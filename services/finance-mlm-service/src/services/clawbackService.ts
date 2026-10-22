/**
 * Commission clawback after a refund or chargeback on a payment whose
 * commission was ALREADY paid (payment stamped with an approved run).
 *
 * Payments still inside their hold period need no clawback: the refund /
 * dispute simply removes them from the next settlement.
 *
 * The amount is estimated from the approved run itself: the tutor's group
 * volume is reduced by the lost amount and the classic differential formula
 * (Payout = max(0, R(GV) * GV - total paid in the downline organisations))
 * is re-applied up the sponsor chain. Each tutor is charged at most what they were paid.
 * The upline share is clawed back too, so a fake downline cannot keep the
 * override commission.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@tutor-advantage/database";
import { calculateCommissionInfo, calculatePayoutMinor } from "./commissionService";
import {
  findOrCreateMutableRun,
  getFollowingIctPeriodMonth,
} from "./adjustmentRunService";

export type ClawbackKind = "refund" | "chargeback";

export interface ClawbackItem {
  tutorUserId: string;
  /** Positive amount to take back, in satang. */
  amountMinor: bigint;
}

const SYSTEM_ACTOR = "SYSTEM:payment-risk";

function payoutAtVolume(volumeMinor: bigint) {
  if (volumeMinor <= 0n) return 0n;
  const rate = calculateCommissionInfo(Number(volumeMinor) / 100).rate;
  return calculatePayoutMinor(volumeMinor, rate);
}

const max0 = (value: bigint) => (value < 0n ? 0n : value);

export async function estimateCommissionClawbacks(input: {
  settlementRunId: string;
  earningTutorUserId: string;
  lossMinor: bigint;
}): Promise<ClawbackItem[]> {
  const { settlementRunId, earningTutorUserId, lossMinor } = input;
  if (lossMinor <= 0n) return [];

  const [lines, adjustments] = await Promise.all([
    prisma.payoutLine.findMany({
      where: { settlementRunId },
      select: {
        tutorUserId: true,
        grossVolumeMinor: true,
        payoutAmountMinor: true,
        badgeBonusMinor: true,
      },
    }),
    prisma.adjustment.findMany({
      where: { settlementRunId, status: "APPROVED" },
      select: { tutorUserId: true, amountMinor: true },
    }),
  ]);

  const lineByTutor = new Map(lines.map((line) => [line.tutorUserId, line]));
  // A tutor without a line had no counted volume: nothing was paid on it.
  if (!lineByTutor.has(earningTutorUserId)) return [];

  const adjustmentByTutor = new Map<string, bigint>();
  for (const adjustment of adjustments) {
    adjustmentByTutor.set(
      adjustment.tutorUserId,
      (adjustmentByTutor.get(adjustment.tutorUserId) ?? 0n) + adjustment.amountMinor,
    );
  }

  // Sponsor chain (nearest ancestors that were part of the run).
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | null = earningTutorUserId;
  while (current && !seen.has(current) && seen.size < 64) {
    seen.add(current);
    if (lineByTutor.has(current)) chain.push(current);
    const user: { sponsorTutorId: string | null } | null = await prisma.user.findUnique({
      where: { userId: current },
      select: { sponsorTutorId: true },
    });
    current = user?.sponsorTutorId ?? null;
  }

  const items: ClawbackItem[] = [];
  // Total paid in the previous chain node's organisation, before / after.
  let childOldOrg: bigint | null = null;
  let childNewOrg: bigint | null = null;

  for (const tutorUserId of chain) {
    const line = lineByTutor.get(tutorUserId)!;
    // Commission part of the line (without adjustments / badge bonus).
    const oldBase = max0(
      line.payoutAmountMinor -
        (adjustmentByTutor.get(tutorUserId) ?? 0n) -
        (line.badgeBonusMinor ?? 0n),
    );
    const gv = line.grossVolumeMinor;
    const newGv = max0(gv - lossMinor);

    // What the downline organisations were paid (R(GV)*GV - own payout).
    const oldChildren: bigint = max0(payoutAtVolume(gv) - oldBase);
    const newChildren: bigint =
      childOldOrg === null || childNewOrg === null
        ? oldChildren
        : max0(oldChildren - childOldOrg + childNewOrg);

    let newBase = max0(payoutAtVolume(newGv) - newChildren);
    if (oldBase === 0n) newBase = 0n; // not paid (ineligible / clamped)
    if (newBase > oldBase) newBase = oldBase; // never pay anyone extra here

    const claw = oldBase - newBase;
    if (claw > 0n) items.push({ tutorUserId, amountMinor: claw });

    childOldOrg = oldChildren + oldBase;
    childNewOrg = newChildren + newBase;
  }

  return items;
}

