import { NBSP, toDateKey } from "@/lib/format";
import { t } from "@/lib/i18n";

/**
 * Pure schedule logic (no React): Bangkok calendar-day keys ("YYYY-MM-DD"),
 * week/month grids and the class → sessions expansion used by the schedule
 * page. Keys avoid browser-timezone drift: all day maths runs in UTC on the
 * key, and display goes through `keyToDate()` + lib/format (Asia/Bangkok).
 */

export type DateKey = string;

/** Class as returned by learning-service `GET /v1/classes` (fields used here). */
export interface ScheduleClass {
  id: string;
  name: string;
  book?: string | null;
  students?: number | null;
  nextSession?: string | null;
  scheduleData?: unknown;
  startsAt?: string | null;
  endsAt?: string | null;
  isDemo?: boolean | null;
  expiresAt?: string | null;
}

export interface ScheduledEvent {
  id: string;
  classId: string;
  title: string;
  book: string;
  students: number;
  /** "18:00" or null (all day / by appointment) */
  start: string | null;
  end: string | null;
  /** Display label: "18:00–19:30 น.", "ตามนัดหมาย", "ตลอดวัน (24 ชม.)" */
  timeLabel: string;
  dateKey: DateKey;
  /** Raw schedule description (for calendar export). */
  schedule: string;
  startsAt: string | null;
  endsAt: string | null;
  isDemo: boolean;
}

// ─── Day keys ───────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function keyToUtc(key: DateKey): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToKey(ms: number): DateKey {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function addDays(key: DateKey, days: number): DateKey {
  return utcToKey(keyToUtc(key) + days * DAY_MS);
}

/** First day of the month `months` away from the key's month. */
export function addMonths(key: DateKey, months: number): DateKey {
  const [y, m] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, 1));
  return utcToKey(date.getTime());
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(key: DateKey): number {
  return new Date(keyToUtc(key)).getUTCDay();
}

/** Noon in Bangkok on that day, for lib/format display (never off by a day). */
export function keyToDate(key: DateKey): Date {
  return new Date(`${key}T12:00:00+07:00`);
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

/** The 7 day keys of the (Sunday-first) week containing `key`. */
export function weekKeys(key: DateKey): DateKey[] {
  const start = addDays(key, -weekdayOf(key));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 42 cells (6 Sunday-first weeks) covering the month of `key`. */
export function monthGrid(key: DateKey): { key: DateKey; inMonth: boolean }[] {
  const first = `${key.slice(0, 7)}-01`;
  const start = addDays(first, -weekdayOf(first));
  return Array.from({ length: 42 }, (_, i) => {
    const cell = addDays(start, i);
    return { key: cell, inMonth: cell.slice(0, 7) === key.slice(0, 7) };
  });
}

// ─── Schedule parsing ───────────────────────────────────────────────────────

const DAY_CODES: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

export interface WeeklySlot {
  day: number;
  start: string | null;
  end: string | null;
}

function normaliseTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2})[:.](\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : null;
}

/** "18:00 - 19:30 น." → { start, end } (null when there is no time range). */
export function extractTimeRange(text: string): { start: string | null; end: string | null } {
  const match = text.match(/(\d{1,2}[:.]\d{2})(?:\s*น\.?)?\s*[-–]\s*(\d{1,2}[:.]\d{2})(?:\s*น\.?)?/i);
  if (!match) return { start: null, end: null };
  return { start: normaliseTime(match[1]), end: normaliseTime(match[2]) };
}

/**
 * Weekly days + time from the Thai schedule text ("ทุกวันจันทร์ และ พฤหัสบดี
 * 18:00 - 19:30"). Same rules as before: "ทุกวัน" without a weekday means
 * every day; no weekday at all (or "ยังไม่ได้กำหนด") falls back to Mon/Wed/Fri.
 */
export function parseThaiSchedule(scheduleStr: string): WeeklySlot[] {
  const fallbackDays = [1, 3, 5];
  if (!scheduleStr || scheduleStr === t("dashboardSchedule.unsetSchedule")) {
    return fallbackDays.map((day) => ({ day, start: null, end: null }));
  }
  const lower = scheduleStr.toLowerCase();
  const dayMapping: Record<string, number> = {
    [t("tutorClass.days.sunFull")]: 0,
    [t("tutorClass.days.monFull")]: 1,
    [t("tutorClass.days.tueFull")]: 2,
    [t("tutorClass.days.wedFull")]: 3,
    [t("tutorClass.days.thuFull")]: 4,
    [t("dashboardSchedule.parserThuShort")]: 4,
    [t("tutorClass.days.friFull")]: 5,
    [t("tutorClass.days.satFull")]: 6,
  };
  const days: number[] = [];
  Object.entries(dayMapping).forEach(([name, value]) => {
    if (lower.includes(name) && !days.includes(value)) days.push(value);
  });
  const { start, end } = extractTimeRange(scheduleStr);
  if (days.length === 0) {
    const everyDay = lower.includes(t("tutorClass.scheduleEveryDayPrefix"));
    return (everyDay ? [0, 1, 2, 3, 4, 5, 6] : fallbackDays).map((day) => ({ day, start, end }));
  }
  return days.sort((a, b) => a - b).map((day) => ({ day, start, end }));
}

