import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  class: { findMany: vi.fn() },
  enrollmentPackage: { findMany: vi.fn() },
  notificationDelivery: {
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
}));

const line = vi.hoisted(() => ({
  buildLiffDeepLink: vi.fn(),
  sendFlexToUserWithResult: vi.fn(),
  sendTextToUserWithResult: vi.fn(),
}));

vi.mock("@tutor-advantage/database", () => ({ prisma, Prisma: { DbNull: "DbNull" } }));
vi.mock("./LineNotificationService", () => ({ LineNotificationService: line }));

import {
  bangkokDaysSince,
  bookPaymentDedupKey,
  buildBookPaymentReminderText,
  classSessionDedupKey,
  deliverReminders,
  attemptMayHaveReachedLine,
  deliveryOutcome,
  paymentReminderMilestone,
  ReminderCandidate,
  sendBookPaymentReminders,
  sendClassSessionReminders,
  sessionsDueForReminder,
  sessionStartsFromSchedule,
} from "./ReminderService";

const classId = "22222222-2222-4222-8222-222222222222";
const studentA = "55555555-5555-4555-8555-555555555555";
const studentB = "66666666-6666-4666-8666-666666666666";

// Wednesday 2026-11-04 23:50 in Bangkok.
const lateWednesday = new Date("2026-11-04T16:50:00Z");

