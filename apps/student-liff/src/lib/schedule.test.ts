import { describe, expect, it } from "vitest";
import {
  buildScheduleEvents,
  clampMonth,
  enrolledClassesResourceKey,
  extractTime,
  formatStartMinutes,
  getMonthGrid,
  getNavigableMonthRange,
  getScheduleWindow,
  getStartMinutes,
  getSwipeMonthDelta,
  groupEventsByDate,
  parseDateKey,
  parseThaiSchedule,
  pickSelectedDateForMonth,
  sortEventsByTime,
  type ScheduledEvent,
} from "./schedule";

// Friday 2 October 2026, 10:00 local time.
const NOW = new Date(2026, 9, 2, 10, 0, 0);

function weekdaysOf(events: ScheduledEvent[]): Set<number> {
  return new Set(
    events.map((event) => {
      const [y, m, d] = event.dateStr.split("-").map(Number);
      return new Date(y, m - 1, d).getDay();
    }),
  );
}

describe("extractTime", () => {
  it("normalises dots and dashes into a Thai time label", () => {
    expect(extractTime("ทุกวันจันทร์ 18.00-19.30")).toBe("18:00 - 19:30 น.");
    expect(extractTime("อังคาร 9:00 – 10:30")).toBe("9:00 - 10:30 น.");
  });

  it("falls back to 'by appointment' without a time range", () => {
    expect(extractTime("ทุกวันพุธ")).toBe("ตามนัดหมาย");
  });
});

describe("getStartMinutes", () => {
  it("parses the first time in the label", () => {
    expect(getStartMinutes("9:00 - 10:30 น.")).toBe(540);
    expect(getStartMinutes("13:15 - 14:00 น.")).toBe(795);
  });

  it("returns null when there is no time", () => {
    expect(getStartMinutes("ตามนัดหมาย")).toBeNull();
    expect(getStartMinutes("ยังไม่ได้กำหนด")).toBeNull();
  });
});

describe("parseThaiSchedule", () => {
  it("detects Thai day names (both spellings of Thursday)", () => {
    expect(parseThaiSchedule("ทุกวันจันทร์ 18:00 - 19:30")).toEqual({ days: [1], timeRange: "18:00 - 19:30 น." });
    expect(parseThaiSchedule("อังคาร และ พฤหัส 17.00-18.00").days.sort()).toEqual([2, 4]);
    expect(parseThaiSchedule("วันพฤหัสบดี").days).toEqual([4]);
    expect(parseThaiSchedule("เสาร์-อาทิตย์ 9:00-12:00").days.sort()).toEqual([0, 6]);
  });

  it("treats 'ทุกวัน' without a specific day as every day", () => {
    expect(parseThaiSchedule("ทุกวัน 8:00-9:00")).toEqual({
      days: [0, 1, 2, 3, 4, 5, 6],
      timeRange: "8:00 - 9:00 น.",
    });
  });

  it("keeps the Mon/Wed/Fri fallback for empty, unset or unknown text", () => {
    expect(parseThaiSchedule("")).toEqual({ days: [1, 3, 5], timeRange: "ยังไม่ได้กำหนด" });
    expect(parseThaiSchedule("ยังไม่ได้กำหนด")).toEqual({ days: [1, 3, 5], timeRange: "ยังไม่ได้กำหนด" });
    expect(parseThaiSchedule("Mon/Wed 10:00-11:00")).toEqual({ days: [1, 3, 5], timeRange: "10:00 - 11:00 น." });
    expect(parseThaiSchedule("แล้วแต่ตกลง")).toEqual({ days: [1, 3, 5], timeRange: "ตามนัดหมาย" });
  });
});

describe("getScheduleWindow", () => {
  it("spans 30 days back and 60 days forward at the same time of day", () => {
    const { start, end } = getScheduleWindow(NOW);
    expect(start).toEqual(new Date(2026, 8, 2, 10, 0, 0));
    expect(end).toEqual(new Date(2026, 11, 1, 10, 0, 0));
  });
});

describe("buildScheduleEvents", () => {
  it("starts a class without startsAt from now and ends at the window end", () => {
    const events = buildScheduleEvents(
      [{ id: "c1", name: "Reading A", tutorName: "ครูเอ", nextSession: "ทุกวันจันทร์ 18:00-19:00" }],
      NOW,
    );
    expect(weekdaysOf(events)).toEqual(new Set([1]));
    expect(events[0].dateStr).toBe("2026-10-05");
    expect(events.at(-1)?.dateStr).toBe("2026-11-30");
    expect(events).toHaveLength(9);
    expect(events[0]).toMatchObject({
      id: "c1-2026-10-05",
      classId: "c1",
      title: "Reading A",
      tutor: "ครูเอ",
      time: "18:00 - 19:00 น.",
      startMinutes: 1080,
      type: "class",
    });
  });

  it("clamps an early startsAt to 30 days ago and respects endsAt", () => {
    const events = buildScheduleEvents(
      [
        {
          id: "c2",
          name: "Reading B",
          tutorName: "ครูบี",
          nextSession: "พุธ",
          startsAt: new Date(2026, 0, 1).toISOString(),
          endsAt: new Date(2026, 9, 10).toISOString(),
        },
      ],
      NOW,
    );
    expect(events[0].dateStr).toBe("2026-09-02");
    expect(events.at(-1)?.dateStr).toBe("2026-10-07");
    expect(weekdaysOf(events)).toEqual(new Set([3]));
  });

  it("uses the Mon/Wed/Fri fallback when the schedule is unknown", () => {
    const events = buildScheduleEvents(
      [{ id: "c3", name: "C", tutorName: "T", nextSession: null, startsAt: new Date(2026, 9, 1).toISOString() }],
      NOW,
    );
    expect(weekdaysOf(events)).toEqual(new Set([1, 3, 5]));
    expect(events[0].dateStr).toBe("2026-10-02");
    expect(events[0].time).toBe("ยังไม่ได้กำหนด");
  });

  it("gives a demo class exactly one occurrence on its start date", () => {
    const events = buildScheduleEvents(
      [
        {
          id: "demo",
          name: "Demo",
          tutorName: "T",
          nextSession: "ทุกวัน 9:00-10:00",
          startsAt: new Date(2026, 9, 20, 9, 0).toISOString(),
          isDemo: true,
        },
      ],
      NOW,
    );
    expect(events).toEqual([
      expect.objectContaining({ id: "demo-2026-10-20", dateStr: "2026-10-20", time: "9:00 - 10:00 น." }),
    ]);
  });

  it("gives a demo class without startsAt a single event today", () => {
    const events = buildScheduleEvents([{ id: "d", name: "D", tutorName: "T", nextSession: "", isDemo: true }], NOW);
    expect(events.map((e) => e.dateStr)).toEqual(["2026-10-02"]);
  });
});

