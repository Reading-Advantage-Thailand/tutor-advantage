import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettlementService } from "./settlementService";

const omiseMock = vi.hoisted(() => ({
  createOmiseTransfer: vi.fn(),
  retrieveOmiseTransfer: vi.fn(),
  isOmiseConfigured: vi.fn(),
}));

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
    findUnique: vi.fn(),
  },
  settlementRun: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  payoutLine: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  },
  payoutDocument: {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  tutorBadge: {
    findMany: vi.fn().mockResolvedValue([]), // default: no badges → no bonus
  },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
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

vi.mock("./omiseService", () => omiseMock);

describe("SettlementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("COMMISSION_BASE_RATE", "0.5");
    omiseMock.isOmiseConfigured.mockReturnValue(false);
    prismaMock.settlementRun.findFirst.mockResolvedValue(null);
    prismaMock.tutorBadge.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
        verificationStatus: "VERIFIED",
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
        netPayoutMinor: 0n,
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
        verificationStatus: "VERIFIED",
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

  it("rejects a concurrent preview for an active period", async () => {
    prismaMock.settlementRun.findFirst.mockResolvedValue({
      settlementRunId: "run-existing",
    });

    await expect(
      SettlementService.previewSettlement("2026-05", "admin-1"),
    ).rejects.toThrow("DRAFT_EXISTS");
    expect(prismaMock.paymentIntent.findMany).not.toHaveBeenCalled();
  });

  it("rejects a closed sponsor cycle even when the graph has no root", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([]);
    prismaMock.adjustment.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([
      {
        userId: "tutor-a",
        sponsorTutorId: "tutor-b",
        verificationStatus: "VERIFIED",
      },
      {
        userId: "tutor-b",
        sponsorTutorId: "tutor-a",
        verificationStatus: "VERIFIED",
      },
    ]);

    await expect(
      SettlementService.previewSettlement("2026-05", "admin-1"),
    ).rejects.toThrow("SPONSOR_TREE_CYCLE");
    expect(prismaMock.settlementRun.create).not.toHaveBeenCalled();
  });

  it("calculates a compressed tree and blocks unverified payouts", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([
      { enrollmentId: "en-child", amountMinor: 2_000_000n },
    ]);
    prismaMock.enrollment.findMany.mockResolvedValue([
      {
        enrollmentId: "en-child",
        class: { tutorUserId: "child" },
      },
    ]);
    prismaMock.adjustment.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([
      {
        userId: "root",
        sponsorTutorId: null,
        verificationStatus: "VERIFIED",
      },
      {
        userId: "child",
        sponsorTutorId: "root",
        verificationStatus: "VERIFIED",
      },
      {
        userId: "unverified",
        sponsorTutorId: null,
        verificationStatus: "UNVERIFIED",
      },
    ]);
    prismaMock.tutorBadge.findMany.mockResolvedValue([
      { tutorUserId: "child", badgeCode: "RISING_STAR" },
      { tutorUserId: "child", badgeCode: "UNKNOWN" },
    ]);
    prismaMock.settlementRun.create.mockResolvedValue({
      settlementRunId: "run-tree",
      periodMonth: "2026-05",
      status: "DRAFT",
    });
    prismaMock.payoutLine.create.mockResolvedValue({});

    const result = await SettlementService.previewSettlement(
      "2026-05",
      "admin-1",
    );

    expect(result.payoutLineCount).toBe(2);
    expect(prismaMock.payoutLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tutorUserId: "root",
        payoutAmountMinor: 0n,
        eligibilityStatus: "INELIGIBLE_NO_PV",
      }),
    });
    expect(prismaMock.payoutLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tutorUserId: "child",
        badgeBonusMinor: 5000n,
        eligibilityStatus: "ELIGIBLE_ADJUSTED",
      }),
    });
  });

  it("replaces payout lines when refreshing an active run", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([]);
    prismaMock.enrollment.findMany.mockResolvedValue([]);
    prismaMock.adjustment.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.settlementRun.update.mockResolvedValue({
      settlementRunId: "run-refresh",
      periodMonth: "2026-05",
      status: "SUBMITTED",
    });
    prismaMock.payoutLine.findMany.mockResolvedValue([
      { payoutLineId: "line-old" },
    ]);

    const result = await SettlementService.previewSettlement(
      "2026-05",
      "admin-1",
      { refreshRunId: "run-refresh" },
    );

    expect(result.snapshotId).toBe("run-refresh");
    expect(prismaMock.payoutDocument.deleteMany).toHaveBeenCalledWith({
      where: { payoutLineId: { in: ["line-old"] } },
    });
    expect(prismaMock.payoutLine.deleteMany).toHaveBeenCalledWith({
      where: { settlementRunId: "run-refresh" },
    });
  });

  it("refreshes draft runs and leaves final runs immutable", async () => {
    prismaMock.settlementRun.findUnique
      .mockResolvedValueOnce({
        settlementRunId: "run-final",
        periodMonth: "2026-05",
        status: "APPROVED",
      })
      .mockResolvedValueOnce(null);

    await expect(
      SettlementService.refreshSettlementRun("run-final"),
    ).resolves.toEqual({
      refreshed: false,
      status: "APPROVED",
      totalPayoutSatang: null,
      totalNetPayoutSatang: null,
      payoutLineCount: null,
    });
    await expect(
      SettlementService.refreshSettlementRun("missing"),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("approves a submitted run, creates documents, and marks transfers unsent", async () => {
    const payoutLines = [
      {
        payoutLineId: "line-positive",
        tutorUserId: "tutor-1",
        payoutAmountMinor: 10_000n,
        withholdingTaxMinor: 300n,
        netPayoutMinor: 9_700n,
      },
      {
        payoutLineId: "line-zero",
        tutorUserId: "tutor-2",
        payoutAmountMinor: 0n,
        withholdingTaxMinor: 0n,
        netPayoutMinor: 0n,
      },
    ];
    prismaMock.settlementRun.findUnique.mockResolvedValue({
      settlementRunId: "run-1",
      status: "SUBMITTED",
    });
    prismaMock.payoutLine.findMany.mockResolvedValue([payoutLines[0]]);
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        settlementRun: {
          update: vi.fn().mockResolvedValue({
            settlementRunId: "run-1",
            status: "APPROVED",
            payoutLines,
          }),
        },
        payoutDocument: {
          upsert: vi.fn().mockResolvedValue({
            payoutDocumentId: "doc-1",
            documentNumber: "DOC-1",
          }),
        },
      }),
    );

    const result = await SettlementService.approveSettlement(
      "run-1",
      "checker-1",
    );

    expect(result.status).toBe("APPROVED");
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(2);
    expect(omiseMock.createOmiseTransfer).not.toHaveBeenCalled();
  });

  it("validates approval status and Omise recipients before approval", async () => {
    prismaMock.settlementRun.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: "DRAFT" })
      .mockResolvedValueOnce({ status: "SUBMITTED" });

    await expect(
      SettlementService.approveSettlement("missing", "checker"),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      SettlementService.approveSettlement("draft", "checker"),
    ).rejects.toThrow("INVALID_STATUS");

    omiseMock.isOmiseConfigured.mockReturnValue(true);
    prismaMock.payoutLine.findMany.mockResolvedValue([
      { payoutLineId: "line-1", tutorUserId: "tutor-1" },
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      { userId: "tutor-1", settings: {} },
    ]);
    await expect(
      SettlementService.approveSettlement("run-1", "checker"),
    ).rejects.toThrow("MISSING_OMISE_RECIPIENT:tutor-1");
  });

  it("automatically sends configured transfers after approval", async () => {
    omiseMock.isOmiseConfigured.mockReturnValue(true);
    prismaMock.settlementRun.findUnique.mockResolvedValue({
      status: "SUBMITTED",
    });
    prismaMock.payoutLine.findMany.mockResolvedValue([
      { payoutLineId: "line-1", tutorUserId: "tutor-1" },
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      {
        userId: "tutor-1",
        settings: { omiseRecipientId: "recp_1" },
      },
    ]);
    const line = {
      payoutLineId: "line-1",
      tutorUserId: "tutor-1",
      payoutAmountMinor: 10_000n,
      withholdingTaxMinor: 300n,
      netPayoutMinor: 9_700n,
    };
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        settlementRun: {
          update: vi.fn().mockResolvedValue({
            status: "APPROVED",
            payoutLines: [line],
          }),
        },
        payoutDocument: {
          upsert: vi.fn().mockResolvedValue({
            payoutDocumentId: "doc-1",
            documentNumber: "DOC-1",
          }),
        },
      }),
    );
    omiseMock.createOmiseTransfer.mockResolvedValue({
      id: "trsf_1",
      sent: true,
      paid: false,
      sendable: true,
      sent_at: "2026-05-01T00:00:00.000Z",
    });

    await SettlementService.approveSettlement("run-1", "checker");

    expect(omiseMock.createOmiseTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 9700,
        recipient: "recp_1",
        failFast: true,
      }),
    );
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it.each([
    [false, "OMISE_PAYOUTS_NOT_CONFIGURED"],
  ])("blocks retries when payout configuration is invalid", async (
    configured,
    error,
  ) => {
    omiseMock.isOmiseConfigured.mockReturnValue(configured);
    await expect(
      SettlementService.retryPayoutTransfer("line-1"),
    ).rejects.toThrow(error);
  });

  it("retries a failed payout and returns the provider status", async () => {
    omiseMock.isOmiseConfigured.mockReturnValue(true);
    prismaMock.payoutLine.findUnique.mockResolvedValue({
      payoutLineId: "line-1",
      settlementRunId: "run-1",
      tutorUserId: "tutor-1",
      netPayoutMinor: 9_700n,
      settlementRun: { status: "APPROVED" },
      payoutDocument: {
        payoutDocumentId: "doc-1",
        documentNumber: "DOC-1",
        transferStatus: "TRANSFER_FAILED",
      },
    });
    prismaMock.user.findUnique.mockResolvedValue({
      settings: { omiseRecipientId: "recp_1" },
    });
    omiseMock.createOmiseTransfer.mockResolvedValue({
      id: "trsf_1",
      paid: true,
      sent: true,
      sendable: true,
      paid_at: "2026-05-01T00:00:00.000Z",
    });

    await expect(
      SettlementService.retryPayoutTransfer("line-1", "run-1"),
    ).resolves.toMatchObject({
      providerTransferId: "trsf_1",
      transferStatus: "PAID",
    });
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it("rejects retrying an active transfer", async () => {
    omiseMock.isOmiseConfigured.mockReturnValue(true);
    prismaMock.payoutLine.findUnique.mockResolvedValue({
      payoutLineId: "line-1",
      settlementRunId: "run-1",
      tutorUserId: "tutor-1",
      netPayoutMinor: 9_700n,
      settlementRun: { status: "APPROVED" },
      payoutDocument: {
        transferStatus: "SENT",
      },
    });

    await expect(
      SettlementService.retryPayoutTransfer("line-1"),
    ).rejects.toThrow("TRANSFER_ALREADY_ACTIVE");
  });

  it("returns without syncing when no provider transfer exists", async () => {
    prismaMock.payoutLine.findUnique.mockResolvedValue({
      payoutLineId: "line-1",
      tutorUserId: "tutor-1",
      payoutDocument: {
        providerTransferId: null,
        transferStatus: "NOT_SENT",
        transferredAt: null,
      },
    });

    await expect(
      SettlementService.syncPayoutTransferStatus("line-1"),
    ).resolves.toEqual({
      payoutLineId: "line-1",
      tutorUserId: "tutor-1",
      transferStatus: "NOT_SENT",
      transferredAt: null,
      synced: false,
    });
  });

  it("syncs a paid transfer from Omise", async () => {
    omiseMock.isOmiseConfigured.mockReturnValue(true);
    prismaMock.payoutLine.findUnique.mockResolvedValue({
      payoutLineId: "line-1",
      tutorUserId: "tutor-1",
      payoutDocument: {
        providerTransferId: "trsf_1",
      },
    });
    omiseMock.retrieveOmiseTransfer.mockResolvedValue({
      id: "trsf_1",
      paid: true,
      sent: true,
      sendable: true,
      paid_at: "2026-05-01T00:00:00.000Z",
    });

    await expect(
      SettlementService.syncPayoutTransferStatus("line-1"),
    ).resolves.toMatchObject({
      transferStatus: "PAID",
      transferredAt: "2026-05-01T00:00:00.000Z",
      synced: true,
    });
    expect(prismaMock.$executeRaw).toHaveBeenCalledOnce();
  });
});
