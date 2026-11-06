import { describe, expect, it } from "vitest";
import {
  attendanceRate,
  buildRoster,
  buildStudentStats,
  changedStudentIds,
  countStatuses,
  expectedStudentIds,
  joinHintWindow,
  LIMITS,
  listMeetings,
  listScheduledOccurrences,
  markBlock,
  planMarkChanges,
  resolveMeeting,
  scheduleEntriesOn,
  toMeetingSummary,
  toMyAttendance,
  validateMeetingQuery,
  validateSaveMarks,
  type MeetingRowFields,
} from "./attendance";

const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";

// 2026-11-06 20:00 Bangkok, a Friday.
const NOW = new Date("2026-11-06T13:00:00Z");

function row(startTime: string, overrides: Partial<MeetingRowFields> = {}): MeetingRowFields {
  return { meetingDate: "2026-11-06", startTime, endTime: null, source: "SCHEDULED", ...overrides };
}

describe("listScheduledOccurrences", () => {
  it("returns dated entries in range, oldest first, keeping end", () => {
    const data = [
      { date: "2026-11-05", start: "18:00", end: "19:00" },
      { date: "2026-11-01", start: "09:00", end: "10:00" },
      { date: "2026-12-01", start: "09:00", end: "10:00" },
    ];
    expect(listScheduledOccurrences(data, null, null, { from: "2026-11-01", to: "2026-11-06" })).toEqual([
      { date: "2026-11-01", start: "09:00", end: "10:00" },
      { date: "2026-11-05", start: "18:00", end: "19:00" },
    ]);
  });

  it("does not clamp dated entries to startsAt/endsAt", () => {
    const data = [{ date: "2026-11-01", start: "09:00" }];
    const startsAt = new Date("2026-11-03T00:00:00Z");
    expect(listScheduledOccurrences(data, startsAt, null, { to: "2026-11-06" })).toHaveLength(1);
  });

  it("expands legacy weekly entries inside startsAt/endsAt, accepting startTime", () => {
    const data = [{ day: "MON", start: "18:00", end: "19:00" }, { day: "wed", startTime: "10:00" }];
    const out = listScheduledOccurrences(data, new Date("2026-11-02T00:00:00Z"), new Date("2026-11-04T00:00:00Z"), {
      to: "2026-11-30",
    });
    expect(out).toEqual([
      { date: "2026-11-02", start: "18:00", end: "19:00" },
      { date: "2026-11-04", start: "10:00", end: null },
    ]);
  });

  it("caps weekly expansion 120 days back when there is no startsAt", () => {
    const out = listScheduledOccurrences([{ day: "FRI", start: "18:00" }], null, null, { to: "2026-11-06" });
    expect(out[0].date >= "2026-07-09").toBe(true);
    expect(out[out.length - 1].date).toBe("2026-11-06");
    expect(out.length).toBeLessThanOrEqual(18);
  });

  it("skips malformed entries, impossible dates and bad ends", () => {
    const data = [
      null,
      "x",
      {},
      { date: "2026-02-31", start: "10:00" },
      { date: "2026-11-01", start: "" },
      { date: "2026-11-01", start: "25:00" },
      { day: "XXX", start: "10:00" },
      { day: 3, start: "10:00" },
      { date: "2026-11-02", start: "10:00", end: "" },
      { date: "2026-11-03", start: "10:00", end: "09:00" },
    ];
    expect(listScheduledOccurrences(data, null, null, { to: "2026-11-06" })).toEqual([
      { date: "2026-11-02", start: "10:00", end: null },
      { date: "2026-11-03", start: "10:00", end: null },
    ]);
    expect(listScheduledOccurrences("nope", null, null, { to: "2026-11-06" })).toEqual([]);
    expect(listScheduledOccurrences(null, null, null, { to: "2026-11-06" })).toEqual([]);
  });

  it("dedupes by date and start", () => {
    const data = [
      { date: "2026-11-02", start: "10:00", end: "11:00" },
      { date: "2026-11-02", start: "10:00", end: "12:00" },
      { day: "MON", start: "10:00" },
    ];
    const out = listScheduledOccurrences(data, new Date("2026-11-02T00:00:00Z"), new Date("2026-11-02T00:00:00Z"), {
      to: "2026-11-06",
    });
    expect(out).toEqual([{ date: "2026-11-02", start: "10:00", end: "11:00" }]);
  });
});

