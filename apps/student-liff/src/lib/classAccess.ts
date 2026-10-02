/**
 * Access / upgrade / call-to-action rules for the class detail screen.
 * Pure functions, extracted unchanged from classes/[id]/page.tsx so a visual
 * refactor cannot silently change who sees Enroll vs Upgrade vs Enrolled or
 * which book cycle's lessons load.
 */

export interface ClassBookCycle {
  id: string;
  title: string;
  bookCode?: string | null;
  price: number;
  packagePriceSatang?: number;
  accessStatus?: string;
  hasAccess: boolean;
  sequence: number;
  status?: string;
  progress?: {
    completedArticles: number;
    totalArticles: number;
    percent: number;
  } | null;
}

/** The subset of GET /classes/:id that the access rules read. */
export interface ClassAccessSource {
  id: string;
  status: string;
  price: number;
  isEnrolled?: boolean;
  enrollmentStatus?: string | null;
  activeBookCycleId?: string | null;
  bookCycles?: ClassBookCycle[];
}

/**
 * Default book cycle: the newest cycle the student can open, else the class's
 * active cycle, else the first one. "" when the class has no cycles.
 */
export function pickDefaultCycleId(cls: Pick<ClassAccessSource, "bookCycles" | "activeBookCycleId">): string {
  const cycles = cls.bookCycles ?? [];
  const defaultCycle =
    [...cycles].reverse().find((cycle) => cycle.hasAccess) ||
    cycles.find((cycle) => cycle.id === cls.activeBookCycleId) ||
    cycles[0];
  return defaultCycle?.id || "";
}

/** The student's pick while it still exists in the class data, otherwise the default. */
export function resolveSelectedCycleId(
  cls: Pick<ClassAccessSource, "bookCycles" | "activeBookCycleId">,
  userSelectedId: string | null,
): string {
  if (userSelectedId !== null && (cls.bookCycles ?? []).some((cycle) => cycle.id === userSelectedId)) {
    return userSelectedId;
  }
  return pickDefaultCycleId(cls);
}

export interface ClassAccess {
  /** Enrolled in a closed class → may rate the tutor. */
  canReview: boolean;
  /** The class's current (open) book cycle. */
  activeCycle: ClassBookCycle | undefined;
  /** Enrolled, but the class moved on to a book the student has not paid for. */
  needsUpgrade: boolean;
  selectedCycle: ClassBookCycle | undefined;
  /** Enrolled and the selected book is unlocked (or the class has no cycles). */
  canReadSelectedCycle: boolean;
  /** The selected cycle exists and is locked → skip loading its lessons. */
  selectedCycleLocked: boolean;
  /** Price shown next to the main CTA (next book's price when upgrading). */
  footerPrice: number;
}

export function deriveClassAccess(cls: ClassAccessSource, selectedCycleId: string): ClassAccess {
  const canReview = Boolean(cls.isEnrolled && cls.status === "closed");
  const activeCycle = cls.bookCycles?.find((cycle) => cycle.id === cls.activeBookCycleId);
  const needsUpgrade = Boolean(cls.isEnrolled && activeCycle && !activeCycle.hasAccess);
  const selectedCycle = cls.bookCycles?.find((cycle) => cycle.id === selectedCycleId);
  const canReadSelectedCycle = Boolean(cls.isEnrolled && (!selectedCycle || selectedCycle.hasAccess));
  const selectedCycleLocked = Boolean(selectedCycle && !selectedCycle.hasAccess);
  const footerPrice = needsUpgrade && activeCycle ? activeCycle.price : cls.price ?? 0;
  return {
    canReview,
    activeCycle,
    needsUpgrade,
    selectedCycle,
    canReadSelectedCycle,
    selectedCycleLocked,
    footerPrice,
  };
}

/** /payment?classId=…[&cycleId=…] — the exact query the payment page parses. */
export function paymentHref(classId: string, cycleId?: string | null): string {
  return cycleId ? `/payment?classId=${classId}&cycleId=${cycleId}` : `/payment?classId=${classId}`;
}

/** Lesson lobby for an enrolled class. */
export function lessonLobbyHref(classId: string): string {
  return `/lesson/${encodeURIComponent(classId)}`;
}

