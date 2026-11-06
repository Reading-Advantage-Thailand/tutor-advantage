import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  class: { findUnique: vi.fn() },
  classMeeting: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  attendanceRecord: { findMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  enrollment: { findMany: vi.fn(), findFirst: vi.fn() },
  user: { findMany: vi.fn(), findUnique: vi.fn() },
  sessionParticipant: { groupBy: vi.fn() },
  auditEvent: { create: vi.fn() },
}));

vi.mock("@tutor-advantage/database", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tutor-advantage/database")>()),
  prisma,
}));
vi.mock("@tutor-advantage/shared-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tutor-advantage/shared-config")>()),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../services/ticketNotifications", () => ({ notifyNewTicket: vi.fn(), notifyRequester: vi.fn() }));

import { getAdminClassAttendance } from "./adminAttendanceController";
import { getAttendanceMeeting, getClassAttendance, saveAttendanceMeeting } from "./attendanceController";

const TUTOR = "11111111-1111-4111-8111-111111111111";
const OTHER_TUTOR = "22222222-2222-4222-8222-222222222222";
const STUDENT = "33333333-3333-4333-8333-333333333333";
const STUDENT_2 = "44444444-4444-4444-8444-444444444444";
const CLASS_ID = "55555555-5555-4555-8555-555555555555";
const MEETING = "66666666-6666-4666-8666-666666666666";
const ADMIN = "77777777-7777-4777-8777-777777777777";

// 2026-11-06 20:00 Bangkok.
const NOW = new Date("2026-11-06T13:00:00Z");
const ENROLLED = new Date("2026-01-01T00:00:00Z");

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    user: { userId: TUTOR, role: "TUTOR" },
    headers: {},
    params: { classId: CLASS_ID },
    query: {},
    body: {},
    ...overrides,
  } as never;
}

function classRow(overrides: Record<string, unknown> = {}) {
  return {
    classId: CLASS_ID,
    title: "English",
    tutorUserId: TUTOR,
    isDemo: false,
    setupRequiredAt: null,
    scheduleData: [{ date: "2026-11-06", start: "19:00", end: "20:00" }],
    startsAt: null,
    endsAt: null,
    ...overrides,
  };
}

function meetingRow(overrides: Record<string, unknown> = {}) {
  return {
    meetingId: MEETING,
    classId: CLASS_ID,
    meetingDate: "2026-11-06",
    startTime: "19:00",
    endTime: "20:00",
    source: "SCHEDULED",
    records: [],
    ...overrides,
  };
}

function save(marks: unknown[], extra: Record<string, unknown> = {}) {
  return request({ body: { date: "2026-11-06", start: "19:00", marks, ...extra } });
}

function errorCode(res: ReturnType<typeof response>) {
  return (res.json.mock.calls[0][0] as { error: { code: string } }).error.code;
}

function body<T = any>(res: ReturnType<typeof response>): T {
  return res.json.mock.calls[0][0] as T;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(prisma));
  prisma.$executeRaw.mockResolvedValue(1);
  prisma.class.findUnique.mockResolvedValue(classRow());
  prisma.classMeeting.findMany.mockResolvedValue([]);
  prisma.classMeeting.create.mockResolvedValue({ meetingId: MEETING });
  prisma.attendanceRecord.findMany.mockResolvedValue([]);
  prisma.enrollment.findMany.mockResolvedValue([{ studentUserId: STUDENT, createdAt: ENROLLED }]);
  prisma.enrollment.findFirst.mockResolvedValue(null);
  prisma.user.findMany.mockResolvedValue([{ userId: STUDENT, displayName: "น้องเอ", profilePictureUrl: null }]);
  prisma.user.findUnique.mockResolvedValue({ displayName: "ครูบี" });
  prisma.sessionParticipant.groupBy.mockResolvedValue([]);
});

