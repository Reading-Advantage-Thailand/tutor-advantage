/**
 * Student schedule: turns the free-text `nextSession` of each enrolled class
 * (GET /classes) into calendar occurrences.
 *
 * This is product logic moved out of src/app/schedule/page.tsx unchanged:
 * - Thai day names from studentScheduleCopy.dayMapping ("พฤหัส" and
 *   "พฤหัสบดี" both mean Thursday), "ทุกวัน" = every day.
 * - Empty / "ยังไม่ได้กำหนด" / unparseable text falls back to Mon/Wed/Fri.
 * - Occurrences are generated for today-30 … today+60 days, clamped to the
 *   class startsAt/endsAt. A class without startsAt starts "now".
 * - isDemo classes get a single occurrence on their start date.
 *
 * Relative imports on purpose: the root vitest config maps "@" to tutor-pwa.
 */
import { toLocalDateKey } from "./format";
import { studentScheduleCopy, t } from "./i18n";

export interface ScheduleClass {
  id: string;
  name: string;
  tutorName: string;
  nextSession?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isDemo?: boolean;
}

/** GET /classes response (only the fields the schedule and chat list read). */
export interface EnrolledClassesResponse {
  classes?: Array<ScheduleClass & { tutorUserId?: string }> | null;
}

/**
 * useCachedResource key for GET /classes (enrolled classes). Shared by the
 * schedule and the chat list, so opening one after the other is instant.
 */
export function enrolledClassesResourceKey(userId: string): string {
  return `${userId}:enrolledClasses`;
}

export interface ScheduledEvent {
  id: string;
  classId: string;
  title: string;
  tutor: string;
  /** Display time, e.g. "18:00 - 19:30 น.", "ตามนัดหมาย" or "ยังไม่ได้กำหนด". */
  time: string;
  /** Start of the time range in minutes after midnight (for sorting); null when there is no time. */
  startMinutes: number | null;
  type: "class" | "reminder" | "event";
  /** Local calendar day, "YYYY-MM-DD". */
  dateStr: string;
}

export interface ParsedSchedule {
  /** Days of the week (0 = Sunday … 6 = Saturday). */
  days: number[];
  timeRange: string;
}

/** Mon/Wed/Fri — used when the schedule text has no recognisable day. */
export const FALLBACK_SCHEDULE_DAYS: readonly number[] = [1, 3, 5];
export const SCHEDULE_WINDOW_PAST_DAYS = 30;
export const SCHEDULE_WINDOW_FUTURE_DAYS = 60;

