import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  book: {
    findFirst: vi.fn(),
  },
  class: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  classBookCycle: {
    create: vi.fn(),
  },
}));

const line = vi.hoisted(() => ({
  buildLiffDeepLink: vi.fn(),
  sendToUser: vi.fn(),
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));
vi.mock("../services/ReadingAdvantageDB", () => ({ getArticleDetails: vi.fn() }));
vi.mock("../services/LineNotificationService", () => ({ LineNotificationService: line }));

import {
  createClass,
  isDatedSchedule,
  parseMeetingUrl,
  rescheduleClass,
  setupClass,
} from "./classController";

const tutorId = "11111111-1111-4111-8111-111111111111";
const otherTutorId = "44444444-4444-4444-8444-444444444444";
const classId = "22222222-2222-4222-8222-222222222222";
const bookId = "33333333-3333-4333-8333-333333333333";

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

const validSetup = {
  title: "  English กับครูนกเอี้ยง  ",
  meetingUrl: " https://meet.google.com/abc-defg-hij ",
  scheduleDescription: "10 พ.ย. 69 - 1 ธ.ค. 69 (รวม 8 วัน)",
  scheduleData: [
    { date: "2026-11-10", start: "19:00", end: "21:00" },
    { date: "2026-12-01", start: "19:00", end: "21:00" },
  ],
  startsAt: "2026-11-10",
  endsAt: "2026-12-01",
  totalHours: 16,
};

function setupRequest(body: Record<string, unknown> = {}, user = { userId: tutorId, role: "TUTOR" }, id = classId) {
  return { id: "req-1", user, params: { classId: id }, body: { ...validSetup, ...body } };
}

function pendingClass(overrides: Record<string, unknown> = {}) {
  return {
    classId,
    tutorUserId: tutorId,
    bookId,
    title: "English",
    capacity: 30,
    packagePriceMinor: 300000n,
    freeHours: 0,
    scheduleDescription: null,
    scheduleData: null,
    meetingUrl: null,
    startsAt: null,
    endsAt: null,
    setupRequiredAt: new Date("2026-11-02T03:00:00.000Z"),
    enrollments: [{ studentUserId: "student-1" }, { studentUserId: "student-2" }],
    ...overrides,
  };
}

describe("POST /v1/classes/:classId/setup", () => {
  beforeEach(() => {
    prisma.class.findUnique.mockResolvedValue(pendingClass());
    prisma.class.updateMany.mockResolvedValue({ count: 1 });
    prisma.class.findUniqueOrThrow.mockResolvedValue({
      ...pendingClass({ enrollments: undefined }),
      title: "English กับครูนกเอี้ยง",
      setupRequiredAt: null,
    });
    line.buildLiffDeepLink.mockReturnValue("https://liff.line.me/test?redirect=%2Fclasses%2Fx");
    line.sendToUser.mockResolvedValue(true);
  });

  it("completes setup with a guarded update and tells paid students the class is ready", async () => {
    const res = response();

    await setupClass(setupRequest() as never, res as never);

    expect(prisma.class.updateMany).toHaveBeenCalledWith({
      where: { classId, tutorUserId: tutorId, setupRequiredAt: { not: null } },
      data: {
        title: "English กับครูนกเอี้ยง",
        scheduleDescription: "10 พ.ย. 69 - 1 ธ.ค. 69 (รวม 8 วัน)",
        scheduleData: validSetup.scheduleData,
        startsAt: new Date("2026-11-10"),
        endsAt: new Date("2026-12-01"),
        meetingUrl: "https://meet.google.com/abc-defg-hij",
        setupRequiredAt: null,
        updatedAt: expect.any(Date),
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.class).toMatchObject({
      classId,
      title: "English กับครูนกเอี้ยง",
      packagePriceMinor: 300000,
      setupRequired: false,
    });

    expect(line.buildLiffDeepLink).toHaveBeenCalledWith(`/classes/${classId}`);
    expect(line.sendToUser).toHaveBeenCalledTimes(2);
    expect(line.sendToUser).toHaveBeenCalledWith(
      "student-1",
      'คลาส "English กับครูนกเอี้ยง" พร้อมเรียนแล้ว ครูตั้งตารางเรียนเรียบร้อย: 10 พ.ย. 69 - 1 ธ.ค. 69 (รวม 8 วัน)\n' +
        "ดูรายละเอียด: https://liff.line.me/test?redirect=%2Fclasses%2Fx",
      { type: "notifyClassReminders" },
    );
    expect(line.sendToUser.mock.calls[0][1]).not.toContain("มีการเปลี่ยนแปลง");
  });

  it("leaves the meeting link alone when it is not sent and clears it when sent empty", async () => {
    const { meetingUrl: _omit, ...withoutMeetingUrl } = validSetup;
    void _omit;
    const res = response();

    await setupClass({ ...setupRequest(), body: withoutMeetingUrl } as never, res as never);
    expect(prisma.class.updateMany.mock.calls[0][0].data).not.toHaveProperty("meetingUrl");

    await setupClass(setupRequest({ meetingUrl: "  " }) as never, res as never);
    expect(prisma.class.updateMany.mock.calls[1][0].data.meetingUrl).toBeNull();
  });

  it("stores only date/start/end for each schedule entry", async () => {
    const res = response();

    await setupClass(
      setupRequest({
        scheduleData: [{ date: "2026-11-10", start: "19:00", end: "21:00", note: "<script>", extra: { a: 1 } }],
        startsAt: "2026-11-10",
        endsAt: "2026-11-10",
        totalHours: 2,
      }) as never,
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.class.updateMany.mock.calls[0][0].data.scheduleData).toEqual([
      { date: "2026-11-10", start: "19:00", end: "21:00" },
    ]);
  });

  it("sends the message without a link when LIFF is not configured", async () => {
    line.buildLiffDeepLink.mockReturnValue("");
    const res = response();

    await setupClass(setupRequest() as never, res as never);

    expect(line.sendToUser.mock.calls[0][1]).toBe(
      'คลาส "English กับครูนกเอี้ยง" พร้อมเรียนแล้ว ครูตั้งตารางเรียนเรียบร้อย: 10 พ.ย. 69 - 1 ธ.ค. 69 (รวม 8 วัน)',
    );
  });

  it("still succeeds when LINE delivery fails", async () => {
    line.sendToUser.mockRejectedValue(new Error("LINE down"));
    const res = response();

    await setupClass(setupRequest() as never, res as never);
    expect(res.status).toHaveBeenCalledWith(200);

    line.buildLiffDeepLink.mockImplementation(() => {
      throw new Error("bad LIFF config");
    });
    const second = response();
    await setupClass(setupRequest() as never, second as never);
    expect(second.status).toHaveBeenCalledWith(200);
  });

  it("only lets tutors set up classes", async () => {
    const res = response();

    await setupClass(setupRequest({}, { userId: "student-1", role: "STUDENT" }) as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "UNAUTHORIZED_ROLE" }) });
    expect(prisma.class.findUnique).not.toHaveBeenCalled();
  });

  it("only lets the owner set up the class", async () => {
    const res = response();

    await setupClass(setupRequest({}, { userId: otherTutorId, role: "TUTOR" }) as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "FORBIDDEN" }) });
    expect(prisma.class.updateMany).not.toHaveBeenCalled();
  });

  it("returns CLASS_NOT_FOUND for unknown and malformed class ids", async () => {
    prisma.class.findUnique.mockResolvedValue(null);
    const res = response();

    await setupClass(setupRequest() as never, res as never);
    await setupClass(setupRequest({}, undefined, "not-a-uuid") as never, res as never);

    expect(prisma.class.findUnique).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenNthCalledWith(1, 404);
    expect(res.status).toHaveBeenNthCalledWith(2, 404);
    expect(res.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "CLASS_NOT_FOUND" }) });
  });

  it("refuses a class that does not need setup", async () => {
    prisma.class.findUnique.mockResolvedValue(pendingClass({ setupRequiredAt: null }));
    const res = response();

    await setupClass(setupRequest() as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "CLASS_SETUP_NOT_REQUIRED" }) });
    expect(prisma.class.updateMany).not.toHaveBeenCalled();
  });

  it("returns 409 without notifying anyone when a double submit loses the guarded update", async () => {
    prisma.class.updateMany.mockResolvedValue({ count: 0 });
    const res = response();

    await setupClass(setupRequest() as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "CLASS_SETUP_NOT_REQUIRED" }) });
    expect(line.sendToUser).not.toHaveBeenCalled();
  });

  it.each([
    [{ title: "   " }, "INVALID_TITLE"],
    [{ title: "x".repeat(121) }, "INVALID_TITLE"],
    [{ meetingUrl: "javascript:alert(1)" }, "INVALID_MEETING_URL"],
    [{ meetingUrl: 42 }, "INVALID_MEETING_URL"],
    [{ meetingUrl: "java\tscript:alert(1)" }, "INVALID_MEETING_URL"],
    [{ meetingUrl: "\u0001javascript:alert(1)" }, "INVALID_MEETING_URL"],
    [{ scheduleData: [] }, "INVALID_SCHEDULE"],
    [{ scheduleData: undefined }, "INVALID_SCHEDULE"],
    [{ scheduleData: [{ date: "10/11/2026", start: "19:00", end: "21:00" }] }, "INVALID_SCHEDULE"],
    [{ scheduleData: [{ day: "MON", start: "19:00", end: "21:00" }] }, "INVALID_SCHEDULE"],
    [{ scheduleData: [{ date: "2026-11-10", start: "21:00", end: "19:00" }] }, "INVALID_SCHEDULE"],
    [{ startsAt: "2026-12-02" }, "INVALID_SCHEDULE"],
    [{ endsAt: "not a date" }, "INVALID_SCHEDULE"],
    [{ totalHours: undefined }, "INVALID_SCHEDULE"],
    [{ scheduleDescription: 5 }, "INVALID_SCHEDULE"],
    [{ totalHours: 23 }, "HOURS_EXCEEDED"],
  ])("rejects %o with %s", async (body, code) => {
    const res = response();

    await setupClass(setupRequest(body) as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code }) });
    expect(prisma.class.updateMany).not.toHaveBeenCalled();
  });

  it("extends the hours limit with the class's free coupon hours, like rescheduleClass", async () => {
    prisma.class.findUnique.mockResolvedValue(pendingClass({ freeHours: 4 }));
    const res = response();

    await setupClass(setupRequest({ totalHours: 26 }) as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("class form helpers", () => {
  it("keeps web links, scheme-less links and clears empty ones", () => {
    expect(parseMeetingUrl(" https://zoom.us/j/1 ")).toEqual({ ok: true, value: "https://zoom.us/j/1" });
    expect(parseMeetingUrl("meet.google.com/abc-defg-hij")).toEqual({ ok: true, value: "meet.google.com/abc-defg-hij" });
    expect(parseMeetingUrl("")).toEqual({ ok: true, value: null });
    expect(parseMeetingUrl(null)).toEqual({ ok: true, value: null });
    expect(parseMeetingUrl("data:text/html,hi")).toEqual({ ok: false });
    // Browsers drop tabs/newlines and leading control characters before reading the scheme.
    expect(parseMeetingUrl("java\nscript:alert(1)")).toEqual({ ok: false });
    expect(parseMeetingUrl("\u0000javascript:alert(1)")).toEqual({ ok: false });
  });

  it("accepts the dated schedule the tutor schedule editor sends", () => {
    expect(isDatedSchedule(validSetup.scheduleData)).toBe(true);
    expect(isDatedSchedule([{ date: "2026-11-10", start: "7:00", end: "9:00" }])).toBe(false);
    expect(isDatedSchedule([null])).toBe(false);
    expect(isDatedSchedule([{ date: "2026-11-10", start: "19:00", end: "19:00" }])).toBe(false);
  });
});

describe("shared class validation keeps existing behaviour", () => {
  beforeEach(() => {
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
  });

  function createRequest(body: Record<string, unknown>) {
    return {
      id: "req-1",
      user: { userId: tutorId, role: "TUTOR" },
      body: { bookId: "Reading 3.1", title: "Reading", capacity: 30, ...body },
    };
  }

  it("createClass still answers NOT_FOUND / BOOK_UNAVAILABLE for books", async () => {
    prisma.book.findFirst.mockResolvedValueOnce(null);
    const missing = response();
    await createClass(createRequest({}) as never, missing as never);
    expect(prisma.book.findFirst).toHaveBeenCalledWith({ where: { bookCode: "Reading 3.1" } });
    expect(missing.status).toHaveBeenCalledWith(404);
    expect(missing.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "NOT_FOUND" }) });

    prisma.book.findFirst.mockResolvedValueOnce({ bookId, bookCode: "Primary Adventures 1.0" });
    const unavailable = response();
    await createClass(createRequest({ bookId }) as never, unavailable as never);
    expect(prisma.book.findFirst).toHaveBeenLastCalledWith({ where: { bookId } });
    expect(unavailable.status).toHaveBeenCalledWith(403);
    expect(unavailable.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "BOOK_UNAVAILABLE" }) });
  });

  it("createClass and rescheduleClass keep the HOURS_EXCEEDED limit", async () => {
    const create = response();
    await createClass(createRequest({ totalHours: 22.5 }) as never, create as never);
    expect(create.status).toHaveBeenCalledWith(400);
    expect(create.json).toHaveBeenCalledWith({
      error: {
        code: "HOURS_EXCEEDED",
        message: "Scheduled teaching hours (22.5) exceed the 22-hour limit",
        requestId: "req-1",
      },
    });
    expect(prisma.book.findFirst).not.toHaveBeenCalled();

    prisma.class.findUnique.mockResolvedValue(pendingClass({ freeHours: 2, enrollments: [] }));
    const reschedule = response();
    await rescheduleClass(
      { id: "req-1", user: { userId: tutorId, role: "TUTOR" }, params: { classId }, body: { totalHours: 25 } } as never,
      reschedule as never,
    );
    expect(reschedule.status).toHaveBeenCalledWith(400);
    expect(reschedule.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: "HOURS_EXCEEDED", message: expect.stringContaining("24-hour limit") }),
    });
    expect(prisma.class.update).not.toHaveBeenCalled();
  });
});
