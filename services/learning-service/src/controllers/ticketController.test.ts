import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  supportTicket: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  supportTicketMessage: {
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  enrollment: { findFirst: vi.fn() },
  class: { findFirst: vi.fn() },
}));
const notifications = vi.hoisted(() => ({ notifyNewTicket: vi.fn() }));

vi.mock("@tutor-advantage/database", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tutor-advantage/database")>()),
  prisma,
}));
vi.mock("@tutor-advantage/shared-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tutor-advantage/shared-config")>()),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../services/ticketNotifications", () => notifications);

import { createTicket, getMyTicket, listMyTickets, replyToMyTicket, resolveMyTicket } from "./ticketController";

const STUDENT = "11111111-1111-4111-8111-111111111111";
const TICKET = "22222222-2222-4222-8222-222222222222";
const KEY = "33333333-3333-4333-8333-333333333333";
const CLASS_ID = "44444444-4444-4444-8444-444444444444";
const MSG_ID = "55555555-5555-4555-8555-555555555555";

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    user: { userId: STUDENT, role: "STUDENT" },
    headers: {},
    params: {},
    query: {},
    body: {},
    ...overrides,
  } as never;
}

function ticketRow(overrides: Record<string, unknown> = {}) {
  const created = new Date("2026-11-02T03:00:00Z");
  return {
    ticketId: TICKET,
    ticketNumber: 42,
    requesterUserId: STUDENT,
    requesterRole: "STUDENT",
    category: "CLASS",
    subject: "เปลี่ยนเวลาเรียน",
    status: "OPEN",
    awaitingSupport: true,
    classId: null,
    paymentReference: null,
    assigneeUserId: null,
    idempotencyKey: KEY,
    dueAt: new Date("2026-11-04T16:59:59.999Z"),
    firstResponseAt: null,
    resolvedAt: null,
    requesterLastReadAt: created,
    lastMessageAt: created,
    createdAt: created,
    updatedAt: created,
    class: null,
    messages: [
      {
        messageId: "m1",
        ticketId: TICKET,
        authorUserId: STUDENT,
        authorSide: "REQUESTER",
        kind: "MESSAGE",
        body: "ขอเปลี่ยนเวลาเรียนค่ะ",
        fromStatus: null,
        toStatus: null,
        clientMessageId: null,
        createdAt: created,
      },
    ],
    ...overrides,
  };
}

const validCreate = { category: "CLASS", subject: "เปลี่ยนเวลาเรียน", body: "ขอเปลี่ยนเวลาเรียนค่ะ", idempotencyKey: KEY };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(prisma));
  prisma.supportTicket.count.mockResolvedValue(0);
  prisma.supportTicketMessage.count.mockResolvedValue(0);
  prisma.supportTicketMessage.findFirst.mockResolvedValue(null);
  prisma.supportTicket.updateMany.mockResolvedValue({ count: 1 });
});

describe("requester role gate", () => {
  it("answers 401 without a user and 403 for admins", async () => {
    const res401 = response();
    await listMyTickets(request({ user: undefined }), res401 as never);
    expect(res401.status).toHaveBeenCalledWith(401);

    const res403 = response();
    await createTicket(request({ user: { userId: STUDENT, role: "ADMIN" }, body: validCreate }), res403 as never);
    expect(res403.status).toHaveBeenCalledWith(403);
    expect(res403.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "FORBIDDEN", requestId: "req-1" }) });
    expect(prisma.supportTicket.create).not.toHaveBeenCalled();
  });
});

describe("GET /v1/tickets", () => {
  it("lists the caller's tickets newest first with the unread flag", async () => {
    prisma.supportTicket.findMany.mockResolvedValue([
      ticketRow({
        class: { title: "English A" },
        messages: [{ authorSide: "SUPPORT", kind: "MESSAGE", createdAt: new Date("2026-11-03T00:00:00Z") }],
      }),
    ]);
    const res = response();
    await listMyTickets(request(), res as never);
    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { requesterUserId: STUDENT }, orderBy: { lastMessageAt: "desc" }, take: 100 }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.tickets).toHaveLength(1);
    expect(body.tickets[0]).toMatchObject({ ticketNumber: 42, classTitle: "English A", hasUnreadReply: true });
    expect(body.tickets[0]).not.toHaveProperty("messages");
  });
});

