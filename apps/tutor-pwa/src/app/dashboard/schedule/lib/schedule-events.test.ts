import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  buildEvents,
  extractTimeRange,
  formatSlotTime,
  groupByDay,
  keyToDate,
  monthGrid,
  parseThaiSchedule,
  readScheduleData,
  todayKey,
  totalMinutes,
  weekKeys,
  weekdayOf,
  type ScheduleClass,
} from "./schedule-events";
import { NBSP, formatThaiDate } from "@/lib/format";

describe("day keys", () => {
  it("adds days and months across boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-01");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-01");
  });
  it("knows weekdays and Sunday-first weeks", () => {
    expect(weekdayOf("2026-10-02")).toBe(5); // Friday
    expect(weekKeys("2026-10-02")).toEqual([
      "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03",
    ]);
  });
  it("builds a 6-week month grid", () => {
    const grid = monthGrid("2026-10-15");
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ key: "2026-09-27", inMonth: false });
    expect(grid.filter((c) => c.inMonth)).toHaveLength(31);
  });
  it("displays keys on the right Bangkok day in Buddhist era", () => {
    expect(formatThaiDate(keyToDate("2026-10-02"), "long")).toBe("2 ตุลาคม 2569");
    expect(todayKey(new Date("2026-10-01T18:30:00Z"))).toBe("2026-10-02"); // 01:30 in Bangkok
  });
});

describe("parsing", () => {
  it("extracts time ranges", () => {
    expect(extractTimeRange("ทุกวันจันทร์ 18:00 - 19:30")).toEqual({ start: "18:00", end: "19:30" });
    expect(extractTimeRange("เสาร์ 9.00–10.30 น.")).toEqual({ start: "09:00", end: "10:30" });
    expect(extractTimeRange("ตามนัด")).toEqual({ start: null, end: null });
  });
  it("parses Thai weekday text like before", () => {
    expect(parseThaiSchedule("ทุกวันจันทร์ และ พฤหัสบดี 18:00 - 19:30")).toEqual([
      { day: 1, start: "18:00", end: "19:30" },
      { day: 4, start: "18:00", end: "19:30" },
    ]);
    expect(parseThaiSchedule("ทุกวัน 08:00 - 09:00").map((s) => s.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(parseThaiSchedule("").map((s) => s.day)).toEqual([1, 3, 5]);
    expect(parseThaiSchedule("ยังไม่ได้กำหนด")[0].start).toBeNull();
  });
  it("reads structured scheduleData (weekly and dated)", () => {
    expect(readScheduleData([{ day: "MON", start: "18:00", end: "19:30" }])).toEqual({
      weekly: [{ day: 1, start: "18:00", end: "19:30" }],
      dated: [],
    });
    expect(readScheduleData([{ date: "2026-10-05", start: "10:00", end: "11:00" }])?.dated).toEqual([
      { dateKey: "2026-10-05", start: "10:00", end: "11:00" },
    ]);
    expect(readScheduleData(null)).toBeNull();
    expect(readScheduleData([{ foo: 1 }])).toBeNull();
  });
  it("formats slot times", () => {
    expect(formatSlotTime("18:00", "19:30")).toBe(`18:00–19:30${NBSP}น.`);
    expect(formatSlotTime(null, null)).toBe("ตามนัดหมาย");
  });
});

const cls = (over: Partial<ScheduleClass> = {}): ScheduleClass => ({
  id: "c1",
  name: "คลาส A",
  book: "Book",
  students: 4,
  nextSession: "ทุกวันจันทร์ และ พฤหัสบดี 18:00 - 19:30",
  startsAt: "2026-09-12T13:00:00Z",
  endsAt: "2026-12-11T13:00:00Z",
  ...over,
});

describe("buildEvents", () => {
  it("expands weekly sessions inside the range and class dates", () => {
    const events = buildEvents([cls()], "2026-09-27", "2026-10-03");
    expect(events.map((e) => [e.dateKey, e.start, e.end])).toEqual([
      ["2026-09-28", "18:00", "19:30"],
      ["2026-10-01", "18:00", "19:30"],
    ]);
    expect(events[0].timeLabel).toBe(`18:00–19:30${NBSP}น.`);
  });
  it("prefers structured scheduleData with per-day times", () => {
    const events = buildEvents(
      [cls({ scheduleData: [{ day: "TUE", start: "17:00", end: "18:00" }, { day: "SAT", start: "09:00", end: "10:30" }] })],
      "2026-09-27",
      "2026-10-03",
    );
    expect(events.map((e) => [e.dateKey, e.start])).toEqual([
      ["2026-09-29", "17:00"],
      ["2026-10-03", "09:00"],
    ]);
  });
  it("respects class start and end dates", () => {
    expect(buildEvents([cls({ startsAt: "2026-10-01T00:00:00Z" })], "2026-09-27", "2026-10-03")).toHaveLength(1);
    expect(buildEvents([cls({ endsAt: "2026-09-20T00:00:00Z" })], "2026-09-27", "2026-10-03")).toHaveLength(0);
  });
  it("shows a demo class once, on its creation day", () => {
    const events = buildEvents(
      [cls({ isDemo: true, expiresAt: "2026-10-03T05:00:00Z" })],
      "2026-09-27",
      "2026-10-03",
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ dateKey: "2026-10-02", isDemo: true, start: null });
  });
  it("sorts by day then time and groups by day", () => {
    const events = buildEvents(
      [cls({ id: "b", name: "B", nextSession: "จันทร์ 19:00 - 20:00" }), cls({ id: "a", name: "A", nextSession: "จันทร์ 08:00 - 09:00" })],
      "2026-09-28",
      "2026-09-28",
    );
    expect(events.map((e) => e.classId)).toEqual(["a", "b"]);
    expect(groupByDay(events).get("2026-09-28")).toHaveLength(2);
    expect(totalMinutes(events)).toBe(120);
  });
});