function uniqueViolation() {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

function deliveryRow(row: { deliveryId: string; dedupKey: string; status: string; attempts: number; updatedAt: Date; reason?: string | null; createdAt?: Date }) {
  return { reason: null, createdAt: row.updatedAt, ...row };
}

function candidate(dedupKey: string, send = vi.fn().mockResolvedValue({ sent: true })): ReminderCandidate {
  return { dedupKey, kind: "CLASS_SESSION_REMINDER", userId: studentA, classId, send };
}

function bookCandidate(dedupKey: string, send = vi.fn().mockResolvedValue({ sent: true })): ReminderCandidate {
  return { dedupKey, kind: "BOOK_PAYMENT_REMINDER", userId: studentA, classId, send };
}

beforeEach(() => {
  line.buildLiffDeepLink.mockImplementation((path: string) => `https://liff.line.me/test?redirect=${encodeURIComponent(path)}`);
  prisma.notificationDelivery.findMany.mockResolvedValue([]);
  prisma.notificationDelivery.create.mockImplementation(async ({ data }) => ({ deliveryId: `delivery-${data.dedupKey}` }));
  prisma.notificationDelivery.update.mockResolvedValue({});
  prisma.notificationDelivery.updateMany.mockResolvedValue({ count: 1 });
});

describe("sessionStartsFromSchedule", () => {
  it("reads dated entries as Bangkok wall-clock times, including just after midnight", () => {
    const sessions = sessionStartsFromSchedule(
      [
        { date: "2026-11-05", start: "00:10", end: "01:00" },
        { date: "2026-11-05", start: "18:00", end: "20:00" },
      ],
      null,
      null,
      lateWednesday,
    );
    expect(sessions.map((session) => session.startsAt.toISOString())).toEqual([
      "2026-11-04T17:10:00.000Z",
      "2026-11-05T11:00:00.000Z",
    ]);
    expect(sessions[0]).toMatchObject({ date: "2026-11-05", start: "00:10" });
  });

  it("drops sessions that already started and malformed entries", () => {
    const sessions = sessionStartsFromSchedule(
      [
        { date: "2026-11-04", start: "23:45" }, // started 5 minutes ago
        { date: "2026-11-04", start: "23:50" }, // starts exactly now
        { date: "2026-02-31", start: "10:00" },
        { date: "05/11/2026", start: "10:00" },
        { date: "2026-11-06", start: "9:00" },
        { date: "2026-11-06", start: "24:00" },
        { date: "2026-11-06" },
        { day: "FUNDAY", start: "10:00" },
        null,
        "MON 18:00",
        42,
        { date: "2026-11-06", start: "09:00" },
      ],
      null,
      null,
      lateWednesday,
    );
    expect(sessions.map((session) => `${session.date}T${session.start}`)).toEqual(["2026-11-06T09:00"]);
    expect(sessionStartsFromSchedule(null, null, null, lateWednesday)).toEqual([]);
    expect(sessionStartsFromSchedule({ date: "2026-11-06", start: "09:00" }, null, null, lateWednesday)).toEqual([]);
  });

  it("expands legacy weekly entries to today and tomorrow in Bangkok, not UTC", () => {
    // 23:50 Wednesday in Bangkok is still Wednesday in UTC, but tomorrow is Thursday.
    const sessions = sessionStartsFromSchedule(
      [
        { day: "THU", start: "00:10", end: "01:00" },
        { day: "wed", startTime: "23:55", endTime: "23:59" },
        { day: "MON", start: "18:00" },
      ],
      null,
      null,
      lateWednesday,
    );
    expect(sessions.map((session) => [session.date, session.start, session.startsAt.toISOString()])).toEqual([
      ["2026-11-04", "23:55", "2026-11-04T16:55:00.000Z"],
      ["2026-11-05", "00:10", "2026-11-04T17:10:00.000Z"],
    ]);
  });

  it("uses the Bangkok date when UTC is still on the previous day", () => {
    // 2026-11-05 06:00 Bangkok is 2026-11-04 23:00 UTC (a Wednesday in UTC).
    const earlyThursday = new Date("2026-11-04T23:00:00Z");
    const sessions = sessionStartsFromSchedule([{ day: "THU", start: "07:00" }], null, null, earlyThursday);
    expect(sessions.map((session) => session.startsAt.toISOString())).toEqual(["2026-11-05T00:00:00.000Z"]);
  });

  it("clamps legacy weekly entries to startsAt and endsAt calendar days", () => {
    const weekly = [{ day: "THU", start: "18:00" }];
    // startsAt/endsAt are stored as UTC midnight of the Bangkok calendar day.
    expect(sessionStartsFromSchedule(weekly, new Date("2026-11-06T00:00:00Z"), null, lateWednesday)).toEqual([]);
    expect(sessionStartsFromSchedule(weekly, null, new Date("2026-11-04T00:00:00Z"), lateWednesday)).toEqual([]);
    expect(
      sessionStartsFromSchedule(weekly, new Date("2026-11-05T00:00:00Z"), new Date("2026-11-05T00:00:00Z"), lateWednesday),
    ).toHaveLength(1);
  });
});

describe("sessionsDueForReminder", () => {
  it("includes a start exactly at now + lead and excludes later ones", () => {
    const now = new Date("2026-11-05T10:45:00Z"); // 17:45 Bangkok
    const sessions = sessionStartsFromSchedule(
      [
        { date: "2026-11-05", start: "17:46" },
        { date: "2026-11-05", start: "18:00" },
        { date: "2026-11-05", start: "18:01" },
      ],
      null,
      null,
      now,
    );
    expect(sessionsDueForReminder(sessions, now, 15).map((session) => session.start)).toEqual(["17:46", "18:00"]);
  });

  it("never includes a session that has started", () => {
    const now = new Date("2026-11-05T11:00:00Z"); // 18:00 Bangkok
    const started = [{ date: "2026-11-05", start: "18:00", startsAt: new Date("2026-11-05T11:00:00Z") }];
    expect(sessionsDueForReminder(started, now, 15)).toEqual([]);
  });
});

describe("payment reminder milestones", () => {
  const created = new Date("2026-11-01T05:00:00Z"); // 12:00 Bangkok, 1 Nov

  it("counts Bangkok calendar days", () => {
    expect(bangkokDaysSince(created, new Date("2026-11-02T03:00:00Z"))).toBe(1); // 10:00 next day
    // 23:30 Bangkok on 1 Nov is still day 0 even though UTC is the same day.
    expect(bangkokDaysSince(created, new Date("2026-11-01T16:30:00Z"))).toBe(0);
    // 00:30 Bangkok on 2 Nov is day 1 although UTC is still 1 Nov.
    expect(bangkokDaysSince(created, new Date("2026-11-01T17:30:00Z"))).toBe(1);
  });

  it("picks the largest milestone reached, then stops after day 14", () => {
    const at = (day: number) => new Date(created.getTime() + day * 24 * 60 * 60 * 1000);
    expect(paymentReminderMilestone(created, at(0))).toBeNull();
    expect(paymentReminderMilestone(created, at(1))).toBe(1);
    expect(paymentReminderMilestone(created, at(2))).toBe(1);
    expect(paymentReminderMilestone(created, at(3))).toBe(3);
    expect(paymentReminderMilestone(created, at(6))).toBe(3);
    expect(paymentReminderMilestone(created, at(7))).toBe(7);
    expect(paymentReminderMilestone(created, at(14))).toBe(7);
    expect(paymentReminderMilestone(created, at(15))).toBeNull();
  });

  it("builds the house-style payment text with the LIFF payment link", () => {
    const text = buildBookPaymentReminderText({ bookTitle: "Book 2", classTitle: "English", classId, cycleId: "cycle-2" });
    expect(text.split("\n")).toEqual([
      "ยังไม่ได้ชำระค่าเล่ม: Book 2",
      'คลาส "English"',
      "ชำระเงินเพื่อเข้าเรียนสดของเล่มนี้",
      `ชำระเงิน: https://liff.line.me/test?redirect=${encodeURIComponent(`/payment?classId=${classId}&cycleId=cycle-2`)}`,
    ]);
  });
});

describe("deliveryOutcome", () => {
  it("maps permanent reasons to SKIPPED and transient ones to FAILED", () => {
    expect(deliveryOutcome({ sent: true })).toEqual({ status: "SENT", reason: null });
    expect(deliveryOutcome({ sent: false, reason: "PREFERENCE_DISABLED" })).toEqual({ status: "SKIPPED", reason: "PREFERENCE_DISABLED" });
    expect(deliveryOutcome({ sent: false, reason: "LINE_NOT_LINKED" })).toEqual({ status: "SKIPPED", reason: "LINE_NOT_LINKED" });
    expect(deliveryOutcome({ sent: false, reason: "USER_NOT_FOUND" })).toEqual({ status: "SKIPPED", reason: "USER_NOT_FOUND" });
    expect(deliveryOutcome({ sent: false, reason: "LINE_NOT_CONFIGURED" })).toEqual({ status: "FAILED", reason: "LINE_NOT_CONFIGURED" });
    expect(deliveryOutcome({ sent: false, reason: "LINE_API_ERROR", lineStatus: 429 })).toEqual({ status: "FAILED", reason: "LINE_API_429" });
    expect(deliveryOutcome({ sent: false, reason: "UNEXPECTED_ERROR" })).toEqual({ status: "FAILED", reason: "UNEXPECTED_ERROR" });
  });
});

describe("attemptMayHaveReachedLine", () => {
  it("treats unknown outcomes and LINE 5xx as possibly delivered", () => {
    expect(attemptMayHaveReachedLine({ status: "CLAIMED", reason: null })).toBe(true);
    expect(attemptMayHaveReachedLine({ status: "FAILED", reason: "UNEXPECTED_ERROR" })).toBe(true);
    expect(attemptMayHaveReachedLine({ status: "FAILED", reason: "LINE_API_ERROR" })).toBe(true);
    expect(attemptMayHaveReachedLine({ status: "FAILED", reason: "LINE_API_503" })).toBe(true);
    expect(attemptMayHaveReachedLine({ status: "FAILED", reason: "LINE_API_429" })).toBe(false);
    expect(attemptMayHaveReachedLine({ status: "FAILED", reason: "LINE_NOT_CONFIGURED" })).toBe(false);
    expect(attemptMayHaveReachedLine({ status: "SENT", reason: null })).toBe(false);
  });
});

describe("deliverReminders", () => {
  const now = new Date("2026-11-05T10:45:00Z");

  it("claims a new row, sends with the delivery id as retry key and records the outcome", async () => {
    const sentSend = vi.fn().mockResolvedValue({ sent: true });
    const optedOut = vi.fn().mockResolvedValue({ sent: false, reason: "PREFERENCE_DISABLED" });
    const lineDown = vi.fn().mockResolvedValue({ sent: false, reason: "LINE_API_ERROR", lineStatus: 500 });

    const summary = await deliverReminders([candidate("a", sentSend), candidate("b", optedOut), candidate("c", lineDown)], now);

    expect(summary).toEqual({ considered: 3, sent: 1, skipped: 1, failed: 1, alreadyHandled: 0 });
    expect(prisma.notificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { dedupKey: "a", kind: "CLASS_SESSION_REMINDER", userId: studentA, classId, status: "CLAIMED" },
    }));
    expect(sentSend).toHaveBeenCalledWith("delivery-a");
    const updates = Object.fromEntries(
      prisma.notificationDelivery.update.mock.calls.map(([args]) => [args.where.deliveryId, args.data]),
    );
    expect(updates["delivery-a"]).toEqual({ status: "SENT", reason: null, sentAt: expect.any(Date) });
    expect(updates["delivery-b"]).toEqual({ status: "SKIPPED", reason: "PREFERENCE_DISABLED" });
    expect(updates["delivery-c"]).toEqual({ status: "FAILED", reason: "LINE_API_500", attempts: { increment: 1 } });
  });

  it("does not send when another run created the row first", async () => {
    prisma.notificationDelivery.create.mockRejectedValue(uniqueViolation());
    const send = vi.fn();

    const summary = await deliverReminders([candidate("a", send)], now);

    expect(summary).toMatchObject({ sent: 0, alreadyHandled: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it("skips settled rows without touching LINE", async () => {
    const fresh = new Date(now.getTime() - 60_000);
    prisma.notificationDelivery.findMany.mockResolvedValue([
      deliveryRow({ deliveryId: "d1", dedupKey: "sent", status: "SENT", attempts: 0, updatedAt: fresh }),
      deliveryRow({ deliveryId: "d2", dedupKey: "skipped", status: "SKIPPED", attempts: 0, updatedAt: fresh }),
      deliveryRow({ deliveryId: "d3", dedupKey: "in-flight", status: "CLAIMED", attempts: 0, updatedAt: fresh }),
      deliveryRow({ deliveryId: "d4", dedupKey: "gave-up", status: "FAILED", attempts: 3, updatedAt: fresh }),
    ]);
    const send = vi.fn();

    const summary = await deliverReminders(
      ["sent", "skipped", "in-flight", "gave-up"].map((key) => candidate(key, send)),
      now,
    );

    expect(summary).toEqual({ considered: 4, sent: 0, skipped: 0, failed: 0, alreadyHandled: 4 });
    expect(send).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.create).not.toHaveBeenCalled();
  });

  it("retries a FAILED row by reclaiming it atomically with the same retry key", async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([
      deliveryRow({ deliveryId: "d1", dedupKey: "a", status: "FAILED", attempts: 1, updatedAt: new Date(now.getTime() - 300_000) }),
    ]);
    const send = vi.fn().mockResolvedValue({ sent: true });

    const summary = await deliverReminders([candidate("a", send)], now);

    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: { deliveryId: "d1", status: "FAILED", attempts: { lt: 3 } },
      data: { status: "CLAIMED", updatedAt: now },
    });
    expect(send).toHaveBeenCalledWith("d1");
    expect(summary.sent).toBe(1);
    expect(prisma.notificationDelivery.create).not.toHaveBeenCalled();
  });

  it("loses the reclaim race gracefully", async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([
      deliveryRow({ deliveryId: "d1", dedupKey: "a", status: "FAILED", attempts: 1, updatedAt: now }),
    ]);
    prisma.notificationDelivery.updateMany.mockResolvedValue({ count: 0 });
    const send = vi.fn();

    const summary = await deliverReminders([candidate("a", send)], now);

    expect(summary.alreadyHandled).toBe(1);
    expect(send).not.toHaveBeenCalled();
  });

  it("reclaims a class reminder claimed just under 5 minutes ago, before the session starts", async () => {
    // Claimed a few seconds into the 13:45 run, recovered by the 13:50 run.
    const stuckSince = new Date(now.getTime() - (5 * 60_000 - 3_000));
    prisma.notificationDelivery.findMany.mockResolvedValue([
      deliveryRow({ deliveryId: "d1", dedupKey: "a", status: "CLAIMED", attempts: 0, updatedAt: stuckSince }),
    ]);
    const send = vi.fn().mockResolvedValue({ sent: true });

    await deliverReminders([candidate("a", send)], now);

    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: {
        deliveryId: "d1",
        status: "CLAIMED",
        updatedAt: { lt: new Date(now.getTime() - 4 * 60_000) },
        attempts: { lt: 3 },
      },
      data: { status: "CLAIMED", updatedAt: now, attempts: { increment: 1 } },
    });
    expect(send).toHaveBeenCalledWith("d1");
  });

  it("waits 10 minutes before reclaiming a book payment claim", async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([
      deliveryRow({ deliveryId: "d1", dedupKey: "a", status: "CLAIMED", attempts: 0, updatedAt: new Date(now.getTime() - 5 * 60_000) }),
      deliveryRow({ deliveryId: "d2", dedupKey: "b", status: "CLAIMED", attempts: 0, updatedAt: new Date(now.getTime() - 11 * 60_000) }),
    ]);
    const send = vi.fn().mockResolvedValue({ sent: true });

    const summary = await deliverReminders([bookCandidate("a", send), bookCandidate("b", send)], now);

    expect(summary).toMatchObject({ sent: 1, alreadyHandled: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("d2");
  });

  it("does not retry an ambiguous attempt once LINE may have forgotten its retry key", async () => {
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000);
    prisma.notificationDelivery.findMany.mockResolvedValue([
      deliveryRow({ deliveryId: "d1", dedupKey: "a", status: "FAILED", reason: "UNEXPECTED_ERROR", attempts: 1, createdAt: dayAgo, updatedAt: dayAgo }),
      deliveryRow({ deliveryId: "d2", dedupKey: "b", status: "FAILED", reason: "LINE_API_502", attempts: 1, createdAt: dayAgo, updatedAt: dayAgo }),
      deliveryRow({ deliveryId: "d3", dedupKey: "c", status: "CLAIMED", attempts: 0, createdAt: dayAgo, updatedAt: dayAgo }),
    ]);
    const send = vi.fn();

    const summary = await deliverReminders(["a", "b", "c"].map((key) => bookCandidate(key, send)), now);

    expect(summary).toEqual({ considered: 3, sent: 0, skipped: 3, failed: 0, alreadyHandled: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: { deliveryId: "d1", status: "FAILED", updatedAt: dayAgo },
      data: { status: "SKIPPED", reason: "RETRY_KEY_EXPIRED" },
    });
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith({
      where: { deliveryId: "d3", status: "CLAIMED", updatedAt: dayAgo },
      data: { status: "SKIPPED", reason: "RETRY_KEY_EXPIRED" },
    });
  });

  it("still retries after a day when LINE clearly rejected the earlier attempt", async () => {
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000);
    prisma.notificationDelivery.findMany.mockResolvedValue([
      deliveryRow({ deliveryId: "d1", dedupKey: "a", status: "FAILED", reason: "LINE_API_429", attempts: 1, createdAt: dayAgo, updatedAt: dayAgo }),
    ]);
    const send = vi.fn().mockResolvedValue({ sent: true });

    const summary = await deliverReminders([bookCandidate("a", send)], now);

    expect(summary.sent).toBe(1);
    expect(send).toHaveBeenCalledWith("d1");
  });

  it("retries an ambiguous attempt inside the retry-key window with the same key", async () => {
    const hourAgo = new Date(now.getTime() - 60 * 60_000);
    prisma.notificationDelivery.findMany.mockResolvedValue([
      deliveryRow({ deliveryId: "d1", dedupKey: "a", status: "FAILED", reason: "LINE_API_500", attempts: 1, createdAt: hourAgo, updatedAt: hourAgo }),
    ]);
    const send = vi.fn().mockResolvedValue({ sent: true });

    await deliverReminders([bookCandidate("a", send)], now);

    expect(send).toHaveBeenCalledWith("d1");
  });

  it("records a thrown send as FAILED and keeps going", async () => {
    const throwing = vi.fn().mockRejectedValue(new Error("boom"));
    const ok = vi.fn().mockResolvedValue({ sent: true });

    const summary = await deliverReminders([candidate("a", throwing), candidate("b", ok)], now);

    expect(summary).toMatchObject({ sent: 1, failed: 1 });
  });

  it("caps the work per run", async () => {
    const send = vi.fn().mockResolvedValue({ sent: true });
    const summary = await deliverReminders(["a", "b", "c"].map((key) => candidate(key, send)), now, 2);

    expect(send).toHaveBeenCalledTimes(2);
    expect(summary).toEqual({ considered: 3, sent: 2, skipped: 0, failed: 0, alreadyHandled: 0 });
  });
});

