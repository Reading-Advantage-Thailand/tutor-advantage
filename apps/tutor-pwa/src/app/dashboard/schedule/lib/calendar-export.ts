/**
 * Calendar export for a class's weekly schedule (moved unchanged from
 * schedule-client): .ics (add / cancel) and a Google Calendar template URL.
 * Pure string builders plus a tiny browser download helper.
 */

export interface CalendarExportInput {
  classId: string;
  title: string;
  /** Thai schedule text, e.g. "ทุกวันจันทร์ และ พฤหัสบดี 18:00 - 19:30" */
  schedule: string;
  startsAt?: string | null;
  endsAt?: string | null;
  /** Fallback anchor day "YYYY-MM-DD" when startsAt is missing. */
  dateKey?: string | null;
}

const BY_DAY: Record<number, string> = { 0: "SU", 1: "MO", 2: "TU", 3: "WE", 4: "TH", 5: "FR", 6: "SA" };
const DAY_NAMES_MAP: Record<string, number> = {
  จันทร์: 1,
  อังคาร: 2,
  พุธ: 3,
  พฤหัสบดี: 4,
  พฤหัส: 4,
  ศุกร์: 5,
  เสาร์: 6,
  อาทิตย์: 0,
};

export function parseDaysAndTime(schedStr: string) {
  const days: number[] = [];
  Object.entries(DAY_NAMES_MAP).forEach(([name, val]) => {
    if (schedStr.includes(name) && !days.includes(val)) days.push(val);
  });
  if (days.length === 0) days.push(1);
  const m = schedStr.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  return {
    days,
    sh: m ? parseInt(m[1]) : 19,
    sm: m ? parseInt(m[2]) : 0,
    eh: m ? parseInt(m[3]) : 21,
    em: m ? parseInt(m[4]) : 0,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date, h: number, mi: number) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(h)}${pad(mi)}00`;
const stamp = (d: Date) => d.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";

function anchorOf(ev: CalendarExportInput): Date {
  return ev.startsAt ? new Date(ev.startsAt) : ev.dateKey ? new Date(ev.dateKey) : new Date();
}

export function buildICSContent(ev: CalendarExportInput, now: Date = new Date()): string {
  const schedStr = ev.schedule || "";
  const { days, sh, sm, eh, em } = parseDaysAndTime(schedStr);
  const first = new Date(anchorOf(ev));
  first.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    if (days.includes(first.getDay())) break;
    first.setDate(first.getDate() + 1);
  }
  const byday = days.map((d) => BY_DAY[d]).join(",");
  const until = ev.endsAt ? `;UNTIL=${stamp(new Date(ev.endsAt))}` : "";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tutor Advantage//TH",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-TIMEZONE:Asia/Bangkok",
    "BEGIN:VEVENT",
    `UID:${ev.classId}@ta.th`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;TZID=Asia/Bangkok:${fmt(first, sh, sm)}`,
    `DTEND;TZID=Asia/Bangkok:${fmt(first, eh, em)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${byday}${until}`,
    `SUMMARY:${ev.title}`,
    `DESCRIPTION:${schedStr.replace(/\n/g, "\\n")}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:แจ้งเตือน: ${ev.title}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function buildCancelICSContent(ev: Pick<CalendarExportInput, "classId" | "title">, now: Date = new Date()): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tutor Advantage//TH",
    "CALSCALE:GREGORIAN",
    "METHOD:CANCEL",
    "BEGIN:VEVENT",
    `UID:${ev.classId}@ta.th`,
    `DTSTAMP:${stamp(now)}`,
    `SUMMARY:${ev.title}`,
    "STATUS:CANCELLED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function googleCalUrl(ev: CalendarExportInput): string {
  const schedStr = ev.schedule || "";
  const { days, sh, sm, eh, em } = parseDaysAndTime(schedStr);
  const anchor = anchorOf(ev);
  const byday = days.map((d) => BY_DAY[d]).join("%2C");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&dates=${fmt(anchor, sh, sm)}/${fmt(anchor, eh, em)}&recur=RRULE%3AFREQ%3DWEEKLY%3BBYDAY%3D${byday}&details=${encodeURIComponent(schedStr)}`;
}

export function icsFileName(title: string, cancel = false): string {
  return `${cancel ? "cancel-" : ""}${title.replace(/\s+/g, "-")}.ics`;
}

/** Browser-only: save text as a file. */
export function downloadTextFile(content: string, fileName: string, type = "text/calendar;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
