import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SettlementService,
  SettlementStaleError,
  fingerprintPayoutLines,
  isDevMakerCheckerOverrideEnabled,
} from "./settlementService";

const omiseMock = vi.hoisted(() => ({
  createOmiseTransfer: vi.fn(),
  listOmiseTransfers: vi.fn(),
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
    updateMany: vi.fn(),
  },
  payoutLine: {
    create: vi.fn(),
    createMany: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  },
  payoutDocument: {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
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

/** All payout lines written via payoutLine.createMany in this test. */
function createdLines() {
  return prismaMock.payoutLine.createMany.mock.calls.flatMap(
    (call) => (call[0] as { data: unknown[] }).data,
  );
}

describe("SettlementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("COMMISSION_BASE_RATE", "0.5");
    omiseMock.isOmiseConfigured.mockReturnValue(false);
    omiseMock.listOmiseTransfers.mockResolvedValue([]);
    prismaMock.settlementRun.findFirst.mockResolvedValue(null);
    prismaMock.tutorBadge.findMany.mockResolvedValue([]);
    prismaMock.payoutDocument.updateMany.mockResolvedValue({ count: 1 });
    // Preview persists inside prisma.$transaction; by default run the callback
    // against the same mock client (tests that need a separate tx override it).
    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback(prismaMock),
    );
    prismaMock.settlementRun.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.payoutLine.createMany.mockResolvedValue({ count: 0 });
    // Approval tests below exercise the transfer/identity logic; the freshness
    // gate has its own tests at the end of this file.
    vi.spyOn(SettlementService, "assertRunReadyForReview").mockResolvedValue({
      previewed: true,
      lineCount: 1,
      stale: false,
      reasons: [],
      changedTutorUserIds: [],
      checkedAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
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
        volumeMinor: true,
        reason: true,
      },
    });
    expect(createdLines()).toContainEqual(expect.objectContaining({
        tutorUserId: "tutor-1",
        payoutAmountMinor: -250000n,
        withholdingTaxMinor: 0n,
        netPayoutMinor: 0n,
        eligibilityStatus: "ELIGIBLE_BASE_ADJUSTED",
      }));
  });

  it("removes refunded payment volume before calculating MLM payouts", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([
      {
        paymentIntentId: "pi-refunded",
        enrollmentId: "en-refunded",
        amountMinor: 100_000n,
        status: "SUCCESS",
        paidAt: new Date("2026-05-10T00:00:00.000Z"),
        events: [],
      },
    ]);
    prismaMock.enrollment.findMany.mockResolvedValue([
      { enrollmentId: "en-refunded", class: { tutorUserId: "tutor-1" } },
    ]);
    prismaMock.adjustment.findMany.mockResolvedValue([
      {
        adjustmentId: "adj-refund",
        tutorUserId: "tutor-1",
        amountMinor: -2_500n,
        volumeMinor: -100_000n,
        reason: "refund:pi-refunded",
      },
    ]);
    prismaMock.user.findMany.mockResolvedValue([{
      userId: "tutor-1",
      sponsorTutorId: null,
      verificationStatus: "VERIFIED",
      payoutIdentityVersion: 0,
      settings: { omiseRecipientId: "recp_1" },
    }]);
    prismaMock.settlementRun.create.mockResolvedValue({
      settlementRunId: "run-refund",
      periodMonth: "2026-05",
      status: "DRAFT",
    });
    prismaMock.payoutLine.create.mockResolvedValue({});

    await SettlementService.previewSettlement("2026-05", "admin-1");

    expect(createdLines()).toContainEqual(expect.objectContaining({
        tutorUserId: "tutor-1",
        grossVolumeMinor: 0n,
        payoutAmountMinor: -2_500n,
      }));
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
    expect(createdLines()).toContainEqual(expect.objectContaining({
        payoutAmountMinor: 10000n,
        withholdingTaxMinor: 300n,
        netPayoutMinor: 9700n,
      }));
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

  it("isolates a closed sponsor cycle instead of stopping the whole settlement", async () => {
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
    prismaMock.settlementRun.create.mockResolvedValue({
      settlementRunId: "run-cycle",
      periodMonth: "2026-05",
      status: "DRAFT",
    });

    await expect(
      SettlementService.previewSettlement("2026-05", "admin-1"),
    ).resolves.toMatchObject({ snapshotId: "run-cycle" });
    expect(createdLines()).toHaveLength(0);
  });

  it("does not recreate an approved settlement period", async () => {
    prismaMock.settlementRun.findFirst.mockResolvedValue({
      settlementRunId: "run-approved",
      status: "APPROVED",
    });

    await expect(
      SettlementService.previewSettlement("2026-05", "admin-1"),
    ).rejects.toThrow("DRAFT_EXISTS");
  });

  it("still creates payouts for healthy sponsor components beside a cycle", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([
      { enrollmentId: "en-healthy", amountMinor: 100_000n },
    ]);
    prismaMock.enrollment.findMany.mockResolvedValue([
      { enrollmentId: "en-healthy", class: { tutorUserId: "healthy-root" } },
    ]);
    prismaMock.adjustment.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([
      { userId: "cycle-a", sponsorTutorId: "cycle-b", verificationStatus: "VERIFIED" },
      { userId: "cycle-b", sponsorTutorId: "cycle-a", verificationStatus: "VERIFIED" },
      { userId: "healthy-root", sponsorTutorId: null, verificationStatus: "VERIFIED" },
    ]);
    prismaMock.settlementRun.create.mockResolvedValue({
      settlementRunId: "run-mixed",
      periodMonth: "2026-05",
      status: "DRAFT",
    });
    prismaMock.payoutLine.create.mockResolvedValue({});

    await expect(
      SettlementService.previewSettlement("2026-05", "admin-1"),
    ).resolves.toMatchObject({ snapshotId: "run-mixed", payoutLineCount: 1 });
    expect(createdLines()).toContainEqual(expect.objectContaining({
        tutorUserId: "healthy-root",
        eligibilityStatus: "ELIGIBLE",
      }));
  });

  it("compresses an active tutor around an inactive sponsor instead of dropping the subtree", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([
      { enrollmentId: "en-child", amountMinor: 100_000n },
    ]);
    prismaMock.enrollment.findMany.mockResolvedValue([
      { enrollmentId: "en-child", class: { tutorUserId: "child" } },
    ]);
    prismaMock.adjustment.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([
      {
        userId: "inactive-sponsor",
        sponsorTutorId: null,
        isActive: false,
        verificationStatus: "VERIFIED",
      },
      {
        userId: "child",
        sponsorTutorId: "inactive-sponsor",
        isActive: true,
        verificationStatus: "VERIFIED",
      },
    ]);
    prismaMock.settlementRun.create.mockResolvedValue({
      settlementRunId: "run-compressed",
      periodMonth: "2026-05",
      status: "DRAFT",
    });
    prismaMock.payoutLine.create.mockResolvedValue({});

    await expect(
      SettlementService.previewSettlement("2026-05", "admin-1"),
    ).resolves.toMatchObject({ snapshotId: "run-compressed", payoutLineCount: 1 });
    expect(createdLines()).toContainEqual(expect.objectContaining({ tutorUserId: "child", grossVolumeMinor: 100_000n }));
  });

  it("keeps historical payment volume with the tutor who owned the class at payment time", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([
      {
        enrollmentId: "en-transfer",
        earningTutorUserId: "original-tutor",
        amountMinor: 100_000n,
      },
    ]);
    prismaMock.enrollment.findMany.mockResolvedValue([
      { enrollmentId: "en-transfer", class: { tutorUserId: "new-tutor" } },
    ]);
    prismaMock.adjustment.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([
      { userId: "original-tutor", sponsorTutorId: null, verificationStatus: "VERIFIED" },
      { userId: "new-tutor", sponsorTutorId: null, verificationStatus: "VERIFIED" },
    ]);
    prismaMock.settlementRun.create.mockResolvedValue({
      settlementRunId: "run-transfer",
      periodMonth: "2026-05",
      status: "DRAFT",
    });
    prismaMock.payoutLine.create.mockResolvedValue({});

    await SettlementService.previewSettlement("2026-05", "admin-1");

    expect(createdLines()).toContainEqual(expect.objectContaining({ tutorUserId: "original-tutor", grossVolumeMinor: 100_000n }));
    expect(createdLines()).not.toContainEqual(expect.objectContaining({ tutorUserId: "new-tutor", grossVolumeMinor: 100_000n }));
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
    expect(createdLines()).toContainEqual(expect.objectContaining({
        tutorUserId: "root",
        payoutAmountMinor: 0n,
        eligibilityStatus: "INELIGIBLE_NO_PV",
      }));
    expect(createdLines()).toContainEqual(expect.objectContaining({
        tutorUserId: "child",
        badgeBonusMinor: 0n,
        eligibilityStatus: "ELIGIBLE",
      }));
  });

  it("selects successful payment volume by paidAt instead of updatedAt", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([]);
    prismaMock.enrollment.findMany.mockResolvedValue([]);
    prismaMock.adjustment.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.settlementRun.create.mockResolvedValue({
      settlementRunId: "run-paid-at",
      periodMonth: "2026-05",
      status: "DRAFT",
    });

    await SettlementService.previewSettlement("2026-05", "admin-1");

    const paymentQuery = prismaMock.paymentIntent.findMany.mock.calls[0][0];
    expect(paymentQuery.where).toEqual({
      status: "SUCCESS",
      paidAt: {
        gte: expect.any(Date),
        lte: expect.any(Date),
      },
    });
    expect(paymentQuery.where.updatedAt).toBeUndefined();
  });

  it("replaces payout lines when refreshing an active run", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([]);
    prismaMock.enrollment.findMany.mockResolvedValue([]);
    prismaMock.adjustment.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.settlementRun.findUnique.mockResolvedValue({
      settlementRunId: "run-refresh",
      periodMonth: "2026-05",
      status: "DRAFT",
    });
    prismaMock.settlementRun.update.mockResolvedValue({
      settlementRunId: "run-refresh",
      periodMonth: "2026-05",
      status: "DRAFT",
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

  it("does not refresh a submitted run", async () => {
    prismaMock.settlementRun.findUnique.mockResolvedValue({
      settlementRunId: "run-submitted",
      periodMonth: "2026-05",
      status: "SUBMITTED",
    });

    await expect(
      SettlementService.refreshSettlementRun("run-submitted"),
    ).resolves.toMatchObject({ refreshed: false, status: "SUBMITTED" });
    expect(prismaMock.settlementRun.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.payoutLine.deleteMany).not.toHaveBeenCalled();
  });

  it("approves a submitted run, creates documents, and marks transfers unsent", async () => {
    const payoutLines = [
      {
        payoutLineId: "line-positive",
        tutorUserId: "tutor-1",
        payoutIdentityVersion: 0,
        recipientSnapshot: "recp_1",
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
    prismaMock.user.findMany.mockResolvedValue([{
      userId: "tutor-1",
      isActive: true,
      verificationStatus: "VERIFIED",
      payoutIdentityVersion: 0,
      settings: { omiseRecipientId: "recp_1" },
    }]);
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        settlementRun: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue({
            settlementRunId: "run-1",
            status: "APPROVING",
            payoutLines,
          }),
          update: vi.fn(),
        },
        payoutDocument: {
          upsert: vi.fn().mockResolvedValue({
            payoutDocumentId: "doc-1",
            documentNumber: "DOC-1",
          }),
        },
        user: {
          findMany: vi.fn().mockResolvedValue([{
            userId: "tutor-1",
            isActive: true,
            verificationStatus: "VERIFIED",
            payoutIdentityVersion: 0,
            settings: { omiseRecipientId: "recp_1" },
          }]),
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
      {
        payoutLineId: "line-1",
        tutorUserId: "tutor-1",
        payoutIdentityVersion: 0,
        recipientSnapshot: null,
      },
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      {
        userId: "tutor-1",
        isActive: true,
        verificationStatus: "VERIFIED",
        payoutIdentityVersion: 0,
        settings: {},
      },
    ]);
    await expect(
      SettlementService.approveSettlement("run-1", "checker"),
    ).rejects.toThrow("PAYOUT_IDENTITY_SNAPSHOT_MISSING:tutor-1");
  });

  it("rejects approval when the reviewed payout identity has changed", async () => {
    prismaMock.settlementRun.findUnique.mockResolvedValue({ status: "SUBMITTED" });
    prismaMock.payoutLine.findMany.mockResolvedValue([{
      payoutLineId: "line-identity",
      tutorUserId: "tutor-1",
      payoutIdentityVersion: 0,
      recipientSnapshot: "recp_1",
    }]);
    prismaMock.user.findMany.mockResolvedValue([{
      userId: "tutor-1",
      isActive: true,
      verificationStatus: "VERIFIED",
      payoutIdentityVersion: 1,
      settings: { omiseRecipientId: "recp_1" },
    }]);

    await expect(
      SettlementService.approveSettlement("run-identity", "checker"),
    ).rejects.toThrow("PAYOUT_IDENTITY_CHANGED:tutor-1");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("automatically sends configured transfers after approval", async () => {
    omiseMock.isOmiseConfigured.mockReturnValue(true);
    prismaMock.settlementRun.findUnique.mockResolvedValue({
      status: "SUBMITTED",
    });
    prismaMock.payoutLine.findMany.mockResolvedValue([
      {
        payoutLineId: "line-1",
        tutorUserId: "tutor-1",
        payoutIdentityVersion: 0,
        recipientSnapshot: "recp_1",
      },
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      {
        userId: "tutor-1",
        isActive: true,
        verificationStatus: "VERIFIED",
        payoutIdentityVersion: 0,
        settings: { omiseRecipientId: "recp_1" },
      },
    ]);
    const line = {
      payoutLineId: "line-1",
      tutorUserId: "tutor-1",
      payoutIdentityVersion: 0,
      recipientSnapshot: "recp_1",
      payoutAmountMinor: 10_000n,
      withholdingTaxMinor: 300n,
      netPayoutMinor: 9_700n,
    };
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        settlementRun: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue({
            status: "APPROVING",
            payoutLines: [line],
          }),
          update: vi.fn(),
        },
        payoutDocument: {
          upsert: vi.fn().mockResolvedValue({
            payoutDocumentId: "doc-1",
            documentNumber: "DOC-1",
          }),
        },
        user: {
          findMany: vi.fn().mockResolvedValue([{
            userId: "tutor-1",
            isActive: true,
            verificationStatus: "VERIFIED",
            payoutIdentityVersion: 0,
            settings: { omiseRecipientId: "recp_1" },
          }]),
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
    expect(omiseMock.createOmiseTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "omise:payout-line:line-1",
      }),
    );
  });

  it("claims a settlement once when approvals race", async () => {
    omiseMock.isOmiseConfigured.mockReturnValue(true);
    prismaMock.settlementRun.findUnique.mockResolvedValue({
      settlementRunId: "run-race",
      status: "SUBMITTED",
    });
    prismaMock.payoutLine.findMany.mockResolvedValue([
      {
        payoutLineId: "line-race",
        tutorUserId: "tutor-1",
        payoutIdentityVersion: 0,
        recipientSnapshot: "recp_1",
      },
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      {
        userId: "tutor-1",
        isActive: true,
        verificationStatus: "VERIFIED",
        payoutIdentityVersion: 0,
        settings: { omiseRecipientId: "recp_1" },
      },
    ]);

    let transactionAttempt = 0;
    prismaMock.$transaction.mockImplementation(async (callback) => {
      transactionAttempt += 1;
      const line = {
        payoutLineId: "line-race",
        tutorUserId: "tutor-1",
        payoutIdentityVersion: 0,
        recipientSnapshot: "recp_1",
        payoutAmountMinor: 10_000n,
        withholdingTaxMinor: 300n,
        netPayoutMinor: 9_700n,
      };
      return callback({
        settlementRun: {
          updateMany: vi.fn().mockResolvedValue({
            count: transactionAttempt === 1 ? 1 : 0,
          }),
          findUnique: vi.fn().mockResolvedValue({
            settlementRunId: "run-race",
            status: "APPROVING",
            payoutLines: [line],
          }),
        },
        payoutDocument: {
          upsert: vi.fn().mockResolvedValue({
            payoutDocumentId: "doc-race",
            documentNumber: "DOC-RACE",
          }),
        },
        user: {
          findMany: vi.fn().mockResolvedValue([{
            userId: "tutor-1",
            isActive: true,
            verificationStatus: "VERIFIED",
            payoutIdentityVersion: 0,
            settings: { omiseRecipientId: "recp_1" },
          }]),
        },
      } as never);
    });
    omiseMock.createOmiseTransfer.mockResolvedValue({
      id: "trsf-race",
      paid: false,
      sent: true,
      sendable: true,
    });

    const results = await Promise.allSettled([
      SettlementService.approveSettlement("run-race", "checker-1"),
      SettlementService.approveSettlement("run-race", "checker-2"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(String((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason))
      .toContain("SETTLEMENT_ALREADY_CLAIMED");
    expect(omiseMock.createOmiseTransfer).toHaveBeenCalledOnce();
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
      payoutIdentityVersion: 0,
      recipientSnapshot: "recp_1",
      netPayoutMinor: 9_700n,
      settlementRun: { status: "APPROVED" },
      payoutDocument: {
        payoutDocumentId: "doc-1",
        documentNumber: "DOC-1",
        transferStatus: "TRANSFER_FAILED",
      },
    });
    prismaMock.user.findUnique.mockResolvedValue({
      isActive: true,
      verificationStatus: "VERIFIED",
      payoutIdentityVersion: 0,
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
    expect(prismaMock.$executeRaw).toHaveBeenCalledOnce();
    expect(omiseMock.createOmiseTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "omise:payout-line:line-1",
      }),
    );
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

  it("allows only one concurrent retry to claim a payout line", async () => {
    omiseMock.isOmiseConfigured.mockReturnValue(true);
    prismaMock.payoutLine.findUnique.mockResolvedValue({
      payoutLineId: "line-race",
      settlementRunId: "run-1",
      tutorUserId: "tutor-1",
      payoutIdentityVersion: 0,
      recipientSnapshot: "recp_1",
      netPayoutMinor: 9_700n,
      settlementRun: { status: "APPROVED" },
      payoutDocument: {
        payoutDocumentId: "doc-1",
        documentNumber: "DOC-1",
        transferStatus: "TRANSFER_FAILED",
      },
    });
    prismaMock.user.findUnique.mockResolvedValue({
      isActive: true,
      verificationStatus: "VERIFIED",
      payoutIdentityVersion: 0,
      settings: { omiseRecipientId: "recp_1" },
    });
    prismaMock.payoutDocument.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    omiseMock.createOmiseTransfer.mockResolvedValue({
      id: "trsf_race",
      paid: false,
      sent: true,
      sendable: true,
    });

    const results = await Promise.allSettled([
      SettlementService.retryPayoutTransfer("line-race"),
      SettlementService.retryPayoutTransfer("line-race"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(String((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason))
      .toContain("TRANSFER_ALREADY_ACTIVE");
    expect(omiseMock.createOmiseTransfer).toHaveBeenCalledOnce();
  });

  it("recovers an uncertain transfer from Omise before refusing a duplicate", async () => {
    omiseMock.isOmiseConfigured.mockReturnValue(true);
    prismaMock.payoutLine.findUnique.mockResolvedValue({
      payoutLineId: "line-uncertain",
      settlementRunId: "run-1",
      tutorUserId: "tutor-1",
      netPayoutMinor: 9_700n,
      settlementRun: { status: "APPROVED" },
      payoutDocument: {
        payoutDocumentId: "doc-1",
        documentNumber: "DOC-1",
        providerTransferId: null,
        transferStatus: "PENDING_TRANSFER",
      },
    });
    omiseMock.listOmiseTransfers.mockResolvedValue([
      {
        id: "trsf_recovered",
        paid: true,
        sent: true,
        sendable: true,
        metadata: { payoutLineId: "line-uncertain" },
      },
    ]);

    await expect(
      SettlementService.retryPayoutTransfer("line-uncertain"),
    ).rejects.toThrow("TRANSFER_ALREADY_ACTIVE");
    expect(omiseMock.createOmiseTransfer).not.toHaveBeenCalled();
    expect(prismaMock.$executeRaw).toHaveBeenCalledOnce();
  });

  // ── F-2 / F-3 / transactional preview (admin G2) ──────────────────────────

  function oneTutorWithBonus(adjustments: Array<{ adjustmentId: string; amountMinor: bigint }>) {
    prismaMock.paymentIntent.findMany.mockResolvedValue([]);
    prismaMock.enrollment.findMany.mockResolvedValue([]);
    prismaMock.adjustment.findMany.mockResolvedValue(
      adjustments.map((adjustment) => ({
        ...adjustment,
        tutorUserId: "tutor-1",
        volumeMinor: null,
        reason: "manual_bonus",
      })),
    );
    prismaMock.user.findMany.mockResolvedValue([{
      userId: "tutor-1",
      sponsorTutorId: null,
      isActive: true,
      verificationStatus: "VERIFIED",
      payoutIdentityVersion: 0,
      settings: {},
    }]);
  }

  it("refreshes a never-calculated (phantom) DRAFT instead of answering DRAFT_EXISTS", async () => {
    oneTutorWithBonus([{ adjustmentId: "adj-1", amountMinor: 10_000n }]);
    prismaMock.settlementRun.findFirst.mockResolvedValue({
      settlementRunId: "run-phantom",
      periodMonth: "2026-09",
      status: "DRAFT",
      previewPayload: {},
    });
    prismaMock.settlementRun.findUnique.mockResolvedValue({
      settlementRunId: "run-phantom",
      periodMonth: "2026-09",
      status: "DRAFT",
    });
    prismaMock.payoutLine.findMany.mockResolvedValue([]);

    const result = await SettlementService.previewSettlement("2026-09", "admin-1");

    expect(result).toMatchObject({ snapshotId: "run-phantom", payoutLineCount: 1 });
    expect(prismaMock.settlementRun.create).not.toHaveBeenCalled();
    expect(prismaMock.settlementRun.updateMany).toHaveBeenCalledWith({
      where: { settlementRunId: "run-phantom", status: "DRAFT" },
      data: expect.objectContaining({
        previewPayload: expect.objectContaining({
          previewedBy: "admin-1",
          approvedAdjustmentIds: ["adj-1"],
          payoutLineCount: 1,
        }),
      }),
    });
  });

  it("keeps answering DRAFT_EXISTS (with the run id) for a calculated draft", async () => {
    prismaMock.settlementRun.findFirst.mockResolvedValue({
      settlementRunId: "run-calculated",
      status: "DRAFT",
      previewPayload: { previewedAt: "2026-09-01T00:00:00.000Z" },
    });
    prismaMock.payoutLine.count.mockResolvedValue(3);

    await expect(
      SettlementService.previewSettlement("2026-09", "admin-1"),
    ).rejects.toMatchObject({ message: "DRAFT_EXISTS", existingRunId: "run-calculated" });
    expect(prismaMock.paymentIntent.findMany).not.toHaveBeenCalled();
  });

  it("writes the run and all of its lines inside one transaction", async () => {
    oneTutorWithBonus([{ adjustmentId: "adj-1", amountMinor: 10_000n }]);
    const tx = {
      settlementRun: {
        create: vi.fn().mockResolvedValue({ settlementRunId: "run-tx", status: "DRAFT" }),
      },
      payoutLine: { createMany: vi.fn().mockRejectedValue(new Error("disk full")) },
    };
    prismaMock.$transaction.mockImplementation(async (callback: (client: unknown) => unknown) =>
      callback(tx),
    );

    await expect(
      SettlementService.previewSettlement("2026-09", "admin-1"),
    ).rejects.toThrow("disk full");
    expect(tx.settlementRun.create).toHaveBeenCalledOnce();
    expect(tx.payoutLine.createMany).toHaveBeenCalledOnce();
    // Nothing was written outside the transaction (it rolls back as a unit).
    expect(prismaMock.settlementRun.create).not.toHaveBeenCalled();
    expect(prismaMock.payoutLine.createMany).not.toHaveBeenCalled();
    expect(prismaMock.payoutLine.create).not.toHaveBeenCalled();
  });

  it("reports a run as stale when an adjustment is approved after it was calculated", async () => {
    oneTutorWithBonus([{ adjustmentId: "adj-1", amountMinor: 10_000n }]);
    const computed = await SettlementService.computeSettlement("2026-08");
    const storedLines = computed.lines.map((line) => ({
      ...line,
      payoutRate: { toString: () => String(line.payoutRate) },
    }));
    prismaMock.payoutLine.findMany.mockResolvedValue(storedLines);
    const run = {
      settlementRunId: "run-08",
      periodMonth: "2026-08",
      previewPayload: {
        previewedAt: "2026-09-01T00:00:00.000Z",
        approvedAdjustmentIds: ["adj-1"],
        linesFingerprint: fingerprintPayoutLines(computed.lines),
      },
    };

    await expect(SettlementService.getRunFreshness(run)).resolves.toMatchObject({
      stale: false,
      lineCount: 1,
      reasons: [],
    });

    // A checker approves +฿300 for the same tutor after the run was reviewed.
    oneTutorWithBonus([
      { adjustmentId: "adj-1", amountMinor: 10_000n },
      { adjustmentId: "adj-2", amountMinor: 30_000n },
    ]);
    const stale = await SettlementService.getRunFreshness(run);
    expect(stale.stale).toBe(true);
    expect(stale.reasons).toEqual(["LINES_CHANGED", "ADJUSTMENTS_CHANGED"]);
    expect(stale.changedTutorUserIds).toEqual(["tutor-1"]);
  });

  it("refuses to submit/approve an empty, never-calculated or stale run", async () => {
    vi.mocked(SettlementService.assertRunReadyForReview).mockRestore();
    const freshness = vi.spyOn(SettlementService, "getRunFreshness");
    const run = { settlementRunId: "run-x", periodMonth: "2026-09", previewPayload: {} };

    freshness.mockResolvedValueOnce({
      previewed: false, lineCount: 0, stale: true, reasons: ["NOT_PREVIEWED"],
      changedTutorUserIds: [], checkedAt: "",
    });
    await expect(SettlementService.assertRunReadyForReview(run)).rejects.toThrow("SETTLEMENT_EMPTY");

    freshness.mockResolvedValueOnce({
      previewed: false, lineCount: 2, stale: true, reasons: ["NOT_PREVIEWED"],
      changedTutorUserIds: [], checkedAt: "",
    });
    await expect(SettlementService.assertRunReadyForReview(run)).rejects.toThrow("SETTLEMENT_NOT_PREVIEWED");

    freshness.mockResolvedValueOnce({
      previewed: true, lineCount: 2, stale: true, reasons: ["ADJUSTMENTS_CHANGED"],
      changedTutorUserIds: ["tutor-1"], checkedAt: "",
    });
    await expect(SettlementService.assertRunReadyForReview(run)).rejects.toBeInstanceOf(SettlementStaleError);
  });

  it("does not approve (or send transfers for) a stale run", async () => {
    omiseMock.isOmiseConfigured.mockReturnValue(true);
    prismaMock.settlementRun.findUnique.mockResolvedValue({
      settlementRunId: "run-stale",
      periodMonth: "2026-08",
      status: "SUBMITTED",
      previewPayload: { previewedAt: "x" },
    });
    vi.mocked(SettlementService.assertRunReadyForReview).mockRejectedValue(
      new SettlementStaleError({
        previewed: true, lineCount: 1, stale: true, reasons: ["ADJUSTMENTS_CHANGED"],
        changedTutorUserIds: ["tutor-1"], checkedAt: "",
      }),
    );

    await expect(
      SettlementService.approveSettlement("run-stale", "checker-1"),
    ).rejects.toThrow("SETTLEMENT_STALE:tutor-1");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(omiseMock.createOmiseTransfer).not.toHaveBeenCalled();
  });

  it("lets a stale SUBMITTED run be recalculated back to DRAFT only when asked", async () => {
    prismaMock.settlementRun.findUnique.mockResolvedValue({
      settlementRunId: "run-sub",
      periodMonth: "2026-08",
      status: "SUBMITTED",
      createdBy: "admin-1",
    });
    await expect(SettlementService.refreshSettlementRun("run-sub")).resolves.toMatchObject({
      refreshed: false,
    });

    const preview = vi.spyOn(SettlementService, "previewSettlement").mockResolvedValue({
      snapshotId: "run-sub",
      periodMonth: "2026-08",
      totalPayoutSatang: 1,
      totalNetPayoutSatang: 1,
      payoutLineCount: 1,
      status: "DRAFT",
    });
    await expect(
      SettlementService.refreshSettlementRun("run-sub", { allowSubmitted: true, actorId: "admin-2" }),
    ).resolves.toMatchObject({ refreshed: true, status: "DRAFT" });
    expect(prismaMock.settlementRun.updateMany).toHaveBeenCalledWith({
      where: { settlementRunId: "run-sub", status: "SUBMITTED" },
      data: { status: "REFRESHING" },
    });
    expect(preview).toHaveBeenCalledWith("2026-08", "admin-2", { refreshRunId: "run-sub" });
  });

  it("enables the maker-checker bypass only with explicit opt-in outside production", () => {
    expect(isDevMakerCheckerOverrideEnabled({ ENABLE_DEV_ROUTES: "true", NODE_ENV: "development" })).toBe(true);
    expect(isDevMakerCheckerOverrideEnabled({ ENABLE_DEV_ROUTES: "true", NODE_ENV: "production" })).toBe(false);
    expect(isDevMakerCheckerOverrideEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(isDevMakerCheckerOverrideEnabled({ ENABLE_DEV_ROUTES: "false", NODE_ENV: "staging" })).toBe(false);
    expect(isDevMakerCheckerOverrideEnabled({ ENABLE_DEV_ROUTES: "true", NODE_ENV: "staging" })).toBe(true);
  });
});
