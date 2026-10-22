/**
 * Refunds and chargebacks (Omise "disputes"), chargeback protection 2026-10-22.
 *
 * Omise sends dispute.create / dispute.update / dispute.accept / dispute.close
 * and refund.create events. Their `data` is a dispute or refund object whose
 * `charge` field points at our charge; it carries none of our metadata. Every
 * event is treated as a notification only: the dispute / charge is fetched
 * from Omise again and matched to the stored payment before anything changes.
 *
 * What happens:
 *  - dispute opened  -> payment DISPUTED (excluded from settlement while open),
 *                       tutor flagged (payout paused), clawback if the
 *                       commission was already paid
 *  - dispute lost    -> payment CHARGEBACKED, student access revoked
 *  - dispute won     -> payment SUCCESS again (commission paid in a later run),
 *                       earlier clawback reversed through PENDING credits
 *  - refund          -> refunded amount recorded (partial refunds reduce the
 *                       volume), full refund = REFUNDED + access revoked,
 *                       clawback if the commission was already paid
 */
import { logger } from "@tutor-advantage/shared-config";
import { prisma } from "@tutor-advantage/database";
import type { Prisma } from "@prisma/client";
import {
  listOmiseDisputes,
  listOmiseRefunds,
  omiseRefId,
  retrieveOmiseCharge,
  retrieveOmiseDispute,
  type OmiseCharge,
  type OmiseDispute,
  type OmiseRefund,
} from "./omiseService";
import { createCommissionClawback, reverseCommissionClawback } from "./clawbackService";
import { flagDispute } from "./fraudRules";
import { DAY_IN_MS } from "./payoutPolicy";

type IntentRow = {
  paymentIntentId: string;
  enrollmentId: string;
  enrollmentPackageId: string | null;
  studentUserId: string;
  earningTutorUserId: string | null;
  amountMinor: bigint;
  currency: string;
  status: string;
  providerRef: string | null;
  refundedAmountMinor?: bigint | null;
  disputeId?: string | null;
  commissionSettlementRunId?: string | null;
};

export type RiskOutcome = {
  paymentIntentId: string | null;
  outcome: string;
};

export type OmiseEventKind = "charge" | "dispute" | "refund";

export function classifyOmiseEvent(payload: unknown) {
  const body = (payload && typeof payload === "object" ? payload : {}) as Record<string, any>;
  const key = String(body.key || body.type || "");
  const data = (body.data && typeof body.data === "object" ? body.data : body) as Record<string, any>;
  const objectType = typeof data.object === "string" ? data.object : "";
  let kind: OmiseEventKind = "charge";
  if (objectType === "dispute" || key.startsWith("dispute.")) kind = "dispute";
  else if (objectType === "refund" || key.startsWith("refund.")) kind = "refund";
  return {
    kind,
    key,
    objectId: typeof data.id === "string" ? data.id : null,
    chargeId: kind === "charge" ? (typeof data.id === "string" ? data.id : null) : omiseRefId(data.charge),
    data,
  };
}

/**
 * Re-reads the charge from Omise and checks it belongs to the stored intent
 * (id, amount, currency, our paymentIntentId metadata). Null = no match.
 */
export async function retrieveAndVerifyOmiseCharge(paymentIntentId: string, providerRef: string) {
  const intent = await prisma.paymentIntent.findUnique({
    where: { paymentIntentId },
    select: {
      paymentIntentId: true,
      providerRef: true,
      amountMinor: true,
      currency: true,
    },
  });
  if (!intent || !intent.providerRef || intent.providerRef !== providerRef) {
    return null;
  }

  const charge = await retrieveOmiseCharge(providerRef);
  let chargeAmount: bigint;
  try {
    chargeAmount = BigInt(charge.amount);
  } catch {
    return null;
  }

  if (
    typeof charge.currency !== "string" ||
    charge.id !== intent.providerRef ||
    chargeAmount !== intent.amountMinor ||
    charge.currency.toUpperCase() !== intent.currency.toUpperCase() ||
    charge.metadata?.paymentIntentId !== intent.paymentIntentId
  ) {
    logger.warn(
      `[PaymentWebhook] Omise charge ${providerRef} did not match payment intent ${paymentIntentId}`,
    );
    return null;
  }

  return charge;
}

