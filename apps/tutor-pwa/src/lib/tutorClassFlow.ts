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
};

export type CreateClassRequest = {
  title: string;
  bookId: string;
  capacity: number;
  scheduleDescription: string;
  meetingUrl?: string;
  startsAt?: string;
  endsAt?: string;
};

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
