/**
 * Pure helpers for the coupon form (validation + Bangkok/Buddhist-era expiry).
 * Relative imports only so vitest (whose "@" alias points elsewhere) can test it.
 */
import { toBuddhistYear, toDateKey } from "../../lib/format";

export const HOURS_MAX = 1000;
export const NOTE_MAX = 500;

export type CouponStatus = "ACTIVE" | "REDEEMED" | "VOID" | "EXPIRED";

export interface Coupon {
  couponId: string;
  code: string;
  hours: number;
  status: CouponStatus;
  /** ACTIVE coupons past their expiry are reported as EXPIRED by the API. */
  effectiveStatus?: CouponStatus;
  note: string | null;
  assignedTutorId: string | null;
  assignedTutorName: string | null;
  redeemedByTutorId: string | null;
  redeemedByTutorName: string | null;
  redemptionMode: string | null;
  redeemedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CouponSummary {
  total: number;
  totalHours: number;
  byStatus: Record<CouponStatus, { count: number; hours: number }>;
  redemptionRate: number;
}

export interface CouponPage {
  coupons: Coupon[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  summary?: CouponSummary;
}

export interface TutorOption {
  userId: string;
  displayName: string | null;
  email?: string | null;
}

/** Day / month (1–12) / Buddhist-era year as strings ("" = not chosen). */
export interface ThaiDateParts {
  day: string;
  month: string;
  yearBE: string;
}

export const EMPTY_DATE: ThaiDateParts = { day: "", month: "", yearBE: "" };

export function couponStatus(coupon: Pick<Coupon, "status" | "effectiveStatus">): CouponStatus {
  return coupon.effectiveStatus ?? coupon.status;
}

export function daysInMonth(month: number, yearCE: number): number {
  return new Date(Date.UTC(yearCE, month, 0)).getUTCDate();
}

export function isEmptyDate(parts: ThaiDateParts): boolean {
  return !parts.day && !parts.month && !parts.yearBE;
}

/** "YYYY-MM-DD" (Gregorian) from BE parts, or null when incomplete / not a real date. */
export function partsToDateKey(parts: ThaiDateParts): string | null {
  const day = Number(parts.day);
  const month = Number(parts.month);
  const yearBE = Number(parts.yearBE);
  if (!day || !month || !yearBE) return null;
  const yearCE = yearBE - 543;
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(month, yearCE)) return null;
  return `${yearCE}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function dateKeyToParts(key: string | null | undefined): ThaiDateParts {
  const match = key ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(key) : null;
  if (!match) return EMPTY_DATE;
  return {
    day: String(Number(match[3])),
    month: String(Number(match[2])),
    yearBE: String(toBuddhistYear(Number(match[1]))),
  };
}

/** Expiry instant sent to the API: the END of that Bangkok calendar day (23:59:59.999 +07:00). */
export function dateKeyToExpiryIso(key: string): string {
  return new Date(`${key}T23:59:59.999+07:00`).toISOString();
}

/** Bangkok calendar day of a stored expiry (for editing). */
export function expiryIsoToDateKey(iso: string | null | undefined): string | null {
  const key = iso ? toDateKey(iso) : "";
  return key || null;
}

/** Bangkok "today" + n days as "YYYY-MM-DD". */
export function addDaysKey(days: number, now: Date = new Date()): string {
  return toDateKey(new Date(now.getTime() + days * 86_400_000));
}

export interface CouponFormValues {
  hours: string;
  note: string;
  tutor: TutorOption | null;
  expiry: ThaiDateParts;
}

export type CouponFormErrors = Partial<Record<"hours" | "note" | "expiry", string>>;

export interface CouponFormMessages {
  hoursInteger: string;
  noteTooLong: string;
  expiryIncomplete: string;
  expiryInvalid: string;
  expiryPast: string;
}

/**
 * Validates the form. `mode: "edit"` skips hours (not editable after create).
 * Returns errors (empty object = valid) and, when valid, the API body.
 */
export function validateCouponForm(
  values: CouponFormValues,
  messages: CouponFormMessages,
  { mode = "create", now = new Date() }: { mode?: "create" | "edit"; now?: Date } = {},
): { errors: CouponFormErrors; body: Record<string, unknown> | null } {
  const errors: CouponFormErrors = {};
  const body: Record<string, unknown> = {};

  if (mode === "create") {
    const raw = values.hours.trim();
    const hours = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isInteger(hours) || hours < 1 || hours > HOURS_MAX) {
      errors.hours = messages.hoursInteger;
    } else {
      body.hours = hours;
    }
  }

  const note = values.note.trim();
  if (note.length > NOTE_MAX) errors.note = messages.noteTooLong;
  else if (mode === "edit") body.note = note || null;
  else if (note) body.note = note;

  if (isEmptyDate(values.expiry)) {
    if (mode === "edit") body.expiresAt = null;
  } else if (!values.expiry.day || !values.expiry.month || !values.expiry.yearBE) {
    errors.expiry = messages.expiryIncomplete;
  } else {
    const key = partsToDateKey(values.expiry);
    if (!key) errors.expiry = messages.expiryInvalid;
    else if (key < toDateKey(now)) errors.expiry = messages.expiryPast;
    else body.expiresAt = dateKeyToExpiryIso(key);
  }

  if (values.tutor) body.assignedTutorId = values.tutor.userId;
  else if (mode === "edit") body.assignedTutorId = null;

  return { errors, body: Object.keys(errors).length ? null : body };
}
