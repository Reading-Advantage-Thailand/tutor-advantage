/**
 * Pure helpers for /discount-codes (codes that make one class free at
 * checkout): API shapes, create-form validation (same Bangkok end-of-day
 * expiry as coupons), who used a code, and the `?create=1&classId=` deep
 * link from /classes. Codes are issued in batches of single-use codes (one
 * per student) so a forwarded code cannot be reused.
 * Each code records what the student already paid by bank transfer
 * (`offlinePaidSatang`): the redemption's payment carries that amount, so the
 * tutor and upline earn on it. 0 (or null on older codes) = a truly free code.
 * Relative imports only so vitest (whose "@" alias points elsewhere) can test it.
 */
import type { AdminClass } from "../classes/classForm";
import { parseExpiryParts, type ExpiryMessages, type ThaiDateParts } from "../coupons/couponForm";

/** POST /v1/discount-codes/batch: codes per request (each code is single-use). */
export const QUANTITY_LIMIT = 100;
export const NOTE_MAX = 500;
/** Amount paid outside the app, per code: 0–10,000 THB (same cap as a class price). */
export const OFFLINE_PAID_MAX_SATANG = 1_000_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Effective status from the API: USED_UP and EXPIRED are derived from an ACTIVE row. */
export type DiscountCodeStatus = "ACTIVE" | "USED_UP" | "EXPIRED" | "VOID";

/** One student who used a code (`DiscountCode.redeemers`, newest first). */
export interface DiscountCodeRedeemer {
  studentUserId: string;
  studentName: string | null;
  studentEmail: string | null;
  studentPhone: string | null;
  redeemedAt: string;
}

/** GET /v1/discount-codes item (finance-mlm-service). */
export interface DiscountCode {
  discountCodeId: string;
  code: string;
  classId: string;
  classTitle: string | null;
  bookCode: string | null;
  packagePriceSatang: number | null;
  tutorUserId: string | null;
  tutorName: string | null;
  tutorEmail: string | null;
  maxRedemptions: number;
  redeemedCount: number;
  remaining: number;
  status: DiscountCodeStatus;
  note: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdByUserId: string;
  createdByName: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  /**
   * What the student paid outside the app (satang), recorded on the payment
   * when the code is used. null = free code (older codes; also absent while
   * an older finance version is deployed).
   */
  offlinePaidSatang?: number | null;
  /** The 3 most recent students who used the code, newest first. */
  redeemers: DiscountCodeRedeemer[];
  lastRedeemedAt: string | null;
}

/** Counts over all codes (ignores the list filters); `redemptions` = students who used a code. */
export interface DiscountCodeSummary {
  total: number;
  ACTIVE: number;
  USED_UP: number;
  EXPIRED: number;
  VOID: number;
  redemptions: number;
}

export interface DiscountCodePage {
  items: DiscountCode[];
  total: number;
  page: number;
  pageSize: number;
  summary?: DiscountCodeSummary;
}

/** GET /v1/discount-codes/:id/redemptions item, newest first. */
export interface DiscountCodeRedemption {
  redemptionId: string;
  studentUserId: string;
  studentName: string | null;
  studentEmail: string | null;
  /** Not every finance version sends it; fall back to `DiscountCode.redeemers`. */
  studentPhone?: string | null;
  enrollmentId: string;
  enrollmentPackageId: string | null;
  enrollmentStatus: string | null;
  paymentIntentId: string;
  originalAmountSatang: number;
  /** Amount of the redemption's payment (what the tutor earns on); absent on older finance versions. */
  paidAmountSatang?: number;
  createdAt: string;
}

/** Who used the code, for a list cell: name, else email, else phone; null when none is known. */
export function redeemerLabel(
  redeemer: Pick<DiscountCodeRedeemer, "studentName" | "studentEmail" | "studentPhone">,
): string | null {
  return redeemer.studentName?.trim() || redeemer.studentEmail?.trim() || redeemer.studentPhone?.trim() || null;
}

/**
 * Newest student who used the code plus how many others did. `redeemers`
 * may be missing while an older finance version is still deployed.
 */
export function latestRedeemer(code: Pick<DiscountCode, "redeemers" | "redeemedCount">): {
  latest: DiscountCodeRedeemer | null;
  others: number;
} {
  const latest = code.redeemers?.[0] ?? null;
  return { latest, others: latest ? Math.max(0, code.redeemedCount - 1) : 0 };
}