describe("sortEventsByTime / groupEventsByDate", () => {
  const base = { classId: "c", tutor: "T", type: "class" as const, dateStr: "2026-10-05" };
  const make = (id: string, time: string, startMinutes: number | null): ScheduledEvent => ({
    ...base,
    id,
    title: id,
    time,
    startMinutes,
  });

  it("sorts numerically (9:00 before 13:00) and puts untimed events last, stably", () => {
    const sorted = sortEventsByTime([
      make("late", "13:00 - 14:00 น.", 780),
      make("none-1", "ตามนัดหมาย", null),
      make("early", "9:00 - 10:00 น.", 540),
      make("none-2", "ยังไม่ได้กำหนด", null),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["early", "late", "none-1", "none-2"]);
  });

  it("groups by day", () => {
    const grouped = groupEventsByDate([
      make("b", "13:00 - 14:00 น.", 780),
      { ...make("x", "8:00 - 9:00 น.", 480), dateStr: "2026-10-06" },
      make("a", "9:00 - 10:00 น.", 540),
    ]);
    expect(grouped.get("2026-10-05")?.map((e) => e.id)).toEqual(["a", "b"]);
    expect(grouped.get("2026-10-06")?.map((e) => e.id)).toEqual(["x"]);
  });
});

describe("calendar helpers", () => {
  it("always returns 42 cells starting on Sunday", () => {
    const cells = getMonthGrid(new Date(2026, 9, 15));
    expect(cells).toHaveLength(42);
    expect(cells[0]).toMatchObject({ day: 27, month: "prev", key: "2026-09-27" });
    expect(cells[4]).toMatchObject({ day: 1, month: "curr", key: "2026-10-01" });
    expect(cells[34]).toMatchObject({ day: 31, month: "curr" });
    expect(cells[35]).toMatchObject({ day: 1, month: "next", key: "2026-11-01" });
    expect(cells.every((cell, i) => cell.date.getDay() === i % 7)).toBe(true);
  });

  it("limits navigation to months that overlap the window", () => {
    const { first, last } = getNavigableMonthRange(NOW);
    expect(first).toEqual(new Date(2026, 8, 1));
    expect(last).toEqual(new Date(2026, 11, 1));
  });

  it("widens navigation to events outside the window (far-away demo class)", () => {
    const range = getNavigableMonthRange(NOW, ["2026-10-05", "2027-02-14", "bad-key"]);
    expect(range.first).toEqual(new Date(2026, 8, 1));
    expect(range.last).toEqual(new Date(2027, 1, 1));
  });

  it("parses date keys and clamps months into the range", () => {
    expect(parseDateKey("2026-10-02")).toEqual(new Date(2026, 9, 2));
    expect(parseDateKey("2026-1-2")).toBeNull();
    const range = { first: new Date(2026, 8, 1), last: new Date(2026, 11, 1) };
    expect(clampMonth(new Date(2026, 5, 1), range)).toBe(range.first);
    expect(clampMonth(new Date(2027, 0, 1), range)).toBe(range.last);
    expect(clampMonth(new Date(2026, 9, 1), range)).toEqual(new Date(2026, 9, 1));
  });

  it("turns horizontal swipes into month steps and ignores vertical scrolls", () => {
    expect(getSwipeMonthDelta(-80, 10)).toBe(1);
    expect(getSwipeMonthDelta(90, -20)).toBe(-1);
    expect(getSwipeMonthDelta(30, 0)).toBe(0);
    expect(getSwipeMonthDelta(-80, 70)).toBe(0);
  });

  it("formats start minutes like the time label", () => {
    expect(formatStartMinutes(1080)).toBe("18:00");
    expect(formatStartMinutes(545)).toBe("9:05");
    expect(formatStartMinutes(null)).toBe("");
  });

  it("uses a per-student cache key for enrolled classes", () => {
    expect(enrolledClassesResourceKey("U1")).toBe("U1:enrolledClasses");
  });

  it("selects today in the current month, otherwise the 1st", () => {
    expect(pickSelectedDateForMonth(new Date(2026, 9, 1), NOW)).toEqual(new Date(2026, 9, 2));
    expect(pickSelectedDateForMonth(new Date(2026, 10, 1), NOW)).toEqual(new Date(2026, 10, 1));
  });
});