describe("sendClassSessionReminders", () => {
  it("reminds every ACTIVE student once per due session with a Flex card", async () => {
    const now = new Date("2026-11-05T10:45:00Z"); // 17:45 Bangkok
    prisma.class.findMany.mockResolvedValue([
      {
        classId,
        title: "English กับครูนกเอี้ยง",
        scheduleData: [
          { date: "2026-11-05", start: "17:30", end: "18:00" },
          { date: "2026-11-05", start: "18:00", end: "20:00" },
          { date: "2026-11-06", start: "18:00", end: "20:00" },
        ],
        startsAt: new Date("2026-11-05T00:00:00Z"),
        endsAt: new Date("2026-11-06T00:00:00Z"),
        enrollments: [{ studentUserId: studentA }, { studentUserId: studentB }],
      },
    ]);
    line.sendFlexToUserWithResult.mockResolvedValue({ sent: true });

    const summary = await sendClassSessionReminders({ now });

    expect(summary).toEqual({ considered: 2, sent: 2, skipped: 0, failed: 0, alreadyHandled: 0 });
    expect(prisma.class.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        isDemo: false,
        setupRequiredAt: null,
        status: { in: ["OPEN", "FULL"], mode: "insensitive" },
      }),
    }));
    expect(prisma.notificationDelivery.create.mock.calls.map(([args]) => args.data.dedupKey)).toEqual([
      classSessionDedupKey(classId, { date: "2026-11-05", start: "18:00" }, studentA),
      classSessionDedupKey(classId, { date: "2026-11-05", start: "18:00" }, studentB),
    ]);
    expect(classSessionDedupKey(classId, { date: "2026-11-05", start: "18:00" }, studentA))
      .toBe(`class-session:${classId}:2026-11-05T18:00:${studentA}`);

    const [userId, altText, card, options] = line.sendFlexToUserWithResult.mock.calls[0];
    expect(userId).toBe(studentA);
    expect(altText).toBe('คลาส "English กับครูนกเอี้ยง" จะเริ่มในอีก 15 นาที (18:00 น.)');
    expect(options).toEqual({ type: "notifyClassReminders", retryKey: expect.stringContaining("class-session:") });
    expect(card.header.backgroundColor).toBe("#06C755");
    expect(card.body.contents[0].text).toBe("คลาสจะเริ่มในอีก 15 นาที");
    expect(card.body.contents[3].text).toBe("เวลา 18:00 น.");
    expect(card.footer.contents[0].action).toEqual({
      type: "uri",
      label: "ดูคลาส",
      uri: `https://liff.line.me/test?redirect=${encodeURIComponent(`/classes/${classId}`)}`,
    });
  });

  it("sends nothing when no session is due", async () => {
    prisma.class.findMany.mockResolvedValue([
      {
        classId,
        title: "English",
        scheduleData: [{ date: "2026-11-05", start: "19:00", end: "20:00" }],
        startsAt: null,
        endsAt: null,
        enrollments: [{ studentUserId: studentA }],
      },
    ]);

    const summary = await sendClassSessionReminders({ now: new Date("2026-11-05T10:45:00Z") });

    expect(summary.considered).toBe(0);
    expect(line.sendFlexToUserWithResult).not.toHaveBeenCalled();
  });
});

