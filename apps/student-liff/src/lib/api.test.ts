/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@line/liff", () => ({
  default: {
    getIDToken: vi.fn(),
  },
}));

describe("student API helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    // Reset cookies
    document.cookie = "student-session=; max-age=0; path=/";
  });

  it("uses browser proxy URLs and relies on the HttpOnly same-origin cookie", async () => {
    document.cookie = "student-session=token-1; path=/";
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { fetchWithAuth } = await import("./api");

    await expect(fetchWithAuth("/dashboard/summary")).resolves.toEqual({ ok: true });

    expect(fetch).toHaveBeenCalledWith("/api/learning/dashboard/summary", expect.objectContaining({
      credentials: "same-origin",
      cache: "no-store",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
      }),
    }));
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).not.toHaveProperty("Authorization");
  });

  it("throws API error messages from error envelopes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "No class found" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );
    const { fetchWithAuth } = await import("./api");

    await expect(fetchWithAuth("/classes/missing")).rejects.toThrow("No class found");
  });

  it("does not log expected 4xx API errors to the console", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "PAYMENT_REQUIRED",
            message: "Payment is required to access this book",
          },
        }),
        {
          status: 402,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    const { fetchWithAuth } = await import("./api");

    await expect(fetchWithAuth("/classes/class-1/articles?cycleId=locked")).rejects.toMatchObject({
      status: 402,
      code: "PAYMENT_REQUIRED",
      message: "Payment is required to access this book",
    });
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe("studentApi support tickets", () => {
  const TICKET_ID = "11111111-2222-4333-8444-555555555555";

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.mocked(fetch).mockImplementation(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });

  function lastCall() {
    const [url, init] = vi.mocked(fetch).mock.calls.at(-1) ?? [];
    return { url, init: init as RequestInit | undefined };
  }

  it("lists and reads tickets through the learning proxy", async () => {
    const { studentApi } = await import("./api");

    await studentApi.getSupportTickets();
    expect(lastCall().url).toBe("/api/learning/tickets");
    expect(lastCall().init).toMatchObject({ credentials: "same-origin", cache: "no-store" });
    expect(lastCall().init?.method).toBeUndefined();

    await studentApi.getSupportTicket(TICKET_ID);
    expect(lastCall().url).toBe(`/api/learning/tickets/${TICKET_ID}`);
  });

  it("creates a ticket with the contract body", async () => {
    const { studentApi } = await import("./api");
    const payload = {
      category: "REFUND",
      subject: "ขอคืนเงิน",
      body: "จ่ายเงินซ้ำสองครั้งค่ะ",
      paymentReference: "chrg_test_123",
      idempotencyKey: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    };

    await studentApi.createSupportTicket(payload);

    expect(lastCall().url).toBe("/api/learning/tickets");
    expect(lastCall().init?.method).toBe("POST");
    expect(JSON.parse(String(lastCall().init?.body))).toEqual(payload);
    expect(lastCall().init?.headers).not.toHaveProperty("Authorization");
  });

  it("replies to and resolves a ticket", async () => {
    const { studentApi } = await import("./api");

    await studentApi.replySupportTicket(TICKET_ID, { body: "ได้รับแล้วค่ะ", clientMessageId: "c-1" });
    expect(lastCall().url).toBe(`/api/learning/tickets/${TICKET_ID}/messages`);
    expect(lastCall().init?.method).toBe("POST");
    expect(JSON.parse(String(lastCall().init?.body))).toEqual({ body: "ได้รับแล้วค่ะ", clientMessageId: "c-1" });

    await studentApi.resolveSupportTicket(TICKET_ID);
    expect(lastCall().url).toBe(`/api/learning/tickets/${TICKET_ID}/resolve`);
    expect(lastCall().init?.method).toBe("POST");
  });

  it("encodes ticket ids taken from the URL", async () => {
    const { studentApi } = await import("./api");

    await studentApi.getSupportTicket("../payments/x");
    expect(lastCall().url).toBe("/api/learning/tickets/..%2Fpayments%2Fx");
  });
});
