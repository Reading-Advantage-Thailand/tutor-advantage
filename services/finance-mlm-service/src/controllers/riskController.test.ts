import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const riskServiceMock = vi.hoisted(() => ({ syncDisputesAndRefunds: vi.fn() }));
vi.mock("../services/paymentRiskService", () => riskServiceMock);

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  auditEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@tutor-advantage/database", () => ({ prisma: prismaMock }));

import { syncDisputesInternal } from "./riskController";

const KEY = "internal-test-key";

function createResponse() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
  };
  return res;
}

function request(key?: string | string[], body: unknown = {}) {
  return { headers: key === undefined ? {} : { "x-internal-key": key }, body } as never;
}

describe("syncDisputesInternal internal key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("INTERNAL_API_KEY", KEY);
    riskServiceMock.syncDisputesAndRefunds.mockResolvedValue({ disputes: 2, refunds: 1 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["the header is missing", undefined],
    ["the key is wrong", "not-the-key"],
    ["the key differs only in length", `${KEY}x`],
    ["the header is repeated", [KEY, KEY]],
    ["the header is empty", ""],
  ])("answers 401 when %s", async (_label, key) => {
    const res = createResponse();
    await syncDisputesInternal(request(key as string | string[] | undefined), res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: { code: "UNAUTHORIZED", message: "Invalid internal key" } });
    expect(riskServiceMock.syncDisputesAndRefunds).not.toHaveBeenCalled();
  });

  it("rejects every caller when INTERNAL_API_KEY is not configured", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "");
    for (const key of [undefined, "", KEY]) {
      const res = createResponse();
      await syncDisputesInternal(request(key), res as never);
      expect(res.statusCode).toBe(401);
    }
    expect(riskServiceMock.syncDisputesAndRefunds).not.toHaveBeenCalled();
  });

  it("runs the sync with the correct key", async () => {
    const res = createResponse();
    await syncDisputesInternal(request(KEY, { sinceDays: 30 }), res as never);

    expect(res.statusCode).toBe(200);
    expect(riskServiceMock.syncDisputesAndRefunds).toHaveBeenCalledWith({ sinceDays: 30 });
    expect(res.body).toMatchObject({ sinceDays: 30, disputes: 2, refunds: 1 });
  });

  it("falls back to 45 days for an out-of-range sinceDays", async () => {
    const res = createResponse();
    await syncDisputesInternal(request(KEY, { sinceDays: 9999 }), res as never);

    expect(res.statusCode).toBe(200);
    expect(riskServiceMock.syncDisputesAndRefunds).toHaveBeenCalledWith({ sinceDays: 45 });
  });

  it("answers 500 when the sync fails", async () => {
    riskServiceMock.syncDisputesAndRefunds.mockRejectedValue(new Error("omise down"));
    const res = createResponse();
    await syncDisputesInternal(request(KEY), res as never);

    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
