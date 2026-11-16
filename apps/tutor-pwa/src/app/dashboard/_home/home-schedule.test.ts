import { describe, expect, it } from "vitest";
import {
  buildHomeSchedule,
  canStartNow,
  greetingPart,
  gridPosition,
  mondayOf,
  openSeats,
  teacherNameSuffix,
  toMinutes,
  type HomeClass,
} from "./home-schedule";

// Monday 9 Nov 2026, 16:25 in Bangkok.
const NOW = new Date("2026-11-09T16:25:00+07:00");

const english: HomeClass = {
  id: "class-en",
  name: "English",
  book: "Primary Origins 2 (A0)",
  students: 6,
  capacity: 8,
  cefrLevel: "A0",
  status: "open",
  scheduleData: [
    { day: "MON", start: "17:00", end: "18:00" },
    { day: "WED", start: "17:00", end: "18:00" },
  ],
};

const conversation: HomeClass = {
  id: "class-conv",
  name: "English Conversation",
  book: "Reading 3.1",
  students: 4,
  capacity: 8,
  cefrLevel: "A1",
  status: "open",
  scheduleData: [
    { day: "MON", start: "16:15", end: "17:15" },
    { day: "FRI", start: "19:00" },
  ],
};

describe("buildHomeSchedule", () => {
  it("lists today's timed sessions and picks the first one that has not ended", () => {
    const schedule = buildHomeSchedule([english, conversation], NOW);
    expect(schedule.todayKey).toBe("2026-11-09");
    expect(schedule.nowMin).toBe(16 * 60 + 25);
    expect(schedule.today.map((s) => `${s.start} ${s.title}`)).toEqual(["16:15 English Conversation", "17:00 English"]);
    // 16:15–17:15 is still running at 16:25, so it is the next class (in progress).
    expect(schedule.next).toMatchObject({ classId: "class-conv", inProgress: true, minutesUntil: null, dayOffset: 0 });
  });

  it("counts down to a session later today", () => {
    const schedule = buildHomeSchedule([english], NOW);
    expect(schedule.next).toMatchObject({ classId: "class-en", start: "17:00", end: "18:00", minutesUntil: 35, inProgress: false });
    expect(schedule.today[0]).toMatchObject({ level: "A0", students: 6, durationMin: 60 });
  });

  it("looks ahead to the following days when today is over", () => {
    const late = new Date("2026-11-09T19:00:00+07:00");
    const schedule = buildHomeSchedule([english], late);
    expect(schedule.next).toMatchObject({ dateKey: "2026-11-11", dayOffset: 2, minutesUntil: null });
  });

  it("builds a Monday-first week and widens the grid for early or late sessions", () => {
    const early: HomeClass = { id: "c3", name: "Early", scheduleData: [{ day: "SAT", start: "07:30", end: "08:30" }] };
    const schedule = buildHomeSchedule([english, conversation, early], NOW);
    expect(schedule.week.map((d) => d.dateKey)).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ]);
    expect(schedule.week[0].isToday).toBe(true);
    expect(schedule.week[4].sessions[0]).toMatchObject({ title: "English Conversation", end: null, endMin: 20 * 60 });
    expect(schedule.hourFrom).toBe(7);
    expect(schedule.hourTo).toBe(21);
  });

  it("leaves out demo classes, untimed schedules and classes outside their dates", () => {
    const demo: HomeClass = { id: "d", name: "Demo", isDemo: true, expiresAt: "2026-11-10T09:00:00+07:00" };
    const untimed: HomeClass = { id: "u", name: "Untimed", nextSession: "ตามนัดหมาย" };
    const ended: HomeClass = { ...english, id: "old", endsAt: "2026-10-01T00:00:00Z" };
    const schedule = buildHomeSchedule([demo, untimed, ended], NOW);
    expect(schedule.today).toEqual([]);
    expect(schedule.next).toBeNull();
    expect(schedule.week.every((d) => d.sessions.length === 0)).toBe(true);
    expect(schedule.hourFrom).toBe(9);
    expect(schedule.hourTo).toBe(21);
  });

  it("handles missing data", () => {
    const schedule = buildHomeSchedule(null, NOW);
    expect(schedule.today).toEqual([]);
    expect(schedule.next).toBeNull();
    expect(schedule.week).toHaveLength(7);
  });
});

describe("canStartNow", () => {
  it("opens 15 minutes before the start and closes at the end", () => {
    const schedule = buildHomeSchedule([english], NOW);
    const session = schedule.today[0];
    expect(canStartNow(session, { todayKey: schedule.todayKey, nowMin: 16 * 60 + 44 })).toBe(false);
    expect(canStartNow(session, { todayKey: schedule.todayKey, nowMin: 16 * 60 + 45 })).toBe(true);
    expect(canStartNow(session, { todayKey: schedule.todayKey, nowMin: 17 * 60 + 59 })).toBe(true);
    expect(canStartNow(session, { todayKey: schedule.todayKey, nowMin: 18 * 60 })).toBe(false);
    expect(canStartNow(session, { todayKey: "2026-11-10", nowMin: 17 * 60 })).toBe(false);
  });
});

describe("small helpers", () => {
  it("parses times", () => {
    expect(toMinutes("17:30")).toBe(1050);
    expect(toMinutes("9:05")).toBe(545);
    expect(toMinutes(null)).toBeNull();
    expect(toMinutes("ตามนัดหมาย")).toBeNull();
  });

  it("finds the Monday of a week", () => {
    expect(mondayOf("2026-11-09")).toBe("2026-11-09");
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
    expect(mondayOf("2026-11-12")).toBe("2026-11-09");
  });

  it("places a session in the grid", () => {
    const mid = gridPosition({ startMin: 17 * 60, endMin: 18 * 60 }, 9, 21);
    expect(mid.left).toBeCloseTo((8 / 12) * 100);
    expect(mid.width).toBeCloseTo((1 / 12) * 100);
    const clipped = gridPosition({ startMin: 8 * 60, endMin: 10 * 60 }, 9, 21);
    expect(clipped.left).toBe(0);
    expect(clipped.width).toBeCloseTo((1 / 12) * 100);
  });

  it("greets by Bangkok time of day", () => {
    expect(greetingPart(new Date("2026-11-09T08:00:00+07:00"))).toBe("morning");
    expect(greetingPart(new Date("2026-11-09T12:00:00+07:00"))).toBe("afternoon");
    expect(greetingPart(new Date("2026-11-09T17:00:00+07:00"))).toBe("evening");
  });

  it("joins Thai names to ครู and keeps Latin ones on the same line", () => {
    expect(teacherNameSuffix("นกเอี้ยง")).toBe("นกเอี้ยง");
    expect(teacherNameSuffix("Anna")).toBe(" Anna");
    expect(teacherNameSuffix("  ")).toBe("");
    expect(teacherNameSuffix(null)).toBe("");
  });

  it("counts free seats in open classes only", () => {
    expect(openSeats([english, conversation, { ...english, id: "x", status: "closed" }, { ...english, id: "y", isDemo: true }])).toBe(6);
    expect(openSeats([{ id: "z", name: "Full", status: "open", capacity: 4, students: 6 }])).toBe(0);
    expect(openSeats(null)).toBe(0);
  });
});