describe("resolveMeeting", () => {
  const entry = { date: "2026-11-06", start: "19:00", end: "20:00" };

  it("uses the row when one exists at this time", () => {
    const saved = row("19:00", { endTime: "20:30" });
    expect(resolveMeeting("2026-11-06", "19:00", [entry], [saved])).toEqual({
      date: "2026-11-06",
      start: "19:00",
      end: "20:30",
      source: "SCHEDULED",
      inSchedule: true,
      movedFrom: null,
      row: saved,
    });
  });

  it("treats a schedule entry with no row as a new scheduled meeting", () => {
    expect(resolveMeeting("2026-11-06", "19:00", [entry], [])).toMatchObject({
      source: "SCHEDULED",
      inSchedule: true,
      end: "20:00",
      row: null,
    });
  });

  it("treats a time outside the schedule as ad hoc", () => {
    expect(resolveMeeting("2026-11-06", "10:00", [entry], [])).toMatchObject({
      source: "ADHOC",
      inSchedule: false,
      end: null,
      row: null,
    });
  });

  it("merges a moved time: the old and new start open the same row", () => {
    const saved = row("18:00");
    for (const start of ["18:00", "19:00"]) {
      expect(resolveMeeting("2026-11-06", start, [entry], [saved])).toMatchObject({
        start: "19:00",
        end: "20:00",
        inSchedule: true,
        movedFrom: "18:00",
        row: saved,
      });
    }
  });

  it("does not merge a third time into a moved meeting", () => {
    expect(resolveMeeting("2026-11-06", "21:00", [entry], [row("18:00")])).toMatchObject({
      start: "21:00",
      source: "ADHOC",
      row: null,
    });
  });

  it("does not merge when the date has two entries or two scheduled rows", () => {
    const second = { date: "2026-11-06", start: "21:00", end: null };
    expect(resolveMeeting("2026-11-06", "19:00", [entry, second], [row("18:00")]).movedFrom).toBeNull();
    expect(resolveMeeting("2026-11-06", "19:00", [entry], [row("17:00"), row("18:00")]).movedFrom).toBeNull();
  });

  it("does not treat an ad hoc row as a moved meeting", () => {
    const adhoc = row("10:00", { source: "ADHOC" });
    expect(resolveMeeting("2026-11-06", "19:00", [entry], [adhoc])).toMatchObject({
      start: "19:00",
      movedFrom: null,
      row: null,
    });
    expect(resolveMeeting("2026-11-06", "10:00", [entry], [adhoc])).toMatchObject({
      source: "ADHOC",
      inSchedule: false,
      row: adhoc,
    });
  });

  it("still finds the moved row beside an ad hoc row", () => {
    const moved = row("18:00");
    const adhoc = row("10:00", { source: "ADHOC" });
    expect(resolveMeeting("2026-11-06", "19:00", [entry], [adhoc, moved])).toMatchObject({ movedFrom: "18:00", row: moved });
  });
});

describe("listMeetings", () => {
  it("is started occurrences plus rows, newest first", () => {
    const occurrences = [
      { date: "2026-11-01", start: "10:00", end: null },
      { date: "2026-11-06", start: "19:00", end: null },
      { date: "2026-11-06", start: "21:00", end: null },
    ];
    const adhoc = row("08:00", { meetingDate: "2026-11-03", source: "ADHOC" });
    const out = listMeetings(occurrences, [adhoc], NOW);
    expect(out.map((m) => `${m.date} ${m.start} ${m.source} ${m.inSchedule}`)).toEqual([
      "2026-11-06 19:00 SCHEDULED true",
      "2026-11-03 08:00 ADHOC false",
      "2026-11-01 10:00 SCHEDULED true",
    ]);
  });

  it("shows a moved meeting once, even when the new time is still ahead", () => {
    const saved = row("18:00");
    const out = listMeetings([{ date: "2026-11-06", start: "22:00", end: "23:00" }], [saved], NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ start: "22:00", end: "23:00", movedFrom: "18:00", row: saved });
  });

  it("keeps a row whose date left the schedule", () => {
    const out = listMeetings([], [row("18:00")], NOW);
    expect(out[0]).toMatchObject({ start: "18:00", inSchedule: false, source: "SCHEDULED", movedFrom: null });
  });

  it("does not repeat an occurrence that has a row", () => {
    const out = listMeetings([{ date: "2026-11-06", start: "18:00", end: null }], [row("18:00")], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].inSchedule).toBe(true);
  });
});

