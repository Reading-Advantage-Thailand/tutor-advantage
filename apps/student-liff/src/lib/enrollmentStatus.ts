/**
 * Pure helpers for the student's enrollments as returned by
 * GET /dashboard/summary (studentApi.getDashboard).
 *
 * These were extracted verbatim from the Home screen so Home, Profile and
 * any other screen agree on what "pending payment", "primary class" and
 * "shareable" mean, and build exactly the same URLs.
 */

export interface Enrollment {
  id?: string;
  cycleId?: string;
  name: string;
  tutorName: string;
  status: string;
  nextSession: string;
  progress: number;
  bookName: string | null;
  seriesCefr: string | null;
  isLive?: boolean;
  price?: number;
}

export interface LessonHistoryItem {
  sessionId: string;
  date: string;
  rank: number;
  totalParticipants: number;
  articleTitle: string;
  tutorName: string;
  score: number;
}

export interface DashboardSummary {
  unreadMessages: number;
  weekStreak: number;
  activeEnrollments: number;
  recentClasses: Enrollment[];
  shareableClasses?: Enrollment[];
  todayHistory?: LessonHistoryItem[];
}

/** String heuristic for an enrollment that still waits for payment (unchanged from Home). */
export function isPendingPayment(status: string | null | undefined): boolean {
  const s = status?.toLowerCase() ?? "";
  return (
    s.includes("pending") ||
    s === "awaiting_payment" ||
    s === "unpaid" ||
    s === "payment_required"
  );
}

/**
 * Checkout URL for a pending enrollment: `/payment?classId=…[&cycleId=…]`,
 * or `/payment` when the class id is unknown.
 */
export function buildPaymentHref(enrollment: Pick<Enrollment, "id" | "cycleId">): string {
  if (!enrollment.id) return "/payment";
  return `/payment?classId=${enrollment.id}${enrollment.cycleId ? `&cycleId=${enrollment.cycleId}` : ""}`;
}

/**
 * Where tapping a class goes: checkout for a pending class with an id,
 * the lesson lobby `/lesson/{id}` otherwise, `/classes` without an id.
 */
export function buildEnrollmentHref(enrollment: Pick<Enrollment, "id" | "cycleId" | "status">): string {
  if (isPendingPayment(enrollment.status) && enrollment.id) return buildPaymentHref(enrollment);
  return enrollment.id ? `/lesson/${enrollment.id}` : "/classes";
}

export interface EnrollmentGroups {
  all: Enrollment[];
  active: Enrollment[];
  pending: Enrollment[];
}

/** Splits recentClasses into paid ("active") and pending-payment enrollments, keeping order. */
export function groupEnrollments(summary: Pick<DashboardSummary, "recentClasses"> | null | undefined): EnrollmentGroups {
  const all = summary?.recentClasses ?? [];
  return {
    all,
    active: all.filter((c) => !isPendingPayment(c.status)),
    pending: all.filter((c) => isPendingPayment(c.status)),
  };
}

/**
 * Classes the student may invite friends to: the server's shareableClasses
 * (or the active classes when absent), minus anything without an id or
 * still pending payment.
 */
export function getShareableClasses(
  summary: Pick<DashboardSummary, "recentClasses" | "shareableClasses"> | null | undefined,
): Enrollment[] {
  const source = summary?.shareableClasses ?? groupEnrollments(summary).active;
  return source.filter((c) => Boolean(c.id) && !isPendingPayment(c.status));
}

/** The class Home features: a live class first (any status), then the first active one, else null. */
export function getPrimaryClass(summary: Pick<DashboardSummary, "recentClasses"> | null | undefined): Enrollment | null {
  const { all, active } = groupEnrollments(summary);
  return all.find((c) => c.isLive) ?? active[0] ?? null;
}

/** True when the server sent a real next-session label ("-" means none). */
export function hasNextSession(enrollment: Pick<Enrollment, "nextSession">): boolean {
  return Boolean(enrollment.nextSession) && enrollment.nextSession !== "-";
}

/**
 * Level label for the hero/profile chip, e.g. "Primary Origins 3.1 (A0)" or
 * "Reading 3.1 · A1". Null when there is no class/book (no fake default level).
 */
export function formatLevelLabel(enrollment: Pick<Enrollment, "bookName" | "seriesCefr"> | null | undefined): string | null {
  const book = enrollment?.bookName?.trim();
  if (!book) return null;
  const cefr = enrollment?.seriesCefr?.trim();
  if (!cefr || book.includes(cefr)) return book;
  return `${book} · ${cefr}`;
}

/** Stable React key for an enrollment row (unchanged from Home). */
export function getEnrollmentKey(enrollment: Enrollment, index: number): string {
  return [
    enrollment.id ?? "class",
    enrollment.cycleId ?? "base",
    enrollment.status ?? "status",
    enrollment.bookName ?? enrollment.name ?? "enrollment",
    index,
  ].join(":");
}
