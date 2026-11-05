import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  supportTicket: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  supportTicketMessage: { findFirst: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn() },
  auditEvent: { create: vi.fn() },
}));
const notifications = vi.hoisted(() => ({ notifyRequester: vi.fn(), notifyNewTicket: vi.fn() }));

vi.mock("@tutor-advantage/database", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tutor-advantage/database")>()),
  prisma,
}));
vi.mock("@tutor-advantage/shared-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tutor-advantage/shared-config")>()),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../services/ticketNotifications", () => notifications);

import {
  assignAdminTicket,
  buildAdminTicketWhere,
  getAdminTicket,
  getAdminTickets,
  postAdminTicketMessage,
  setAdminTicketStatus,
} from "./adminTicketController";

const ADMIN = "aaaaaaaa-1111-4111-8111-111111111111";
const OTHER_ADMIN = "aaaaaaaa-2222-4222-8222-222222222222";
const STUDENT = "11111111-1111-4111-8111-111111111111";
const TICKET = "22222222-2222-4222-8222-222222222222";
const MSG_ID = "55555555-5555-4555-8555-555555555555";

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    user: { userId: ADMIN, role: "ADMIN" },
    headers: {},
    params: { ticketId: TICKET },
    query: {},
    body: {},
    ...overrides,
  } as never;
}

function adminRow(overrides: Record<string, unknown> = {}) {
  const created = new Date("2026-11-02T03:00:00Z");
  return {
    ticketId: TICKET,
    ticketNumber: 42,
    requesterUserId: STUDENT,
    requesterRole: "STUDENT",
    category: "REFUND",
    subject: "ขอคืนเงิน",
    status: "OPEN",
    awaitingSupport: true,
    classId: null,
    paymentReference: "chrg_test_1",
    assigneeUserId: null,
    idempotencyKey: null,
    dueAt: new Date("2026-11-05T16:59:59.999Z"),
    firstResponseAt: null,
    resolvedAt: null,
    requesterLastReadAt: null,
    lastMessageAt: created,
    createdAt: created,
    updatedAt: created,
    class: null,
    requester: { userId: STUDENT, displayName: "Nok", role: "STUDENT", email: "nok@example.com" },
    assignee: null,
    messages: [],
    ...overrides,
  };
}

const current = (status: string, extra: Record<string, unknown> = {}) => ({
  ticketId: TICKET,
  ticketNumber: 42,
  requesterUserId: STUDENT,
  requesterRole: "STUDENT",
  status,
  firstResponseAt: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(prisma));
  prisma.supportTicket.updateMany.mockResolvedValue({ count: 1 });
  prisma.supportTicketMessage.findFirst.mockResolvedValue(null);
});