describe("meetings on an old weekly date", () => {
  // 2026-06-08 is a Monday, 151 days before NOW and so outside the weekly cap.
  const OLD_MONDAY = "2026-06-08";
  const schedule = [{ day: "MON", start: "10:00", end: "11:00" }];
  const startsAt = new Date("2026-03-01T00:00:00Z");
  const capped = (data: unknown) => listScheduledOccurrences(data, startsAt, null, { to: "2026-11-06" });
  const on = (data: unknown, starts: Date | null = startsAt, ends: Date | null = null) => (date: string) =>
    scheduleEntriesOn(data, starts, ends, date);

  it("finds the entry on any date inside startsAt/endsAt, however old", () => {
    expect(on(schedule)(OLD_MONDAY)).toEqual([{ date: OLD_MONDAY, start: "10:00", end: "11:00" }]);
    expect(capped(schedule).some((entry) => entry.date === OLD_MONDAY)).toBe(false);
  });

  it("keeps a saved row in the schedule after it ages past the cap", () => {
    const out = listMeetings(capped(schedule), [row("10:00", { meetingDate: OLD_MONDAY })], NOW, on(schedule)).filter(
      (meeting) => meeting.date === OLD_MONDAY,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ inSchedule: true, source: "SCHEDULED", movedFrom: null });
  });

  it("still reports a moved time on an old date", () => {
    const out = listMeetings(capped(schedule), [row("09:00", { meetingDate: OLD_MONDAY })], NOW, on(schedule)).filter(
      (meeting) => meeting.date === OLD_MONDAY,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ start: "10:00", end: "11:00", movedFrom: "09:00", inSchedule: true });
  });

  it("does not put a row in the schedule when its date or weekday does not match", () => {
    const classify = (meetingDate: string, starts: Date | null, ends: Date | null) =>
      listMeetings([], [row("10:00", { meetingDate })], NOW, on(schedule, starts, ends))[0].inSchedule;
    expect(classify("2026-06-09", startsAt, null)).toBe(false);
    expect(classify(OLD_MONDAY, new Date("2026-06-09T00:00:00Z"), null)).toBe(false);
    expect(classify(OLD_MONDAY, startsAt, new Date("2026-06-07T00:00:00Z"))).toBe(false);
  });

  it("does not list another unmarked slot of that old date", () => {
    const twoSlots = [...schedule, { day: "MON", start: "14:00", end: "15:00" }];
    const out = listMeetings(capped(twoSlots), [row("10:00", { meetingDate: OLD_MONDAY })], NOW, on(twoSlots)).filter(
      (meeting) => meeting.date === OLD_MONDAY,
    );
    expect(out.map((meeting) => meeting.start)).toEqual(["10:00"]);
  });
});

describe("markBlock", () => {
  const meeting = (start: string, date = "2026-11-06", inSchedule = true, saved: MeetingRowFields | null = null) => ({
    date,
    start,
    end: null,
    source: inSchedule ? ("SCHEDULED" as const) : ("ADHOC" as const),
    inSchedule,
    movedFrom: null,
    row: saved,
  });

  it("allows a meeting at or after its start instant, by Bangkok time", () => {
    expect(markBlock(meeting("20:00"), NOW)).toBeNull();
    expect(markBlock(meeting("20:01"), NOW)).toBe("NOT_STARTED");
    expect(markBlock(meeting("08:00", "2026-11-07"), NOW)).toBe("NOT_STARTED");
  });

  it("limits ad hoc meetings to 120 days back", () => {
    expect(markBlock(meeting("10:00", "2026-07-09", false), NOW)).toBeNull();
    expect(markBlock(meeting("10:00", "2026-07-08", false), NOW)).toBe("TOO_OLD");
  });

  it("does not age-limit scheduled meetings or corrections to a saved row", () => {
    expect(markBlock(meeting("10:00", "2026-01-01"), NOW)).toBeNull();
    expect(markBlock(meeting("10:00", "2026-01-01", false, row("10:00")), NOW)).toBeNull();
  });
});

