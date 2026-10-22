/**
 * Automatic fraud rules (chargeback protection, 2026-10-22).
 *
 * Rules raise fraud flags on the Risk page. HIGH / CRITICAL flags that are
 * still OPEN, INVESTIGATING or FROZEN pause the tutor's payout (see
 * settlementService): the money is carried to the next month, never lost.
 *
 *  CHARGEBACK     a dispute on one of the tutor's payments (HIGH; CRITICAL
 *                 when it is the 2nd+ dispute in the window)
 *  MULTI_ACCOUNT  one card used by many different students
 *  CARD_BLOCKED   a card that already had a chargeback tried again (refused)
 *  VELOCITY       a new tutor reached the card-sales limit (card refused,
 *                 PromptPay still works)
 *  CARD_NO_3DS    a card charge that was paid without 3-D Secure
 */
import { logger } from "@tutor-advantage/shared-config";
import { prisma } from "@tutor-advantage/database";
import {
  DAY_IN_MS,
  PROMPTPAY_METHOD_FILTER,
  PAYOUT_HOLD_FLAG_SEVERITIES,
  PAYOUT_HOLD_FLAG_STATUSES,
  getRiskConfig,
} from "./payoutPolicy";

const ACTIVE_FLAG_STATUSES = ["OPEN", "INVESTIGATING", "MONITORING", "FROZEN"];
const SEVERITY_RANK: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const SYSTEM_ACTOR = "SYSTEM:fraud-rules";

/** Statuses of a payment that "used" a card (counts for card-sharing rules). */
const CARD_USE_STATUSES = ["PENDING", "SUCCESS", "DISPUTED", "REFUNDED", "CHARGEBACKED"];

export type RiskRefusal = { status: number; code: string; message: string };