describe("admin gate", () => {
  it("refuses non-admins even past the route guard", async () => {
    const res = response();
    await getAdminTickets(request({ user: { userId: STUDENT, role: "STUDENT" } }), res as never);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.supportTicket.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /v1/admin/tickets", () => {
  it("lists the active queue by deadline with whole-queue counts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T00:00:00Z"));
    try {
      prisma.supportTicket.findMany.mockResolvedValue([adminRow()]);
      prisma.supportTicket.count.mockResolvedValueOnce(1).mockResolvedValueOnce(3).mockResolvedValueOnce(4);
      prisma.supportTicket.groupBy.mockResolvedValue([
        { status: "OPEN", _count: { _all: 2 } },
        { status: "IN_PROGRESS", _count: { _all: 1 } },
        { status: "WAITING_ON_REQUESTER", _count: { _all: 2 } },
        { status: "RESOLVED", _count: { _all: 9 } },
      ]);
      const res = response();
      await getAdminTickets(request({ query: { pageSize: "10", page: "2" } }), res as never);

      const args = prisma.supportTicket.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ AND: [{ status: { not: "RESOLVED" } }] });
      expect(args.orderBy).toEqual([{ dueAt: "asc" }, { createdAt: "asc" }]);
      expect(args.skip).toBe(10);
      expect(args.take).toBe(10);
      const body = res.json.mock.calls[0][0];
      expect(res.status).toHaveBeenCalledWith(200);
      expect(body).toMatchObject({
        total: 1,
        page: 2,
        pageSize: 10,
        counts: { ACTIVE: 5, OPEN: 2, IN_PROGRESS: 1, WAITING_ON_REQUESTER: 2, RESOLVED: 9, overdue: 3, awaitingSupport: 4 },
      });
      expect(body.tickets[0]).toMatchObject({
        ticketNumber: 42,
        requester: { displayName: "Nok", email: "nok@example.com", role: "STUDENT" },
        overdue: true,
        awaitingSupport: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("sorts resolved tickets by resolvedAt and rejects bad filters", async () => {
    prisma.supportTicket.findMany.mockResolvedValue([]);
    prisma.supportTicket.count.mockResolvedValue(0);
    prisma.supportTicket.groupBy.mockResolvedValue([]);
    const res = response();
    await getAdminTickets(request({ query: { status: "RESOLVED" } }), res as never);
    expect(prisma.supportTicket.findMany.mock.calls[0][0].orderBy).toEqual([{ resolvedAt: "desc" }, { createdAt: "desc" }]);

    const bad = response();
    await getAdminTickets(request({ query: { status: "CLOSED" } }), bad as never);
    expect(bad.status).toHaveBeenCalledWith(400);
  });

  it("builds search, number, assignee and overdue filters", () => {
    const now = new Date("2026-11-06T00:00:00Z");
    const base = { status: "ACTIVE" as const, category: null, ticketNumber: null, search: null, assignee: null, overdue: false, page: 1, pageSize: 20 };
    expect(buildAdminTicketWhere({ ...base, ticketNumber: 12 }, ADMIN, now).AND).toContainEqual({ ticketNumber: 12 });
    expect(buildAdminTicketWhere({ ...base, search: "nok" }, ADMIN, now).AND).toContainEqual({
      OR: [
        { subject: { contains: "nok", mode: "insensitive" } },
        { requester: { displayName: { contains: "nok", mode: "insensitive" } } },
        { requester: { email: { contains: "nok", mode: "insensitive" } } },
      ],
    });
    expect(buildAdminTicketWhere({ ...base, assignee: "me" }, ADMIN, now).AND).toContainEqual({ assigneeUserId: ADMIN });
    expect(buildAdminTicketWhere({ ...base, assignee: "unassigned" }, ADMIN, now).AND).toContainEqual({ assigneeUserId: null });
    expect(buildAdminTicketWhere({ ...base, overdue: true, category: "REFUND" }, ADMIN, now).AND).toEqual([
      { status: { not: "RESOLVED" } },
      { category: "REFUND" },
      { status: { not: "RESOLVED" }, firstResponseAt: null, dueAt: { lt: now } },
    ]);
  });
});

describe("GET /v1/admin/tickets/:ticketId", () => {
  it("returns internal notes with author names", async () => {
    prisma.supportTicket.findUnique.mockResolvedValue(
      adminRow({
        messages: [
          { messageId: "m1", authorUserId: STUDENT, authorSide: "REQUESTER", kind: "MESSAGE", body: "ขอคืนเงิน", fromStatus: null, toStatus: null, createdAt: new Date("2026-11-02T03:00:00Z"), author: { displayName: "Nok" } },
          { messageId: "m2", authorUserId: ADMIN, authorSide: "SUPPORT", kind: "INTERNAL_NOTE", body: "check Omise", fromStatus: null, toStatus: null, createdAt: new Date("2026-11-02T04:00:00Z"), author: { displayName: "Admin A" } },
        ],
      }),
    );
    const res = response();
    await getAdminTicket(request(), res as never);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].ticket.messages).toEqual([
      expect.objectContaining({ kind: "MESSAGE", author: "REQUESTER", authorName: "Nok" }),
      expect.objectContaining({ kind: "INTERNAL_NOTE", author: "SUPPORT", authorName: "Admin A" }),
    ]);
  });

  it("answers 404 for a malformed or unknown id", async () => {
    const bad = response();
    await getAdminTicket(request({ params: { ticketId: "x" } }), bad as never);
    expect(bad.status).toHaveBeenCalledWith(404);
    prisma.supportTicket.findUnique.mockResolvedValue(null);
    const missing = response();
    await getAdminTicket(request(), missing as never);
    expect(missing.status).toHaveBeenCalledWith(404);
  });
});