async function findIntentByCharge(chargeId: string | null): Promise<IntentRow | null> {
  if (!chargeId) return null;
  return (await prisma.paymentIntent.findFirst({
    where: { providerRef: chargeId },
    orderBy: { createdAt: "desc" },
  })) as IntentRow | null;
}

/** Revokes the class access bought by this payment (inside a transaction). */
export async function revokeAccessForPayment(tx: Prisma.TransactionClient, intent: IntentRow) {
  if (intent.enrollmentPackageId) {
    await tx.enrollmentPackage.updateMany({
      where: {
        enrollmentPackageId: intent.enrollmentPackageId,
        status: { in: ["PENDING_PAYMENT", "ACTIVE"] },
      },
      data: { status: "REVOKED" },
    });
    return;
  }

  const revoked = await tx.enrollment.updateMany({
    where: {
      enrollmentId: intent.enrollmentId,
      status: { in: ["PENDING_PAYMENT", "ACTIVE"] },
    },
    data: { status: "REVOKED", paymentExpiresAt: null },
  });

  await tx.enrollmentPackage.updateMany({
    where: {
      enrollmentId: intent.enrollmentId,
      status: { in: ["PENDING_PAYMENT", "ACTIVE"] },
    },
    data: { status: "REVOKED" },
  });

  if (revoked.count > 0) {
    const enrollment = await tx.enrollment.findUnique({
      where: { enrollmentId: intent.enrollmentId },
      select: { classId: true, class: { select: { enrolledCount: true } } },
    });
    if (enrollment) {
      await tx.class.update({
        where: { classId: enrollment.classId },
        data: {
          enrolledCount: Math.max(0, enrollment.class.enrolledCount - revoked.count),
        },
      });
    }
  }
}

async function earningTutorOf(intent: IntentRow) {
  if (intent.earningTutorUserId) return intent.earningTutorUserId;
  const enrollment = await prisma.enrollment.findUnique({
    where: { enrollmentId: intent.enrollmentId },
    select: { class: { select: { tutorUserId: true } } },
  });
  return enrollment?.class?.tutorUserId ?? null;
}

async function clawbackIfPaid(intent: IntentRow, kind: "refund" | "chargeback", eventRef: string, lossMinor: bigint) {
  if (!intent.commissionSettlementRunId || lossMinor <= 0n) return 0;
  const tutorId = await earningTutorOf(intent);
  if (!tutorId) return 0;
  const created = await createCommissionClawback({
    kind,
    paymentIntentId: intent.paymentIntentId,
    eventRef,
    settlementRunId: intent.commissionSettlementRunId,
    earningTutorUserId: tutorId,
    lossMinor,
  });
  return created.length;
}

function netAmount(intent: IntentRow) {
  const net = intent.amountMinor - (intent.refundedAmountMinor ?? 0n);
  return net < 0n ? 0n : net;
}

