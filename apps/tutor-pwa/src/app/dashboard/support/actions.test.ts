import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateTicketRequest, TicketDetail } from "./lib/support";

const { cookieValue, revalidatePath } = vi.hoisted(() => ({
  cookieValue: { current: "tutor-token" as string | undefined },
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "tutor_session" && cookieValue.current ? { value: cookieValue.current } : undefined),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { createTicket, replyToTicket, resolveTicket } from "./actions";

const TICKET_ID = "8a0c3f4e-1b2d-4c5e-9f60-718293a4b5c6";
const IDEMPOTENCY_KEY = "0f1e2d3c-4b5a-4968-8776-a5b4c3d2e1f0";
const CLIENT_MESSAGE_ID = "11111111-2222-4333-8444-555555555555";

const ticket: TicketDetail = {
  ticketId: TICKET_ID,
  ticketNumber: 42,
  category: "PAYOUT",
  subject: "ยังไม่ได้รับเงินรอบนี้",
  status: "OPEN",
  classId: null,
  classTitle: null,
  createdAt: "2026-11-05T03:00:00.000Z",
  updatedAt: "2026-11-05T03:00:00.000Z",
  lastMessageAt: "2026-11-05T03:00:00.000Z",
  hasUnreadReply: false,
  paymentReference: null,
  resolvedAt: null,
  canReply: true,
  messages: [],
};

const request: CreateTicketRequest = {
  category: "PAYOUT",
  subject: "ยังไม่ได้รับเงินรอบนี้",
  body: "รอบจ่ายวันที่ 1 พ.ย. ยังไม่ได้รับเงินเข้าบัญชีครับ",
  idempotencyKey: IDEMPOTENCY_KEY,
};

describe("createTicket", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    revalidatePath.mockReset();
    cookieValue.current = "tutor-token";
  });

  it("posts the ticket with the tutor session and returns the created ticket", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ticket }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createTicket(request)).resolves.toEqual({ ok: true, ticket });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/v1\/tickets$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tutor-token");
    expect(JSON.parse(init.body)).toEqual(request);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/support");
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/support/${TICKET_ID}`);
  });

  it("passes the learning error code through", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({ error: { code: "TOO_MANY_OPEN_TICKETS", message: "Too many", requestId: "r1" } }, { status: 429 }),
      ),
    );

    await expect(createTicket(request)).resolves.toEqual({ ok: false, code: "TOO_MANY_OPEN_TICKETS" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("falls back to SUPPORT_REQUEST_FAILED for a non-JSON error or a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad gateway", { status: 502 })));
    await expect(createTicket(request)).resolves.toEqual({ ok: false, code: "SUPPORT_REQUEST_FAILED" });

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(createTicket(request)).resolves.toEqual({ ok: false, code: "SUPPORT_REQUEST_FAILED" });
  });

  it("does not call learning without a session", async () => {
    cookieValue.current = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(createTicket(request)).resolves.toEqual({ ok: false, code: "UNAUTHORIZED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("replyToTicket", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    revalidatePath.mockReset();
    cookieValue.current = "tutor-token";
  });

  it("posts body + clientMessageId to the ticket's messages", async () => {
    const replied = { ...ticket, messages: [] };
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ticket: replied }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(replyToTicket(TICKET_ID, "ขอบคุณครับ", CLIENT_MESSAGE_ID)).resolves.toEqual({ ok: true, ticket: replied });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(new RegExp(`/v1/tickets/${TICKET_ID}/messages$`));
    expect(JSON.parse(init.body)).toEqual({ body: "ขอบคุณครับ", clientMessageId: CLIENT_MESSAGE_ID });
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/support/${TICKET_ID}`);
  });

  it("passes TICKET_CLOSED through", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ error: { code: "TICKET_CLOSED", message: "Closed" } }, { status: 409 })),
    );
    await expect(replyToTicket(TICKET_ID, "ยังมีปัญหาอยู่", CLIENT_MESSAGE_ID)).resolves.toEqual({
      ok: false,
      code: "TICKET_CLOSED",
    });
  });

  it("rejects a malformed ticket id without calling learning", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(replyToTicket("../admin", "hi", CLIENT_MESSAGE_ID)).resolves.toEqual({ ok: false, code: "TICKET_NOT_FOUND" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("resolveTicket", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    revalidatePath.mockReset();
    cookieValue.current = "tutor-token";
  });

  it("posts to resolve and returns the resolved ticket", async () => {
    const resolved = { ...ticket, status: "RESOLVED" as const, resolvedAt: "2026-11-05T04:00:00.000Z" };
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ticket: resolved }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveTicket(TICKET_ID)).resolves.toEqual({ ok: true, ticket: resolved });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(new RegExp(`/v1/tickets/${TICKET_ID}/resolve$`));
    expect(init.method).toBe("POST");
  });

  it("treats a 2xx response without a ticket as a failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));
    await expect(resolveTicket(TICKET_ID)).resolves.toEqual({ ok: false, code: "SUPPORT_REQUEST_FAILED" });
  });
});