/** Reading page for one article (/student/read/[articleId]). */
export function articleReadHref(articleId: string): string {
  return `/student/read/${articleId}`;
}

export type ClassPrimaryAction =
  /** Enrolled, next book unpaid → pay for the active cycle. */
  | { kind: "upgrade"; href: string; cycleSequence: number; price: number }
  /** Enrolled → go to the class lobby. */
  | { kind: "enter"; href: string }
  /** Not enrolled → payment for the class (pendingPayment: an unpaid enrollment exists). */
  | { kind: "enroll"; href: string; price: number; pendingPayment: boolean };

/**
 * The detail screen's main action. Same precedence as the old footer:
 * upgrade (needsUpgrade) → enrolled → enroll.
 */
export function getClassPrimaryAction(cls: ClassAccessSource, access: ClassAccess): ClassPrimaryAction {
  if (access.needsUpgrade && access.activeCycle) {
    return {
      kind: "upgrade",
      href: paymentHref(cls.id, access.activeCycle.id),
      cycleSequence: access.activeCycle.sequence,
      price: access.footerPrice,
    };
  }
  if (cls.isEnrolled) {
    return { kind: "enter", href: lessonLobbyHref(cls.id) };
  }
  return {
    kind: "enroll",
    href: paymentHref(cls.id),
    price: access.footerPrice,
    pendingPayment: cls.enrollmentStatus === "PENDING_PAYMENT",
  };
}

/** Seats left (never negative) and whether to show the "hurry" style. */
export function getSeatInfo(enrolled: number, capacity: number): { seatsLeft: number; fillPercent: number; urgent: boolean } {
  const seatsLeft = Math.max(0, capacity - enrolled);
  const fillPercent = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 100;
  return { seatsLeft, fillPercent, urgent: seatsLeft <= 2 };
}

/**
 * Lesson rows link to the reader only when the student can actually read the
 * selected book (/student/articles/:id authorises the same ACTIVE enrollment +
 * book access). Otherwise the row is static and shows a lock.
 */
export function getArticleRowHref(articleId: string, canReadSelectedCycle: boolean): string | undefined {
  return canReadSelectedCycle ? articleReadHref(articleId) : undefined;
}

export type LessonListFooter = { kind: "more"; remaining: number } | { kind: "allAfterPayment" } | null;

/**
 * "+ N more lessons (unlock after paying)" / "all lessons appear after paying"
 * footers. Same counts as before, but never shown to a student who can read
 * the selected book (they used to see them too).
 */
export function getLessonListFooter(articleCount: number, shownCount: number, canReadSelectedCycle: boolean): LessonListFooter {
  if (canReadSelectedCycle) return null;
  if (articleCount > shownCount) return { kind: "more", remaining: articleCount - shownCount };
  if (articleCount === shownCount && shownCount > 0) return { kind: "allAfterPayment" };
  return null;
}

export type ClassLoadErrorKind = "notFound" | "offline" | "error";

/**
 * GET /classes/:id failure → screen: 404 (no class) and 403 (closed class the
 * student is not in) are "not found"; a request that never got an HTTP status
 * (TypeError: Failed to fetch) is "offline"; everything else gets a retry.
 */
export function classifyClassLoadError(error: unknown): ClassLoadErrorKind {
  const status = error && typeof error === "object" ? (error as { status?: unknown }).status : undefined;
  if (status === 404 || status === 403) return "notFound";
  if (typeof status !== "number") return "offline";
  return "error";
}

/* ─── Cache keys (useCachedResource) ───────────────────────────────────────── */

/** GET /classes/:id for one student. */
export function classDetailResourceKey(userId: string, classId: string): string {
  return `${userId}:class:${classId}`;
}

/** GET /classes/:id/articles?cycleId= ("" = server default cycle). */
export function classArticlesResourceKey(userId: string, classId: string, cycleId: string): string {
  return `${classDetailResourceKey(userId, classId)}:articles:${cycleId}`;
}

/** GET /classes/:id/review (the student's own tutor review). */
export function classReviewResourceKey(userId: string, classId: string): string {
  return `${classDetailResourceKey(userId, classId)}:review`;
}
