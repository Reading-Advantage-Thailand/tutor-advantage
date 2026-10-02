/**
 * Pure helpers for the invite/QR enroll landing page (/enroll). No React and
 * no "@/" imports so vitest (whose "@" alias points at another app) can load it.
 */

/** Details the enroll screen shows, mapped from GET /classes/:id or GET /enroll/:token/details. */
export interface EnrollClassDetails {
  classId: string;
  className: string;
  tutorName: string;
  tutorPictureUrl: string | null;
  bookTitle: string;
  price: number;
  maxStudents: number;
  currentStudents: number;
  cefrLevel: string;
  schedule: string;
  /** Live-lesson hours (class details only; the referral endpoint does not send it). */
  totalHours: number | null;
}

interface RawEnrollClass {
  id: string;
  name: string;
  tutor?: { name?: string | null; pictureUrl?: string | null } | null;
  book: string;
  price: number;
  maxStudents: number;
  students: number;
  cefr: string;
  schedule: string;
  totalHours?: number | null;
}

/** Same field mapping the page always used (tutor falls back to "Tutor Advantage"). */
export function mapEnrollClassDetails(cls: RawEnrollClass): EnrollClassDetails {
  return {
    classId: cls.id,
    className: cls.name,
    tutorName: cls.tutor?.name || "Tutor Advantage",
    tutorPictureUrl: cls.tutor?.pictureUrl || null,
    bookTitle: cls.book,
    price: cls.price,
    maxStudents: cls.maxStudents,
    currentStudents: cls.students,
    cefrLevel: cls.cefr,
    schedule: cls.schedule,
    totalHours: typeof cls.totalHours === "number" && cls.totalHours > 0 ? cls.totalHours : null,
  };
}

export interface EnrollSeatState {
  spotsLeft: number;
  /** No seats left → the CTA stays disabled (unchanged behaviour). */
  isFull: boolean;
  /** 0–100 fill for the seat meter. */
  spotsPercent: number;
  /** ≥ 70% full → amber meter. */
  busy: boolean;
  /** 1–3 seats left → "hurry" line. */
  urgent: boolean;
}

export function getEnrollSeatState(currentStudents: number, maxStudents: number): EnrollSeatState {
  const spotsLeft = maxStudents - currentStudents;
  const isFull = spotsLeft <= 0;
  const spotsPercent = maxStudents > 0 ? Math.min(100, Math.round((currentStudents / maxStudents) * 100)) : 100;
  return {
    spotsLeft,
    isFull,
    spotsPercent,
    busy: spotsPercent >= 70,
    urgent: spotsLeft > 0 && spotsLeft <= 3,
  };
}

/** /payment?classId=…[&referralToken=…] — the exact query the payment page parses. */
export function buildEnrollPaymentHref(classId: string, referralToken: string | null): string {
  const params = new URLSearchParams({ classId });
  if (referralToken) params.set("referralToken", referralToken);
  return `/payment?${params.toString()}`;
}

/** Login redirect that brings the student back to this exact /enroll URL. */
export function buildEnrollLoginRedirect(currentQuery: string): string {
  const redirectTarget = encodeURIComponent(`/enroll?${currentQuery}`);
  return `/login?redirect=${redirectTarget}`;
}

export interface EnrollmentApi {
  enrollByReferral: (referralToken: string) => Promise<{ status?: string }>;
  enrollClass: (classId: string, referralToken?: string | null) => Promise<{ status?: string }>;
}

/** Free-class enrollment: a referral token always wins over the direct classId enroll. */
export function requestFreeEnrollment(
  api: EnrollmentApi,
  classId: string,
  referralToken: string | null,
): Promise<{ status?: string }> {
  return referralToken
    ? api.enrollByReferral(referralToken)
    : api.enrollClass(classId, referralToken as string | undefined);
}

export type EnrollErrorKind = "classFull" | "classClosed" | "linkInvalid" | "demoExpired" | "notFound" | "ownClass" | "generic";

/**
 * Friendly category for a failed details load or enrollment. Reads the
 * learning-service error envelope (StudentApiError: `status`, `code`,
 * `message`) without importing it.
 */
export function classifyEnrollError(error: unknown): EnrollErrorKind {
  if (!error || typeof error !== "object") return "generic";
  const { status, code, message } = error as { status?: unknown; code?: unknown; message?: unknown };
  const signals = [code, message].filter((value): value is string => typeof value === "string");
  const has = (needle: string) => signals.some((value) => value.includes(needle));
  if (has("CLASS_FULL")) return "classFull";
  if (has("CLASS_CLOSED")) return "classClosed";
  if (has("REFERRAL_INVALID")) return "linkInvalid";
  if (has("DEMO_EXPIRED")) return "demoExpired";
  if (has("TUTOR_CANNOT_ENROLL_OWN_CLASS")) return "ownClass";
  if (has("CLASS_NOT_FOUND") || status === 404) return "notFound";
  if (status === 403) return "classClosed";
  return "generic";
}

/**
 * A failed details load that a retry can fix (network / server hiccup). Bad,
 * expired or closed links get a dead-end screen with a way out instead.
 */
export function isRetryableEnrollLoadError(kind: EnrollErrorKind): boolean {
  return kind === "generic";
}

export type EnrollCtaKind = "full" | "free" | "continue";

/** Bottom-bar CTA: full classes stay disabled; free classes enroll here; paid ones go to payment. */
export function getEnrollCtaKind(isFull: boolean, price: number): EnrollCtaKind {
  if (isFull) return "full";
  return price === 0 ? "free" : "continue";
}
