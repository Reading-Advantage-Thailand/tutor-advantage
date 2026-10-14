import { t } from "./i18n";

export type ClassDay = {
  label: string;
  full: string;
  value: string;
};

export type CreateClassForm = {
  name: string;
  book: string;
  schedule: string;
  scheduleData?: any[];
  meetingUrl?: string;
  startsAt?: string;
  endsAt?: string;
  totalHours?: number;
  couponCode?: string;
};

export type CreateClassRequest = {
  title: string;
  bookId: string;
  capacity: number;
  scheduleDescription: string;
  scheduleData?: any[];
  meetingUrl?: string;
  startsAt?: string;
  endsAt?: string;
  totalHours?: number;
  couponCode?: string;
};

// Maximum live-teaching hours allowed per class schedule
export const MAX_CLASS_HOURS = 22;

// Parse a "yyyy-MM-dd" string as a LOCAL calendar date (midnight local time).
// Using `new Date("yyyy-MM-dd")` parses as UTC, which then shifts the day when
// formatted/compared in local time. This keeps schedule dates stable across
// save/load round-trips in any timezone.
//
// Tolerant: anything that is not a "yyyy-MM-dd…" string (e.g. `undefined` from a
// weekly-template entry `{ day, start, end }`) yields an Invalid Date instead of
// throwing. Use `tryParseLocalDate` when you need to branch on validity.
export function parseLocalDate(dateStr: string | null | undefined): Date {
  return tryParseLocalDate(dateStr) ?? new Date(Number.NaN);
}

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Like `parseLocalDate` but returns `null` for missing/malformed input. */
export function tryParseLocalDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = LOCAL_DATE_RE.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  // Reject roll-overs such as 2026-02-31.
  if (date.getMonth() !== m - 1) return null;
  return date;
}

/** Local calendar key "yyyy-MM-dd" (same as date-fns `format(d, "yyyy-MM-dd")`). */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local midnight of `date` (a copy). */
export function startOfLocalDay(date: Date = new Date()): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export type WeeklyTemplate = {
  id: string;
  label: string;
  days: string[];
  startTime: string;
  endTime: string;
};

// Quick-pick weekly schedule presets
export const WEEKLY_TEMPLATES: WeeklyTemplate[] = [
  { id: "weekday-eve", label: "จ–ศ เย็น", days: ["MON", "TUE", "WED", "THU", "FRI"], startTime: "18:00", endTime: "20:00" },
  { id: "mwf-eve", label: "จ/พ/ศ เย็น", days: ["MON", "WED", "FRI"], startTime: "18:00", endTime: "20:00" },
  { id: "tt-eve", label: "อ/พฤ เย็น", days: ["TUE", "THU"], startTime: "18:00", endTime: "20:00" },
  { id: "weekend-morning", label: "ส–อา เช้า", days: ["SAT", "SUN"], startTime: "09:00", endTime: "12:00" },
];

export const CLASS_DAYS: ClassDay[] = [
  { label: t("tutorClass.days.monShort"), full: t("tutorClass.days.monFull"), value: "MON" },
  { label: t("tutorClass.days.tueShort"), full: t("tutorClass.days.tueFull"), value: "TUE" },
  { label: t("tutorClass.days.wedShort"), full: t("tutorClass.days.wedFull"), value: "WED" },
  { label: t("tutorClass.days.thuShort"), full: t("tutorClass.days.thuFull"), value: "THU" },
  { label: t("tutorClass.days.friShort"), full: t("tutorClass.days.friFull"), value: "FRI" },
  { label: t("tutorClass.days.satShort"), full: t("tutorClass.days.satFull"), value: "SAT" },
  { label: t("tutorClass.days.sunShort"), full: t("tutorClass.days.sunFull"), value: "SUN" },
];

export const CLASS_TIME_OPTIONS = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
];

export function buildScheduleString(
  days: string[],
  startTime: string,
  endTime: string,
  availableDays: ClassDay[] = CLASS_DAYS,
): string {
  if (!days.length || !startTime || !endTime) return "";

  const dayLabels = days
    .map((value) => availableDays.find((day) => day.value === value)?.full)
    .filter(Boolean)
    .join(", ");

  if (!dayLabels) return "";

  return `${t("tutorClass.scheduleEveryDayPrefix")}${dayLabels} ${startTime}-${endTime} ${t("tutorClass.scheduleSuffix")}`;
}

export function toggleClassDay(selectedDays: string[], day: string): string[] {
  return selectedDays.includes(day)
    ? selectedDays.filter((selectedDay) => selectedDay !== day)
    : [...selectedDays, day];
}

export function getEndTimeOptions(
  startTime: string,
  timeOptions: string[] = CLASS_TIME_OPTIONS,
): string[] {
  return timeOptions.filter((time) => time > startTime);
}

// Hours between two "HH:MM" times (single session length)
export function diffHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  return minutes > 0 ? minutes / 60 : 0;
}