/** Applies an (already fetched) Omise dispute. */
export async function applyDispute(dispute: OmiseDispute, eventKey = ""): Promise<RiskOutcome> {
  const chargeId = omiseRefId(dispute.charge);
  const intent = await findIntentByCharge(chargeId);
  if (!intent || !chargeId) {
    logger.warn(`[PaymentRisk] Dispute ${dispute.id} has no matching payment (charge ${chargeId})`);
    return { paymentIntentId: null, outcome: "UNMAPPED" };
  }
  const verified = await retrieveAndVerifyOmiseCharge(intent.paymentIntentId, chargeId);
  if (!verified) return { paymentIntentId: intent.paymentIntentId, outcome: "CHARGE_MISMATCH" };

  const status = String(dispute.status || "").toLowerCase();
  const lost = status === "lost" || status === "closed" || eventKey === "dispute.accept";
  const won = status === "won";
  const paidStatuses = ["SUCCESS", "DISPUTED", "CHARGEBACKED"];
  if (!paidStatuses.includes(intent.status)) {
    // Never fulfilled or already refunded: nothing to hold, keep the dispute id.
    await prisma.paymentIntent.update({
      where: { paymentIntentId: intent.paymentIntentId },
      data: { disputeId: dispute.id },
    });
    return { paymentIntentId: intent.paymentIntentId, outcome: `IGNORED_${intent.status}` };
  }

  if (won) {
    if (intent.status === "DISPUTED" || intent.status === "CHARGEBACKED") {
      await prisma.paymentIntent.updateMany({
        where: { paymentIntentId: intent.paymentIntentId, status: { in: ["DISPUTED", "CHARGEBACKED"] } },
        data: { status: "SUCCESS", disputeId: dispute.id },
      });
    }
    const reversed = await reverseCommissionClawback({
      paymentIntentId: intent.paymentIntentId,
      eventRef: dispute.id,
    });
    return {
      paymentIntentId: intent.paymentIntentId,
      outcome: intent.status === "CHARGEBACKED" ? "WON_ACCESS_NEEDS_MANUAL_RESTORE" : `WON_REVERSED_${reversed.length}`,
    };
  }

  const firstNotice = intent.disputeId !== dispute.id;
  if (lost) {
    await prisma.$transaction(async (tx) => {
      await tx.paymentIntent.update({
        where: { paymentIntentId: intent.paymentIntentId },
        data: { status: "CHARGEBACKED", disputeId: dispute.id },
      });
      if (intent.status !== "CHARGEBACKED") await revokeAccessForPayment(tx, intent);
    });
  } else {
    await prisma.paymentIntent.update({
      where: { paymentIntentId: intent.paymentIntentId },
      data: { status: "DISPUTED", disputeId: dispute.id },
    });
  }

  const loss = BigInt(Math.min(Number(dispute.amount ?? netAmount(intent)), Number(netAmount(intent))));
  const clawbacks = await clawbackIfPaid(intent, "chargeback", dispute.id, loss);

  if (firstNotice || lost) {
    await flagDispute({
      tutorUserId: await earningTutorOf(intent),
      paymentIntentId: intent.paymentIntentId,
      studentUserId: intent.studentUserId,
      disputeId: dispute.id,
      amountMinor: loss,
      reason: dispute.reason_code ?? null,
    });
  }

  return {
    paymentIntentId: intent.paymentIntentId,
    outcome: `${lost ? "LOST" : "OPEN"}_CLAWBACK_${clawbacks}`,
  };
}

/**
 * Applies the refunded amount of a verified charge. `eventRef` makes the
 * clawback idempotent (refund id, or the charge's refunded total).
 */
export async function applyRefundedCharge(
  intent: IntentRow,
  charge: Pick<OmiseCharge, "refunded_amount">,
  eventRef: string,
): Promise<RiskOutcome> {
  const total = BigInt(Math.max(0, Number(charge.refunded_amount ?? 0)));
  const previous = intent.refundedAmountMinor ?? 0n;
  if (total <= previous) {
    return { paymentIntentId: intent.paymentIntentId, outcome: "REFUND_ALREADY_APPLIED" };
  }
  const delta = total - previous;
  const full = total >= intent.amountMinor;
  const paidStatus = ["SUCCESS", "DISPUTED"].includes(intent.status);

  await prisma.$transaction(async (tx) => {
    await tx.paymentIntent.update({
      where: { paymentIntentId: intent.paymentIntentId },
      data: {
        refundedAmountMinor: total,
        ...(full && paidStatus ? { status: "REFUNDED" } : {}),
      },
    });
    if (full && paidStatus) await revokeAccessForPayment(tx, intent);
  });

  const clawbacks = paidStatus || intent.status === "REFUNDED"
    ? await clawbackIfPaid(intent, "refund", eventRef, delta)
    : 0;

  return {
    paymentIntentId: intent.paymentIntentId,
    outcome: `${full ? "FULL" : "PARTIAL"}_REFUND_CLAWBACK_${clawbacks}`,
  };
}

