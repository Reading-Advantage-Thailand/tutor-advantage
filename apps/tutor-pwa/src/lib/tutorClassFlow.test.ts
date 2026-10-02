import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import {
  buildCreateClassRequest,
  buildScheduleString,
  getClassActionErrorMessage,
  getEndTimeOptions,
  parseLocalDate,
  toggleClassDay,
  tryParseLocalDate,
  toLocalDateKey,
  normalizeScheduleData,
  sumScheduledHours,
  generateSchedule,
  templateToSlots,
  weeklyEntriesToSlots,
  splitPastSchedule,
  totalScheduleHours,
  buildScheduleEntries,
  buildScheduleDescription,
  localDateToBangkokNoon,
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
        name: "Reading A1",
        book: "book-1",
        schedule: "ทุกวันจันทร์ 19:00-21:00 น.",
        meetingUrl: "https://meet.google.com/abc-defg-hij",
      }),
    ).toEqual({
      title: "Reading A1",
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

describe("schedule data helpers", () => {
  it("does not throw on weekly-template entries and returns an invalid date", () => {
    expect(() => parseLocalDate(undefined)).not.toThrow();
    expect(Number.isNaN(parseLocalDate(undefined).getTime())).toBe(true);
    expect(tryParseLocalDate(undefined)).toBeNull();
    expect(tryParseLocalDate("MON")).toBeNull();
    expect(tryParseLocalDate("2026-02-31")).toBeNull();
    expect(toLocalDateKey(tryParseLocalDate("2026-10-05T00:00:00.000Z")!)).toBe("2026-10-05");
  });

  it("splits dated sessions from weekly template entries", () => {
    const { dated, weekly } = normalizeScheduleData([
      { day: "MON", start: "18:00", end: "19:30" },
      { date: "2026-10-08", start: "19:00", end: "21:00" },
      { day: "thursday", start: "18:00", end: "19:30" },
      null,
      "junk",
      { start: "10:00" },
    ]);
    expect(dated).toEqual([{ date: "2026-10-08", start: "19:00", end: "21:00" }]);
    expect(weekly).toEqual([
      { day: "MON", start: "18:00", end: "19:30" },
      { day: "THU", start: "18:00", end: "19:30" },
    ]);
    expect(normalizeScheduleData(undefined)).toEqual({ dated: [], weekly: [] });
  });

  it("sums hours for either schedule shape", () => {
    expect(sumScheduledHours([{ day: "MON", start: "18:00", end: "19:30" }, { date: "2026-10-08", start: "19:00", end: "21:00" }])).toBe(3.5);
    expect(sumScheduledHours(null)).toBe(0);
  });

  it("generates sessions up to the hour limit and trims the last one", () => {
    // 2026-10-05 is a Monday.
    const { dates, times } = generateSchedule({
      startDate: "2026-10-05",
      slots: templateToSlots({ days: ["MON", "WED"], startTime: "18:00", endTime: "20:00" }),
      maxHours: 5,
    });
    expect(dates.map(toLocalDateKey)).toEqual(["2026-10-05", "2026-10-07", "2026-10-12"]);
    expect(times["2026-10-12"]).toEqual({ start: "18:00", end: "19:00" });
    expect(totalScheduleHours(dates, times)).toBe(5);
  });

  it("keeps locked sessions and counts them towards the limit", () => {
    const keep = splitPastSchedule(
      [
        { date: "2026-09-28", start: "18:00", end: "20:00" },
        { date: "2026-10-20", start: "18:00", end: "20:00" },
      ],
      new Date(2026, 9, 2),
    );
    expect(keep.dates.map(toLocalDateKey)).toEqual(["2026-09-28"]);
    const { dates } = generateSchedule({
      startDate: "2026-10-05",
      slots: weeklyEntriesToSlots([{ day: "MON", start: "18:00", end: "20:00" }]),
      maxHours: 4,
      keep,
    });
    expect(dates.map(toLocalDateKey)).toEqual(["2026-09-28", "2026-10-05"]);
  });

  it("returns only the kept sessions when nothing can be generated", () => {
    expect(generateSchedule({ startDate: "", slots: {}, maxHours: 22 }).dates).toEqual([]);
    expect(generateSchedule({ startDate: "2026-10-05", slots: { MON: { start: "20:00", end: "18:00" } }, maxHours: 22 }).dates).toEqual([]);
  });

  it("builds the payload entries and a Buddhist-era description", () => {
    const dates = [new Date(2026, 10, 30), new Date(2026, 9, 5)];
    const times = { "2026-10-05": { start: "18:00", end: "20:00" }, "2026-11-30": { start: "09:00", end: "10:00" } };
    expect(buildScheduleEntries(dates, times)).toEqual([
      { date: "2026-10-05", start: "18:00", end: "20:00" },
      { date: "2026-11-30", start: "09:00", end: "10:00" },
    ]);
    expect(buildScheduleDescription(dates, times)).toBe("5 ต.ค. 69 - 30 พ.ย. 69 (รวม 2 วัน)");
    expect(buildScheduleDescription([dates[1]], times)).toBe("5 ต.ค. 69 (18:00-20:00)");
    expect(buildScheduleDescription([], times)).toBe("");
    expect(localDateToBangkokNoon(dates[1])).toBe("2026-10-05T12:00:00+07:00");
  });
});
