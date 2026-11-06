import { describe, expect, it } from "vitest";
import { NBSP } from "../../../../lib/format";
import { t } from "../../../../lib/i18n";
import {
  ATTENDANCE_PREVIEW_COUNT,
  ATTENDANCE_STATUS_DISPLAY,
  attendanceRatePercent,
  formatMeetingDate,
  formatMeetingTime,
  isAttendanceUnavailable,
  selectAttendancePreview,
} from "./attendanceModel";
import type { AttendanceRecord } from "./types";

function records(count: number): AttendanceRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    date: `2026-10-${String(count - index).padStart(2, "0")}`,
    start: "19:00",
    end: null,
    status: "PRESENT" as const,
  }));
}

describe("attendanceRatePercent", () => {
  it("rounds to a whole percent", () => {
    expect(attendanceRatePercent(0)).toBe(0);
    expect(attendanceRatePercent(2 / 3)).toBe(67);
    expect(attendanceRatePercent(1)).toBe(100);
  });

  it("is null when nothing is marked or the value is not a number", () => {
    expect(attendanceRatePercent(null)).toBeNull();
    expect(attendanceRatePercent(undefined)).toBeNull();
    expect(attendanceRatePercent(Number.NaN)).toBeNull();
  });

  it("stays within 0..100", () => {
    expect(attendanceRatePercent(-0.2)).toBe(0);
    expect(attendanceRatePercent(1.4)).toBe(100);
  });
});

describe("selectAttendancePreview", () => {
  it("keeps the server order and offers more only past the preview count", () => {
    expect(selectAttendancePreview([])).toEqual({ preview: [], hasMore: false });

    const exact = records(ATTENDANCE_PREVIEW_COUNT);
    expect(selectAttendancePreview(exact)).toEqual({ preview: exact, hasMore: false });

    const more = records(ATTENDANCE_PREVIEW_COUNT + 1);
    const selected = selectAttendancePreview(more);
    expect(selected.hasMore).toBe(true);
    expect(selected.preview).toEqual(more.slice(0, ATTENDANCE_PREVIEW_COUNT));
  });
});

describe("formatMeetingDate", () => {
  it("shows the calendar day as sent, in the Buddhist-era year", () => {
    const expected = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(2026, 10, 6),
    );
    expect(formatMeetingDate("2026-11-06")).toBe(expected);
    expect(formatMeetingDate("2026-11-06")).toContain("2569");
    // The first of a month stays in that month and year in every time zone.
    expect(formatMeetingDate("2026-01-01")).toContain("2569");
    expect(formatMeetingDate("2026-01-01")).toMatch(/^1 /);
  });

  it("returns anything that is not a real date unchanged", () => {
    expect(formatMeetingDate("2026-02-30")).toBe("2026-02-30");
    expect(formatMeetingDate("soon")).toBe("soon");
    expect(formatMeetingDate("")).toBe("");
  });
});

describe("formatMeetingTime", () => {
  it("shows a range, or the start alone when the meeting has no end", () => {
    expect(formatMeetingTime("19:00", "20:30")).toBe(`19:00${NBSP}-${NBSP}20:30${NBSP}น.`);
    expect(formatMeetingTime("19:00", null)).toBe(`19:00${NBSP}น.`);
  });
});

describe("isAttendanceUnavailable", () => {
  it("is true only for the not-available error code", () => {
    expect(isAttendanceUnavailable({ status: 409, code: "ATTENDANCE_NOT_AVAILABLE" })).toBe(true);
    expect(isAttendanceUnavailable({ status: 500, code: "INTERNAL_SERVER_ERROR" })).toBe(false);
    expect(isAttendanceUnavailable(new TypeError("Failed to fetch"))).toBe(false);
    expect(isAttendanceUnavailable(undefined)).toBe(false);
    expect(isAttendanceUnavailable(null)).toBe(false);
  });
});

describe("ATTENDANCE_STATUS_DISPLAY", () => {
  it("uses the agreed terms with a distinct colour per status", () => {
    expect(t(ATTENDANCE_STATUS_DISPLAY.PRESENT.labelKey)).toBe("มาเรียน");
    expect(t(ATTENDANCE_STATUS_DISPLAY.LATE.labelKey)).toBe("มาสาย");
    expect(t(ATTENDANCE_STATUS_DISPLAY.ABSENT.labelKey)).toBe("ขาดเรียน");
    const tones = Object.values(ATTENDANCE_STATUS_DISPLAY).map((display) => display.tone);
    expect(new Set(tones).size).toBe(3);
  });
});
