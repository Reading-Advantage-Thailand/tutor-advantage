/**
 * Pure helpers for the dashboard home's schedule blocks (next class, today's
 * sessions, the desktop week grid) and the greeting. No React, no fetch, so
 * they are unit-tested (home-schedule.test.ts).
 *
 * Data: learning-service `GET /v1/classes` (the call the schedule page
 * already makes), expanded into sessions with the schedule page's own
 * `buildEvents`, so Home and ตารางสอน always agree. Only timed sessions are
 * used here: a session without a start time cannot be placed in a time grid
 * or counted down to.
 */

import { formatThaiTime, NBSP, toDateKey } from "@/lib/format";
import { addDays, buildEvents, weekdayOf, type DateKey, type ScheduleClass } from "../schedule/lib/schedule-events";

/** Class as returned by learning-service `GET /v1/classes` (fields used on Home). */
export interface HomeClass extends ScheduleClass {
  cefrLevel?: string | null;
  status?: string | null;
  capacity?: number | null;
  maxStudents?: number | null;
}

/** One timed session of a class on one day. */
export interface HomeSession {
  id: string;
  classId: string;
  title: string;
  book: string;
  students: number;
  /** CEFR band of the class's book ("A0"), for the level dot / block tone. */
  level: string | null;
  dateKey: DateKey;
  /** "17:00" */
  start: string;
  /** "18:00" or null when the class has no end time. */
  end: string | null;
  /** Minutes after midnight (Bangkok). */
  startMin: number;
  /** End in minutes; a session without an end time counts as 60 minutes. */
  endMin: number;
  /** Length in minutes when the end time is known. */
  durationMin: number | null;
}

export interface NextSession extends HomeSession {
  /** 0 = today, 1 = tomorrow … */
  dayOffset: number;
  /** Today and already started (start ≤ now < end). */
  inProgress: boolean;
  /** Minutes until the start (today only, > 0); null otherwise. */
  minutesUntil: number | null;
}

export interface WeekDay {
  dateKey: DateKey;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  isToday: boolean;
  sessions: HomeSession[];
}

export interface HomeSchedule {
  todayKey: DateKey;
  /** Minutes after midnight now (Bangkok). */
  nowMin: number;
  /** Today's timed sessions, by start time. */
  today: HomeSession[];
  /** The first session that has not ended yet (today, then the next 7 days). */
  next: NextSession | null;
  /** Monday-first week containing today. */
  week: WeekDay[];
  /** Hour range of the week grid (start inclusive, end exclusive): 9–21 unless sessions fall outside. */
  hourFrom: number;
  hourTo: number;
}

/** Minutes before the start from which a session can be started ("เริ่มสอน"). */
export const START_WINDOW_MIN = 15;
/** Assumed length of a session without an end time. */
export const DEFAULT_SESSION_MIN = 60;

/** "17:30" → 1050; null for anything else. */
export function toMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const match = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return Number.isFinite(minutes) ? minutes : null;
}

/** Minutes after midnight in Bangkok time. */
export function bangkokMinutes(now: Date): number {
  return toMinutes(formatThaiTime(now)) ?? 0;
}

/** Monday of the week containing `key`. */
export function mondayOf(key: DateKey): DateKey {
  return addDays(key, -((weekdayOf(key) + 6) % 7));
}

/**
 * Expands the tutor's classes into Home's schedule blocks. Demo classes are
 * left out (they have their own page and no time), as are sessions without
 * a start time.
 */