describe("authorization", () => {
  it("answers 401 with no user on every route", async () => {
    for (const handler of [getClassAttendance, getAttendanceMeeting, saveAttendanceMeeting, getAdminClassAttendance]) {
      const res = response();
      await handler(request({ user: undefined }), res as never);
      expect(res.status).toHaveBeenCalledWith(401);
    }
  });

  it("does not let an admin use the tutor routes", async () => {
    for (const handler of [getClassAttendance, getAttendanceMeeting, saveAttendanceMeeting]) {
      const res = response();
      await handler(request({ user: { userId: ADMIN, role: "ADMIN" } }), res as never);
      expect(res.status).toHaveBeenCalledWith(403);
    }
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it("does not let a student read a meeting or save", async () => {
    for (const handler of [getAttendanceMeeting, saveAttendanceMeeting]) {
      const res = response();
      await handler(request({ user: { userId: STUDENT, role: "STUDENT" } }), res as never);
      expect(res.status).toHaveBeenCalledWith(403);
    }
  });

  it("answers 403 to another tutor and 404 to an unknown class", async () => {
    const res = response();
    await getClassAttendance(request({ user: { userId: OTHER_TUTOR, role: "TUTOR" } }), res as never);
    expect(res.status).toHaveBeenCalledWith(403);

    const save403 = response();
    await saveAttendanceMeeting({ ...save([]), user: { userId: OTHER_TUTOR, role: "TUTOR" } } as never, save403 as never);
    expect(save403.status).toHaveBeenCalledWith(403);

    prisma.class.findUnique.mockResolvedValue(null);
    const res404 = response();
    await getClassAttendance(request(), res404 as never);
    expect(res404.status).toHaveBeenCalledWith(404);
  });

  it("answers 404 to a malformed id without touching the database", async () => {
    for (const handler of [getClassAttendance, getAttendanceMeeting, saveAttendanceMeeting]) {
      const res = response();
      await handler(request({ params: { classId: "not-a-uuid" } }), res as never);
      expect(res.status).toHaveBeenCalledWith(404);
    }
    const adminRes = response();
    await getAdminClassAttendance(
      request({ params: { classId: "not-a-uuid" }, user: { userId: ADMIN, role: "ADMIN" } }),
      adminRes as never,
    );
    expect(adminRes.status).toHaveBeenCalledWith(404);
    expect(prisma.class.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["demo", { isDemo: true }],
    ["waiting for setup", { setupRequiredAt: new Date() }],
  ])("denies a class that is %s with ATTENDANCE_NOT_AVAILABLE", async (_name, overrides) => {
    prisma.class.findUnique.mockResolvedValue(classRow(overrides));
    const list = response();
    await getClassAttendance(request(), list as never);
    expect(list.status).toHaveBeenCalledWith(409);
    expect(errorCode(list)).toBe("ATTENDANCE_NOT_AVAILABLE");

    const put = response();
    await saveAttendanceMeeting(save([{ studentUserId: STUDENT, status: "PRESENT" }]), put as never);
    expect(errorCode(put)).toBe("ATTENDANCE_NOT_AVAILABLE");
    expect(prisma.classMeeting.create).not.toHaveBeenCalled();

    const admin = response();
    await getAdminClassAttendance(request({ user: { userId: ADMIN, role: "ADMIN" } }), admin as never);
    expect(errorCode(admin)).toBe("ATTENDANCE_NOT_AVAILABLE");
  });

  it("keeps a closed class markable", async () => {
    prisma.class.findUnique.mockResolvedValue(classRow({ status: "CLOSED" }));
    const res = response();
    await saveAttendanceMeeting(save([{ studentUserId: STUDENT, status: "PRESENT" }]), res as never);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("student view", () => {
  const asStudent = { user: { userId: STUDENT, role: "STUDENT" } };

  it("is 404 without any enrollment", async () => {
    const res = response();
    await getClassAttendance(request(asStudent), res as never);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.attendanceRecord.findMany).not.toHaveBeenCalled();
  });

  it("returns only the caller's own marks, for any enrollment status", async () => {
    prisma.enrollment.findFirst.mockResolvedValue({ classId: CLASS_ID });
    prisma.attendanceRecord.findMany.mockResolvedValue([
      { status: "LATE", meeting: { meetingDate: "2026-11-05", startTime: "19:00", endTime: "20:00" } },
    ]);
    const res = response();
    await getClassAttendance(request(asStudent), res as never);

    expect(prisma.enrollment.findFirst).toHaveBeenCalledWith({
      where: { classId: CLASS_ID, studentUserId: STUDENT },
      select: { classId: true },
    });
    expect(prisma.attendanceRecord.findMany.mock.calls[0][0].where).toEqual({
      studentUserId: STUDENT,
      meeting: { classId: CLASS_ID },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(body(res)).toEqual({
      mine: {
        summary: { present: 0, late: 1, absent: 0, rate: 1 },
        records: [{ date: "2026-11-05", start: "19:00", end: "20:00", status: "LATE" }],
      },
    });
    expect(prisma.classMeeting.findMany).not.toHaveBeenCalled();
  });
});

describe("tutor overview", () => {
  it("lists started occurrences and rows, with per-student totals", async () => {
    prisma.class.findUnique.mockResolvedValue(
      classRow({
        scheduleData: [
          { date: "2026-11-05", start: "19:00", end: "20:00" },
          { date: "2026-11-06", start: "19:00", end: "20:00" },
          { date: "2026-11-06", start: "21:00", end: "22:00" },
          { date: "2026-11-07", start: "19:00", end: "20:00" },
        ],
      }),
    );
    prisma.classMeeting.findMany.mockResolvedValue([
      meetingRow({
        meetingDate: "2026-11-05",
        records: [{ studentUserId: STUDENT, status: "PRESENT" }],
      }),
    ]);
    const res = response();
    await getClassAttendance(request(), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(body(res)).toEqual({
      meetings: [
        {
          date: "2026-11-06",
          start: "19:00",
          end: "20:00",
          source: "SCHEDULED",
          inSchedule: true,
          movedFrom: null,
          counts: { present: 0, late: 0, absent: 0, unmarked: 1 },
          marked: false,
        },
        {
          date: "2026-11-05",
          start: "19:00",
          end: "20:00",
          source: "SCHEDULED",
          inSchedule: true,
          movedFrom: null,
          counts: { present: 1, late: 0, absent: 0, unmarked: 0 },
          marked: true,
        },
      ],
      students: [{ studentUserId: STUDENT, name: "น้องเอ", avatarUrl: null, present: 1, late: 0, absent: 0, rate: 1 }],
    });
  });

  it("merges a moved time into one meeting with the row's marks", async () => {
    prisma.classMeeting.findMany.mockResolvedValue([
      meetingRow({ startTime: "18:00", endTime: "19:00", records: [{ studentUserId: STUDENT, status: "LATE" }] }),
    ]);
    const res = response();
    await getClassAttendance(request(), res as never);
    const { meetings } = body(res);
    expect(meetings).toHaveLength(1);
    expect(meetings[0]).toMatchObject({ start: "19:00", end: "20:00", movedFrom: "18:00", marked: true });
    expect(meetings[0].counts).toEqual({ present: 0, late: 1, absent: 0, unmarked: 0 });
  });
});

describe("a student who joined after a meeting", () => {
  // 2026-11-05 17:30 UTC is 00:30 on the 6th in Bangkok.
  const joinedOnThe6th = [{ studentUserId: STUDENT, createdAt: new Date("2026-11-05T17:30:00Z") }];
  const twoMeetings = [
    { date: "2026-11-05", start: "19:00", end: "20:00" },
    { date: "2026-11-06", start: "19:00", end: "20:00" },
  ];

  it("is not counted as unmarked before their enrollment day, and is from that day", async () => {
    prisma.class.findUnique.mockResolvedValue(classRow({ scheduleData: twoMeetings }));
    prisma.enrollment.findMany.mockResolvedValue(joinedOnThe6th);
    const res = response();
    await getClassAttendance(request(), res as never);
    const unmarked = Object.fromEntries(body(res).meetings.map((meeting: any) => [meeting.date, meeting.counts.unmarked]));
    expect(unmarked).toEqual({ "2026-11-05": 0, "2026-11-06": 1 });
    expect(body(res).students).toEqual([expect.objectContaining({ studentUserId: STUDENT })]);
  });

  it("uses the earliest enrollment when a student has more than one", async () => {
    prisma.class.findUnique.mockResolvedValue(classRow({ scheduleData: twoMeetings }));
    prisma.enrollment.findMany.mockResolvedValue([...joinedOnThe6th, { studentUserId: STUDENT, createdAt: ENROLLED }]);
    const res = response();
    await getClassAttendance(request(), res as never);
    expect(body(res).meetings.map((meeting: any) => meeting.counts.unmarked)).toEqual([1, 1]);
  });

  it("stays on the roster, flagged, and can still be marked", async () => {
    prisma.class.findUnique.mockResolvedValue(classRow({ scheduleData: twoMeetings }));
    prisma.enrollment.findMany.mockResolvedValue(joinedOnThe6th);
    const opened = response();
    await getAttendanceMeeting(request({ query: { date: "2026-11-05", start: "19:00" } }), opened as never);
    expect(body(opened).roster).toEqual([expect.objectContaining({ studentUserId: STUDENT, enrolled: true, joinedLater: true })]);

    const sameDay = response();
    await getAttendanceMeeting(request({ query: { date: "2026-11-06", start: "19:00" } }), sameDay as never);
    expect(body(sameDay).roster).toEqual([expect.objectContaining({ joinedLater: false })]);

    const saved = response();
    await saveAttendanceMeeting(save([{ studentUserId: STUDENT, status: "PRESENT" }], { date: "2026-11-05" }), saved as never);
    expect(saved.status).toHaveBeenCalledWith(200);
    expect(prisma.attendanceRecord.createMany).toHaveBeenCalledTimes(1);
  });
});

describe("a weekly class with a meeting older than the 120-day list", () => {
  // 2026-06-08 is a Monday, 151 days before NOW.
  const OLD_MONDAY = "2026-06-08";
  const weekly = classRow({
    scheduleData: [{ day: "MON", start: "10:00", end: "11:00" }],
    startsAt: new Date("2026-03-01T00:00:00Z"),
  });
  const oldRow = (overrides: Record<string, unknown> = {}) =>
    meetingRow({ meetingDate: OLD_MONDAY, startTime: "10:00", endTime: "11:00", ...overrides });

  beforeEach(() => {
    prisma.class.findUnique.mockResolvedValue(weekly);
  });

  it("keeps a saved row in the schedule", async () => {
    prisma.classMeeting.findMany.mockResolvedValue([oldRow({ records: [{ studentUserId: STUDENT, status: "PRESENT" }] })]);
    const res = response();
    await getClassAttendance(request(), res as never);
    expect(body(res).meetings.find((meeting: any) => meeting.date === OLD_MONDAY)).toMatchObject({
      source: "SCHEDULED",
      inSchedule: true,
      movedFrom: null,
    });
  });

  it("stays a scheduled, markable meeting after its last mark is cleared", async () => {
    prisma.classMeeting.findMany.mockResolvedValueOnce([oldRow()]);
    prisma.attendanceRecord.findMany.mockResolvedValueOnce([{ studentUserId: STUDENT, status: "PRESENT" }]);
    const res = response();
    await saveAttendanceMeeting(save([{ studentUserId: STUDENT, status: null }], { date: OLD_MONDAY, start: "10:00" }), res as never);
    expect(prisma.classMeeting.delete).toHaveBeenCalledWith({ where: { meetingId: MEETING } });
    expect(body(res).meeting).toMatchObject({ source: "SCHEDULED", inSchedule: true, end: "11:00", markable: true });
  });

  it("accepts a mark again on that date, as a scheduled meeting", async () => {
    const res = response();
    await saveAttendanceMeeting(save([{ studentUserId: STUDENT, status: "PRESENT" }], { date: OLD_MONDAY, start: "10:00" }), res as never);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.classMeeting.create.mock.calls[0][0].data).toMatchObject({ source: "SCHEDULED", startTime: "10:00", endTime: "11:00" });
  });

  it("treats a date before startsAt with no row as too old a make-up meeting", async () => {
    const opened = response();
    await getAttendanceMeeting(request({ query: { date: "2026-02-02", start: "10:00" } }), opened as never);
    expect(body(opened).meeting).toMatchObject({ source: "ADHOC", inSchedule: false, markable: false });

    const saved = response();
    await saveAttendanceMeeting(save([{ studentUserId: STUDENT, status: "PRESENT" }], { date: "2026-02-02", start: "10:00" }), saved as never);
    expect(saved.status).toHaveBeenCalledWith(400);
    expect(prisma.classMeeting.create).not.toHaveBeenCalled();
  });
});

describe("GET meeting", () => {
  const open = (start: string, date = "2026-11-06") => request({ query: { date, start } });

  it("rejects a bad date or time", async () => {
    const res = response();
    await getAttendanceMeeting(open("19:00", "2026-02-31"), res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(errorCode(res)).toBe("VALIDATION_FAILED");
  });

  it("returns the roster with the join hint, never creating a mark", async () => {
    const joined = new Date("2026-11-06T11:55:00Z");
    prisma.sessionParticipant.groupBy.mockResolvedValue([{ studentUserId: STUDENT, _min: { joinedAt: joined } }]);
    const res = response();
    await getAttendanceMeeting(open("19:00"), res as never);

    expect(prisma.sessionParticipant.groupBy.mock.calls[0][0].where).toEqual({
      session: { classId: CLASS_ID },
      joinedAt: { gte: new Date("2026-11-06T11:30:00Z"), lte: new Date("2026-11-06T13:00:00Z") },
    });
    expect(body(res)).toEqual({
      meeting: { date: "2026-11-06", start: "19:00", end: "20:00", source: "SCHEDULED", inSchedule: true, movedFrom: null, markable: true },
      roster: [
        { studentUserId: STUDENT, name: "น้องเอ", avatarUrl: null, status: null, joinedAt: joined.toISOString(), enrolled: true, joinedLater: false },
      ],
    });
    expect(prisma.classMeeting.create).not.toHaveBeenCalled();
    expect(prisma.attendanceRecord.createMany).not.toHaveBeenCalled();
  });

  it("reports a future meeting as not markable", async () => {
    const res = response();
    await getAttendanceMeeting(open("19:00", "2026-11-07"), res as never);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(body(res).meeting.markable).toBe(false);
    expect(prisma.sessionParticipant.groupBy).not.toHaveBeenCalled();
  });

  it("includes a former student with a mark as read-only", async () => {
    prisma.classMeeting.findMany.mockResolvedValue([meetingRow()]);
    prisma.attendanceRecord.findMany.mockResolvedValue([{ studentUserId: STUDENT_2, status: "ABSENT" }]);
    prisma.user.findMany.mockResolvedValue([
      { userId: STUDENT, displayName: "ก", profilePictureUrl: null },
      { userId: STUDENT_2, displayName: "ข", profilePictureUrl: null },
    ]);
    const res = response();
    await getAttendanceMeeting(open("19:00"), res as never);
    expect(body(res).roster).toEqual([
      expect.objectContaining({ studentUserId: STUDENT, status: null, enrolled: true }),
      expect.objectContaining({ studentUserId: STUDENT_2, status: "ABSENT", enrolled: false }),
    ]);
  });

  it("opens a moved meeting from either time", async () => {
    prisma.classMeeting.findMany.mockResolvedValue([meetingRow({ startTime: "18:00", endTime: "19:00" })]);
    for (const start of ["18:00", "19:00"]) {
      const res = response();
      await getAttendanceMeeting(open(start), res as never);
      expect(body(res).meeting).toMatchObject({ start: "19:00", movedFrom: "18:00" });
    }
    expect(prisma.attendanceRecord.findMany).toHaveBeenCalledWith({
      where: { meetingId: MEETING },
      select: { studentUserId: true, status: true },
    });
  });
});

describe("PUT meeting", () => {
  it("rejects invalid input before opening a transaction", async () => {
    const res = response();
    await saveAttendanceMeeting(save([{ studentUserId: STUDENT, status: "NOPE" }]), res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(errorCode(res)).toBe("VALIDATION_FAILED");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a future meeting", async () => {
    const res = response();
    await saveAttendanceMeeting(
      save([{ studentUserId: STUDENT, status: "PRESENT" }], { date: "2026-11-06", start: "20:01" }),
      res as never,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(errorCode(res)).toBe("MEETING_NOT_STARTED");
    expect(prisma.classMeeting.create).not.toHaveBeenCalled();
  });

  it("creates the row on the first mark, with no audit", async () => {
    const res = response();
    await saveAttendanceMeeting(save([{ studentUserId: STUDENT, status: "PRESENT" }]), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.classMeeting.create).toHaveBeenCalledWith({
      data: {
        classId: CLASS_ID,
        meetingDate: "2026-11-06",
        startTime: "19:00",
        endTime: "20:00",
        source: "SCHEDULED",
        createdByUserId: TUTOR,
      },
    });
    expect(prisma.attendanceRecord.createMany).toHaveBeenCalledWith({
      data: [{ meetingId: MEETING, studentUserId: STUDENT, status: "PRESENT", markedByUserId: TUTOR, markedAt: NOW }],
    });
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it("creates an ad hoc meeting with the tutor's times", async () => {
    const res = response();
    await saveAttendanceMeeting(
      save([{ studentUserId: STUDENT, status: "LATE" }], { date: "2026-11-02", start: "10:00", end: "11:00" }),
      res as never,
    );
    expect(prisma.classMeeting.create.mock.calls[0][0].data).toMatchObject({
      meetingDate: "2026-11-02",
      startTime: "10:00",
      endTime: "11:00",
      source: "ADHOC",
    });
  });

  it("refuses an ad hoc meeting older than 120 days", async () => {
    const res = response();
    await saveAttendanceMeeting(save([{ studentUserId: STUDENT, status: "LATE" }], { date: "2026-07-01", start: "10:00" }), res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(errorCode(res)).toBe("VALIDATION_FAILED");
  });

  it("rolls the whole save back when a changed student is not ACTIVE", async () => {
    // Simulates what $transaction does on a throw: nothing after the check runs.
    const res = response();
    await saveAttendanceMeeting(
      save([
        { studentUserId: STUDENT, status: "PRESENT" },
        { studentUserId: STUDENT_2, status: "PRESENT" },
      ]),
      res as never,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(errorCode(res)).toBe("STUDENT_NOT_ENROLLED");
    expect(prisma.classMeeting.create).not.toHaveBeenCalled();
    expect(prisma.attendanceRecord.createMany).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it("does not let a former student's mark change or be removed", async () => {
    prisma.classMeeting.findMany.mockResolvedValue([meetingRow()]);
    prisma.attendanceRecord.findMany.mockResolvedValue([{ studentUserId: STUDENT_2, status: "ABSENT" }]);
    prisma.enrollment.findMany.mockResolvedValue([]);
    for (const status of ["PRESENT", null]) {
      const res = response();
      await saveAttendanceMeeting(save([{ studentUserId: STUDENT_2, status }]), res as never);
      expect(errorCode(res)).toBe("STUDENT_NOT_ENROLLED");
    }
    expect(prisma.attendanceRecord.updateMany).not.toHaveBeenCalled();
    expect(prisma.attendanceRecord.deleteMany).not.toHaveBeenCalled();
  });

  it("is idempotent: a repeated save writes nothing", async () => {
    prisma.classMeeting.findMany.mockResolvedValue([meetingRow()]);
    prisma.attendanceRecord.findMany.mockResolvedValue([
      { studentUserId: STUDENT, status: "PRESENT" },
      { studentUserId: STUDENT_2, status: "ABSENT" },
    ]);
    prisma.enrollment.findMany.mockResolvedValue([{ studentUserId: STUDENT, createdAt: ENROLLED }]);
    const res = response();
    await saveAttendanceMeeting(
      save([
        { studentUserId: STUDENT, status: "PRESENT" },
        { studentUserId: STUDENT_2, status: "ABSENT" },
      ]),
      res as never,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.attendanceRecord.createMany).not.toHaveBeenCalled();
    expect(prisma.attendanceRecord.updateMany).not.toHaveBeenCalled();
    expect(prisma.classMeeting.update).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it("audits a correction once, with counts only", async () => {
    prisma.classMeeting.findMany.mockResolvedValue([meetingRow()]);
    prisma.attendanceRecord.findMany.mockResolvedValue([{ studentUserId: STUDENT, status: "PRESENT" }]);
    prisma.enrollment.findMany.mockResolvedValue([{ studentUserId: STUDENT, createdAt: ENROLLED }]);
    const res = response();
    await saveAttendanceMeeting(save([{ studentUserId: STUDENT, status: "LATE" }]), res as never);

    expect(prisma.attendanceRecord.updateMany).toHaveBeenCalledWith({
      where: { meetingId: MEETING, studentUserId: { in: [STUDENT] } },
      data: { status: "LATE", markedByUserId: TUTOR, markedAt: NOW },
    });
    expect(prisma.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: {
        actorId: TUTOR,
        action: "ATTENDANCE_CORRECT",
        entityType: "CLASS_MEETING",
        entityId: MEETING,
        payload: { created: 0, changed: 1, removed: 0 },
      },
    });
    expect(prisma.classMeeting.delete).not.toHaveBeenCalled();
  });

  it("deletes the meeting row and audits when the last mark is removed", async () => {
    prisma.classMeeting.findMany.mockResolvedValue([meetingRow()]);
    prisma.attendanceRecord.findMany.mockResolvedValue([{ studentUserId: STUDENT, status: "PRESENT" }]);
    const res = response();
    await saveAttendanceMeeting(save([{ studentUserId: STUDENT, status: null }]), res as never);

    expect(prisma.attendanceRecord.deleteMany).toHaveBeenCalledWith({
      where: { meetingId: MEETING, studentUserId: { in: [STUDENT] } },
    });
    expect(prisma.classMeeting.delete).toHaveBeenCalledWith({ where: { meetingId: MEETING } });
    expect(prisma.auditEvent.create.mock.calls[0][0].data.payload).toEqual({ created: 0, changed: 0, removed: 1 });
  });

  it("keeps the meeting row when another mark remains", async () => {
    prisma.classMeeting.findMany.mockResolvedValue([meetingRow()]);
    prisma.attendanceRecord.findMany.mockResolvedValue([
      { studentUserId: STUDENT, status: "PRESENT" },
      { studentUserId: STUDENT_2, status: "ABSENT" },
    ]);
    const res = response();
    await saveAttendanceMeeting(save([{ studentUserId: STUDENT, status: null }]), res as never);
    expect(prisma.classMeeting.delete).not.toHaveBeenCalled();
    expect(prisma.classMeeting.update).toHaveBeenCalledWith({ where: { meetingId: MEETING }, data: { updatedAt: NOW } });
  });

  it("fills a saved meeting's missing end from the typed end", async () => {
    prisma.classMeeting.findMany.mockResolvedValue([meetingRow({ endTime: null })]);
    prisma.attendanceRecord.findMany.mockResolvedValue([{ studentUserId: STUDENT, status: "PRESENT" }]);
    const res = response();
    await saveAttendanceMeeting(save([{ studentUserId: STUDENT, status: "LATE" }], { end: "20:30" }), res as never);
    expect(prisma.classMeeting.update).toHaveBeenCalledWith({ where: { meetingId: MEETING }, data: { updatedAt: NOW, endTime: "20:30" } });
  });

  it("does not replace a saved end, or fill the row of a moved meeting", async () => {
    prisma.attendanceRecord.findMany.mockResolvedValue([{ studentUserId: STUDENT, status: "PRESENT" }]);
    for (const saved of [meetingRow(), meetingRow({ startTime: "18:00", endTime: null })]) {
      prisma.classMeeting.update.mockClear();
      prisma.classMeeting.findMany.mockResolvedValue([saved]);
      const res = response();
      await saveAttendanceMeeting(save([{ studentUserId: STUDENT, status: "LATE" }], { end: "20:30" }), res as never);
      expect(prisma.classMeeting.update).toHaveBeenCalledWith({ where: { meetingId: MEETING }, data: { updatedAt: NOW } });
    }
  });

  it("saves a moved meeting to the existing row", async () => {
    prisma.classMeeting.findMany.mockResolvedValue([meetingRow({ startTime: "18:00", endTime: "19:00" })]);
    const res = response();
    await saveAttendanceMeeting(save([{ studentUserId: STUDENT, status: "PRESENT" }]), res as never);
    expect(prisma.classMeeting.create).not.toHaveBeenCalled();
    expect(prisma.attendanceRecord.createMany.mock.calls[0][0].data[0].meetingId).toBe(MEETING);
    expect(body(res).meeting).toMatchObject({ start: "19:00", movedFrom: "18:00" });
  });

  it("serialises saves per class inside the transaction", async () => {
    const res = response();
    await saveAttendanceMeeting(save([{ studentUserId: STUDENT, status: "PRESENT" }]), res as never);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.class.findUnique.mock.invocationCallOrder[0]);
  });

  it("answers 500 without details when the database fails", async () => {
    prisma.$transaction.mockRejectedValue(new Error("connection string with secrets"));
    const res = response();
    await saveAttendanceMeeting(save([]), res as never);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(body(res))).not.toContain("secrets");
  });
});

describe("admin view", () => {
  const asAdmin = { user: { userId: ADMIN, role: "ADMIN" } };

  it("is ADMIN only, also when reached past the route guard", async () => {
    const res = response();
    await getAdminClassAttendance(request(), res as never);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns the class with meetings and students, and writes nothing", async () => {
    const res = response();
    await getAdminClassAttendance(request(asAdmin), res as never);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(body(res)).toEqual({
      class: { classId: CLASS_ID, title: "English", tutorName: "ครูบี" },
      meetings: [expect.objectContaining({ date: "2026-11-06", start: "19:00", marked: false })],
      students: [expect.objectContaining({ studentUserId: STUDENT, rate: null })],
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.classMeeting.create).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it("answers 404 to an unknown class", async () => {
    prisma.class.findUnique.mockResolvedValue(null);
    const res = response();
    await getAdminClassAttendance(request(asAdmin), res as never);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