describe("POST /v1/admin/tickets/:ticketId/messages", () => {
  function primeTicket(state: ReturnType<typeof current>) {
    prisma.supportTicket.findUnique
      .mockResolvedValueOnce({ ticketId: TICKET }) // exists
      .mockResolvedValueOnce(state) // in tx
      .mockResolvedValueOnce(adminRow()); // response
  }

  it("a public reply on OPEN sets first response, IN_PROGRESS and notifies via LINE", async () => {
    primeTicket(current("OPEN"));
    const res = response();
    await postAdminTicketMessage(
      request({ body: { body: "กำลังตรวจสอบครับ", internal: false, clientMessageId: MSG_ID } }),
      res as never,
    );
    expect(prisma.supportTicket.updateMany).toHaveBeenCalledWith({
      where: { ticketId: TICKET, status: "OPEN" },
      data: expect.objectContaining({ status: "IN_PROGRESS", awaitingSupport: false, firstResponseAt: expect.any(Date) }),
    });
    // The row is locked (and `now` taken) before the ticket is read, so the reply sorts after any
    // requester message committed first.
    expect((prisma.$queryRaw.mock.calls[0][0] as string[]).join("?")).toContain("FOR UPDATE");
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.supportTicket.updateMany.mock.invocationCallOrder[0]);
    const kinds = prisma.supportTicketMessage.create.mock.calls.map((c) => [c[0].data.kind, c[0].data.authorSide]);
    expect(kinds).toEqual([
      ["MESSAGE", "SUPPORT"],
      ["STATUS_CHANGE", "SUPPORT"],
    ]);
    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "SUPPORT_TICKET_STATUS_CHANGE", entityType: "SupportTicket", entityId: TICKET }),
    });
    expect(notifications.notifyRequester).toHaveBeenCalledWith(expect.objectContaining({ ticketNumber: 42, requesterUserId: STUDENT }), "REPLY");
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("keeps firstResponseAt and honours an explicit status", async () => {
    primeTicket(current("IN_PROGRESS", { firstResponseAt: new Date("2026-11-02T05:00:00Z") }));
    const res = response();
    await postAdminTicketMessage(
      request({ body: { body: "ขอเลขที่ใบเสร็จครับ", internal: false, clientMessageId: MSG_ID, status: "WAITING_ON_REQUESTER" } }),
      res as never,
    );
    const data = prisma.supportTicket.updateMany.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: "WAITING_ON_REQUESTER", awaitingSupport: false });
    expect(data).not.toHaveProperty("firstResponseAt");
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("an internal note changes nothing on the ticket and sends nothing", async () => {
    primeTicket(current("OPEN"));
    const res = response();
    await postAdminTicketMessage(request({ body: { body: "รอทีมการเงิน", internal: true, clientMessageId: MSG_ID } }), res as never);
    expect(prisma.supportTicket.updateMany).not.toHaveBeenCalled();
    expect(prisma.supportTicketMessage.create).toHaveBeenCalledTimes(1);
    expect(prisma.supportTicketMessage.create.mock.calls[0][0].data).toMatchObject({ kind: "INTERNAL_NOTE", authorSide: "SUPPORT" });
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
    expect(notifications.notifyRequester).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("replays a known clientMessageId", async () => {
    prisma.supportTicket.findUnique.mockResolvedValueOnce({ ticketId: TICKET }).mockResolvedValueOnce(adminRow());
    prisma.supportTicketMessage.findFirst.mockResolvedValue({ messageId: "m9" });
    const res = response();
    await postAdminTicketMessage(request({ body: { body: "hi", internal: false, clientMessageId: MSG_ID } }), res as never);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(notifications.notifyRequester).not.toHaveBeenCalled();
  });

  it("validates the request", async () => {
    prisma.supportTicket.findUnique.mockResolvedValueOnce({ ticketId: TICKET });
    const res = response();
    await postAdminTicketMessage(request({ body: { body: "hi", clientMessageId: MSG_ID } }), res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "VALIDATION_FAILED" }) });
  });
});