const DAY_TO_INDEX: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

// Count how many of the selected weekdays fall within [startsAt, endsAt] inclusive
export function countSessionOccurrences(
  days: string[],
  startsAt?: string,
  endsAt?: string,
): number {
  if (!days.length || !startsAt || !endsAt) return 0;
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  const wanted = new Set(days.map((d) => DAY_TO_INDEX[d]).filter((n) => n !== undefined));
  if (wanted.size === 0) return 0;

  let count = 0;
  let guard = 0;
  const cur = new Date(start);
  while (cur <= end && guard < 3660) {
    if (wanted.has(cur.getDay())) count++;
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return count;
}

// Total live-teaching hours = session length × number of session days in range
export function calculateTotalHours(
  days: string[],
  startTime: string,
  endTime: string,
  startsAt?: string,
  endsAt?: string,
): number {
  const per = diffHours(startTime, endTime);
  if (per <= 0) return 0;
  const occurrences = countSessionOccurrences(days, startsAt, endsAt);
  return Math.round(per * occurrences * 100) / 100;
}

export function buildCreateClassRequest(
  data: CreateClassForm,
  capacity = 30,
): CreateClassRequest {
  return {
    title: data.name,
    bookId: data.book,
    capacity,
    scheduleDescription: data.schedule,
    scheduleData: data.scheduleData,
    meetingUrl: data.meetingUrl,
    startsAt: data.startsAt || undefined,
    endsAt: data.endsAt || undefined,
    totalHours: data.totalHours,
    couponCode: data.couponCode?.trim() || undefined,
  };
}

export function getClassActionErrorMessage(
  data: unknown,
  fallback: string,
): string {
  if (data && typeof data === "object") {
    if ("message" in data && typeof data.message === "string" && data.message.trim()) {
      return data.message;
    }

    if ("error" in data) {
      const error = data.error;
      if (typeof error === "string" && error.trim()) {
        return error;
      }
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string" &&
        error.message.trim()
      ) {
        return error.message;
      }
    }
  }

  return fallback;
}

/* ─── Schedule data (class.scheduleData) ─────────────────────────────── */

export type TimeSlot = { start: string; end: string };
/** One dated teaching session: { date: "2026-10-05", start: "18:00", end: "20:00" }. */
export type DatedScheduleEntry = TimeSlot & { date: string };
/** Weekly template entry (older classes / seed data): { day: "MON", start, end }. */
export type WeeklyScheduleEntry = TimeSlot & { day: string };
export type ScheduleTimes = Record<string, TimeSlot>;

const WEEKDAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

/**
 * Splits raw `scheduleData` into dated sessions and weekly template entries.
 * Accepts both shapes (and ignores junk), so callers never call
 * `parseLocalDate(undefined)` on a template entry.
 */
export function normalizeScheduleData(raw: unknown): {
  dated: DatedScheduleEntry[];
  weekly: WeeklyScheduleEntry[];
} {
  const dated: DatedScheduleEntry[] = [];
  const weekly: WeeklyScheduleEntry[] = [];
  if (!Array.isArray(raw)) return { dated, weekly };
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const start = typeof entry.start === "string" ? entry.start : "";
    const end = typeof entry.end === "string" ? entry.end : "";
    const date = tryParseLocalDate(entry.date);
    if (date) {
      dated.push({ date: toLocalDateKey(date), start, end });
      continue;
    }
    const day = typeof entry.day === "string" ? entry.day.trim().toUpperCase().slice(0, 3) : "";
    if ((WEEKDAY_CODES as readonly string[]).includes(day)) {
      weekly.push({ day, start, end });
    }
  }
  return { dated, weekly };
}

/** Sum of session lengths in hours for raw scheduleData (either shape). */
export function sumScheduledHours(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  const total = raw.reduce<number>((sum, item) => {
    if (!item || typeof item !== "object") return sum;
    const { start, end } = item as Record<string, unknown>;
    return sum + diffHours(typeof start === "string" ? start : "", typeof end === "string" ? end : "");
  }, 0);
  return Math.round(total * 100) / 100;
}

/** Weekday code → time slot, from a quick-pick template. */
export function templateToSlots(template: Pick<WeeklyTemplate, "days" | "startTime" | "endTime">): Record<string, TimeSlot> {
  const slots: Record<string, TimeSlot> = {};
  for (const day of template.days) slots[day] = { start: template.startTime, end: template.endTime };
  return slots;
}