describe("joinHintWindow", () => {
  const base = { date: "2026-11-06", source: "SCHEDULED" as const, inSchedule: true, movedFrom: null, row: null };

  it("runs from 30 minutes before start to the end", () => {
    expect(joinHintWindow({ ...base, start: "19:00", end: "20:00" })).toEqual({
      from: new Date("2026-11-06T11:30:00Z"),
      to: new Date("2026-11-06T13:00:00Z"),
    });
  });

  it("runs to start + 3 hours with no end", () => {
    expect(joinHintWindow({ ...base, start: "19:00", end: null })?.to).toEqual(new Date("2026-11-06T15:00:00Z"));
  });

  it("spans both the old and new times of a moved meeting", () => {
    const window = joinHintWindow({
      ...base,
      start: "19:00",
      end: "20:00",
      movedFrom: "15:00",
      row: row("15:00", { endTime: "16:00" }),
    });
    expect(window).toEqual({ from: new Date("2026-11-06T07:30:00Z"), to: new Date("2026-11-06T13:00:00Z") });
  });
});

describe("planMarkChanges", () => {
  const existing = [
    { studentUserId: S1, status: "PRESENT" },
    { studentUserId: S2, status: "ABSENT" },
  ];

  it("changes nothing when the marks repeat the current state", () => {
    const plan = planMarkChanges(existing, [
      { studentUserId: S1, status: "PRESENT" },
      { studentUserId: "33333333-3333-4333-8333-333333333333", status: null },
    ]);
    expect(changedStudentIds(plan)).toEqual([]);
  });

  it("splits creates, updates and removes", () => {
    const fresh = "33333333-3333-4333-8333-333333333333";
    expect(
      planMarkChanges(existing, [
        { studentUserId: S1, status: "LATE" },
        { studentUserId: S2, status: null },
        { studentUserId: fresh, status: "PRESENT" },
      ]),
    ).toEqual({
      creates: [{ studentUserId: fresh, status: "PRESENT" }],
      updates: [{ studentUserId: S1, status: "LATE" }],
      removes: [S2],
    });
  });
});

describe("validators", () => {
  const valid = { date: "2026-11-06", start: "19:00", marks: [{ studentUserId: S1, status: "PRESENT" }] };

  it("accepts a valid save and lower-cases student ids", () => {
    const parsed = validateSaveMarks({ ...valid, end: "20:00", marks: [{ studentUserId: S1.toUpperCase(), status: null }] });
    expect(parsed).toEqual({
      ok: true,
      value: { date: "2026-11-06", start: "19:00", end: "20:00", marks: [{ studentUserId: S1, status: null }] },
    });
  });

  it.each([
    ["non-object", []],
    ["impossible date", { ...valid, date: "2026-02-31" }],
    ["badly formed date", { ...valid, date: "6/11/2026" }],
    ["bad start", { ...valid, start: "24:00" }],
    ["bad end", { ...valid, end: "9pm" }],
    ["end before start", { ...valid, end: "18:00" }],
    ["end equal to start", { ...valid, end: "19:00" }],
    ["missing marks", { date: valid.date, start: valid.start }],
    ["non-object mark", { ...valid, marks: ["x"] }],
    ["bad student id", { ...valid, marks: [{ studentUserId: "abc", status: "LATE" }] }],
    ["bad status", { ...valid, marks: [{ studentUserId: S1, status: "HERE" }] }],
    ["missing status", { ...valid, marks: [{ studentUserId: S1 }] }],
    ["duplicate student", { ...valid, marks: [{ studentUserId: S1, status: "LATE" }, { studentUserId: S1.toUpperCase(), status: null }] }],
    ["too many marks", { ...valid, marks: Array(LIMITS.marksPerSaveMax + 1).fill({ studentUserId: S1, status: "LATE" }) }],
  ])("rejects %s", (_name, body) => {
    expect(validateSaveMarks(body)).toMatchObject({ ok: false, code: "VALIDATION_FAILED" });
  });

  it("validates the meeting query", () => {
    expect(validateMeetingQuery({ date: "2026-11-06", start: "19:00" }).ok).toBe(true);
    expect(validateMeetingQuery({ date: ["2026-11-06"], start: "19:00" }).ok).toBe(false);
    expect(validateMeetingQuery({ date: "2026-11-06" }).ok).toBe(false);
  });
});