/** Applies an Omise refund object (refund.create event or the daily sync). */
export async function applyRefund(refund: Pick<OmiseRefund, "id" | "charge">): Promise<RiskOutcome> {
  const chargeId = omiseRefId(refund.charge);
  const intent = await findIntentByCharge(chargeId);
  if (!intent || !chargeId) {
    logger.warn(`[PaymentRisk] Refund ${refund.id} has no matching payment (charge ${chargeId})`);
    return { paymentIntentId: null, outcome: "UNMAPPED" };
  }
  const charge = await retrieveAndVerifyOmiseCharge(intent.paymentIntentId, chargeId);
  if (!charge) return { paymentIntentId: intent.paymentIntentId, outcome: "CHARGE_MISMATCH" };
  return applyRefundedCharge(intent, charge, refund.id);
}

/** Webhook entry point for dispute.* and refund.* events. */
export async function handleDisputeOrRefundEvent(
  classified: ReturnType<typeof classifyOmiseEvent>,
): Promise<RiskOutcome> {
  if (classified.kind === "dispute") {
    if (!classified.objectId) return { paymentIntentId: null, outcome: "NO_DISPUTE_ID" };
    const dispute = await retrieveOmiseDispute(classified.objectId);
    return applyDispute(dispute, classified.key);
  }
  if (classified.kind === "refund") {
    if (!classified.objectId) return { paymentIntentId: null, outcome: "NO_REFUND_ID" };
    return applyRefund({ id: classified.objectId, charge: classified.chargeId });
  }
  return { paymentIntentId: null, outcome: "NOT_A_RISK_EVENT" };
}

/**
 * Daily safety net (Cloud Scheduler): pulls disputes and refunds from Omise
 * so a missed webhook cannot leave a chargeback unnoticed, and re-checks
 * every open dispute.
 */
export async function syncDisputesAndRefunds(options: { sinceDays?: number } = {}) {
  const sinceDays = options.sinceDays ?? 45;
  const from = new Date(Date.now() - sinceDays * DAY_IN_MS);
  const summary = { disputes: 0, refunds: 0, openDisputesRechecked: 0, errors: 0, outcomes: {} as Record<string, number> };
  const count = (outcome: string) => {
    const key = outcome.replace(/_\d+$/, "");
    summary.outcomes[key] = (summary.outcomes[key] ?? 0) + 1;
  };

  const seenDisputes = new Set<string>();
  for (const dispute of await listOmiseDisputes(from)) {
    seenDisputes.add(dispute.id);
    try {
      count((await applyDispute(dispute)).outcome);
      summary.disputes += 1;
    } catch (error) {
      summary.errors += 1;
      logger.error(`[PaymentRisk] Sync failed for dispute ${dispute.id}:`, error);
    }
  }

  const openLocal = await prisma.paymentIntent.findMany({
    where: { status: "DISPUTED", disputeId: { not: null } },
    select: { disputeId: true },
  });
  for (const row of openLocal) {
    if (!row.disputeId || seenDisputes.has(row.disputeId)) continue;
    try {
      count((await applyDispute(await retrieveOmiseDispute(row.disputeId))).outcome);
      summary.openDisputesRechecked += 1;
    } catch (error) {
      summary.errors += 1;
      logger.error(`[PaymentRisk] Re-check failed for dispute ${row.disputeId}:`, error);
    }
  }

  for (const refund of await listOmiseRefunds(from)) {
    try {
      count((await applyRefund(refund)).outcome);
      summary.refunds += 1;
    } catch (error) {
      summary.errors += 1;
      logger.error(`[PaymentRisk] Sync failed for refund ${refund.id}:`, error);
    }
  }

  return summary;
}
