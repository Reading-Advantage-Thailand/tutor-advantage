import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serviceMock = vi.hoisted(() => {
  class SettlementStaleError extends Error {
    constructor(public readonly freshness: { changedTutorUserIds: string[] } & Record<string, unknown>) {
      super(`SETTLEMENT_STALE:${freshness.changedTutorUserIds.join(",")}`);
    }
  }
  return {
    SettlementStaleError,
    SettlementService: {
      previewSettlement: vi.fn(),
      refreshSettlementRun: vi.fn(),
      approveSettlement: vi.fn(),
      assertRunReadyForReview: vi.fn(),
      getRunFreshness: vi.fn(),
    },
    isDevMakerCheckerOverrideEnabled: vi.fn(() => false),
  };
});

vi.mock("../services/settlementService", () => serviceMock);
vi.mock("../services/omiseService", () => ({ isOmiseConfigured: () => true }));

const prismaMock = vi.hoisted(() => ({
  settlementRun: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  payoutLine: { groupBy: vi.fn() },
  adjustment: { count: vi.fn(), groupBy: vi.fn() },
  user: { findMany: vi.fn() },
  auditEvent: { create: vi.fn() },
}));

vi.mock("@tutor-advantage/database", () => ({ prisma: prismaMock }));

import {
  approveSettlement,
  getSettlements,
  previewSettlement,
  refreshSettlement,
  submitSettlement,
} from "./settlementController";

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

function request(role: string, extra: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    user: { userId: `${role.toLowerCase()}-1`, role },
    params: { snapshotId: "run-1" },
    body: {},
    query: {},
    ...extra,
  } as any;
}

const draftRun = {
  settlementRunId: "run-1",
  periodMonth: "2026-09",
  status: "DRAFT",
  previewPayload: {},
  createdBy: "admin-1",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  approvedBy: null,
  approvedAt: null,
};

