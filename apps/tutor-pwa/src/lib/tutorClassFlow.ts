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
  meetingUrl?: string;
  startsAt?: string;
  endsAt?: string;
  totalHours?: number;
};

export type CreateClassRequest = {
  title: string;
  bookId: string;
  capacity: number;
  scheduleDescription: string;
  meetingUrl?: string;
  startsAt?: string;
  endsAt?: string;
  totalHours?: number;
};

// Maximum live-teaching hours allowed per class schedule
export const MAX_CLASS_HOURS = 22;

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
    meetingUrl: data.meetingUrl,
    startsAt: data.startsAt || undefined,
    endsAt: data.endsAt || undefined,
    totalHours: data.totalHours,
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