describe("stats", () => {
  it("rate is (present + late) / marked, null when nothing is marked", () => {
    expect(attendanceRate({ present: 2, late: 1, absent: 1 })).toBe(0.75);
    expect(attendanceRate({ present: 0, late: 0, absent: 3 })).toBe(0);
    expect(attendanceRate({ present: 0, late: 0, absent: 0 })).toBeNull();
  });

  it("counts statuses and ignores anything else", () => {
    expect(countStatuses(["PRESENT", "LATE", "LATE", "ABSENT", "OTHER"])).toEqual({ present: 1, late: 2, absent: 1 });
  });

  it("summarises a meeting: unmarked counts only active students without a mark", () => {
    const meeting = { date: "2026-11-06", start: "19:00", end: null, source: "SCHEDULED" as const, inSchedule: true, movedFrom: null, row: row("19:00") };
    const former = "33333333-3333-4333-8333-333333333333";
    expect(toMeetingSummary(meeting, [{ studentUserId: S1, status: "LATE" }, { studentUserId: former, status: "ABSENT" }], [S1, S2])).toEqual({
      date: "2026-11-06",
      start: "19:00",
      end: null,
      source: "SCHEDULED",
      inSchedule: true,
      movedFrom: null,
      counts: { present: 0, late: 1, absent: 1, unmarked: 1 },
      marked: true,
    });
  });

  it("expects a student from the Bangkok day they enrolled, not before", () => {
    // 2026-11-05 17:30 UTC is 00:30 on the 6th in Bangkok.
    const enrolledAt = new Map([
      [S1, new Date("2026-01-01T00:00:00Z")],
      [S2, new Date("2026-11-05T17:30:00Z")],
    ]);
    expect(expectedStudentIds(enrolledAt, "2026-11-05")).toEqual([S1]);
    expect(expectedStudentIds(enrolledAt, "2026-11-06")).toEqual([S1, S2]);
  });

  it("includes active students with no marks and former students with marks", () => {
    const former = "33333333-3333-4333-8333-333333333333";
    const users = [
      { userId: S1, displayName: "ข", profilePictureUrl: null },
      { userId: S2, displayName: "ก", profilePictureUrl: "https://x/a.png" },
      { userId: former, displayName: "ค", profilePictureUrl: null },
    ];
    const stats = buildStudentStats([S1, S2], [{ studentUserId: former, status: "PRESENT" }, { studentUserId: S1, status: "ABSENT" }], users);
    expect(stats).toEqual([
      { studentUserId: S2, name: "ก", avatarUrl: "https://x/a.png", present: 0, late: 0, absent: 0, rate: null },
      { studentUserId: S1, name: "ข", avatarUrl: null, present: 0, late: 0, absent: 1, rate: 0 },
      { studentUserId: former, name: "ค", avatarUrl: null, present: 1, late: 0, absent: 0, rate: 1 },
    ]);
  });

  it("builds the roster: active union marked, sorted by name, former read-only", () => {
    const former = "33333333-3333-4333-8333-333333333333";
    const joined = new Date("2026-11-06T12:00:00Z");
    const roster = buildRoster(
      [S1, S2],
      [{ studentUserId: former, status: "LATE" }],
      [
        { userId: S1, displayName: "ข", profilePictureUrl: null },
        { userId: S2, displayName: "ก", profilePictureUrl: null },
        { userId: former, displayName: "ค", profilePictureUrl: null },
      ],
      new Map([[S1, joined]]),
      [S1],
    );
    expect(roster).toEqual([
      { studentUserId: S2, name: "ก", avatarUrl: null, status: null, joinedAt: null, enrolled: true, joinedLater: true },
      { studentUserId: S1, name: "ข", avatarUrl: null, status: null, joinedAt: "2026-11-06T12:00:00.000Z", enrolled: true, joinedLater: false },
      { studentUserId: former, name: "ค", avatarUrl: null, status: "LATE", joinedAt: null, enrolled: false, joinedLater: false },
    ]);
  });

  it("orders a student's records newest first with a summary", () => {
    const meeting = (meetingDate: string, startTime: string) => ({ meetingDate, startTime, endTime: null });
    expect(
      toMyAttendance([
        { status: "ABSENT", meeting: meeting("2026-11-01", "10:00") },
        { status: "PRESENT", meeting: meeting("2026-11-03", "10:00") },
        { status: "LATE", meeting: meeting("2026-11-03", "18:00") },
      ]),
    ).toEqual({
      summary: { present: 1, late: 1, absent: 1, rate: 2 / 3 },
      records: [
        { date: "2026-11-03", start: "18:00", end: null, status: "LATE" },
        { date: "2026-11-03", start: "10:00", end: null, status: "PRESENT" },
        { date: "2026-11-01", start: "10:00", end: null, status: "ABSENT" },
      ],
    });
  });
});