describe("settlementController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMock.isDevMakerCheckerOverrideEnabled.mockReturnValue(false);
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.auditEvent.create.mockResolvedValue({});
    prismaMock.adjustment.count.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses to submit a 0-line run (F-2)", async () => {
    prismaMock.settlementRun.findUnique.mockResolvedValue(draftRun);
    serviceMock.SettlementService.assertRunReadyForReview.mockRejectedValue(new Error("SETTLEMENT_EMPTY"));

    const res = createResponse() as any;
    await submitSettlement(request("ADMIN"), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe("SETTLEMENT_EMPTY");
    expect(prismaMock.settlementRun.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to submit a stale run and names the affected tutors (F-3)", async () => {
    prismaMock.settlementRun.findUnique.mockResolvedValue({ ...draftRun, previewPayload: { previewedAt: "x" } });
    serviceMock.SettlementService.assertRunReadyForReview.mockRejectedValue(
      new serviceMock.SettlementStaleError({
        previewed: true,
        lineCount: 2,
        stale: true,
        reasons: ["ADJUSTMENTS_CHANGED"],
        changedTutorUserIds: ["5eed0000-0000-4000-8000-000000000104"],
        checkedAt: "",
      }),
    );
    prismaMock.user.findMany.mockResolvedValue([
      { userId: "5eed0000-0000-4000-8000-000000000104", displayName: "ครูสมหญิง", email: null },
    ]);

    const res = createResponse() as any;
    await submitSettlement(request("ADMIN"), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe("SETTLEMENT_STALE");
    expect(res.body.error.details.changedTutors).toEqual([
      { userId: "5eed0000-0000-4000-8000-000000000104", name: "ครูสมหญิง" },
    ]);
    expect(prismaMock.settlementRun.updateMany).not.toHaveBeenCalled();
  });

  it("submits a fresh run and records who submitted it", async () => {
    prismaMock.settlementRun.findUnique.mockResolvedValue({ ...draftRun, previewPayload: { previewedAt: "x" } });
    serviceMock.SettlementService.assertRunReadyForReview.mockResolvedValue({ lineCount: 2 });
    prismaMock.settlementRun.updateMany.mockResolvedValue({ count: 1 });

    const res = createResponse() as any;
    await submitSettlement(request("ADMIN"), res);

    expect(res.statusCode).toBe(200);
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "SUBMIT", entityType: "SettlementRun", entityId: "run-1" }),
    });
  });

  it("keeps maker-checker: an ADMIN cannot approve without the explicit dev override (F-10)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = createResponse() as any;
    await approveSettlement(request("ADMIN"), res);

    expect(res.statusCode).toBe(403);
    expect(serviceMock.SettlementService.approveSettlement).not.toHaveBeenCalled();
  });

  it("allows the labelled dev override to approve a DRAFT directly and audits it", async () => {
    serviceMock.isDevMakerCheckerOverrideEnabled.mockReturnValue(true);
    prismaMock.settlementRun.findUnique.mockResolvedValue({ periodMonth: "2026-09", status: "DRAFT" });
    serviceMock.SettlementService.approveSettlement.mockResolvedValue({
      ...draftRun,
      status: "APPROVED",
      timezone: "Asia/Bangkok",
      payoutLines: [],
    });

    const res = createResponse() as any;
    await approveSettlement(request("ADMIN"), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.devOverride).toBe(true);
    expect(serviceMock.SettlementService.approveSettlement).toHaveBeenCalledWith("run-1", "admin-1", {
      allowDirectFromDraft: true,
    });
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "APPROVE",
        payload: expect.objectContaining({ devOverride: true }),
      }),
    });
  });

  it("a checker may approve only SUBMITTED runs", async () => {
    serviceMock.isDevMakerCheckerOverrideEnabled.mockReturnValue(true);
    prismaMock.settlementRun.findUnique.mockResolvedValue({ periodMonth: "2026-09", status: "DRAFT" });

    const res = createResponse() as any;
    await approveSettlement(request("FINANCE_CHECKER"), res);

    expect(res.statusCode).toBe(400);
    expect(serviceMock.SettlementService.approveSettlement).not.toHaveBeenCalled();
  });

  it("maps a stale approval to 409 SETTLEMENT_STALE", async () => {
    prismaMock.settlementRun.findUnique.mockResolvedValue({ periodMonth: "2026-08", status: "SUBMITTED" });
    serviceMock.SettlementService.approveSettlement.mockRejectedValue(
      new serviceMock.SettlementStaleError({ changedTutorUserIds: [], reasons: ["LINES_CHANGED"] }),
    );

    const res = createResponse() as any;
    await approveSettlement(request("FINANCE_CHECKER"), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe("SETTLEMENT_STALE");
  });

  it("returns the existing run id with DRAFT_EXISTS so the UI can open it", async () => {
    serviceMock.SettlementService.previewSettlement.mockRejectedValue(
      Object.assign(new Error("DRAFT_EXISTS"), { existingRunId: "run-9", existingStatus: "SUBMITTED" }),
    );

    const res = createResponse() as any;
    await previewSettlement(request("ADMIN", { body: { periodMonth: "2026-09" } }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error.details).toEqual({ snapshotId: "run-9", status: "SUBMITTED" });
  });

  it("recalculates a SUBMITTED run only when it is stale", async () => {
    prismaMock.settlementRun.findUnique.mockResolvedValue({ ...draftRun, status: "SUBMITTED" });
    serviceMock.SettlementService.getRunFreshness.mockResolvedValueOnce({ stale: false });

    const res1 = createResponse() as any;
    await refreshSettlement(request("ADMIN"), res1);
    expect(res1.statusCode).toBe(409);
    expect(res1.body.error.code).toBe("SETTLEMENT_NOT_STALE");

    serviceMock.SettlementService.getRunFreshness.mockResolvedValueOnce({ stale: true });
    serviceMock.SettlementService.refreshSettlementRun.mockResolvedValue({ refreshed: true, status: "DRAFT" });
    const res2 = createResponse() as any;
    await refreshSettlement(request("ADMIN"), res2);
    expect(res2.statusCode).toBe(200);
    expect(serviceMock.SettlementService.refreshSettlementRun).toHaveBeenCalledWith("run-1", {
      actorId: "admin-1",
      allowSubmitted: true,
    });
  });

  it("lists runs with grouped totals and pagination instead of loading every line", async () => {
    prismaMock.settlementRun.count.mockResolvedValue(3);
    prismaMock.settlementRun.findMany.mockResolvedValue([
      { ...draftRun, settlementRunId: "run-a", status: "APPROVED" },
    ]);
    prismaMock.settlementRun.groupBy.mockResolvedValue([{ status: "APPROVED", _count: { _all: 3 } }]);
    prismaMock.payoutLine.groupBy.mockResolvedValue([
      {
        settlementRunId: "run-a",
        _count: { _all: 2 },
        _sum: { payoutAmountMinor: 20_000n, withholdingTaxMinor: 600n, netPayoutMinor: 19_400n },
      },
    ]);
    prismaMock.adjustment.groupBy.mockResolvedValue([]);

    const res = createResponse() as any;
    await getSettlements(request("FINANCE_CHECKER", { query: { page: "2", pageSize: "1" } }), res);

    expect(res.statusCode).toBe(200);
    const findManyArgs = prismaMock.settlementRun.findMany.mock.calls[0][0];
    expect(findManyArgs).toMatchObject({ skip: 1, take: 1 });
    expect(findManyArgs.include).toBeUndefined();
    expect(res.body.settlements[0]).toMatchObject({
      snapshotId: "run-a",
      payoutLineCount: 2,
      totalNetPayoutSatang: 19_400,
      stale: null,
    });
    expect(res.body.pagination).toEqual({ total: 3, page: 2, pageSize: 1, totalPages: 3 });
    expect(serviceMock.SettlementService.getRunFreshness).not.toHaveBeenCalled();
  });
});
