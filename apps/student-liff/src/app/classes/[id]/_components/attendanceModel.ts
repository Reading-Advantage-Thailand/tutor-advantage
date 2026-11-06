/**
 * The student's own attendance in one class (GET /classes/:id/attendance →
 * `mine`): pure display rules of AttendanceSection.
 *
 * Relative imports on purpose: the root vitest config maps "@" to tutor-pwa.
 */
import type { ChipTone } from "../../../../components/mobile/Chip";
import { formatThaiDate, keepTimesTogether } from "../../../../lib/format";
import type { I18nKey } from "../../../../lib/i18n";
import type { AttendanceRecord, AttendanceStatus } from "./types";

/** Records shown on the class page; the rest open in the "see all" sheet. */
export const ATTENDANCE_PREVIEW_COUNT = 5;

export const ATTENDANCE_STATUS_DISPLAY: Record<AttendanceStatus, { labelKey: I18nKey; tone: ChipTone }> = {
  PRESENT: { labelKey: "classes.detail.attendance.present", tone: "success" },
  LATE: { labelKey: "classes.detail.attendance.late", tone: "warning" },
  ABSENT: { labelKey: "classes.detail.attendance.absent", tone: "danger" },
};

/**
 * Demo and setup-pending classes answer 409 ATTENDANCE_NOT_AVAILABLE on every
 * request. A retry can never succeed, so the section stays hidden for them.
 */
export function isAttendanceUnavailable(error: unknown): boolean {
  return Boolean(error) && typeof error === "object" && (error as { code?: unknown }).code === "ATTENDANCE_NOT_AVAILABLE";
}

/** 0..1 → whole percent; null when nothing is marked yet. */
export function attendanceRatePercent(rate: number | null | undefined): number | null {
  if (typeof rate !== "number" || !Number.isFinite(rate)) return null;
  return Math.round(Math.min(Math.max(rate, 0), 1) * 100);
}

/** Newest-first records from the server → the rows on the page and whether more exist. */
export function selectAttendancePreview(records: AttendanceRecord[]): { preview: AttendanceRecord[]; hasMore: boolean } {
  return {
    preview: records.slice(0, ATTENDANCE_PREVIEW_COUNT),
    hasMore: records.length > ATTENDANCE_PREVIEW_COUNT,
  };
}

/**
 * "yyyy-MM-dd" (Bangkok calendar day) → "6 พ.ย. 2569". Built as a local date:
 * new Date("yyyy-MM-dd") is UTC midnight, which shows the previous day on a
 * device west of Greenwich. Anything else is shown as sent.
 */
export function formatMeetingDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const local = new Date(year, month - 1, day);
  if (local.getFullYear() !== year || local.getMonth() !== month - 1 || local.getDate() !== day) return date;
  return formatThaiDate(local);
}

/** "19:00 - 20:30 น." or "19:00 น." (times stay on one line). */
export function formatMeetingTime(start: string, end: string | null): string {
  return keepTimesTogether(`${end ? `${start} - ${end}` : start} น.`);
}