describe("POST /v1/tickets", () => {
  it("creates an OPEN ticket with its first message and the Bangkok deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T08:00:00Z")); // Friday 15:00 Bangkok
    try {
      prisma.supportTicket.findFirst.mockResolvedValue(null);
      prisma.supportTicket.create.mockResolvedValue(ticketRow());
      const res = response();
      await createTicket(request({ body: validCreate }), res as never);

      expect(res.status).toHaveBeenCalledWith(201);
      const data = prisma.supportTicket.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        requesterUserId: STUDENT,
        requesterRole: "STUDENT",
        category: "CLASS",
        status: "OPEN",
        awaitingSupport: true,
        idempotencyKey: KEY,
        messages: { create: { authorSide: "REQUESTER", kind: "MESSAGE", body: "ขอเปลี่ยนเวลาเรียนค่ะ" } },
      });
      // Friday + 2 business days = Tuesday 23:59:59.999 Bangkok.
      expect(data.dueAt.toISOString()).toBe("2026-11-10T16:59:59.999Z");
      expect(notifications.notifyNewTicket).toHaveBeenCalledWith(expect.objectContaining({ ticketNumber: 42 }));
      // Limits are counted under a per-requester advisory lock, in the same transaction as the insert.
      expect((prisma.$executeRaw.mock.calls[0][0] as string[]).join("?")).toContain("pg_advisory_xact_lock");
      expect(prisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.supportTicket.count.mock.invocationCallOrder[0]);
      expect(res.json.mock.calls[0][0].ticket).toMatchObject({ ticketId: TICKET, canReply: true, messages: [{ author: "REQUESTER" }] });
    } finally {
      vi.useRealTimers();
    }
  });

  it("replays the same idempotencyKey with 200 and no new ticket", async () => {
    prisma.supportTicket.findFirst.mockResolvedValue(ticketRow());
    const res = response();
    await createTicket(request({ body: validCreate }), res as never);
    expect(prisma.supportTicket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { requesterUserId: STUDENT, idempotencyKey: KEY } }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.supportTicket.create).not.toHaveBeenCalled();
    expect(notifications.notifyNewTicket).not.toHaveBeenCalled();
  });

  it("returns the winner when a concurrent create hits the unique key", async () => {
    prisma.supportTicket.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(ticketRow());
    prisma.supportTicket.create.mockRejectedValue({
      code: "P2002",
      meta: { target: ["requester_user_id", "idempotency_key"] },
    });
    const res = response();
    await createTicket(request({ body: validCreate }), res as never);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects a category the role cannot use", async () => {
    prisma.supportTicket.findFirst.mockResolvedValue(null);
    const res = response();
    await createTicket(request({ body: { ...validCreate, category: "PAYOUT" } }), res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "INVALID_CATEGORY" }) });
  });

  it("requires class access: enrollment for students, ownership for tutors", async () => {
    prisma.supportTicket.findFirst.mockResolvedValue(null);
    prisma.enrollment.findFirst.mockResolvedValue(null);
    const res = response();
    await createTicket(request({ body: { ...validCreate, classId: CLASS_ID } }), res as never);
    expect(prisma.enrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { classId: CLASS_ID, studentUserId: STUDENT } }),
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "CLASS_NOT_ACCESSIBLE" }) });

    prisma.class.findFirst.mockResolvedValue({ classId: CLASS_ID });
    prisma.supportTicket.create.mockResolvedValue(ticketRow({ requesterRole: "TUTOR", classId: CLASS_ID }));
    const tutorRes = response();
    await createTicket(
      request({ user: { userId: STUDENT, role: "TUTOR" }, body: { ...validCreate, classId: CLASS_ID } }),
      tutorRes as never,
    );
    expect(prisma.class.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { classId: CLASS_ID, tutorUserId: STUDENT } }),
    );
    expect(tutorRes.status).toHaveBeenCalledWith(201);
  });

  it("limits unresolved tickets, daily creates and hourly messages", async () => {
    prisma.supportTicket.findFirst.mockResolvedValue(null);

    prisma.supportTicket.count.mockResolvedValueOnce(5).mockResolvedValueOnce(0);
    const open = response();
    await createTicket(request({ body: validCreate }), open as never);
    expect(open.status).toHaveBeenCalledWith(429);
    expect(open.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "TOO_MANY_OPEN_TICKETS" }) });

    prisma.supportTicket.count.mockResolvedValueOnce(0).mockResolvedValueOnce(10);
    const daily = response();
    await createTicket(request({ body: validCreate }), daily as never);
    expect(daily.status).toHaveBeenCalledWith(429);
    expect(daily.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "TICKET_RATE_LIMITED" }) });

    prisma.supportTicketMessage.count.mockResolvedValueOnce(30);
    const hourly = response();
    await createTicket(request({ body: validCreate }), hourly as never);
    expect(hourly.status).toHaveBeenCalledWith(429);
    expect(prisma.supportTicket.create).not.toHaveBeenCalled();
  });
});

