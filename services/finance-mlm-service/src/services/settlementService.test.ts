import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettlementService } from "./settlementService";

const prismaMock = vi.hoisted(() => ({
  paymentIntent: {
    findMany: vi.fn(),
  },
  enrollment: {
    findMany: vi.fn(),
  },
  adjustment: {
    findMany: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  settlementRun: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  payoutLine: {
    create: vi.fn(),
  },
  payoutDocument: {
    upsert: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@tutor-advantage/database", () => ({
  prisma: prismaMock,
  Prisma: {
    Decimal: class Decimal {
      private val: number;
      constructor(value: number | string) {
        this.val = Number(value);
      }
      toNumber() { return this.val; }
      toString() { return String(this.val); }
    },
  },
}));

describe("SettlementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("COMMISSION_BASE_RATE", "0.5");
  });

  it("includes approved clawback adjustments in payout lines without negative WHT", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([]);
    prismaMock.enrollment.findMany.mockResolvedValue([]);
    prismaMock.adjustment.findMany.mockResolvedValue([
      {
        adjustmentId: "adj-1",
        tutorUserId: "tutor-1",
        amountMinor: -250000n,
        reason: "chargeback:pi-1",
      },
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      {
        userId: "tutor-1",
        sponsorTutorId: null,
      },
    ]);
    prismaMock.settlementRun.create.mockResolvedValue({
      settlementRunId: "run-1",
      periodMonth: "2026-05",
      status: "DRAFT",
    });
    prismaMock.payoutLine.create.mockResolvedValue({});

    const result = await SettlementService.previewSettlement(
      "2026-05",
      "admin-1",
    );

    expect(result).toMatchObject({
      snapshotId: "run-1",
      totalPayoutSatang: -250000,
    });
    expect(prismaMock.adjustment.findMany).toHaveBeenCalledWith({
      where: {
        status: "APPROVED",
        settlementRun: {
          periodMonth: "2026-05",
        },
      },
      select: {
        adjustmentId: true,
        tutorUserId: true,
        amountMinor: true,
        reason: true,
      },
    });
    expect(prismaMock.payoutLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tutorUserId: "tutor-1",
        payoutAmountMinor: -250000n,
        withholdingTaxMinor: 0n,
        netPayoutMinor: -250000n,
        eligibilityStatus: "ELIGIBLE_BASE_ADJUSTED",
      }),
    });
  });

  it("adds approved positive adjustments before withholding tax", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([]);
    prismaMock.enrollment.findMany.mockResolvedValue([]);
    prismaMock.adjustment.findMany.mockResolvedValue([
      {
        adjustmentId: "adj-1",
        tutorUserId: "tutor-1",
        amountMinor: 10000n,
        reason: "manual_bonus",
      },
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      {
        userId: "tutor-1",
        sponsorTutorId: null,
      },
    ]);
    prismaMock.settlementRun.create.mockResolvedValue({
      settlementRunId: "run-1",
      periodMonth: "2026-05",
      status: "DRAFT",
    });
    prismaMock.payoutLine.create.mockResolvedValue({});

    const result = await SettlementService.previewSettlement(
      "2026-05",
      "admin-1",
    );

    expect(result.totalPayoutSatang).toBe(10000);
    expect(prismaMock.payoutLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payoutAmountMinor: 10000n,
        withholdingTaxMinor: 300n,
        netPayoutMinor: 9700n,
      }),
    });
  });
});
