/**
 * Pure helpers for /discount-codes (codes that make one class free at
 * checkout): API shapes, create-form validation (same Bangkok end-of-day
 * expiry as coupons) and the `?create=1&classId=` deep link from /classes.
 * Relative imports only so vitest (whose "@" alias points elsewhere) can test it.
 */
import type { AdminClass } from "../classes/classForm";
import { parseExpiryParts, type ExpiryMessages, type ThaiDateParts } from "../coupons/couponForm";

export const MAX_REDEMPTIONS_LIMIT = 500;
export const NOTE_MAX = 500;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Effective status from the API: USED_UP and EXPIRED are derived from an ACTIVE row. */
export type DiscountCodeStatus = "ACTIVE" | "USED_UP" | "EXPIRED" | "VOID";

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
  enrollmentId: string;
  enrollmentPackageId: string | null;
  enrollmentStatus: string | null;
  paymentIntentId: string;
  originalAmountSatang: number;
  createdAt: string;
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
  maxRedemptions: string;
  expiry: ThaiDateParts;
  note: string;
}

export type DiscountCodeFormErrors = Partial<Record<"class" | "maxRedemptions" | "expiry" | "note", string>>;

export interface DiscountCodeFormMessages extends ExpiryMessages {
  classRequired: string;
  classDemo: string;
  maxRedemptions: string;
  noteTooLong: string;
}

export interface DiscountCodeCreateBody {
  classId: string;
  maxRedemptions: number;
  expiresAt?: string;
  note?: string;
}

/**
 * Validates the create form with the API limits (1–500 uses, note ≤ 500,
 * expiry today or later). Returns errors (empty object = valid) and, when
 * valid, the POST /v1/discount-codes body.
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

  const raw = values.maxRedemptions.trim();
  const maxRedemptions = Number(raw);
  if (!/^\d+$/.test(raw) || maxRedemptions < 1 || maxRedemptions > MAX_REDEMPTIONS_LIMIT) {
    errors.maxRedemptions = messages.maxRedemptions;
  }

  const note = values.note.trim();
  if (note.length > NOTE_MAX) errors.note = messages.noteTooLong;

  const expiry = parseExpiryParts(values.expiry, messages, now);
  if ("error" in expiry) errors.expiry = expiry.error;

  if (Object.keys(errors).length || !classOption || "error" in expiry) return { errors, body: null };
  const body: DiscountCodeCreateBody = { classId: classOption.classId, maxRedemptions };
  if (expiry.expiresAt) body.expiresAt = expiry.expiresAt;
  if (note) body.note = note;
  return { errors, body };
}
