/**
 * New-request form and reply rules for support tickets. No "@/…" imports (the
 * root vitest config maps "@" to another app); i18n keys are returned as
 * strings for the page to t().
 */
import { isStudentCategory, type StudentTicketCategory } from "./tickets";

/** Server limits (learning-service ticket contract). Lengths are counted after trim. */
export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 120;
export const BODY_MIN = 10;
export const BODY_MAX = 4000;
export const REPLY_MAX = 4000;
export const PAYMENT_REFERENCE_MAX = 64;

const PAYMENT_REFERENCE_PATTERN = /^[A-Za-z0-9_-]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isValidPaymentReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= PAYMENT_REFERENCE_MAX &&
    PAYMENT_REFERENCE_PATTERN.test(value)
  );
}

/**
 * Random v4 UUID for idempotencyKey / clientMessageId. crypto.randomUUID needs a
 * secure context and a recent WebView; fall back to getRandomValues, then Math.random.
 */
export function createUuid(): string {
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === "function") cryptoApi.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/* ─── Prefill (?category=&classId=&ref=) ──────────────────────────────── */

export interface SupportPrefill {
  category: StudentTicketCategory | "";
  classId: string;
  paymentReference: string;
}

/** Only well-formed values survive (a link can carry anything). */
export function parseSupportPrefill(params: { get(name: string): string | null } | null | undefined): SupportPrefill {
  const category = params?.get("category")?.trim().toUpperCase() ?? "";
  const classId = params?.get("classId")?.trim() ?? "";
  const ref = params?.get("ref")?.trim() ?? "";
  return {
    category: isStudentCategory(category) ? category : "",
    classId: isUuid(classId) ? classId : "",
    paymentReference: isValidPaymentReference(ref) ? ref : "",
  };
}

/** Link to the new-request form with a prefill (only valid parts are kept). */
export function buildNewRequestHref(prefill: { category?: string; classId?: string | null; ref?: string | null } = {}): string {
  const params = new URLSearchParams();
  if (prefill.category && isStudentCategory(prefill.category)) params.set("category", prefill.category);
  if (prefill.classId && isUuid(prefill.classId)) params.set("classId", prefill.classId);
  if (prefill.ref && isValidPaymentReference(prefill.ref)) params.set("ref", prefill.ref);
  const qs = params.toString();
  return qs ? `/support/new?${qs}` : "/support/new";
}

/**
 * The class to send: only one of the student's own classes (a prefilled or
 * stale id would fail with CLASS_NOT_ACCESSIBLE). Empty = no class.
 */
export function resolveClassId(selected: string, classIds: readonly string[]): string {
  return selected && classIds.includes(selected) ? selected : "";
}

/* ─── Validation ──────────────────────────────────────────────────────── */

export interface SupportFormValues {
  category: string;
  subject: string;
  details: string;
  classId: string;
  paymentReference: string;
}

export interface SupportFormErrors {
  category?: "support.categoryRequired";
  subject?: "support.subjectRequired" | "support.subjectTooShort" | "support.subjectTooLong";
  details?: "support.detailsRequired" | "support.detailsTooShort" | "support.detailsTooLong";
  paymentReference?: "support.refInvalid";
}

/** Field errors (empty object = valid). Mirrors the server limits so most mistakes never leave the phone. */
export function validateSupportForm(values: SupportFormValues): SupportFormErrors {
  const errors: SupportFormErrors = {};
  if (!isStudentCategory(values.category)) errors.category = "support.categoryRequired";

  const subject = values.subject.trim();
  if (!subject) errors.subject = "support.subjectRequired";
  else if (subject.length < SUBJECT_MIN) errors.subject = "support.subjectTooShort";
  else if (subject.length > SUBJECT_MAX) errors.subject = "support.subjectTooLong";

  const details = values.details.trim();
  if (!details) errors.details = "support.detailsRequired";
  else if (details.length < BODY_MIN) errors.details = "support.detailsTooShort";
  else if (details.length > BODY_MAX) errors.details = "support.detailsTooLong";

  const ref = values.paymentReference.trim();
  if (ref && !isValidPaymentReference(ref)) errors.paymentReference = "support.refInvalid";
  return errors;
}