/** Weekday code → time slot, from weekly-template schedule entries. */
export function weeklyEntriesToSlots(entries: WeeklyScheduleEntry[]): Record<string, TimeSlot> {
  const slots: Record<string, TimeSlot> = {};
  for (const entry of entries) {
    if (diffHours(entry.start, entry.end) > 0) slots[entry.day] = { start: entry.start, end: entry.end };
  }
  return slots;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(Math.round(total % 60)).padStart(2, "0")}`;
}

/**
 * Generates teaching dates from `startDate` onward on the slot weekdays until
 * `maxHours` is reached; the last session is shortened to land exactly on it.
 * `keep` (e.g. past sessions that can no longer change) is kept and counts
 * towards the hours. Returns sorted dates + a time slot per date key.
 */
export function generateSchedule({
  startDate,
  slots,
  maxHours,
  keep,
}: {
  startDate: string;
  slots: Record<string, TimeSlot>;
  maxHours: number;
  keep?: { dates: Date[]; times: ScheduleTimes };
}): { dates: Date[]; times: ScheduleTimes } {
  const dates: Date[] = [...(keep?.dates ?? [])];
  const times: ScheduleTimes = { ...(keep?.times ?? {}) };
  const start = tryParseLocalDate(startDate);
  const hasHours = Object.values(slots).some((slot) => diffHours(slot.start, slot.end) > 0);
  if (!start || !hasHours) return { dates, times };

  let accumulated = 0;
  for (const d of dates) {
    const slot = times[toLocalDateKey(d)];
    if (slot) accumulated += diffHours(slot.start, slot.end);
  }

  const cur = startOfLocalDay(start);
  let guard = 0;
  while (accumulated < maxHours && guard < 3660) {
    const slot = slots[WEEKDAY_CODES[cur.getDay()]];
    const slotHours = slot ? diffHours(slot.start, slot.end) : 0;
    if (slot && slotHours > 0) {
      const d = new Date(cur);
      const key = toLocalDateKey(d);
      const needed = maxHours - accumulated;
      if (!times[key]) {
        dates.push(d);
        if (needed >= slotHours) {
          times[key] = { start: slot.start, end: slot.end };
          accumulated += slotHours;
        } else {
          times[key] = { start: slot.start, end: addMinutes(slot.start, needed * 60) };
          accumulated += needed;
        }
      }
    }
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  dates.sort((a, b) => a.getTime() - b.getTime());
  return { dates, times };
}

/** Total hours of the selected dates (rounded to 2 decimals). */
export function totalScheduleHours(dates: Date[], times: ScheduleTimes): number {
  let sum = 0;
  for (const d of dates) {
    const slot = times[toLocalDateKey(d)];
    if (slot) sum += diffHours(slot.start, slot.end);
  }
  return Math.round(sum * 100) / 100;
}

/** Sorted dated entries for the API payload. */
export function buildScheduleEntries(dates: Date[], times: ScheduleTimes): DatedScheduleEntry[] {
  return [...dates]
    .sort((a, b) => a.getTime() - b.getTime())
    .map((d) => {
      const key = toLocalDateKey(d);
      return { date: key, start: times[key]?.start || "", end: times[key]?.end || "" };
    });
}

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** Local calendar date as "5 ต.ค. 69" (Buddhist-era 2-digit year). */
export function formatShortThaiLocalDate(date: Date, withYear = true): string {
  const base = `${date.getDate()} ${THAI_MONTHS_SHORT[date.getMonth()]}`;
  if (!withYear) return base;
  return `${base} ${String((date.getFullYear() + 543) % 100).padStart(2, "0")}`;
}

/**
 * Human schedule summary stored as `scheduleDescription` and shown to
 * students, e.g. "5 ต.ค. 69 - 30 พ.ย. 69 (รวม 12 วัน)" or
 * "5 ต.ค. 69 (18:00-20:00)" for a single session.
 */
export function buildScheduleDescription(dates: Date[], times: ScheduleTimes): string {
  if (dates.length === 0) return "";
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const startStr = formatShortThaiLocalDate(first);
  if (sorted.length === 1) {
    const slot = times[toLocalDateKey(first)];
    return `${startStr} (${slot?.start || ""}-${slot?.end || ""})`;
  }
  return `${startStr} - ${formatShortThaiLocalDate(last)} (${t("tutorClass.schedule.totalDaysPrefix")} ${sorted.length} ${t("tutorClass.schedule.daysUnit")})`;
}

/** Sessions before `today` (locked in the reschedule editor; they still count towards the hours). */
export function splitPastSchedule(
  entries: DatedScheduleEntry[],
  today: Date = startOfLocalDay(),
): { dates: Date[]; times: ScheduleTimes } {
  const dates: Date[] = [];
  const times: ScheduleTimes = {};
  for (const entry of entries) {
    const d = tryParseLocalDate(entry.date);
    if (d && d < today) {
      dates.push(d);
      times[entry.date] = { start: entry.start, end: entry.end };
    }
  }
  return { dates, times };
}

/** Converts a local calendar date into a Bangkok-noon ISO string so lib/format shows the same day in any timezone. */
export function localDateToBangkokNoon(date: Date): string {
  return `${toLocalDateKey(date)}T12:00:00+07:00`;
}
