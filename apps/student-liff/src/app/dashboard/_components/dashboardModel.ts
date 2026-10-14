/**
 * Pure helpers for the Home screen (kept out of JSX so they are unit-tested).
 * No "@/…" imports here: the root vitest config maps "@" to another app.
 */
import {
  getPrimaryClass,
  getShareableClasses,
  groupEnrollments,
  formatLevelLabel,
  isPendingPayment,
  type DashboardSummary,
  type Enrollment,
  type LessonHistoryItem,
} from "../../../lib/enrollmentStatus";

export type GreetingKey = "dashboard.morning" | "dashboard.afternoon" | "dashboard.evening";

/** Before 12:00 morning, before 17:00 afternoon, otherwise evening (unchanged from Home). */
export function getGreetingKey(hour: number): GreetingKey {
  if (hour < 12) return "dashboard.morning";
  if (hour < 17) return "dashboard.afternoon";
  return "dashboard.evening";
}

/**
 * Chime only when the unread count grew compared with the previous value this
 * screen saw. `previous === undefined` (first value after mount, e.g. data
 * served from cache on a tab revisit) never chimes.
 */
export function shouldPlayUnreadChime(previous: number | undefined, next: number | undefined): boolean {
  if (previous === undefined || next === undefined) return false;
  return next > previous;
}

/** Badge text for an unread counter ("99+" above 99). */
export function formatBadgeCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

/** What the "Next up" card shows for the featured class. */
export type NextUpKind = "live" | "upcoming";

export interface HomeModel {
  /** Featured class (live first, else first paid class); null when there is none. */
  primary: Enrollment | null;
  nextUpKind: NextUpKind | null;
  /** The live featured class still waits for payment (its CTA goes to checkout). */
  primaryNeedsPayment: boolean;
  /**
   * Pending-payment enrollments for the single warning notice. A live pending
   * class is left out because the live card already carries its pay button.
   */
  pendingNotice: Enrollment[];
  /** "คลาสของฉัน" cards: paid classes only (pending ones live in the notice). */
  myClasses: Enrollment[];
  /** Server's active-enrollment count for the section badge (recentClasses may be a subset). */
  classCount: number;
  /** Classes the student may invite friends to. */
  shareable: Enrollment[];
  todayHistory: LessonHistoryItem[];
  /** Unread chat messages (0 when absent). */
  unread: number;
  weekStreak: number;
  /** Book/CEFR label for the hero chip; null when there is no class (no fake level). */
  levelLabel: string | null;
  /** The student has no enrollment at all (paid or pending). */
  isEmpty: boolean;
}

/** Everything Home renders, derived from GET /dashboard/summary. */
export function deriveHomeModel(summary: DashboardSummary | null | undefined): HomeModel {
  const { all, active, pending } = groupEnrollments(summary);
  const primary = getPrimaryClass(summary);
  const isLive = Boolean(primary?.isLive);
  const primaryNeedsPayment = Boolean(primary && isLive && isPendingPayment(primary.status));

  return {
    primary,
    nextUpKind: primary ? (isLive ? "live" : "upcoming") : null,
    primaryNeedsPayment,
    pendingNotice: primaryNeedsPayment ? pending.filter((c) => c !== primary) : pending,
    myClasses: active,
    classCount: summary?.activeEnrollments ?? active.length,
    shareable: getShareableClasses(summary),
    todayHistory: summary?.todayHistory ?? [],
    unread: summary?.unreadMessages ?? 0,
    weekStreak: summary?.weekStreak ?? 0,
    levelLabel: formatLevelLabel(primary),
    isEmpty: all.length === 0,
  };
}