export function buildHomeSchedule(classes: HomeClass[] | null | undefined, now: Date = new Date()): HomeSchedule {
  const todayKey = toDateKey(now);
  const nowMin = bangkokMinutes(now);
  const weekStart = mondayOf(todayKey);
  const weekEnd = addDays(weekStart, 6);
  const horizon = addDays(todayKey, 7);
  const rangeEnd = horizon > weekEnd ? horizon : weekEnd;

  const levelById = new Map((classes ?? []).map((cls) => [cls.id, cls.cefrLevel ?? null]));
  const regular = (classes ?? []).filter((cls) => !cls.isDemo);

  const sessions: HomeSession[] = [];
  for (const event of buildEvents(regular, weekStart, rangeEnd)) {
    const startMin = toMinutes(event.start);
    if (event.isDemo || startMin === null || event.start === null) continue;
    const endRaw = toMinutes(event.end);
    const durationMin = endRaw !== null && endRaw > startMin ? endRaw - startMin : null;
    sessions.push({
      id: event.id,
      classId: event.classId,
      title: event.title,
      book: event.book,
      students: event.students,
      level: levelById.get(event.classId) ?? null,
      dateKey: event.dateKey,
      start: event.start,
      end: durationMin !== null ? event.end : null,
      startMin,
      endMin: startMin + (durationMin ?? DEFAULT_SESSION_MIN),
      durationMin,
    });
  }

  const today = sessions.filter((session) => session.dateKey === todayKey);

  const upcoming = sessions.find(
    (session) => session.dateKey > todayKey || (session.dateKey === todayKey && session.endMin > nowMin),
  );
  let next: NextSession | null = null;
  if (upcoming && upcoming.dateKey <= horizon) {
    const isToday = upcoming.dateKey === todayKey;
    const dayOffset = Math.round(
      (Date.parse(`${upcoming.dateKey}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / 86_400_000,
    );
    next = {
      ...upcoming,
      dayOffset,
      inProgress: isToday && upcoming.startMin <= nowMin,
      minutesUntil: isToday && upcoming.startMin > nowMin ? upcoming.startMin - nowMin : null,
    };
  }

  const week: WeekDay[] = Array.from({ length: 7 }, (_, index) => {
    const dateKey = addDays(weekStart, index);
    return {
      dateKey,
      weekday: weekdayOf(dateKey),
      isToday: dateKey === todayKey,
      sessions: sessions.filter((session) => session.dateKey === dateKey),
    };
  });

  const weekSessions = week.flatMap((day) => day.sessions);
  const earliest = Math.min(...weekSessions.map((session) => session.startMin), 9 * 60);
  const latest = Math.max(...weekSessions.map((session) => session.endMin), 21 * 60);
  const hourFrom = Math.max(0, Math.floor(earliest / 60));
  const hourTo = Math.min(24, Math.ceil(latest / 60));

  return { todayKey, nowMin, today, next, week, hourFrom, hourTo };
}

/** Today's session can be started now: from 15 minutes before the start until it ends. */
export function canStartNow(session: HomeSession, schedule: Pick<HomeSchedule, "todayKey" | "nowMin">): boolean {
  return (
    session.dateKey === schedule.todayKey &&
    schedule.nowMin >= session.startMin - START_WINDOW_MIN &&
    schedule.nowMin < session.endMin
  );
}

/** Position of a session in the week grid track, in percent of the hour range. */
export function gridPosition(session: Pick<HomeSession, "startMin" | "endMin">, hourFrom: number, hourTo: number) {
  const span = Math.max(1, (hourTo - hourFrom) * 60);
  const from = hourFrom * 60;
  const left = Math.min(100, Math.max(0, ((session.startMin - from) / span) * 100));
  const right = Math.min(100, Math.max(0, ((session.endMin - from) / span) * 100));
  return { left, width: Math.max(0, right - left) };
}

/** Morning before 12:00, afternoon until 17:00, evening after (Bangkok time). */
export function greetingPart(now: Date = new Date()): "morning" | "afternoon" | "evening" {
  const minutes = bangkokMinutes(now);
  if (minutes < 12 * 60) return "morning";
  if (minutes < 17 * 60) return "afternoon";
  return "evening";
}

const THAI_LEAD = /^[฀-๿]/u;

/**
 * Name after "ครู": joined for Thai names ("ครูนกเอี้ยง"), a no-break space
 * before Latin names ("ครู Anna", so "ครู" never ends a line). Returns ""
 * when there is no name.
 */
export function teacherNameSuffix(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "";
  return THAI_LEAD.test(trimmed) ? trimmed : `${NBSP}${trimmed}`;
}

/** Seats still free across open classes (capacity − students, never negative). */
export function openSeats(classes: HomeClass[] | null | undefined): number {
  return (classes ?? [])
    .filter((cls) => !cls.isDemo && (cls.status ?? "").toLowerCase() === "open")
    .reduce((sum, cls) => {
      const capacity = cls.capacity ?? cls.maxStudents ?? 0;
      return sum + Math.max(0, capacity - (cls.students ?? 0));
    }, 0);
}