export async function raiseFraudFlag(input: {
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  targetId: string;
  description: string;
  targetName?: string | null;
}) {
  try {
    const existing = await prisma.fraudFlag.findFirst({
      where: { type: input.type, targetId: input.targetId, status: { in: ACTIVE_FLAG_STATUSES } },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      const escalate = (SEVERITY_RANK[input.severity] ?? 0) > (SEVERITY_RANK[existing.severity] ?? 0);
      const description = `${existing.description ?? ""}\n${new Date().toISOString()} ${input.description}`
        .trim()
        .slice(-4000);
      // A MONITORING flag that gets a new HIGH/CRITICAL signal goes back to OPEN.
      const reopen = escalate && existing.status === "MONITORING";
      await prisma.fraudFlag.update({
        where: { flagId: existing.flagId },
        data: {
          description,
          updatedAt: new Date(),
          ...(escalate ? { severity: input.severity } : {}),
          ...(reopen ? { status: "OPEN" } : {}),
        },
      });
      return { flagId: existing.flagId, created: false, escalated: escalate };
    }

    const flag = await prisma.fraudFlag.create({
      data: {
        type: input.type,
        severity: input.severity,
        targetId: input.targetId,
        targetName: input.targetName ?? null,
        description: `${new Date().toISOString()} ${input.description}`,
        status: "OPEN",
      },
    });
    await prisma.auditEvent.create({
      data: {
        actorId: SYSTEM_ACTOR,
        action: "FRAUD_AUTO_FLAG",
        entityType: "FraudFlag",
        entityId: flag.flagId,
        payload: { type: input.type, severity: input.severity, targetId: input.targetId },
      },
    });
    return { flagId: flag.flagId, created: true, escalated: false };
  } catch (error) {
    // A flag must never break a payment or webhook.
    logger.error("[FraudRules] Could not raise fraud flag:", error);
    return null;
  }
}

/** Tutors whose payout is paused by an unreviewed HIGH/CRITICAL flag. */
export async function getPayoutHeldTutorIds(): Promise<Set<string>> {
  const flags = await prisma.fraudFlag.findMany({
    where: {
      status: { in: PAYOUT_HOLD_FLAG_STATUSES },
      severity: { in: PAYOUT_HOLD_FLAG_SEVERITIES },
    },
    select: { targetId: true },
  });
  return new Set((flags ?? []).map((flag) => flag.targetId));
}

function isTrustedForCards(tutorUserId: string, settings: unknown) {
  if (getRiskConfig().trustedTutorIds.has(tutorUserId)) return true;
  return Boolean(
    settings &&
      typeof settings === "object" &&
      !Array.isArray(settings) &&
      (settings as { cardPaymentsTrusted?: unknown }).cardPaymentsTrusted === true,
  );
}

/**
 * Checks run BEFORE a card is charged. Returns a refusal (HTTP status + code)
 * or null when the charge may go ahead.
 */
export async function checkCardPaymentRisk(input: {
  studentUserId: string;
  tutorUserId: string | null | undefined;
  amountMinor: bigint;
  cardFingerprint: string | null | undefined;
  now?: Date;
}): Promise<RiskRefusal | null> {
  const config = getRiskConfig();
  const now = input.now ?? new Date();
  const tutorId = input.tutorUserId ?? null;

  if (input.cardFingerprint) {
    const chargedBack = await prisma.paymentIntent.count({
      where: {
        cardFingerprint: input.cardFingerprint,
        OR: [{ status: { in: ["CHARGEBACKED", "DISPUTED"] } }, { disputeId: { not: null } }],
      },
    });
    if (chargedBack > 0) {
      if (tutorId) {
        await raiseFraudFlag({
          type: "CARD_BLOCKED",
          severity: "HIGH",
          targetId: tutorId,
          description: `Student ${input.studentUserId} tried a card that already had a chargeback (refused).`,
        });
      }
      return {
        status: 403,
        code: "CARD_NOT_ACCEPTED",
        message: "This card cannot be used. Please pay with PromptPay.",
      };
    }

    const otherStudents = await prisma.paymentIntent.findMany({
      where: {
        cardFingerprint: input.cardFingerprint,
        studentUserId: { not: input.studentUserId },
        status: { in: CARD_USE_STATUSES },
      },
      distinct: ["studentUserId"],
      select: { studentUserId: true },
    });
    const others = otherStudents.length;

    if (others >= config.maxStudentsPerCard) {
      if (tutorId) {
        await raiseFraudFlag({
          type: "MULTI_ACCOUNT",
          severity: "HIGH",
          targetId: tutorId,
          description: `One card was used by ${others + 1} different students (latest ${input.studentUserId}); payment refused.`,
        });
      }
      return {
        status: 403,
        code: "CARD_USAGE_LIMIT",
        message: "This card has been used for too many students. Please pay with PromptPay.",
      };
    }
    if (others >= 2 && tutorId) {
      // Parents paying for siblings is normal; a 3rd student is worth a look.
      await raiseFraudFlag({
        type: "MULTI_ACCOUNT",
        severity: "MEDIUM",
        targetId: tutorId,
        description: `One card used by ${others + 1} different students (latest ${input.studentUserId}).`,
      });
    }
  }

  if (tutorId) {
    const tutor = await prisma.user.findUnique({
      where: { userId: tutorId },
      select: { createdAt: true, settings: true, displayName: true },
    });
    const isNew =
      !tutor?.createdAt ||
      now.getTime() - new Date(tutor.createdAt).getTime() < config.newTutorDays * DAY_IN_MS;

    if (tutor && isNew && !isTrustedForCards(tutorId, tutor.settings)) {
      const since = new Date(now.getTime() - config.cardLimitWindowDays * DAY_IN_MS);
      const recent = await prisma.paymentIntent.aggregate({
        where: {
          earningTutorUserId: tutorId,
          // Any non-PromptPay method counts as card (fail-safe, any letter case).
          NOT: { method: PROMPTPAY_METHOD_FILTER },
          status: { in: ["SUCCESS", "DISPUTED"] },
          paidAt: { gte: since },
        },
        _sum: { amountMinor: true },
      });
      const used = recent?._sum?.amountMinor ?? 0n;
      if (used + input.amountMinor > config.newTutorCardLimitMinor) {
        await raiseFraudFlag({
          type: "VELOCITY",
          severity: "MEDIUM",
          targetId: tutorId,
          targetName: tutor.displayName,
          description: `New tutor reached the card limit (${Number(used) / 100} THB in ${config.cardLimitWindowDays} days); card refused, PromptPay offered.`,
        });
        return {
          status: 403,
          code: "CARD_LIMIT_REACHED",
          message: "Card payment is not available for this class right now. Please pay with PromptPay.",
        };
      }
    }
  }

  return null;
}

/** After a card charge: flag cards paid without 3-D Secure. */
export async function recordCardChargeSignals(input: {
  tutorUserId: string | null | undefined;
  studentUserId: string;
  paymentIntentId: string;
  charge: { paid?: boolean; status?: string; authenticated_by?: string | null };
}) {
  const paid = input.charge.paid || input.charge.status === "successful";
  if (!paid || input.charge.authenticated_by || !input.tutorUserId) return;
  await raiseFraudFlag({
    type: "CARD_NO_3DS",
    severity: "LOW",
    targetId: input.tutorUserId,
    description: `Card payment ${input.paymentIntentId} (student ${input.studentUserId}) was paid without 3-D Secure. Ask Omise to enforce 3DS.`,
  });
}

/** A dispute was opened on one of the tutor's payments. */
export async function flagDispute(input: {
  tutorUserId: string | null | undefined;
  paymentIntentId: string;
  studentUserId: string;
  disputeId: string;
  amountMinor: bigint;
  reason?: string | null;
}) {
  if (!input.tutorUserId) return null;
  const config = getRiskConfig();
  const since = new Date(Date.now() - config.disputeWindowDays * DAY_IN_MS);
  const disputes = await prisma.paymentIntent.count({
    where: {
      earningTutorUserId: input.tutorUserId,
      disputeId: { not: null },
      updatedAt: { gte: since },
    },
  });
  return raiseFraudFlag({
    type: "CHARGEBACK",
    severity: disputes >= 2 ? "CRITICAL" : "HIGH",
    targetId: input.tutorUserId,
    description: `Dispute ${input.disputeId} on payment ${input.paymentIntentId} (student ${input.studentUserId}, ${Number(input.amountMinor) / 100} THB${input.reason ? `, ${input.reason}` : ""}). Disputes in ${config.disputeWindowDays} days: ${disputes}. Payout paused until reviewed.`,
  });
}
