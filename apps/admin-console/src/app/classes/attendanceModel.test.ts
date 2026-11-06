import { describe, expect, it } from "vitest";
import {
  attendanceLoadFailure,
  classAttendanceHref,
  classAttendanceKey,
  classAttendancePath,
  meetingDateLabel,
  meetingNote,
  meetingProgress,
  meetingRowKey,
  meetingTimeLabel,
  studentProfileHref,
} from "./attendanceModel";

const counts = { present: 0, late: 0, absent: 0, unmarked: 0 };

describe("attendance paths and keys", () => {
  it("scopes the cache key to the admin and the class", () => {
    expect(classAttendanceKey("admin-1", "class-1")).toBe("admin-1:classes:attendance:class-1");
    expect(classAttendanceKey("admin-2", "class-1")).not.toBe(classAttendanceKey("admin-1", "class-1"));
  });

  it("uses the admin endpoint and encodes ids from the URL", () => {
    expect(classAttendancePath("abc")).toBe("/v1/admin/classes/abc/attendance");
    expect(classAttendancePath("a/../b")).toBe("/v1/admin/classes/a%2F..%2Fb/attendance");
    expect(classAttendanceHref("a b")).toBe("/classes/a%20b/attendance");
    expect(studentProfileHref("u/1")).toBe("/users/u%2F1");
  });

  it("keys two meetings on one day apart", () => {
    expect(meetingRowKey({ date: "2026-11-06", start: "10:00" })).not.toBe(meetingRowKey({ date: "2026-11-06", start: "19:00" }));
  });
});

describe("meeting labels", () => {
  it("shows the stored Bangkok day in the Thai calendar", () => {
    expect(meetingDateLabel("2026-11-06")).toBe("6 พ.ย. 2569");
    expect(meetingDateLabel("2026-01-01")).toBe("1 ม.ค. 2569");
  });

  it("falls back to the raw value for a date it cannot read", () => {
    expect(meetingDateLabel("not-a-date")).toBe("not-a-date");
  });

  it("shows a range only when the meeting has an end", () => {
    expect(meetingTimeLabel({ start: "19:00", end: "20:30" })).toBe("19:00–20:30");
    expect(meetingTimeLabel({ start: "19:00", end: null })).toBe("19:00");
  });
});

describe("meetingNote", () => {
  it("has no note for an ordinary scheduled meeting", () => {
    expect(meetingNote({ source: "SCHEDULED", inSchedule: true, movedFrom: null })).toBeNull();
  });

  it("marks ad hoc meetings even when the schedule later gains the same time", () => {
    expect(meetingNote({ source: "ADHOC", inSchedule: false, movedFrom: null })).toEqual({ kind: "adhoc" });
    expect(meetingNote({ source: "ADHOC", inSchedule: true, movedFrom: null })).toEqual({ kind: "adhoc" });
  });

  it("names the saved time of a moved meeting", () => {
    expect(meetingNote({ source: "SCHEDULED", inSchedule: true, movedFrom: "18:00" })).toEqual({ kind: "moved", from: "18:00" });
  });

  it("flags a saved meeting the schedule no longer has", () => {
    expect(meetingNote({ source: "SCHEDULED", inSchedule: false, movedFrom: null })).toEqual({ kind: "offSchedule" });
  });
});

describe("meetingProgress", () => {
  it("separates unmarked, partly marked and fully marked meetings", () => {
    expect(meetingProgress({ marked: false, counts: { ...counts, unmarked: 5 } })).toBe("none");
    expect(meetingProgress({ marked: false, counts })).toBe("none");
    expect(meetingProgress({ marked: true, counts: { ...counts, present: 2, unmarked: 3 } })).toBe("partial");
    expect(meetingProgress({ marked: true, counts: { ...counts, present: 2, absent: 3 } })).toBe("complete");
  });
});

describe("attendanceLoadFailure", () => {
  it("treats an unknown or malformed class as not found", () => {
    expect(attendanceLoadFailure({ status: 404, code: "NOT_FOUND" })).toBe("notFound");
    expect(attendanceLoadFailure({ status: 400, code: "VALIDATION_FAILED" })).toBe("notFound");
  });

  it("treats a demo or setup-pending class as a state, not an error", () => {
    expect(attendanceLoadFailure({ status: 409, code: "ATTENDANCE_NOT_AVAILABLE" })).toBe("notAvailable");
  });

  it("offers a retry for everything else", () => {
    expect(attendanceLoadFailure({ status: 409, code: "OTHER" })).toBe("retry");
    expect(attendanceLoadFailure({ status: 500, code: "INTERNAL_SERVER_ERROR" })).toBe("retry");
    expect(attendanceLoadFailure(new Error("network"))).toBe("retry");
    expect(attendanceLoadFailure(null)).toBe("retry");
  });
});
