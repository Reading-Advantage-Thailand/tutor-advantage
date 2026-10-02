import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveAdjustment,
  createAdjustment,
  rejectAdjustment,
} from "./adjustmentController";

const TUTOR_ID = "5eed0000-0000-4000-8000-000000000104";

const settlementServiceMock = vi.hoisted(() => ({
  refreshSettlementRun: vi.fn(),
}));

vi.mock("../services/settlementService", () => ({
  SettlementService: settlementServiceMock,
}));

const prismaMock = vi.hoisted(() => ({
  settlementRun: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  adjustment: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  auditEvent: {
    create: vi.fn(),
  },
}));

vi.mock("@tutor-advantage/database", () => ({
  prisma: prismaMock,
}));

function createResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
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

describe("adjustmentController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({ userId: TUTOR_ID, role: "TUTOR" });
    prismaMock.settlementRun.findUnique.mockResolvedValue(null);
    settlementServiceMock.refreshSettlementRun.mockResolvedValue({ refreshed: true, status: "DRAFT" });
  });

  it("allows finance makers to create integer-satang adjustments", async () => {
    prismaMock.settlementRun.findFirst.mockResolvedValue({
      settlementRunId: "run-1",
      status: "DRAFT",
    });
    prismaMock.adjustment.create.mockResolvedValue({
      adjustmentId: "adj-1",
    });
    prismaMock.auditEvent.create.mockResolvedValue({});

    const req = {
      id: "req-1",
      user: { userId: "maker-1", role: "FINANCE_MAKER" },
      body: {
        tutorUserId: TUTOR_ID,
        periodMonth: "2026-05",
        amountSatang: "-250000",
        reason: "chargeback:pi-1",
      },
    } as any;
    const res = createResponse() as any;

    await createAdjustment(req, res);

    expect(res.statusCode).toBe(201);
    expect(prismaMock.adjustment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountMinor: -250000n,
        createdBy: "maker-1",
      }),
    });
  });

  it("does not append adjustments to a submitted settlement", async () => {
    prismaMock.settlementRun.findFirst.mockResolvedValue({
      settlementRunId: "run-submitted",
      status: "SUBMITTED",
    });

    const req = {
      id: "req-2",
      user: { userId: "maker-1", role: "FINANCE_MAKER" },
      body: {
        tutorUserId: TUTOR_ID,
        periodMonth: "2026-05",
        amountSatang: 1000,
        reason: "manual correction",
      },
    } as any;
    const res = createResponse() as any;

    await createAdjustment(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      error: { code: "SETTLEMENT_IMMUTABLE" },
    });
    expect(prismaMock.adjustment.create).not.toHaveBeenCalled();
  });

  it("rejects non-checkers approving adjustments", async () => {
    const req = {
      id: "req-1",
      user: { userId: "maker-1", role: "FINANCE_MAKER" },
      params: { adjustmentId: "adj-1" },
    } as any;
    const res = createResponse() as any;

    await approveAdjustment(req, res);

    expect(res.statusCode).toBe(403);
    expect(prismaMock.adjustment.findUnique).not.toHaveBeenCalled();
  });

  it("blocks adjustment creators from approving their own records", async () => {
    prismaMock.adjustment.findUnique.mockResolvedValue({
      adjustmentId: "adj-1",
      createdBy: "checker-1",
      amountMinor: 1000n,
    });

    const req = {
      id: "req-1",
      user: { userId: "checker-1", role: "FINANCE_CHECKER" },
      params: { adjustmentId: "adj-1" },
    } as any;
    const res = createResponse() as any;

    await approveAdjustment(req, res);

    expect(res.statusCode).toBe(403);
    expect(prismaMock.adjustment.update).not.toHaveBeenCalled();
  });

  it("blocks adjustment creators from rejecting their own records", async () => {
    prismaMock.adjustment.findUnique.mockResolvedValue({
      adjustmentId: "adj-1",
      createdBy: "checker-1",
      amountMinor: 1000n,
    });

    const req = {
      id: "req-1",
      user: { userId: "checker-1", role: "FINANCE_CHECKER" },
      params: { adjustmentId: "adj-1" },
    } as any;
    const res = createResponse() as any;

    await rejectAdjustment(req, res);

    expect(res.statusCode).toBe(403);
    expect(prismaMock.adjustment.update).not.toHaveBeenCalled();
  });

  it("does not approve a rejected adjustment", async () => {
    prismaMock.adjustment.findUnique.mockResolvedValue({
      adjustmentId: "adj-1",
      createdBy: "maker-1",
      status: "REJECTED",
      amountMinor: 1000n,
      settlementRunId: "run-1",
    });
    prismaMock.adjustment.updateMany.mockResolvedValue({ count: 0 });

    const req = {
      id: "req-1",
      user: { userId: "checker-1", role: "FINANCE_CHECKER" },
      params: { adjustmentId: "adj-1" },
    } as any;
    const res = createResponse() as any;

    await approveAdjustment(req, res);

    expect(res.statusCode).toBe(409);
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
  });

  it("does not reject an approved adjustment", async () => {
    prismaMock.adjustment.findUnique.mockResolvedValue({
      adjustmentId: "adj-1",
      createdBy: "maker-1",
      status: "APPROVED",
      amountMinor: 1000n,
      settlementRunId: "run-1",
    });
    prismaMock.adjustment.updateMany.mockResolvedValue({ count: 0 });

    const req = {
      id: "req-1",
      user: { userId: "checker-1", role: "FINANCE_CHECKER" },
      params: { adjustmentId: "adj-1" },
    } as any;
    const res = createResponse() as any;

    await rejectAdjustment(req, res);

    expect(res.statusCode).toBe(409);
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
  });

  function makerRequest(body: Record<string, unknown>) {
    return {
      id: "req-v",
      user: { userId: "maker-1", role: "ADMIN" },
      body: {
        tutorUserId: TUTOR_ID,
        periodMonth: "2026-09",
        amountSatang: 30000,
        reason: "manual correction",
        ...body,
      },
    } as any;
  }

  it("returns 400 INVALID_TUTOR_ID for a malformed tutor id instead of a 500", async () => {
    const res = createResponse() as any;
    await createAdjustment(makerRequest({ tutorUserId: "usr_garbage" }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { code: "INVALID_TUTOR_ID" } });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.adjustment.create).not.toHaveBeenCalled();
  });

  it("returns 404 TUTOR_NOT_FOUND for an unknown or non-tutor user", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    const res1 = createResponse() as any;
    await createAdjustment(makerRequest({}), res1);
    expect(res1.statusCode).toBe(404);
    expect(res1.body).toMatchObject({ error: { code: "TUTOR_NOT_FOUND" } });

    prismaMock.user.findUnique.mockResolvedValueOnce({ userId: TUTOR_ID, role: "STUDENT" });
    const res2 = createResponse() as any;
    await createAdjustment(makerRequest({}), res2);
    expect(res2.statusCode).toBe(404);
    expect(prismaMock.adjustment.create).not.toHaveBeenCalled();
  });

  it("rejects a blank reason and an invalid period", async () => {
    const res1 = createResponse() as any;
    await createAdjustment(makerRequest({ reason: "   " }), res1);
    expect(res1.statusCode).toBe(400);

    const res2 = createResponse() as any;
    await createAdjustment(makerRequest({ periodMonth: "2026-13" }), res2);
    expect(res2.statusCode).toBe(400);
    expect(res2.body).toMatchObject({ error: { code: "INVALID_PERIOD_MONTH" } });
  });

  it("creates an ADJUSTMENT_PENDING holder (not an empty DRAFT) when the period has no run", async () => {
    prismaMock.settlementRun.findFirst.mockResolvedValue(null);
    prismaMock.settlementRun.create.mockResolvedValue({
      settlementRunId: "run-holder",
      status: "ADJUSTMENT_PENDING",
    });
    prismaMock.adjustment.create.mockResolvedValue({ adjustmentId: "adj-holder" });

    const res = createResponse() as any;
    await createAdjustment(makerRequest({}), res);

    expect(res.statusCode).toBe(201);
    expect(prismaMock.settlementRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ periodMonth: "2026-09", status: "ADJUSTMENT_PENDING" }),
    });
    expect(prismaMock.settlementRun.create).not.toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "DRAFT" }),
    });
    expect(res.body).toMatchObject({ settlementRunStatus: "ADJUSTMENT_PENDING" });
  });

  function checkerApprove() {
    return {
      id: "req-a",
      user: { userId: "checker-1", role: "FINANCE_CHECKER" },
      params: { adjustmentId: "adj-1" },
      body: {},
    } as any;
  }

  function pendingAdjustment() {
    prismaMock.adjustment.findUnique.mockResolvedValue({
      adjustmentId: "adj-1",
      createdBy: "maker-1",
      status: "PENDING",
      amountMinor: 30000n,
      settlementRunId: "run-1",
    });
    prismaMock.adjustment.updateMany.mockResolvedValue({ count: 1 });
  }

  it("approving on a SUBMITTED run does not touch its lines and reports it stale", async () => {
    pendingAdjustment();
    prismaMock.settlementRun.findUnique.mockResolvedValue({
      settlementRunId: "run-1",
      periodMonth: "2026-08",
      status: "SUBMITTED",
      previewPayload: { paymentCount: 2 },
    });

    const res = createResponse() as any;
    await approveAdjustment(checkerApprove(), res);

    expect(res.statusCode).toBe(200);
    expect(settlementServiceMock.refreshSettlementRun).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ settlementRefresh: { refreshed: false, stale: true } });
  });

  it("refuses to approve an adjustment whose run is already approved", async () => {
    pendingAdjustment();
    prismaMock.settlementRun.findUnique.mockResolvedValue({ status: "APPROVED" });

    const res = createResponse() as any;
    await approveAdjustment(checkerApprove(), res);

    expect(res.statusCode).toBe(409);
    expect(prismaMock.adjustment.updateMany).not.toHaveBeenCalled();
  });

  it("recalculates a calculated DRAFT but leaves an adjustment holder alone", async () => {
    pendingAdjustment();
    prismaMock.settlementRun.findUnique.mockResolvedValue({
      settlementRunId: "run-1",
      periodMonth: "2026-08",
      status: "DRAFT",
      previewPayload: { paymentCount: 2, previewedAt: "2026-09-01T00:00:00.000Z" },
    });
    const res1 = createResponse() as any;
    await approveAdjustment(checkerApprove(), res1);
    expect(res1.statusCode).toBe(200);
    expect(settlementServiceMock.refreshSettlementRun).toHaveBeenCalledWith("run-1", { actorId: "checker-1" });

    settlementServiceMock.refreshSettlementRun.mockClear();
    pendingAdjustment();
    prismaMock.settlementRun.findUnique.mockResolvedValue({
      settlementRunId: "run-1",
      periodMonth: "2026-09",
      status: "ADJUSTMENT_PENDING",
      previewPayload: {},
    });
    const res2 = createResponse() as any;
    await approveAdjustment(checkerApprove(), res2);
    expect(res2.statusCode).toBe(200);
    expect(settlementServiceMock.refreshSettlementRun).not.toHaveBeenCalled();
  });
});