function clawbackReasonPrefix(kind: ClawbackKind, paymentIntentId: string, eventRef: string) {
  return `${kind}:${paymentIntentId}:${eventRef}:`;
}

/**
 * Creates one APPROVED negative adjustment per affected tutor in the first
 * mutable run after the run that paid the commission. Idempotent per
 * (kind, payment, provider event ref). Returns the adjustments created.
 */
export async function createCommissionClawback(input: {
  kind: ClawbackKind;
  paymentIntentId: string;
  eventRef: string;
  settlementRunId: string;
  earningTutorUserId: string;
  lossMinor: bigint;
}) {
  const prefix = clawbackReasonPrefix(input.kind, input.paymentIntentId, input.eventRef);
  const existing = await prisma.adjustment.findFirst({
    where: { reason: { startsWith: prefix } },
    select: { adjustmentId: true },
  });
  if (existing) return [];

  const items = await estimateCommissionClawbacks({
    settlementRunId: input.settlementRunId,
    earningTutorUserId: input.earningTutorUserId,
    lossMinor: input.lossMinor,
  });
  if (items.length === 0) return [];

  const paidRun = await prisma.settlementRun.findUnique({
    where: { settlementRunId: input.settlementRunId },
    select: { periodMonth: true },
  });
  if (!paidRun) throw new Error("SETTLEMENT_RUN_NOT_FOUND");

  const target = await findOrCreateMutableRun(
    prisma as unknown as Prisma.TransactionClient,
    getFollowingIctPeriodMonth(paidRun.periodMonth),
    "payment-webhook",
  );

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const created = [];
    for (const item of items) {
      created.push(
        await tx.adjustment.create({
          data: {
            settlementRunId: target.settlementRunId,
            tutorUserId: item.tutorUserId,
            amountMinor: -item.amountMinor,
            // Commission is reclaimed directly; the old payment's volume must
            // not also lower this period's tier rate.
            volumeMinor: 0n,
            reason: `${prefix}${item.tutorUserId}`,
            status: "APPROVED",
            createdBy: SYSTEM_ACTOR,
            approvedBy: SYSTEM_ACTOR,
            approvedAt: now,
          },
        }),
      );
    }
    return created;
  });
}

/**
 * A dispute was won after its clawback: give the money back through PENDING
 * positive adjustments (finance approves them like any other credit).
 */
export async function reverseCommissionClawback(input: {
  paymentIntentId: string;
  eventRef: string;
}) {
  const prefix = clawbackReasonPrefix("chargeback", input.paymentIntentId, input.eventRef);
  const reversalPrefix = `chargeback-reversal:${input.paymentIntentId}:${input.eventRef}:`;
  const [clawbacks, reversed] = await Promise.all([
    prisma.adjustment.findMany({
      where: { reason: { startsWith: prefix }, status: "APPROVED" },
      select: { tutorUserId: true, amountMinor: true, settlementRunId: true },
    }),
    prisma.adjustment.findFirst({
      where: { reason: { startsWith: reversalPrefix } },
      select: { adjustmentId: true },
    }),
  ]);
  if (reversed || clawbacks.length === 0) return [];

  const run = await prisma.settlementRun.findUnique({
    where: { settlementRunId: clawbacks[0].settlementRunId },
    select: { periodMonth: true },
  });
  const target = await findOrCreateMutableRun(
    prisma as unknown as Prisma.TransactionClient,
    run?.periodMonth ?? new Date().toISOString().slice(0, 7),
    "payment-webhook",
  );

  return prisma.$transaction(async (tx) => {
    const created = [];
    for (const clawback of clawbacks) {
      created.push(
        await tx.adjustment.create({
          data: {
            settlementRunId: target.settlementRunId,
            tutorUserId: clawback.tutorUserId,
            amountMinor: -clawback.amountMinor,
            volumeMinor: 0n,
            reason: `${reversalPrefix}${clawback.tutorUserId}`,
            status: "PENDING",
            createdBy: SYSTEM_ACTOR,
          },
        }),
      );
    }
    return created;
  });
}