describe("GET /v1/tickets/:ticketId", () => {
  it("answers 404 for malformed and foreign ids", async () => {
    const bad = response();
    await getMyTicket(request({ params: { ticketId: "nope" } }), bad as never);
    expect(bad.status).toHaveBeenCalledWith(404);
    expect(prisma.supportTicket.findFirst).not.toHaveBeenCalled();

    prisma.supportTicket.findFirst.mockResolvedValue(null);
    const foreign = response();
    await getMyTicket(request({ params: { ticketId: TICKET } }), foreign as never);
    expect(prisma.supportTicket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ticketId: TICKET, requesterUserId: STUDENT } }),
    );
    expect(foreign.status).toHaveBeenCalledWith(404);
    expect(foreign.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "TICKET_NOT_FOUND" }) });
  });

  it("marks the thread read up to the newest returned message, without touching updatedAt", async () => {
    const newest = new Date("2026-11-03T00:00:00Z");
    const row = ticketRow({
      messages: [
        ...ticketRow().messages,
        { messageId: "m2", authorSide: "SUPPORT", kind: "MESSAGE", body: "ได้ครับ", fromStatus: null, toStatus: null, createdAt: newest },
      ],
    });
    prisma.supportTicket.findFirst.mockResolvedValue(row);
    const res = response();
    await getMyTicket(request({ params: { ticketId: TICKET } }), res as never);
    // Raw SQL so Prisma's @updatedAt does not move; never a fresh `now`, so a
    // reply committed after the read stays unread.
    expect(prisma.supportTicket.updateMany).not.toHaveBeenCalled();
    const [sql, ...values] = prisma.$executeRaw.mock.calls[0];
    const text = (sql as string[]).join("?");
    expect(text).toContain('"requester_last_read_at" = GREATEST(');
    expect(text).not.toContain("updated_at");
    expect(values).toEqual([newest, newest, TICKET, STUDENT]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].ticket).toMatchObject({ hasUnreadReply: false, messages: [{}, { author: "SUPPORT" }] });
  });
});