export function hasErrors(errors: SupportFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export interface CreateTicketPayload {
  category: string;
  subject: string;
  body: string;
  classId?: string;
  paymentReference?: string;
  idempotencyKey: string;
}

/** POST /tickets body: trimmed text, optional fields omitted when empty. */
export function buildCreateTicketPayload(values: SupportFormValues, idempotencyKey: string): CreateTicketPayload {
  const payload: CreateTicketPayload = {
    category: values.category,
    subject: values.subject.trim(),
    body: values.details.trim(),
    idempotencyKey,
  };
  if (values.classId) payload.classId = values.classId;
  const ref = values.paymentReference.trim();
  if (ref) payload.paymentReference = ref;
  return payload;
}

/* ─── Replies ─────────────────────────────────────────────────────────── */

export interface ReplyAttempt {
  text: string;
  clientMessageId: string;
}

/**
 * clientMessageId for sending `text`: resending the same text after a failure
 * keeps the previous id (the server returns the first copy instead of a
 * duplicate); a different text gets a new id.
 */
export function nextReplyAttempt(
  previous: ReplyAttempt | null,
  text: string,
  makeId: () => string = createUuid,
): ReplyAttempt {
  const normalized = text.trim();
  if (previous && previous.text === normalized) return previous;
  return { text: normalized, clientMessageId: makeId() };
}

/* ─── Error copy ──────────────────────────────────────────────────────── */

function errorDetails(error: unknown): { status?: number; code?: string } {
  const details = (error ?? {}) as { status?: unknown; code?: unknown };
  return {
    status: typeof details.status === "number" ? details.status : undefined,
    code: typeof details.code === "string" ? details.code : undefined,
  };
}

export type SupportErrorKey =
  | "support.sessionExpired"
  | "support.invalidCategory"
  | "support.classNotAccessible"
  | "support.tooManyOpen"
  | "support.rateLimited"
  | "support.forbidden"
  | "support.ticketClosed"
  | "support.invalidData"
  | "support.sendFailed";

/** Kid-friendly Thai message for a failed create/reply (never the raw server text). */
export function getSupportErrorKey(error: unknown): SupportErrorKey {
  const { status, code } = errorDetails(error);
  if (status === 401 || code === "UNAUTHORIZED") return "support.sessionExpired";
  if (code === "INVALID_CATEGORY") return "support.invalidCategory";
  if (code === "CLASS_NOT_ACCESSIBLE") return "support.classNotAccessible";
  if (code === "TOO_MANY_OPEN_TICKETS") return "support.tooManyOpen";
  if (code === "TICKET_RATE_LIMITED" || status === 429) return "support.rateLimited";
  if (code === "TICKET_CLOSED" || status === 409) return "support.ticketClosed";
  if (code === "FORBIDDEN" || status === 403) return "support.forbidden";
  if (code === "VALIDATION_FAILED" || status === 400 || status === 422) return "support.invalidData";
  return "support.sendFailed";
}

/**
 * Keep the same idempotencyKey for the next try? Yes after a network error or
 * 5xx (the ticket may exist already; a replay returns it). No after a 4xx: the
 * server rejected it, so an edited retry is a new request.
 */
export function shouldKeepIdempotencyKey(error: unknown): boolean {
  const { status } = errorDetails(error);
  return !(typeof status === "number" && status >= 400 && status < 500);
}

/** 404 TICKET_NOT_FOUND (bad id, someone else's ticket): no point retrying. */
export function isTicketNotFound(error: unknown): boolean {
  const { status, code } = errorDetails(error);
  return status === 404 || code === "TICKET_NOT_FOUND";
}

/** The ticket can no longer take replies (closed for more than 14 days). */
export function isTicketClosedError(error: unknown): boolean {
  const { status, code } = errorDetails(error);
  return code === "TICKET_CLOSED" || status === 409;
}
