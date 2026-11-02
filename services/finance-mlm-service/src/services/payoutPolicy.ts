/**
 * Payout risk policy (chargeback protection, 2026-10-22).
 *
 * All numbers can be changed with environment variables without a code
 * change. Defaults are deliberately conservative for the launch period.
 *
 *  PAYOUT_HOLD_DAYS_CARD            days a card payment waits before its
 *                                    commission is paid (default 60)
 *  PAYOUT_HOLD_DAYS_OTHER           same for PromptPay and DISCOUNT_CODE (default
 *                                    7). Neither can be charged back: PromptPay is a
 *                                    bank push payment, and a discount code payment
 *                                    records money the student already sent by bank
 *                                    transfer before the code was issued. Fail-safe:
 *                                    only these two methods (any letter case) get
 *                                    this short hold; every other or unknown method
 *                                    waits as long as a card.
 *  RISK_MAX_STUDENTS_PER_CARD       how many different students may use one
 *                                    card (default 3; the 4th is refused)
 *  RISK_NEW_TUTOR_DAYS              a tutor account younger than this is "new"
 *                                    (default 90)
 *  RISK_NEW_TUTOR_CARD_LIMIT_THB    card sales a new tutor may take in any 30
 *                                    days (default 30000 THB); PromptPay and
 *                                    discount code payments are not card sales
 *  RISK_CARD_TRUSTED_TUTOR_IDS      comma-separated tutor ids exempt from the
 *                                    new-tutor card limit (admins can also set
 *                                    settings.cardPaymentsTrusted via the API)
 *  RISK_DISPUTE_WINDOW_DAYS         disputes counted for escalation (default 90)
 */
import type { Prisma } from "@prisma/client";
import { getIctMonthWindow } from "./commissionService";
import { DISCOUNT_CODE_METHOD } from "./paymentMethods";

const DAY_MS = 24 * 60 * 60 * 1000;

function intEnv(name: string, fallback: number, min = 0, max = 3650) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

/**
 * Methods with no card chargeback risk, lower case: PromptPay (bank push
 * payment) and DISCOUNT_CODE (the student paid by bank transfer outside the
 * system; there is no charge to dispute). They are the only short-hold
 * methods and are not card sales.
 */
const NO_CHARGEBACK_METHODS: readonly string[] = ["promptpay", DISCOUNT_CODE_METHOD.toLowerCase()];

/** True for PromptPay and DISCOUNT_CODE in any letter case; every other method is held like a card. */
export function isShortHoldMethod(method?: string | null) {
  return NO_CHARGEBACK_METHODS.includes((method ?? "").trim().toLowerCase());
}

export function getPayoutHoldDays(method?: string | null) {
  return isShortHoldMethod(method)
    ? intEnv("PAYOUT_HOLD_DAYS_OTHER", 7)
    : intEnv("PAYOUT_HOLD_DAYS_CARD", 60);
}

/**
 * Prisma twin of isShortHoldMethod: PromptPay or DISCOUNT_CODE in any letter
 * case (legacy rows use "PROMPTPAY"). Negate it with `NOT` for card-like
 * methods; a NULL method is never stored (the column is NOT NULL).
 *
 * An `in` list, not `equals` + insensitive: on PostgreSQL Prisma turns an
 * insensitive `equals` into ILIKE, where the `_` of "discount_code" matches
 * any character, so another method could slip into the short hold. `in` +
 * insensitive compares LOWER(method) exactly.
 */
export const NO_CHARGEBACK_METHOD_WHERE: Prisma.PaymentIntentWhereInput = {
  method: { in: [...NO_CHARGEBACK_METHODS], mode: "insensitive" },
};

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
  const matured: Prisma.PaymentIntentWhereInput = {
    OR: [
      { AND: [NO_CHARGEBACK_METHOD_WHERE], paidAt: { lte: maturedPaidAtCutoff(end, "promptpay") } },
      { NOT: NO_CHARGEBACK_METHOD_WHERE, paidAt: { lte: maturedPaidAtCutoff(end, "card") } },
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
