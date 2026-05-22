import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveAdjustment,
  createAdjustment,
  rejectAdjustment,
} from "./adjustmentController";

const prismaMock = vi.hoisted(() => ({
  settlementRun: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  adjustment: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
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
  });

  it("allows finance makers to create integer-satang adjustments", async () => {
    prismaMock.settlementRun.findFirst.mockResolvedValue({
      settlementRunId: "run-1",
    });
    prismaMock.adjustment.create.mockResolvedValue({
      adjustmentId: "adj-1",
    });
    prismaMock.auditEvent.create.mockResolvedValue({});

    const req = {
      id: "req-1",
      user: { userId: "maker-1", role: "FINANCE_MAKER" },
      body: {
        tutorUserId: "tutor-1",
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
});
