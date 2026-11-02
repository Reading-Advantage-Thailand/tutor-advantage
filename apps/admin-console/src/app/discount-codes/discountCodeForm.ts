/**
 * Pure helpers for /discount-codes (codes that make one class free at
 * checkout): API shapes, create-form validation (same Bangkok end-of-day
 * expiry as coupons), who used a code, and the `?create=1&classId=` deep
 * link from /classes. Codes are issued in batches of single-use codes (one
 * per student) so a forwarded code cannot be reused.
 * Relative imports only so vitest (whose "@" alias points elsewhere) can test it.
 */
import type { AdminClass } from "../classes/classForm";
import { parseExpiryParts, type ExpiryMessages, type ThaiDateParts } from "../coupons/couponForm";

/** POST /v1/discount-codes/batch: codes per request (each code is single-use). */
export const QUANTITY_LIMIT = 100;
export const NOTE_MAX = 500;

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
  /** How many single-use codes to issue (one per student). */
  quantity: string;
  expiry: ThaiDateParts;
  note: string;
}

export type DiscountCodeFormErrors = Partial<Record<"class" | "quantity" | "expiry" | "note", string>>;

export interface DiscountCodeFormMessages extends ExpiryMessages {
  classRequired: string;
  classDemo: string;
  quantity: string;
  noteTooLong: string;
}

/** POST /v1/discount-codes/batch body (every code gets maxRedemptions 1). */
export interface DiscountCodeCreateBody {
  classId: string;
  quantity: number;
  expiresAt?: string;
  note?: string;
}

/**
 * Validates the create form with the API limits (1–100 codes, note ≤ 500,
 * expiry today or later). Returns errors (empty object = valid) and, when
 * valid, the POST /v1/discount-codes/batch body.
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

  const raw = values.quantity.trim();
  const quantity = Number(raw);
  if (!/^\d+$/.test(raw) || quantity < 1 || quantity > QUANTITY_LIMIT) {
    errors.quantity = messages.quantity;
  }

  const note = values.note.trim();
  if (note.length > NOTE_MAX) errors.note = messages.noteTooLong;

  const expiry = parseExpiryParts(values.expiry, messages, now);
  if ("error" in expiry) errors.expiry = expiry.error;

  if (Object.keys(errors).length || !classOption || "error" in expiry) return { errors, body: null };
  const body: DiscountCodeCreateBody = { classId: classOption.classId, quantity };
  if (expiry.expiresAt) body.expiresAt = expiry.expiresAt;
  if (note) body.note = note;
  return { errors, body };
}
