/**
 * Payout risk policy (chargeback protection, 2026-10-22).
 *
 * All numbers can be changed with environment variables without a code
 * change. Defaults are deliberately conservative for the launch period.
 *
 *  PAYOUT_HOLD_DAYS_CARD            days a card payment waits before its
 *                                    commission is paid (default 60)
 *  PAYOUT_HOLD_DAYS_OTHER           same for PromptPay / other methods (default 7)
 *  RISK_MAX_STUDENTS_PER_CARD       how many different students may use one
 *                                    card (default 3; the 4th is refused)
 *  RISK_NEW_TUTOR_DAYS              a tutor account younger than this is "new"
 *                                    (default 90)
 *  RISK_NEW_TUTOR_CARD_LIMIT_THB    card sales a new tutor may take in any 30
 *                                    days (default 30000 THB); PromptPay is unlimited
 *  RISK_CARD_TRUSTED_TUTOR_IDS      comma-separated tutor ids exempt from the
 *                                    new-tutor card limit (admins can also set
 *                                    settings.cardPaymentsTrusted via the API)
 *  RISK_DISPUTE_WINDOW_DAYS         disputes counted for escalation (default 90)
 */
import type { Prisma } from "@prisma/client";
import { getIctMonthWindow } from "./commissionService";

const DAY_MS = 24 * 60 * 60 * 1000;

function intEnv(name: string, fallback: number, min = 0, max = 3650) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

export function getPayoutHoldDays(method?: string | null) {
  return method === "card"
    ? intEnv("PAYOUT_HOLD_DAYS_CARD", 60)
    : intEnv("PAYOUT_HOLD_DAYS_OTHER", 7);
}

/** When the commission of a payment may first be paid. */
export function commissionMaturityDate(paidAt: Date, method?: string | null) {
  return new Date(paidAt.getTime() + getPayoutHoldDays(method) * DAY_MS);
}

/** Latest paidAt that has finished its hold period by `cutoff`. */
export function maturedPaidAtCutoff(cutoff: Date, method?: string | null) {
  return new Date(cutoff.getTime() - getPayoutHoldDays(method) * DAY_MS);
}

/**
 * Payments whose commission belongs to the settlement of `periodMonth`:
 * successful, not yet paid by an approved run, and past their hold period
 * by the end of the month. A payment that missed its month (for example a
 * dispute that was later won) is picked up by the next settlement.
 * `ownRunId` keeps payments already stamped with this period's run.
 */
export function buildSettlementPaymentWhere(
  periodMonth: string,
  ownRunId?: string | null,
): Prisma.PaymentIntentWhereInput {
  const { end } = getIctMonthWindow(periodMonth);
  const matured = {
    OR: [
      { method: "card", paidAt: { lte: maturedPaidAtCutoff(end, "card") } },
      { method: { not: "card" }, paidAt: { lte: maturedPaidAtCutoff(end, "other") } },
    ],
  };
  return {
    status: "SUCCESS",
    OR: [
      { AND: [{ commissionSettlementRunId: null }, matured] },
      ...(ownRunId ? [{ commissionSettlementRunId: ownRunId }] : []),
    ],
  };
}

export function getRiskConfig() {
  const trusted = (process.env.RISK_CARD_TRUSTED_TUTOR_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return {
    maxStudentsPerCard: intEnv("RISK_MAX_STUDENTS_PER_CARD", 3, 1, 100),
    newTutorDays: intEnv("RISK_NEW_TUTOR_DAYS", 90),
    newTutorCardLimitMinor: BigInt(intEnv("RISK_NEW_TUTOR_CARD_LIMIT_THB", 30000, 0, 100_000_000)) * 100n,
    cardLimitWindowDays: 30,
    disputeWindowDays: intEnv("RISK_DISPUTE_WINDOW_DAYS", 90, 1, 3650),
    trustedTutorIds: new Set(trusted),
  };
}

/** Fraud flags that pause a tutor's payout until an admin reviews them. */
export const PAYOUT_HOLD_FLAG_STATUSES = ["OPEN", "INVESTIGATING", "FROZEN"];
export const PAYOUT_HOLD_FLAG_SEVERITIES = ["HIGH", "CRITICAL"];
export const HELD_ELIGIBILITY_STATUS = "HELD_FRAUD_REVIEW";

export function isHeldEligibility(status: string | null | undefined) {
  return typeof status === "string" && status.startsWith("HELD_");
}

export const DAY_IN_MS = DAY_MS;
