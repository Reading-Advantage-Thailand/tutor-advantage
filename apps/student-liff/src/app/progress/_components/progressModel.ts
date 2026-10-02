/**
 * Pure rules for the Progress tab (GET /student/progress), extracted verbatim
 * from the page so they are unit-tested. No "@/…" imports: the root vitest
 * config maps "@" to another app.
 */

export interface ProgressStats {
  level: string;
  cefr: string;
  seriesColor: string;
  totalArticles: number;
  articlesRead: number;
  weekStreak: number;
  totalMinutes: number;
  nextMilestone: { at: number; reward: string };
  isBookComplete?: boolean;
}
export interface WeeklyActivity {
  day: string;
  minutes: number;
  active: boolean;
}
export interface ProgressArticle {
  id: string;
  no: number;
  title: string;
  minutes: number;
  done: boolean;
  assessmentSupported: boolean;
  assessmentDone: boolean;
}
export interface EnrolledClassOption {
  classId: string;
  name: string;
  cefr: string;
  bookTitle: string | null;
  seriesColor: string;
}
export interface BookCycleOption {
  id: string;
  title: string;
  cefr: string;
  sequence: number;
  status: string;
  hasAccess: boolean;
  completedArticles: number;
  totalArticles: number;
  percent: number;
  isComplete: boolean;
}
export interface ProgressData {
  enrolledClasses?: EnrolledClassOption[];
  selectedClassId?: string | null;
  selectedBookCycleId?: string | null;
  bookCycles?: BookCycleOption[];
  nextAvailableBookCycleId?: string | null;
  stats: ProgressStats;
  weeklyActivity: WeeklyActivity[];
  articles: ProgressArticle[];
}

/* ─── Lessons: lock / unlock / current (unchanged rules) ─────────────────── */

export type LessonState = "done" | "current" | "locked";

export interface LessonPlan {
  /** Index of the first lesson not done yet; -1 when every lesson is done (or none). */
  currentIndex: number;
  /** Lesson the "เรียนต่อ" button opens: the current one, else the last lesson. */
  currentArticle: ProgressArticle | undefined;
  /** Per lesson: done, current (first not done) or locked (everything else). */
  states: LessonState[];
}

export function getLessonPlan(articles: ProgressArticle[]): LessonPlan {
  const currentIndex = articles.findIndex((article) => !article.done);
  const currentArticle = currentIndex >= 0 ? articles[currentIndex] : articles.at(-1);
  const states = articles.map<LessonState>((article, index) =>
    article.done ? "done" : index === currentIndex ? "current" : "locked",
  );
  return { currentIndex, currentArticle, states };
}

/** Reader URL for a lesson. */
export function buildReadHref(articleId: string): string {
  return `/student/read/${articleId}`;
}

/** Reedy voice-practice URL — a contract with /voice-practice (also built in LessonWrapUpPhase). */
export function buildVoicePracticeHref(cycleId: string, articleId: string): string {
  return `/voice-practice?cycleId=${encodeURIComponent(cycleId)}&articleId=${encodeURIComponent(articleId)}`;
}

/* ─── Book summary ───────────────────────────────────────────────────────── */

/** Whether there is a book to show progress for (else the "no class" empty state). */
export function hasProgressData(data: Pick<ProgressData, "stats" | "articles">): boolean {
  return data.stats.totalArticles > 0 || data.articles.length > 0;
}

export function getProgressPercent(stats: Pick<ProgressStats, "articlesRead" | "totalArticles">): number {
  return stats.totalArticles ? Math.round((stats.articlesRead / stats.totalArticles) * 100) : 0;
}

export function getRemainingLessons(stats: Pick<ProgressStats, "articlesRead" | "totalArticles">): number {
  return Math.max(0, stats.totalArticles - stats.articlesRead);
}

/* ─── Weekly chart ───────────────────────────────────────────────────────── */

export interface WeekBar extends WeeklyActivity {
  /** Bar height in % of the track (min 8 so empty days still show a stub). */
  heightPct: number;
}

export function getWeekChart(weeklyActivity: WeeklyActivity[]): { bars: WeekBar[]; totalMinutes: number } {
  const maxMinutes = Math.max(...weeklyActivity.map((day) => day.minutes), 1);
  return {
    bars: weeklyActivity.map((day) => ({ ...day, heightPct: Math.max(8, (day.minutes / maxMinutes) * 100) })),
    totalMinutes: weeklyActivity.reduce((sum, day) => sum + day.minutes, 0),
  };
}

/* ─── Class / book selection ─────────────────────────────────────────────── */

/**
 * What the student asked for. Only user taps change it; `null` lets the
 * server pick (its choice comes back as data.selectedClassId / selectedBookCycleId).
 * Keeping it apart from the server's answer is what avoids the old double fetch.
 */
export interface ProgressSelection {
  classId: string | null;
  cycleId: string | null;
}

export const AUTO_SELECTION: ProgressSelection = { classId: null, cycleId: null };

/**
 * Tap on a class chip: that class with the server's default book; null = no change.
 * `shownClassId` is the highlighted chip (getDisplayedSelection): while a switch
 * is loading or has failed it is the requested class, so tapping the class still
 * on screen goes back to it instead of doing nothing.
 */
export function selectClass(
  data: ProgressData,
  classId: string,
  shownClassId: string | null | undefined = data.selectedClassId,
): ProgressSelection | null {
  if (classId === shownClassId) return null;
  return { classId, cycleId: null };
}

/**
 * Tap on a book chip: the current class + that book; null when the book is
 * locked (no access) or already highlighted (`shownCycleId`, see selectClass).
 */
export function selectBook(
  data: ProgressData,
  requested: ProgressSelection,
  book: Pick<BookCycleOption, "id" | "hasAccess">,
  shownCycleId: string | null | undefined = data.selectedBookCycleId,
): ProgressSelection | null {
  if (!book.hasAccess || book.id === shownCycleId) return null;
  return { classId: data.selectedClassId ?? requested.classId, cycleId: book.id };
}

/** "ไปเรียนเล่มถัดไป" (shown only when the book is complete): the current class + the next book. */
export function selectNextBook(data: ProgressData, requested: ProgressSelection): ProgressSelection | null {
  if (!data.nextAvailableBookCycleId) return null;
  return { classId: data.selectedClassId ?? requested.classId, cycleId: data.nextAvailableBookCycleId };
}

/**
 * Chip highlighted while a new selection loads (previous data still on screen):
 * the requested one, so the tap feels instant; otherwise the server's choice.
 */
export function getDisplayedSelection(
  data: Pick<ProgressData, "selectedClassId" | "selectedBookCycleId">,
  requested: ProgressSelection,
  isSwitching: boolean,
): { classId: string | null; cycleId: string | null } {
  if (!isSwitching) {
    return { classId: data.selectedClassId ?? null, cycleId: data.selectedBookCycleId ?? null };
  }
  const classChanged = requested.classId !== null && requested.classId !== data.selectedClassId;
  return {
    classId: requested.classId ?? data.selectedClassId ?? null,
    cycleId: requested.cycleId ?? (classChanged ? null : data.selectedBookCycleId ?? null),
  };
}
