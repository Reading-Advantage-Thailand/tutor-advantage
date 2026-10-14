/**
 * "Add to calendar" helpers for a class's weekly schedule (ICS file and
 * Google Calendar link). Pure functions (no DOM) except `downloadIcsFile`.
 *
 * Behaviour is kept identical to the helpers that used to live in
 * classes/[id]/page.tsx:
 * - Weekdays are read from Thai day names inside the free-text schedule
 *   ("จันทร์", "พฤหัส"/"พฤหัสบดี", …); no match → Monday.
 * - The first "HH:MM - HH:MM" range is the lesson time; none → 19:00–21:00.
 * - Dates/times are formatted with the device's local clock and labelled
 *   TZID=Asia/Bangkok (the students' time zone).
 */

/** JS weekday (0 = Sunday) → iCalendar BYDAY code. */
export const ICS_BYDAY: Record<number, string> = {
  0: "SU",
  1: "MO",
  2: "TU",
  3: "WE",
  4: "TH",
  5: "FR",
  6: "SA",
};

/** Thai day names → JS weekday. Order matters: it is the order of `days`. */
export const ICS_DAY_MAP: Record<string, number> = {
  จันทร์: 1,
  อังคาร: 2,
  พุธ: 3,
  พฤหัสบดี: 4,
  พฤหัส: 4,
  ศุกร์: 5,
  เสาร์: 6,
  อาทิตย์: 0,
};

export interface ParsedSchedule {
  /** JS weekdays (0 = Sunday), unique, in ICS_DAY_MAP order. */
  days: number[];
  sh: number;
  sm: number;
  eh: number;
  em: number;
}

export function parseScheduleForCalendar(schedule: string): ParsedSchedule {
  const days: number[] = [];
  Object.entries(ICS_DAY_MAP).forEach(([name, value]) => {
    if (schedule.includes(name) && !days.includes(value)) days.push(value);
  });
  if (days.length === 0) days.push(1);
  const match = schedule.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  return {
    days,
    sh: match ? parseInt(match[1]) : 19,
    sm: match ? parseInt(match[2]) : 0,
    eh: match ? parseInt(match[3]) : 21,
    em: match ? parseInt(match[4]) : 0,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local date + given time → "YYYYMMDDTHHMM00". */
export function formatCalendarDateTime(date: Date, hours: number, minutes: number): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(hours)}${pad(minutes)}00`;
}

/** UTC stamp "YYYYMMDDTHHMMSSZ" (DTSTAMP / UNTIL). */
function toUtcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:.]/g, "").slice(0, 15)}Z`;
}

/** First day on/after `anchor` (local midnight) that is one of `days` (searches 7 days). */
export function firstOccurrence(anchor: Date, days: number[]): Date {
  const first = new Date(anchor);
  first.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    if (days.includes(first.getDay())) break;
    first.setDate(first.getDate() + 1);
  }
  return first;
}

export interface CalendarClass {
  id: string;
  name: string;
  schedule: string;
  startsAt?: string | null;
  endsAt?: string | null;
}

/** Full VCALENDAR text (CRLF line endings) with a weekly RRULE and a 30-min alarm. */
export function buildClassIcs(cls: CalendarClass, now: Date = new Date()): string {
  const { days, sh, sm, eh, em } = parseScheduleForCalendar(cls.schedule);
  const anchor = cls.startsAt ? new Date(cls.startsAt) : new Date(now);
  const first = firstOccurrence(anchor, days);
  const byday = days.map((day) => ICS_BYDAY[day]).join(",");
  const until = cls.endsAt ? `;UNTIL=${toUtcStamp(new Date(cls.endsAt))}` : "";
  const dtstamp = toUtcStamp(now);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tutor Advantage//TH",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-TIMEZONE:Asia/Bangkok",
    "BEGIN:VEVENT",
    `UID:${cls.id}@ta.th`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=Asia/Bangkok:${formatCalendarDateTime(first, sh, sm)}`,
    `DTEND;TZID=Asia/Bangkok:${formatCalendarDateTime(first, eh, em)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${byday}${until}`,
    `SUMMARY:${cls.name}`,
    `DESCRIPTION:${cls.schedule.replace(/\n/g, "\\n")}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:แจ้งเตือน: ${cls.name}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Download file name: spaces → dashes. */
export function icsFileName(className: string): string {
  return `${className.replace(/\s+/g, "-")}.ics`;
}

/**
 * Google Calendar "create event" URL. Note: the first event uses the start
 * date itself (not the first matching weekday) — unchanged legacy behaviour.
 */
export function buildGoogleCalendarUrl(
  cls: Pick<CalendarClass, "name" | "schedule" | "startsAt">,
  now: Date = new Date(),
): string {
  const { days, sh, sm, eh, em } = parseScheduleForCalendar(cls.schedule);
  const anchor = cls.startsAt ? new Date(cls.startsAt) : new Date(now);
  const byday = days.map((day) => ICS_BYDAY[day]).join("%2C");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(cls.name)}&dates=${formatCalendarDateTime(anchor, sh, sm)}/${formatCalendarDateTime(anchor, eh, em)}&recur=RRULE%3AFREQ%3DWEEKLY%3BBYDAY%3D${byday}&details=${encodeURIComponent(cls.schedule)}`;
}

/** Triggers a browser download of the ICS text (blob URL + temporary <a download>). */
export function downloadIcsFile(ics: string, fileName: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
