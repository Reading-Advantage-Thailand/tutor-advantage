import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Internal-key guard of POST /v1/internal/settlement/auto-run (Cloud Scheduler).
// The rest of settlementController is covered in settlementController.test.ts.

const serviceMock = vi.hoisted(() => {
  class SettlementStaleError extends Error {}
  return {
    SettlementStaleError,
    SettlementService: { previewSettlement: vi.fn() },
    isDevMakerCheckerOverrideEnabled: vi.fn(() => false),
  };
});
vi.mock("../services/settlementService", () => serviceMock);
vi.mock("../services/omiseService", () => ({ isOmiseConfigured: () => true }));

const prismaMock = vi.hoisted(() => ({
  settlementRun: { findFirst: vi.fn() },
}));
vi.mock("@tutor-advantage/database", () => ({ prisma: prismaMock }));

import { autoRunSettlement } from "./settlementController";

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

function request(key?: string | string[]) {
  return { headers: key === undefined ? {} : { "x-internal-key": key }, body: {} } as never;
}

describe("autoRunSettlement internal key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("INTERNAL_API_KEY", KEY);
    prismaMock.settlementRun.findFirst.mockResolvedValue(null);
    serviceMock.SettlementService.previewSettlement.mockResolvedValue({ snapshotId: "run-1" });
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
    await autoRunSettlement(request(key as string | string[] | undefined), res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: { code: "UNAUTHORIZED", message: "Invalid internal key" } });
    expect(prismaMock.settlementRun.findFirst).not.toHaveBeenCalled();
    expect(serviceMock.SettlementService.previewSettlement).not.toHaveBeenCalled();
  });

  it("rejects every caller when INTERNAL_API_KEY is not configured", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "");
    for (const key of [undefined, "", KEY]) {
      const res = createResponse();
      await autoRunSettlement(request(key), res as never);
      expect(res.statusCode).toBe(401);
    }
    expect(serviceMock.SettlementService.previewSettlement).not.toHaveBeenCalled();
  });

  it("creates the monthly preview with the correct key", async () => {
    const res = createResponse();
    await autoRunSettlement(request(KEY), res as never);

    expect(res.statusCode).toBe(201);
    expect(serviceMock.SettlementService.previewSettlement).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}$/),
      "SYSTEM_SCHEDULER",
    );
    expect(res.body).toMatchObject({ settlementRunId: "run-1", skipped: false });
  });

  it("skips when a run already exists for the period", async () => {
    prismaMock.settlementRun.findFirst.mockResolvedValue({ settlementRunId: "run-0", status: "APPROVED" });
    const res = createResponse();
    await autoRunSettlement(request(KEY), res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ settlementRunId: "run-0", skipped: true });
    expect(serviceMock.SettlementService.previewSettlement).not.toHaveBeenCalled();
  });
});