describe("POST /v1/admin/tickets/:ticketId/status", () => {
  it("resolves with a status message, internal note, audit row and LINE notice", async () => {
    prisma.supportTicket.findUnique.mockResolvedValueOnce(current("IN_PROGRESS")).mockResolvedValueOnce(adminRow({ status: "RESOLVED" }));
    const res = response();
    await setAdminTicketStatus(request({ body: { status: "RESOLVED", note: "คืนเงินแล้ว" } }), res as never);
    expect(prisma.supportTicket.updateMany).toHaveBeenCalledWith({
      where: { ticketId: TICKET, status: "IN_PROGRESS" },
      data: expect.objectContaining({ status: "RESOLVED", resolvedAt: expect.any(Date), awaitingSupport: false }),
    });
    expect(prisma.supportTicketMessage.create.mock.calls.map((c) => c[0].data.kind)).toEqual(["STATUS_CHANGE", "INTERNAL_NOTE"]);
    expect(prisma.auditEvent.create.mock.calls[0][0].data.payload).toEqual({ ticketNumber: 42, fromStatus: "IN_PROGRESS", toStatus: "RESOLVED", via: "status" });
    expect(notifications.notifyRequester).toHaveBeenCalledWith(expect.anything(), "RESOLVED");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("leaving RESOLVED clears resolvedAt and does not notify", async () => {
    prisma.supportTicket.findUnique.mockResolvedValueOnce(current("RESOLVED")).mockResolvedValueOnce(adminRow());
    const res = response();
    await setAdminTicketStatus(request({ body: { status: "IN_PROGRESS" } }), res as never);
    expect(prisma.supportTicket.updateMany.mock.calls[0][0].data).toMatchObject({ status: "IN_PROGRESS", resolvedAt: null });
    expect(notifications.notifyRequester).not.toHaveBeenCalled();
  });

  it("the same status is a 200 no-op", async () => {
    prisma.supportTicket.findUnique.mockResolvedValueOnce(current("OPEN")).mockResolvedValueOnce(adminRow());
    const res = response();
    await setAdminTicketStatus(request({ body: { status: "OPEN", note: "x" } }), res as never);
    expect(prisma.supportTicket.updateMany).not.toHaveBeenCalled();
    expect(prisma.supportTicketMessage.create).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("answers 404 for an unknown ticket", async () => {
    prisma.supportTicket.findUnique.mockResolvedValueOnce(null);
    const res = response();
    await setAdminTicketStatus(request({ body: { status: "RESOLVED" } }), res as never);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("POST /v1/admin/tickets/:ticketId/assign", () => {
  it("assigns an active admin and audits it", async () => {
    prisma.supportTicket.findUnique
      .mockResolvedValueOnce({ ticketId: TICKET, ticketNumber: 42, assigneeUserId: null })
      .mockResolvedValueOnce(adminRow({ assigneeUserId: OTHER_ADMIN, assignee: { userId: OTHER_ADMIN, displayName: "Admin B" } }));
    prisma.user.findUnique.mockResolvedValue({ role: "ADMIN", isActive: true });
    const res = response();
    await assignAdminTicket(request({ body: { assigneeUserId: OTHER_ADMIN } }), res as never);
    expect(prisma.supportTicket.update).toHaveBeenCalledWith({ where: { ticketId: TICKET }, data: { assigneeUserId: OTHER_ADMIN } });
    expect(prisma.auditEvent.create.mock.calls[0][0].data).toMatchObject({
      action: "SUPPORT_TICKET_ASSIGN",
      payload: { ticketNumber: 42, fromAssigneeUserId: null, toAssigneeUserId: OTHER_ADMIN },
    });
    expect(res.json.mock.calls[0][0].ticket.assignee).toEqual({ userId: OTHER_ADMIN, displayName: "Admin B" });
  });

  it("rejects non-admin or inactive assignees", async () => {
    prisma.supportTicket.findUnique.mockResolvedValue({ ticketId: TICKET, ticketNumber: 42, assigneeUserId: null });
    prisma.user.findUnique.mockResolvedValueOnce({ role: "TUTOR", isActive: true }).mockResolvedValueOnce({ role: "ADMIN", isActive: false });
    for (let i = 0; i < 2; i += 1) {
      const res = response();
      await assignAdminTicket(request({ body: { assigneeUserId: OTHER_ADMIN } }), res as never);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "INVALID_ASSIGNEE" }) });
    }
    expect(prisma.supportTicket.update).not.toHaveBeenCalled();
  });

  it("unassigns with null and skips unchanged assignments", async () => {
    prisma.supportTicket.findUnique
      .mockResolvedValueOnce({ ticketId: TICKET, ticketNumber: 42, assigneeUserId: ADMIN })
      .mockResolvedValueOnce(adminRow())
      .mockResolvedValueOnce({ ticketId: TICKET, ticketNumber: 42, assigneeUserId: null })
      .mockResolvedValueOnce(adminRow());
    const res = response();
    await assignAdminTicket(request({ body: { assigneeUserId: null } }), res as never);
    expect(prisma.supportTicket.update).toHaveBeenCalledWith({ where: { ticketId: TICKET }, data: { assigneeUserId: null } });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();

    const again = response();
    await assignAdminTicket(request({ body: { assigneeUserId: null } }), again as never);
    expect(prisma.supportTicket.update).toHaveBeenCalledTimes(1);
    expect(again.status).toHaveBeenCalledWith(200);
  });
});