describe("POST /v1/tickets/:ticketId/messages", () => {
  const replyBody = { body: "ข้อมูลเพิ่มเติมค่ะ", clientMessageId: MSG_ID };

  it("reopens a WAITING_ON_REQUESTER ticket and records the status change", async () => {
    prisma.supportTicket.findFirst
      .mockResolvedValueOnce({ ticketId: TICKET }) // ownership
      .mockResolvedValueOnce({ status: "WAITING_ON_REQUESTER", resolvedAt: null }) // in tx
      .mockResolvedValueOnce(ticketRow()); // response
    const res = response();
    await replyToMyTicket(request({ params: { ticketId: TICKET }, body: replyBody }), res as never);

    expect(prisma.supportTicket.updateMany).toHaveBeenCalledWith({
      where: { ticketId: TICKET, status: "WAITING_ON_REQUESTER" },
      data: expect.objectContaining({ status: "OPEN", awaitingSupport: true }),
    });
    const created = prisma.supportTicketMessage.create.mock.calls.map((c) => c[0].data);
    expect(created).toEqual([
      expect.objectContaining({ kind: "STATUS_CHANGE", authorSide: "REQUESTER", fromStatus: "WAITING_ON_REQUESTER", toStatus: "OPEN" }),
      expect.objectContaining({ kind: "MESSAGE", authorSide: "REQUESTER", body: "ข้อมูลเพิ่มเติมค่ะ", clientMessageId: MSG_ID }),
    ]);
    expect(created[1].createdAt.getTime()).toBeGreaterThan(created[0].createdAt.getTime());
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("reopens a recently resolved ticket and clears resolvedAt", async () => {
    prisma.supportTicket.findFirst
      .mockResolvedValueOnce({ ticketId: TICKET })
      .mockResolvedValueOnce({ status: "RESOLVED", resolvedAt: new Date(Date.now() - 3 * 86400000) })
      .mockResolvedValueOnce(ticketRow());
    const res = response();
    await replyToMyTicket(request({ params: { ticketId: TICKET }, body: replyBody }), res as never);
    expect(prisma.supportTicket.updateMany.mock.calls[0][0].data).toMatchObject({ status: "OPEN", resolvedAt: null });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("refuses a ticket resolved more than 14 days ago", async () => {
    prisma.supportTicket.findFirst
      .mockResolvedValueOnce({ ticketId: TICKET })
      .mockResolvedValueOnce({ status: "RESOLVED", resolvedAt: new Date(Date.now() - 15 * 86400000) });
    const res = response();
    await replyToMyTicket(request({ params: { ticketId: TICKET }, body: replyBody }), res as never);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "TICKET_CLOSED" }) });
    expect(prisma.supportTicketMessage.create).not.toHaveBeenCalled();
  });

  it("keeps OPEN tickets OPEN without a status message", async () => {
    prisma.supportTicket.findFirst
      .mockResolvedValueOnce({ ticketId: TICKET })
      .mockResolvedValueOnce({ status: "IN_PROGRESS", resolvedAt: null })
      .mockResolvedValueOnce(ticketRow());
    const res = response();
    await replyToMyTicket(request({ params: { ticketId: TICKET }, body: replyBody }), res as never);
    expect(prisma.supportTicketMessage.create).toHaveBeenCalledTimes(1);
    expect(prisma.supportTicket.updateMany.mock.calls[0][0].data.status).toBe("IN_PROGRESS");
  });

  it("replays a known clientMessageId with 200", async () => {
    prisma.supportTicket.findFirst.mockResolvedValueOnce({ ticketId: TICKET }).mockResolvedValueOnce(ticketRow());
    prisma.supportTicketMessage.findFirst.mockResolvedValue({ messageId: "m1" });
    const res = response();
    await replyToMyTicket(request({ params: { ticketId: TICKET }, body: replyBody }), res as never);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("retries when another request changed the status first", async () => {
    prisma.supportTicket.findFirst
      .mockResolvedValueOnce({ ticketId: TICKET })
      .mockResolvedValueOnce({ status: "WAITING_ON_REQUESTER", resolvedAt: null })
      .mockResolvedValueOnce({ status: "OPEN", resolvedAt: null })
      .mockResolvedValueOnce(ticketRow());
    prisma.supportTicket.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    const res = response();
    await replyToMyTicket(request({ params: { ticketId: TICKET }, body: replyBody }), res as never);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.supportTicket.updateMany.mock.calls[1][0].where).toEqual({ ticketId: TICKET, status: "OPEN" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("validates the body and the hourly message limit", async () => {
    prisma.supportTicket.findFirst.mockResolvedValue({ ticketId: TICKET });
    const bad = response();
    await replyToMyTicket(request({ params: { ticketId: TICKET }, body: { body: "hi" } }), bad as never);
    expect(bad.status).toHaveBeenCalledWith(400);

    prisma.supportTicketMessage.count.mockResolvedValue(30);
    const limited = response();
    await replyToMyTicket(request({ params: { ticketId: TICKET }, body: replyBody }), limited as never);
    expect(limited.status).toHaveBeenCalledWith(429);
    expect(limited.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "TICKET_RATE_LIMITED" }) });
  });
});

describe("POST /v1/tickets/:ticketId/resolve", () => {
  it("resolves an open ticket with a requester status change", async () => {
    prisma.supportTicket.findFirst
      .mockResolvedValueOnce({ status: "IN_PROGRESS" })
      .mockResolvedValueOnce(ticketRow({ status: "RESOLVED", resolvedAt: new Date() }));
    const res = response();
    await resolveMyTicket(request({ params: { ticketId: TICKET } }), res as never);
    expect(prisma.supportTicket.updateMany).toHaveBeenCalledWith({
      where: { ticketId: TICKET, status: "IN_PROGRESS" },
      data: expect.objectContaining({ status: "RESOLVED", awaitingSupport: false, resolvedAt: expect.any(Date) }),
    });
    expect(prisma.supportTicketMessage.create.mock.calls[0][0].data).toMatchObject({
      kind: "STATUS_CHANGE",
      authorSide: "REQUESTER",
      fromStatus: "IN_PROGRESS",
      toStatus: "RESOLVED",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("is a 200 no-op on an already resolved ticket", async () => {
    prisma.supportTicket.findFirst
      .mockResolvedValueOnce({ status: "RESOLVED" })
      .mockResolvedValueOnce(ticketRow({ status: "RESOLVED", resolvedAt: new Date() }));
    const res = response();
    await resolveMyTicket(request({ params: { ticketId: TICKET } }), res as never);
    expect(prisma.supportTicket.updateMany).not.toHaveBeenCalled();
    expect(prisma.supportTicketMessage.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("answers 404 for someone else's ticket", async () => {
    prisma.supportTicket.findFirst.mockResolvedValueOnce(null);
    const res = response();
    await resolveMyTicket(request({ params: { ticketId: TICKET } }), res as never);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