const TIME_RANGE_PATTERN = /(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/;

/** "18.00-19.30" → "18:00 - 19:30 น."; no time range → "ตามนัดหมาย". */
export function extractTime(str: string): string {
  const match = str.match(TIME_RANGE_PATTERN);
  if (match) {
    return `${match[1].replace(".", ":")} - ${match[2].replace(".", ":")} ${t("schedule.timeSuffix")}`;
  }
  return t("schedule.byAppointment");
}

/** Minutes after midnight of the first "H:MM" in a display time, or null ("ตามนัดหมาย"). */
export function getStartMinutes(time: string): number | null {
  const match = time.match(/(\d{1,2})[:.](\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 1080 → "18:00", 540 → "9:00" (same style as the time label); null → "". */
export function formatStartMinutes(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "";
  const hours = Math.floor(minutes / 60);
  return `${hours}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Parse a Thai free-text schedule ("ทุกวันจันทร์ พุธ 18:00-19:30") into weekdays + a time label. */
export function parseThaiSchedule(scheduleStr: string): ParsedSchedule {
  if (!scheduleStr || scheduleStr === t("schedule.unset")) {
    return { days: [...FALLBACK_SCHEDULE_DAYS], timeRange: t("schedule.unset") };
  }

  const lowerStr = scheduleStr.toLowerCase();
  const dayMapping: Record<string, number> = studentScheduleCopy.dayMapping;
  const detectedDays: number[] = [];

  Object.entries(dayMapping).forEach(([name, value]) => {
    if (lowerStr.includes(name) && !detectedDays.includes(value)) detectedDays.push(value);
  });

  // Explicit "every day" schedule means all 7 days.
  if (lowerStr.includes(studentScheduleCopy.everyDay) && detectedDays.length === 0) {
    return { days: [0, 1, 2, 3, 4, 5, 6], timeRange: extractTime(scheduleStr) };
  }

  const timeRange = extractTime(scheduleStr);

  // Nothing recognisable (random text, English "Mon/Wed"…): fall back to Mon/Wed/Fri.
  if (detectedDays.length === 0) {
    return { days: [...FALLBACK_SCHEDULE_DAYS], timeRange };
  }

  return { days: detectedDays, timeRange };
}

/** The generated window: now-30 days … now+60 days (same time of day as `now`). */
export function getScheduleWindow(now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  start.setDate(now.getDate() - SCHEDULE_WINDOW_PAST_DAYS);
  const end = new Date(now);
  end.setDate(now.getDate() + SCHEDULE_WINDOW_FUTURE_DAYS);
  return { start, end };
}

/** Expand every class into dated occurrences inside the schedule window. */
export function buildScheduleEvents(classes: ScheduleClass[], now: Date = new Date()): ScheduledEvent[] {
  const events: ScheduledEvent[] = [];
  const { start: windowStart, end: windowEnd } = getScheduleWindow(now);

  for (const cls of classes) {
    const { days, timeRange } = parseThaiSchedule(cls.nextSession || "");
    const startMinutes = getStartMinutes(timeRange);
    const makeEvent = (dateStr: string): ScheduledEvent => ({
      id: `${cls.id}-${dateStr}`,
      classId: cls.id,
      title: cls.name,
      tutor: cls.tutorName,
      time: timeRange,
      startMinutes,
      type: "class",
      dateStr,
    });

    const clsStart = cls.startsAt ? new Date(cls.startsAt) : new Date(now);

    if (cls.isDemo) {
      events.push(makeEvent(toLocalDateKey(clsStart)));
      continue;
    }

    // Respect class start/end dates, clamped to the window bounds.
    const clsEnd = cls.endsAt ? new Date(cls.endsAt) : windowEnd;
    const loopStart = clsStart > windowStart ? clsStart : windowStart;
    const loopEnd = clsEnd < windowEnd ? clsEnd : windowEnd;

    const loopDate = new Date(loopStart);
    while (loopDate <= loopEnd) {
      if (days.includes(loopDate.getDay())) events.push(makeEvent(toLocalDateKey(loopDate)));
      loopDate.setDate(loopDate.getDate() + 1);
    }
  }

  return events;
}

/** Events grouped by "YYYY-MM-DD", each day sorted by start time. */
export function groupEventsByDate(events: ScheduledEvent[]): Map<string, ScheduledEvent[]> {
  const byDate = new Map<string, ScheduledEvent[]>();
  for (const event of events) {
    const list = byDate.get(event.dateStr);
    if (list) list.push(event);
    else byDate.set(event.dateStr, [event]);
  }
  for (const [key, list] of byDate) byDate.set(key, sortEventsByTime(list));
  return byDate;
}

/**
 * Sort by start time numerically ("9:00" before "13:00"); events without a
 * time ("ตามนัดหมาย") go last. Stable, so equal times keep the class order.
 */
export function sortEventsByTime(events: ScheduledEvent[]): ScheduledEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const am = a.event.startMinutes ?? Number.POSITIVE_INFINITY;
      const bm = b.event.startMinutes ?? Number.POSITIVE_INFINITY;
      if (am !== bm) return am < bm ? -1 : 1;
      return a.index - b.index;
    })
    .map(({ event }) => event);
}

export interface CalendarCell {
  day: number;
  month: "prev" | "curr" | "next";
  date: Date;
  /** "YYYY-MM-DD" */
  key: string;
}

/** Always 42 cells (6 weeks, Sunday first) so the grid height never jumps between months. */
export function getMonthGrid(monthDate: Date): CalendarCell[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const startingDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevLastDay = new Date(year, month, 0).getDate();
  const cells: CalendarCell[] = [];
  const push = (date: Date, kind: CalendarCell["month"]) =>
    cells.push({ day: date.getDate(), month: kind, date, key: toLocalDateKey(date) });

  for (let i = startingDayOfWeek - 1; i >= 0; i--) push(new Date(year, month - 1, prevLastDay - i), "prev");
  for (let i = 1; i <= daysInMonth; i++) push(new Date(year, month, i), "curr");
  for (let i = 1; cells.length < 42; i++) push(new Date(year, month + 1, i), "next");
  return cells;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

/** "2026-10-02" → local Date (midnight), or null when malformed. */
export function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Months the calendar can show: the ones overlapping the generated window
 * (outside it there is no data, so the arrows stop instead of showing a
 * misleading empty month), widened to any event outside it (a demo class
 * scheduled further ahead stays reachable).
 */
export function getNavigableMonthRange(
  now: Date,
  eventDateKeys: Iterable<string> = [],
): { first: Date; last: Date } {
  const { start, end } = getScheduleWindow(now);
  let first = startOfMonth(start);
  let last = startOfMonth(end);
  for (const key of eventDateKeys) {
    const date = parseDateKey(key);
    if (!date) continue;
    const month = startOfMonth(date);
    if (month < first) first = month;
    if (month > last) last = month;
  }
  return { first, last };
}

/** Keep `month` (1st of a month) inside the navigable range. */
export function clampMonth(month: Date, range: { first: Date; last: Date }): Date {
  if (month < range.first) return range.first;
  if (month > range.last) return range.last;
  return month;
}

/** Minimum horizontal travel (px) of a swipe that changes the month. */
export const SWIPE_THRESHOLD_PX = 50;

/**
 * Month step for a horizontal swipe on the calendar: left → next (+1),
 * right → previous (-1), mostly-vertical or short moves → 0 (normal scroll/tap).
 */
export function getSwipeMonthDelta(dx: number, dy: number, threshold: number = SWIPE_THRESHOLD_PX): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

/** Day the agenda selects after moving to `month`: today when it is in that month, else the 1st. */
export function pickSelectedDateForMonth(month: Date, today: Date): Date {
  if (month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()) {
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }
  return startOfMonth(month);
}
