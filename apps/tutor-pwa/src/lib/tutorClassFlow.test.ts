import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import {
  buildCreateClassRequest,
  buildScheduleString,
  getClassActionErrorMessage,
  getEndTimeOptions,
  parseLocalDate,
  toggleClassDay,
} from "./tutorClassFlow";

describe("tutorClassFlow helpers", () => {
  it("parses a yyyy-MM-dd string as a local date with no timezone shift", () => {
    const d = parseLocalDate("2026-06-01");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June (0-indexed)
    expect(d.getDate()).toBe(1);
    // Round-trips losslessly through date-fns local format
    expect(format(d, "yyyy-MM-dd")).toBe("2026-06-01");
  });

  it("builds a stable schedule string from selected days and times", () => {
    expect(buildScheduleString(["MON", "WED"], "19:00", "21:00")).toBe(
      "ทุกวันจันทร์, พุธ 19:00-21:00 น.",
    );
    expect(buildScheduleString([], "19:00", "21:00")).toBe("");
    expect(buildScheduleString(["UNKNOWN"], "19:00", "21:00")).toBe("");
  });

  it("toggles class day selections without mutating the current list", () => {
    const selected = ["MON"];

    expect(toggleClassDay(selected, "WED")).toEqual(["MON", "WED"]);
    expect(toggleClassDay(selected, "MON")).toEqual([]);
    expect(selected).toEqual(["MON"]);
  });

  it("returns only end times after the selected start time", () => {
    expect(getEndTimeOptions("20:00")).toEqual(["21:00", "22:00"]);
  });

  it("maps form data to the learning-service create class payload", () => {
    expect(
      buildCreateClassRequest({
        name: "Origins A1",
        book: "book-1",
        schedule: "ทุกวันจันทร์ 19:00-21:00 น.",
        meetingUrl: "https://meet.google.com/abc-defg-hij",
      }),
    ).toEqual({
      title: "Origins A1",
      bookId: "book-1",
      capacity: 30,
      scheduleDescription: "ทุกวันจันทร์ 19:00-21:00 น.",
      meetingUrl: "https://meet.google.com/abc-defg-hij",
    });
  });

  it("extracts action errors from common API envelopes", () => {
    expect(getClassActionErrorMessage({ message: "Bad class" }, "Fallback")).toBe("Bad class");
    expect(getClassActionErrorMessage({ error: "Denied" }, "Fallback")).toBe("Denied");
    expect(getClassActionErrorMessage({ error: { message: "Nested" } }, "Fallback")).toBe("Nested");
    expect(getClassActionErrorMessage({}, "Fallback")).toBe("Fallback");
  });
});