/**
 * Phone for a row of the redemptions sheet. The redemptions endpoint may not
 * send it; the code's `redeemers` (newest 3, from the list) do.
 */
export function redemptionPhone(
  item: Pick<DiscountCodeRedemption, "studentUserId" | "studentPhone">,
  code: Pick<DiscountCode, "redeemers"> | null | undefined,
): string | null {
  if (item.studentPhone) return item.studentPhone;
  return code?.redeemers?.find((redeemer) => redeemer.studentUserId === item.studentUserId)?.studentPhone ?? null;
}

/** Only a code that can still be used is worth voiding (USED_UP/EXPIRED already do nothing). */
export function isVoidable(code: Pick<DiscountCode, "status">): boolean {
  return code.status === "ACTIVE";
}

// ─── Amount paid outside the app ───────────────────────────────────────────

/**
 * Baht typed in the offline-amount field → satang. Accepts "3,000", "3000",
 * "฿3,000" and at most two decimals ("2,999.50"); 0 is allowed (a truly free
 * code). null = empty, malformed, negative or above 10,000 THB.
 */
export function parseOfflinePaidBaht(input: string): number | null {
  const cleaned = input.replace(/[,\s฿]/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const satang = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(satang) && satang <= OFFLINE_PAID_MAX_SATANG ? satang : null;
}

/** Satang → the field's text: 300000 → "3,000", 299950 → "2,999.50"; "" for anything else. */
export function satangToBahtInput(satang: number | null | undefined): string {
  if (typeof satang !== "number" || !Number.isSafeInteger(satang) || satang < 0) return "";
  const whole = String(Math.floor(satang / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = satang % 100;
  return fraction ? `${whole}.${String(fraction).padStart(2, "0")}` : whole;
}

/** The class price as the field's text (the usual offline amount); "" when the class has no price. */
export function classPriceBahtInput(classOption: Pick<AdminClass, "packagePriceSatang"> | null | undefined): string {
  const price = classOption?.packagePriceSatang;
  return typeof price === "number" && price > 0 ? satangToBahtInput(price) : "";
}

/** Recorded amount of a code; 0 for a free code (null, or absent on an older finance version). */
export function offlinePaidOf(code: Pick<DiscountCode, "offlinePaidSatang">): number {
  const amount = code.offlinePaidSatang;
  return typeof amount === "number" && amount > 0 ? amount : 0;
}

/** The amount can change only while nobody used the code and it is still usable (the API also allows nothing else). */
export function canEditOfflinePaid(code: Pick<DiscountCode, "status" | "redeemedCount">): boolean {
  return code.status === "ACTIVE" && code.redeemedCount === 0;
}

/**
 * Starting value of the "แก้ยอดที่รับ" field: the recorded amount, or the
 * class price for an older free code (null), which is what the admin is
 * usually about to record. An explicit 0 stays "0".
 */
export function offlinePaidEditDefault(code: Pick<DiscountCode, "offlinePaidSatang" | "packagePriceSatang">): string {
  if (typeof code.offlinePaidSatang === "number") return satangToBahtInput(code.offlinePaidSatang);
  return classPriceBahtInput({ packagePriceSatang: code.packagePriceSatang ?? 0 });
}

/**
 * Something to double-check on the review step: a free code (the tutor and
 * upline earn nothing) or an amount that differs from the class price.
 */
export function offlinePaidWarning(
  offlinePaidSatang: number,
  classPriceSatang: number | null | undefined,
): "free" | "differs" | null {
  if (offlinePaidSatang === 0) return "free";
  if (typeof classPriceSatang === "number" && classPriceSatang > 0 && offlinePaidSatang !== classPriceSatang) return "differs";
  return null;
}

/**
 * Amount line of one redemption: what was recorded on its payment, else
 * (older finance version without `paidAmountSatang`) the discount as before.
 */
export function redemptionAmount(
  item: Pick<DiscountCodeRedemption, "paidAmountSatang" | "originalAmountSatang">,
): { kind: "paid"; satang: number } | { kind: "free"; satang: number } | { kind: "discount"; satang: number } {
  if (typeof item.paidAmountSatang !== "number") return { kind: "discount", satang: item.originalAmountSatang };
  if (item.paidAmountSatang > 0) return { kind: "paid", satang: item.paidAmountSatang };
  return { kind: "free", satang: item.originalAmountSatang };
}

/**
 * Idempotency-Key for saving an amount: a retry of the same amount reuses the
 * key (the API replays it), a different amount gets a new key (the API would
 * otherwise refuse the reused key).
 */
export function offlinePaidAttempt(
  previous: { satang: number; key: string } | null,
  satang: number,
  newKey: () => string,
): { satang: number; key: string } {
  return previous && previous.satang === satang ? previous : { satang, key: newKey() };
}

/** Drops a hand-edited, non-UUID `classId` filter instead of sending it to the API (400). */
export function listQuery(apiQuery: Record<string, string | number>): Record<string, string | number> {
  if (apiQuery.classId === undefined || isUuid(apiQuery.classId)) return apiQuery;
  const { classId: _ignored, ...rest } = apiQuery;
  return rest;
}

interface ParamsLike {
  get(name: string): string | null;
}

/**
 * `?create=1&classId=<uuid>` (row action on /classes): open the create sheet,
 * with that class preselected when the id is a UUID. null = no request.
 */
export function readCreateRequest(params: ParamsLike | null | undefined): { classId: string | null } | null {
  if (!params || params.get("create") !== "1") return null;
  const classId = params.get("classId");
  return { classId: isUuid(classId) ? classId : null };
}

/** The same query string without `create`, so a reload does not reopen the sheet. */
export function withoutCreateParam(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("create");
  return params.toString();
}

export interface DiscountCodeFormValues {
  classOption: AdminClass | null;
  /** Baht the student already paid outside the app, per code, as typed ("3,000"; "0" = free code). */
  offlinePaid: string;
  /** How many single-use codes to issue (one per student). */
  quantity: string;
  expiry: ThaiDateParts;
  note: string;
}

export type DiscountCodeFormErrors = Partial<Record<"class" | "offlinePaid" | "quantity" | "expiry" | "note", string>>;

export interface DiscountCodeFormMessages extends ExpiryMessages {
  classRequired: string;
  classDemo: string;
  offlinePaid: string;
  quantity: string;
  noteTooLong: string;
}

/** POST /v1/discount-codes/batch body (every code gets maxRedemptions 1). */
export interface DiscountCodeCreateBody {
  classId: string;
  quantity: number;
  /** Paid outside the app per code (0–1,000,000 satang), recorded on the payment when the code is used. */
  offlinePaidSatang: number;
  expiresAt?: string;
  note?: string;
}

/**
 * Picks (or clears) the class. The offline amount follows the class price
 * until the admin has typed an amount of their own (`amountTyped`).
 */
export function withClassOption(
  values: DiscountCodeFormValues,
  classOption: AdminClass | null,
  amountTyped: boolean,
): DiscountCodeFormValues {
  if (amountTyped) return { ...values, classOption };
  return { ...values, classOption, offlinePaid: classPriceBahtInput(classOption) };
}

/**
 * Validates the create form with the API limits (1–100 codes, 0–10,000 THB
 * paid per code, note ≤ 500, expiry today or later). Returns errors (empty
 * object = valid) and, when valid, the POST /v1/discount-codes/batch body.
 */
export function validateDiscountCodeForm(
  values: DiscountCodeFormValues,
  messages: DiscountCodeFormMessages,
  { now = new Date() }: { now?: Date } = {},
): { errors: DiscountCodeFormErrors; body: DiscountCodeCreateBody | null } {
  const errors: DiscountCodeFormErrors = {};

  const classOption = values.classOption;
  if (!classOption) errors.class = messages.classRequired;
  else if (classOption.isDemo) errors.class = messages.classDemo;

  // Required: "0" is a deliberate free code, an empty field is not.
  const offlinePaidSatang = parseOfflinePaidBaht(values.offlinePaid);
  if (offlinePaidSatang === null) errors.offlinePaid = messages.offlinePaid;

  const raw = values.quantity.trim();
  const quantity = Number(raw);
  if (!/^\d+$/.test(raw) || quantity < 1 || quantity > QUANTITY_LIMIT) {
    errors.quantity = messages.quantity;
  }

  const note = values.note.trim();
  if (note.length > NOTE_MAX) errors.note = messages.noteTooLong;

  const expiry = parseExpiryParts(values.expiry, messages, now);
  if ("error" in expiry) errors.expiry = expiry.error;

  if (Object.keys(errors).length || !classOption || offlinePaidSatang === null || "error" in expiry) {
    return { errors, body: null };
  }
  const body: DiscountCodeCreateBody = { classId: classOption.classId, quantity, offlinePaidSatang };
  if (expiry.expiresAt) body.expiresAt = expiry.expiresAt;
  if (note) body.note = note;
  return { errors, body };
}