/**
 * Structured `scheduleData` when the class has it: weekly template items
 * (`{ day: "MON", start, end }`) and/or dated items (`{ date, start, end }`).
 * Returns null when it is missing or unrecognised (callers fall back to text).
 */
export function readScheduleData(
  scheduleData: unknown,
): { weekly: WeeklySlot[]; dated: { dateKey: DateKey; start: string | null; end: string | null }[] } | null {
  if (!Array.isArray(scheduleData) || scheduleData.length === 0) return null;
  const weekly: WeeklySlot[] = [];
  const dated: { dateKey: DateKey; start: string | null; end: string | null }[] = [];
  for (const item of scheduleData) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const start = normaliseTime(record.start ?? record.startTime);
    const end = normaliseTime(record.end ?? record.endTime);
    if (typeof record.day === "string" && record.day.toUpperCase().slice(0, 3) in DAY_CODES) {
      weekly.push({ day: DAY_CODES[record.day.toUpperCase().slice(0, 3)], start, end });
    } else if (typeof record.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(record.date)) {
      dated.push({ dateKey: record.date.slice(0, 10), start, end });
    }
  }
  if (weekly.length === 0 && dated.length === 0) return null;
  return { weekly, dated };
}

export function formatSlotTime(start: string | null, end: string | null): string {
  if (!start) return t("dashboardSchedule.byAppointment");
  if (!end) return `${start}${NBSP}${t("tutorClass.scheduleSuffix")}`;
  return `${start}–${end}${NBSP}${t("tutorClass.scheduleSuffix")}`;
}

// ─── Expansion ──────────────────────────────────────────────────────────────

/**
 * Sessions of every class between `fromKey` and `toKey` (inclusive), sorted
 * by day then start time. Demo classes appear once, on their creation day
 * (expiry − 24 h). Regular classes repeat weekly inside their start/end dates.
 */
export function buildEvents(classes: ScheduleClass[], fromKey: DateKey, toKey: DateKey): ScheduledEvent[] {
  const events: ScheduledEvent[] = [];
  const inRange = (key: DateKey) => key >= fromKey && key <= toKey;

  for (const cls of classes) {
    const base = {
      classId: cls.id,
      title: cls.name,
      book: cls.book ?? "",
      students: cls.students ?? 0,
      startsAt: cls.startsAt ?? null,
      endsAt: cls.endsAt ?? null,
    };

    if (cls.isDemo) {
      const created = cls.expiresAt ? new Date(new Date(cls.expiresAt).getTime() - DAY_MS) : new Date();
      const key = toDateKey(created);
      if (key && inRange(key)) {
        events.push({
          ...base,
          id: `${cls.id}-${key}`,
          start: null,
          end: null,
          timeLabel: t("dashboardSchedule.allDay"),
          dateKey: key,
          schedule: t("dashboardSchedule.demoRoom"),
          isDemo: true,
        });
      }
      continue;
    }

    const schedule = cls.nextSession || "";
    const structured = readScheduleData(cls.scheduleData);
    const weekly = structured ? structured.weekly : parseThaiSchedule(schedule);
    const classFrom = cls.startsAt ? toDateKey(cls.startsAt) : "";
    const classTo = cls.endsAt ? toDateKey(cls.endsAt) : "";
    const from = classFrom && classFrom > fromKey ? classFrom : fromKey;
    const to = classTo && classTo < toKey ? classTo : toKey;

    const push = (key: DateKey, start: string | null, end: string | null) => {
      events.push({
        ...base,
        id: `${cls.id}-${key}-${start ?? "x"}`,
        start,
        end,
        timeLabel: formatSlotTime(start, end),
        dateKey: key,
        schedule,
        isDemo: false,
      });
    };

    if (weekly.length > 0) {
      for (let key = from; key <= to; key = addDays(key, 1)) {
        const weekday = weekdayOf(key);
        weekly.filter((slot) => slot.day === weekday).forEach((slot) => push(key, slot.start, slot.end));
      }
    }
    structured?.dated.forEach((slot) => {
      if (inRange(slot.dateKey)) push(slot.dateKey, slot.start, slot.end);
    });
  }

  return events.sort(
    (a, b) => a.dateKey.localeCompare(b.dateKey) || (a.start ?? "99").localeCompare(b.start ?? "99") || a.title.localeCompare(b.title),
  );
}

/** Group events by day key. */
export function groupByDay(events: ScheduledEvent[]): Map<DateKey, ScheduledEvent[]> {
  const map = new Map<DateKey, ScheduledEvent[]>();
  for (const event of events) {
    const list = map.get(event.dateKey);
    if (list) list.push(event);
    else map.set(event.dateKey, [event]);
  }
  return map;
}

/** Teaching minutes of timed events (for the week summary). */
export function totalMinutes(events: ScheduledEvent[]): number {
  return events.reduce((sum, event) => {
    if (!event.start || !event.end) return sum;
    const [sh, sm] = event.start.split(":").map(Number);
    const [eh, em] = event.end.split(":").map(Number);
    const minutes = eh * 60 + em - (sh * 60 + sm);
    return minutes > 0 ? sum + minutes : sum;
  }, 0);
}