describe("sendBookPaymentReminders", () => {
  it("sends one follow-up per unpaid package for the milestone reached", async () => {
    const now = new Date("2026-11-04T03:00:00Z"); // 10:00 Bangkok
    const pkg = (id: string, createdAt: string) => ({
      enrollmentPackageId: id,
      studentUserId: studentA,
      createdAt: new Date(createdAt),
      classBookCycle: {
        classBookCycleId: "cycle-2",
        classId,
        book: { title: "Book 2" },
        class: { title: "English" },
      },
    });
    prisma.enrollmentPackage.findMany.mockResolvedValue([
      pkg("pkg-day0", "2026-11-04T01:00:00Z"),
      pkg("pkg-day3", "2026-11-01T05:00:00Z"),
      pkg("pkg-day8", "2026-10-27T05:00:00Z"),
    ]);
    prisma.notificationDelivery.findMany.mockResolvedValue([
      deliveryRow({ deliveryId: "d7", dedupKey: bookPaymentDedupKey("pkg-day8", 7), status: "SENT", attempts: 0, updatedAt: now }),
    ]);
    line.sendTextToUserWithResult.mockResolvedValue({ sent: true });

    const summary = await sendBookPaymentReminders({ now });

    expect(summary).toEqual({ considered: 2, sent: 1, skipped: 0, failed: 0, alreadyHandled: 1 });
    expect(prisma.notificationDelivery.create).toHaveBeenCalledTimes(1);
    expect(prisma.notificationDelivery.create.mock.calls[0][0].data).toMatchObject({
      dedupKey: "book-payment:pkg-day3:d3",
      kind: "BOOK_PAYMENT_REMINDER",
      classId,
    });
    expect(line.sendTextToUserWithResult).toHaveBeenCalledWith(
      studentA,
      expect.stringContaining("ยังไม่ได้ชำระค่าเล่ม: Book 2"),
      { type: "notifyClassReminders", retryKey: "delivery-book-payment:pkg-day3:d3" },
    );
    expect(prisma.enrollmentPackage.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "PENDING_PAYMENT",
        enrollment: { status: "ACTIVE" },
      }),
    }));
  });
});
