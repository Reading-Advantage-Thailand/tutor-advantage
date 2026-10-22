/**
 * Chargeback protection (2026-10-22): disputes, refunds, clawbacks, hold
 * period, carry-forward and the automatic fraud rules.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    paymentIntent: {
      findUnique: fn(), findFirst: fn(), findMany: fn(), update: fn(), updateMany: fn(),
      count: fn(), aggregate: fn(), create: fn(),
    },
    paymentEvent: { findUnique: fn(), create: fn() },
    enrollment: { findUnique: fn(), findMany: fn(), updateMany: fn(), update: fn() },
    enrollmentPackage: { updateMany: fn(), findUnique: fn(), update: fn() },
    class: { update: fn() },
    adjustment: { findFirst: fn(), findMany: fn(), create: fn() },
    settlementRun: { findFirst: fn(), findUnique: fn(), create: fn(), updateMany: fn(), update: fn() },
    payoutLine: { findMany: fn(), createMany: fn(), count: fn(), deleteMany: fn() },
    payoutDocument: { upsert: fn(), deleteMany: fn(), updateMany: fn() },
    user: { findUnique: fn(), findMany: fn() },
    fraudFlag: { findFirst: fn(), findMany: fn(), create: fn(), update: fn() },
    auditEvent: { create: fn() },
    tutorBadge: { findMany: fn() },
    userConsent: { findFirst: fn() },
    paymentReceipt: { upsert: fn() },
    $transaction: fn(),
    $executeRaw: fn(),
  };
});

const omiseMock = vi.hoisted(() => ({
  createOmiseCharge: vi.fn(),
  downloadOmiseDocumentAsDataUri: vi.fn(),
  getOmisePublicKey: vi.fn(),
  isOmiseConfigured: vi.fn(),
  retrieveOmiseCharge: vi.fn(),
  retrieveOmiseDispute: vi.fn(),
  retrieveOmiseToken: vi.fn(),
  listOmiseDisputes: vi.fn(),
  listOmiseRefunds: vi.fn(),
  createOmiseTransfer: vi.fn(),
  listOmiseTransfers: vi.fn(),
  retrieveOmiseTransfer: vi.fn(),
  omiseRefId: (ref: unknown) =>
    typeof ref === "string" ? ref : (ref as { id?: string } | null)?.id ?? null,
}));

vi.mock("@tutor-advantage/database", () => ({
  prisma: prismaMock,
  Prisma: {
    Decimal: class Decimal {
      private val: number;
      constructor(value: number | string) { this.val = Number(value); }
      toNumber() { return this.val; }
      toString() { return String(this.val); }
    },
  },
}));
vi.mock("./omiseService", () => omiseMock);

import {
  applyDispute,
  applyRefundedCharge,
  classifyOmiseEvent,
  syncDisputesAndRefunds,
} from "./paymentRiskService";
import { estimateCommissionClawbacks } from "./clawbackService";
import { checkCardPaymentRisk, getPayoutHeldTutorIds, recordCardChargeSignals } from "./fraudRules";
import { SettlementService } from "./settlementService";
import { buildSettlementPaymentWhere, getPayoutHoldDays } from "./payoutPolicy";
import { handleWebhook } from "../controllers/paymentController";

function resetAllMocks() {
  for (const model of Object.values(prismaMock)) {
    if (typeof model === "function") (model as ReturnType<typeof vi.fn>).mockReset();
    else for (const method of Object.values(model)) (method as ReturnType<typeof vi.fn>).mockReset();
  }
  for (const value of Object.values(omiseMock)) {
    if (vi.isMockFunction(value)) value.mockReset();
  }
  prismaMock.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prismaMock) : Promise.all(arg as unknown[]),
  );
  prismaMock.fraudFlag.findFirst.mockResolvedValue(null);
  prismaMock.fraudFlag.findMany.mockResolvedValue([]);
  prismaMock.fraudFlag.create.mockResolvedValue({ flagId: "flag-1" });
  prismaMock.auditEvent.create.mockResolvedValue({});
  prismaMock.paymentIntent.update.mockResolvedValue({});
  prismaMock.paymentIntent.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.paymentIntent.count.mockResolvedValue(0);
  prismaMock.paymentIntent.findMany.mockResolvedValue([]);
  prismaMock.enrollment.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.enrollmentPackage.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.enrollment.findUnique.mockResolvedValue({ classId: "class-1", class: { enrolledCount: 3, tutorUserId: "tutor-1" } });
  prismaMock.class.update.mockResolvedValue({});
  prismaMock.adjustment.findFirst.mockResolvedValue(null);
  prismaMock.adjustment.findMany.mockResolvedValue([]);
  prismaMock.adjustment.create.mockImplementation(async ({ data }: { data: unknown }) => data);
  prismaMock.settlementRun.findFirst.mockResolvedValue(null);
  prismaMock.settlementRun.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    settlementRunId: `run-${data.periodMonth}`,
    ...data,
  }));
  prismaMock.tutorBadge.findMany.mockResolvedValue([]);
  prismaMock.paymentEvent.findUnique.mockResolvedValue(null);
  prismaMock.paymentEvent.create.mockResolvedValue({});
}

const CHARGE = {
  id: "chrg_1",
  amount: 300_000,
  currency: "THB",
  metadata: { paymentIntentId: "pi-1" },
  status: "successful",
  paid: true,
};

function intent(overrides: Record<string, unknown> = {}) {
  return {
    paymentIntentId: "pi-1",
    enrollmentId: "enrollment-1",
    enrollmentPackageId: null,
    studentUserId: "student-1",
    earningTutorUserId: "tutor-1",
    amountMinor: 300_000n,
    currency: "THB",
    method: "card",
    status: "SUCCESS",
    providerRef: "chrg_1",
    refundedAmountMinor: 0n,
    disputeId: null,
    commissionSettlementRunId: null,
    ...overrides,
  };
}

/** Approved October run: tutor-1 (child) under sponsor-1. */
function mockPaidRun() {
  prismaMock.payoutLine.findMany.mockResolvedValue([
    { tutorUserId: "tutor-1", grossVolumeMinor: 1_000_000n, payoutAmountMinor: 450_000n, badgeBonusMinor: 0n },
    { tutorUserId: "sponsor-1", grossVolumeMinor: 2_000_000n, payoutAmountMinor: 550_000n, badgeBonusMinor: 0n },
  ]);
  prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { userId: string } }) => ({
    sponsorTutorId: where.userId === "tutor-1" ? "sponsor-1" : null,
  }));
  prismaMock.settlementRun.findUnique.mockResolvedValue({ periodMonth: "2026-10" });
}

beforeEach(() => {
  vi.stubEnv("COMMISSION_BASE_RATE", "0.5");
  resetAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Omise event classification", () => {
  it("recognises real dispute and refund events by their object, not by the word 'chargeback'", () => {
    expect(classifyOmiseEvent({ key: "dispute.create", data: { object: "dispute", id: "dspt_1", charge: "chrg_1" } }))
      .toMatchObject({ kind: "dispute", objectId: "dspt_1", chargeId: "chrg_1" });
    expect(classifyOmiseEvent({ key: "refund.create", data: { object: "refund", id: "rfnd_1", charge: { id: "chrg_2" } } }))
      .toMatchObject({ kind: "refund", objectId: "rfnd_1", chargeId: "chrg_2" });
    expect(classifyOmiseEvent({ key: "charge.complete", data: { object: "charge", id: "chrg_3" } }))
      .toMatchObject({ kind: "charge", chargeId: "chrg_3" });
  });
});

describe("disputes (chargebacks)", () => {
  beforeEach(() => {
    omiseMock.retrieveOmiseCharge.mockResolvedValue(CHARGE);
  });

  it("holds a payment whose commission is not paid yet: DISPUTED, tutor flagged, no clawback", async () => {
    const row = intent();
    prismaMock.paymentIntent.findFirst.mockResolvedValue(row);
    prismaMock.paymentIntent.findUnique.mockResolvedValue(row);
    prismaMock.paymentIntent.count.mockResolvedValue(1);

    const result = await applyDispute({ id: "dspt_1", amount: 300_000, currency: "thb", status: "open", charge: "chrg_1" });

    expect(result).toEqual({ paymentIntentId: "pi-1", outcome: "OPEN_CLAWBACK_0" });
    expect(prismaMock.paymentIntent.update).toHaveBeenCalledWith({
      where: { paymentIntentId: "pi-1" },
      data: { status: "DISPUTED", disputeId: "dspt_1" },
    });
    expect(prismaMock.adjustment.create).not.toHaveBeenCalled();
    expect(prismaMock.fraudFlag.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "CHARGEBACK", severity: "HIGH", targetId: "tutor-1", status: "OPEN" }),
    });
    // Access stays while the dispute is open.
    expect(prismaMock.enrollment.updateMany).not.toHaveBeenCalled();
  });

  it("escalates to CRITICAL on the tutor's second dispute", async () => {
    const row = intent();
    prismaMock.paymentIntent.findFirst.mockResolvedValue(row);
    prismaMock.paymentIntent.findUnique.mockResolvedValue(row);
    prismaMock.paymentIntent.count.mockResolvedValue(2);

    await applyDispute({ id: "dspt_2", amount: 300_000, currency: "thb", status: "open", charge: "chrg_1" });

    expect(prismaMock.fraudFlag.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "CHARGEBACK", severity: "CRITICAL" }),
    });
  });

  it("claws back commission from the tutor AND the upline when the commission was already paid", async () => {
    const row = intent({ commissionSettlementRunId: "run-oct" });
    prismaMock.paymentIntent.findFirst.mockResolvedValue(row);
    prismaMock.paymentIntent.findUnique.mockResolvedValue(row);
    mockPaidRun();

    const result = await applyDispute({ id: "dspt_1", amount: 300_000, currency: "thb", status: "open", charge: "chrg_1" });

    expect(result.outcome).toBe("OPEN_CLAWBACK_2");
    // Clawbacks go to the first open period after the paid run (Nov).
    expect(prismaMock.settlementRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ periodMonth: "2026-11", status: "ADJUSTMENT_PENDING" }),
    });
    const created = prismaMock.adjustment.create.mock.calls.map((call) => call[0].data);
    expect(created).toEqual([
      expect.objectContaining({
        tutorUserId: "tutor-1",
        amountMinor: -145_500n,
        volumeMinor: 0n,
        status: "APPROVED",
        reason: "chargeback:pi-1:dspt_1:tutor-1",
      }),
      expect.objectContaining({
        tutorUserId: "sponsor-1",
        amountMinor: -30_000n,
        status: "APPROVED",
        reason: "chargeback:pi-1:dspt_1:sponsor-1",
      }),
    ]);
  });

  it("does not claw back twice for the same dispute (open, then lost)", async () => {
    const row = intent({ status: "DISPUTED", disputeId: "dspt_1", commissionSettlementRunId: "run-oct" });
    prismaMock.paymentIntent.findFirst.mockResolvedValue(row);
    prismaMock.paymentIntent.findUnique.mockResolvedValue(row);
    prismaMock.adjustment.findFirst.mockResolvedValue({ adjustmentId: "existing" });
    mockPaidRun();

    const result = await applyDispute({ id: "dspt_1", amount: 300_000, currency: "thb", status: "lost", charge: "chrg_1" });

    expect(result.outcome).toBe("LOST_CLAWBACK_0");
    expect(prismaMock.adjustment.create).not.toHaveBeenCalled();
    expect(prismaMock.paymentIntent.update).toHaveBeenCalledWith({
      where: { paymentIntentId: "pi-1" },
      data: { status: "CHARGEBACKED", disputeId: "dspt_1" },
    });
    // Lost dispute revokes the student's access.
    expect(prismaMock.enrollment.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: "enrollment-1", status: { in: ["PENDING_PAYMENT", "ACTIVE"] } },
      data: { status: "REVOKED", paymentExpiresAt: null },
    });
  });

  it("restores the payment and reverses the clawback (PENDING credits) when the dispute is won", async () => {
    const row = intent({ status: "DISPUTED", disputeId: "dspt_1", commissionSettlementRunId: "run-oct" });
    prismaMock.paymentIntent.findFirst.mockResolvedValue(row);
    prismaMock.paymentIntent.findUnique.mockResolvedValue(row);
    prismaMock.adjustment.findMany.mockResolvedValue([
      { tutorUserId: "tutor-1", amountMinor: -145_500n, settlementRunId: "run-nov" },
      { tutorUserId: "sponsor-1", amountMinor: -30_000n, settlementRunId: "run-nov" },
    ]);
    prismaMock.settlementRun.findUnique.mockResolvedValue({ periodMonth: "2026-11" });
    prismaMock.settlementRun.findFirst.mockResolvedValue({ settlementRunId: "run-nov", status: "DRAFT" });

    const result = await applyDispute({ id: "dspt_1", amount: 300_000, currency: "thb", status: "won", charge: "chrg_1" });

    expect(result.outcome).toBe("WON_REVERSED_2");
    expect(prismaMock.paymentIntent.updateMany).toHaveBeenCalledWith({
      where: { paymentIntentId: "pi-1", status: { in: ["DISPUTED", "CHARGEBACKED"] } },
      data: { status: "SUCCESS", disputeId: "dspt_1" },
    });
    expect(prismaMock.adjustment.create.mock.calls.map((call) => call[0].data)).toEqual([
      expect.objectContaining({ tutorUserId: "tutor-1", amountMinor: 145_500n, status: "PENDING" }),
      expect.objectContaining({ tutorUserId: "sponsor-1", amountMinor: 30_000n, status: "PENDING" }),
    ]);
  });

  it("ignores a dispute whose charge does not match our payment", async () => {
    const row = intent();
    prismaMock.paymentIntent.findFirst.mockResolvedValue(row);
    prismaMock.paymentIntent.findUnique.mockResolvedValue(row);
    omiseMock.retrieveOmiseCharge.mockResolvedValue({ ...CHARGE, amount: 1 });

    const result = await applyDispute({ id: "dspt_x", amount: 1, currency: "thb", status: "open", charge: "chrg_1" });

    expect(result.outcome).toBe("CHARGE_MISMATCH");
    expect(prismaMock.paymentIntent.update).not.toHaveBeenCalled();
  });

  it("processes a signed dispute.create webhook end to end", async () => {
    vi.stubEnv("OMISE_WEBHOOK_SECRET", "");
    vi.stubEnv("ENABLE_DEV_ROUTES", "true");
    const row = intent();
    prismaMock.paymentIntent.findFirst.mockResolvedValue(row);
    prismaMock.paymentIntent.findUnique.mockResolvedValue(row);
    omiseMock.retrieveOmiseDispute.mockResolvedValue({
      id: "dspt_9", amount: 300_000, currency: "thb", status: "open", charge: "chrg_1",
    });
    const res = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };

    await handleWebhook({
      body: { object: "event", id: "evnt_9", key: "dispute.create", data: { object: "dispute", id: "dspt_9", charge: "chrg_1", metadata: {} } },
      headers: {},
    } as never, res as never);

    expect(omiseMock.retrieveOmiseDispute).toHaveBeenCalledWith("dspt_9");
    expect(prismaMock.paymentIntent.update).toHaveBeenCalledWith({
      where: { paymentIntentId: "pi-1" },
      data: { status: "DISPUTED", disputeId: "dspt_9" },
    });
    expect(prismaMock.paymentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ paymentIntentId: "pi-1", eventType: "dispute.create", providerEventId: "evnt_9" }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("refunds", () => {
  it("records a partial refund without revoking access", async () => {
    const result = await applyRefundedCharge(intent(), { refunded_amount: 100_000 }, "rfnd_1");

    expect(result.outcome).toBe("PARTIAL_REFUND_CLAWBACK_0");
    expect(prismaMock.paymentIntent.update).toHaveBeenCalledWith({
      where: { paymentIntentId: "pi-1" },
      data: { refundedAmountMinor: 100_000n },
    });
    expect(prismaMock.enrollment.updateMany).not.toHaveBeenCalled();
  });

  it("claws back only the newly refunded part when commission was paid", async () => {
    mockPaidRun();
    const result = await applyRefundedCharge(
      intent({ commissionSettlementRunId: "run-oct", refundedAmountMinor: 0n }),
      { refunded_amount: 300_000 },
      "rfnd_2",
    );

    expect(result.outcome).toBe("FULL_REFUND_CLAWBACK_2");
    expect(prismaMock.adjustment.create.mock.calls[0][0].data).toMatchObject({
      tutorUserId: "tutor-1",
      amountMinor: -145_500n,
      reason: "refund:pi-1:rfnd_2:tutor-1",
    });
  });

  it("is idempotent when the same refunded total arrives again", async () => {
    const result = await applyRefundedCharge(intent({ refundedAmountMinor: 300_000n, status: "REFUNDED" }), { refunded_amount: 300_000 }, "rfnd_1");
    expect(result.outcome).toBe("REFUND_ALREADY_APPLIED");
    expect(prismaMock.paymentIntent.update).not.toHaveBeenCalled();
  });
});

describe("daily dispute / refund sync", () => {
  it("applies disputes and refunds pulled from Omise and re-checks open local disputes", async () => {
    omiseMock.retrieveOmiseCharge.mockResolvedValue(CHARGE);
    omiseMock.listOmiseDisputes.mockResolvedValue([
      { id: "dspt_a", amount: 300_000, currency: "thb", status: "open", charge: "chrg_1" },
    ]);
    omiseMock.listOmiseRefunds.mockResolvedValue([{ id: "rfnd_a", amount: 1, currency: "thb", charge: "chrg_unknown" }]);
    omiseMock.retrieveOmiseDispute.mockResolvedValue({ id: "dspt_old", amount: 300_000, currency: "thb", status: "won", charge: "chrg_1" });
    const row = intent();
    prismaMock.paymentIntent.findFirst.mockImplementation(async ({ where }: { where: { providerRef: string } }) =>
      where.providerRef === "chrg_1" ? row : null,
    );
    prismaMock.paymentIntent.findUnique.mockResolvedValue(row);
    prismaMock.paymentIntent.findMany.mockResolvedValue([{ disputeId: "dspt_old" }]);

    const summary = await syncDisputesAndRefunds({ sinceDays: 30 });

    expect(omiseMock.listOmiseDisputes).toHaveBeenCalledWith(expect.any(Date));
    expect(summary).toMatchObject({ disputes: 1, refunds: 1, openDisputesRechecked: 1, errors: 0 });
    expect(summary.outcomes).toMatchObject({ OPEN_CLAWBACK: 1, UNMAPPED: 1 });
  });
});

describe("clawback estimate", () => {
  it("never takes back more than a tutor was paid", async () => {
    prismaMock.payoutLine.findMany.mockResolvedValue([
      { tutorUserId: "tutor-1", grossVolumeMinor: 1_000_000n, payoutAmountMinor: 10_000n, badgeBonusMinor: 0n },
    ]);
    prismaMock.user.findUnique.mockResolvedValue({ sponsorTutorId: null });

    const items = await estimateCommissionClawbacks({
      settlementRunId: "run-oct",
      earningTutorUserId: "tutor-1",
      lossMinor: 1_000_000n,
    });
    expect(items).toEqual([{ tutorUserId: "tutor-1", amountMinor: 10_000n }]);
  });

  it("returns nothing when the tutor had no line in the paid run", async () => {
    prismaMock.payoutLine.findMany.mockResolvedValue([]);
    await expect(
      estimateCommissionClawbacks({ settlementRunId: "r", earningTutorUserId: "tutor-1", lossMinor: 5n }),
    ).resolves.toEqual([]);
  });
});

describe("fraud rules before a card is charged", () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue({
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
      settings: {},
      displayName: "Old tutor",
    });
  });

  it("refuses a card that already had a chargeback", async () => {
    prismaMock.paymentIntent.count.mockResolvedValue(1);
    const refusal = await checkCardPaymentRisk({
      studentUserId: "student-9", tutorUserId: "tutor-1", amountMinor: 300_000n, cardFingerprint: "fp-bad",
    });
    expect(refusal).toMatchObject({ status: 403, code: "CARD_NOT_ACCEPTED" });
    expect(prismaMock.fraudFlag.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "CARD_BLOCKED", severity: "HIGH" }),
    });
  });

  it("refuses a 4th student on the same card and flags the tutor (HIGH)", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([
      { studentUserId: "s1" }, { studentUserId: "s2" }, { studentUserId: "s3" },
    ]);
    const refusal = await checkCardPaymentRisk({
      studentUserId: "s4", tutorUserId: "tutor-1", amountMinor: 300_000n, cardFingerprint: "fp-shared",
    });
    expect(refusal).toMatchObject({ code: "CARD_USAGE_LIMIT" });
    expect(prismaMock.fraudFlag.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "MULTI_ACCOUNT", severity: "HIGH" }),
    });
  });

  it("allows siblings on one parent card without a flag", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([{ studentUserId: "s1" }]);
    const refusal = await checkCardPaymentRisk({
      studentUserId: "s2", tutorUserId: "tutor-1", amountMinor: 300_000n, cardFingerprint: "fp-parent",
    });
    expect(refusal).toBeNull();
    expect(prismaMock.fraudFlag.create).not.toHaveBeenCalled();
  });

  it("limits card sales of a new tutor (PromptPay stays open) unless an admin trusts them", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-22T00:00:00.000Z"));
    prismaMock.user.findUnique.mockResolvedValue({
      createdAt: new Date("2026-10-01T00:00:00.000Z"), settings: {}, displayName: "New tutor",
    });
    prismaMock.paymentIntent.aggregate.mockResolvedValue({ _sum: { amountMinor: 2_900_000n } });

    const refusal = await checkCardPaymentRisk({
      studentUserId: "s1", tutorUserId: "tutor-new", amountMinor: 300_000n, cardFingerprint: null,
    });
    expect(refusal).toMatchObject({ code: "CARD_LIMIT_REACHED" });

    prismaMock.user.findUnique.mockResolvedValue({
      createdAt: new Date("2026-10-01T00:00:00.000Z"), settings: { cardPaymentsTrusted: true }, displayName: "New tutor",
    });
    await expect(checkCardPaymentRisk({
      studentUserId: "s1", tutorUserId: "tutor-new", amountMinor: 300_000n, cardFingerprint: null,
    })).resolves.toBeNull();
  });

  it("flags a card charge that was paid without 3-D Secure", async () => {
    await recordCardChargeSignals({
      tutorUserId: "tutor-1", studentUserId: "s1", paymentIntentId: "pi-1",
      charge: { paid: true, status: "successful", authenticated_by: null },
    });
    expect(prismaMock.fraudFlag.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "CARD_NO_3DS", severity: "LOW" }),
    });
    prismaMock.fraudFlag.create.mockClear();
    await recordCardChargeSignals({
      tutorUserId: "tutor-1", studentUserId: "s1", paymentIntentId: "pi-2",
      charge: { paid: true, status: "successful", authenticated_by: "3DS" },
    });
    expect(prismaMock.fraudFlag.create).not.toHaveBeenCalled();
  });

  it("only HIGH/CRITICAL unreviewed flags pause payouts", async () => {
    prismaMock.fraudFlag.findMany.mockResolvedValue([{ targetId: "tutor-1" }]);
    await expect(getPayoutHeldTutorIds()).resolves.toEqual(new Set(["tutor-1"]));
    expect(prismaMock.fraudFlag.findMany).toHaveBeenCalledWith({
      where: { status: { in: ["OPEN", "INVESTIGATING", "FROZEN"] }, severity: { in: ["HIGH", "CRITICAL"] } },
      select: { targetId: true },
    });
  });
});

describe("hold period policy", () => {
  it("uses 60 days for cards and 7 for PromptPay, configurable by env", () => {
    expect(getPayoutHoldDays("card")).toBe(60);
    expect(getPayoutHoldDays("promptpay")).toBe(7);
    vi.stubEnv("PAYOUT_HOLD_DAYS_CARD", "90");
    vi.stubEnv("PAYOUT_HOLD_DAYS_OTHER", "abc");
    expect(getPayoutHoldDays("card")).toBe(90);
    expect(getPayoutHoldDays("promptpay")).toBe(7);
  });

  it("keeps payments already stamped with this period's run", () => {
    const where = buildSettlementPaymentWhere("2026-05", "run-may") as { OR: unknown[] };
    expect(where.OR).toContainEqual({ commissionSettlementRunId: "run-may" });
  });
});

describe("settlement with chargeback protection", () => {
  function tutor(overrides: Record<string, unknown> = {}) {
    return {
      userId: "tutor-1",
      sponsorTutorId: null,
      isActive: true,
      verificationStatus: "VERIFIED",
      payoutIdentityVersion: 0,
      settings: { omiseRecipientId: "recp_1" },
      ...overrides,
    };
  }

  function payment(overrides: Record<string, unknown> = {}) {
    return {
      paymentIntentId: "pi-1",
      enrollmentId: "en-1",
      earningTutorUserId: "tutor-1",
      amountMinor: 100_000n,
      refundedAmountMinor: 0n,
      method: "promptpay",
      status: "SUCCESS",
      paidAt: new Date("2026-05-01T00:00:00.000Z"),
      events: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    prismaMock.enrollment.findMany.mockResolvedValue([]);
  });

  it("holds the payout of a tutor with an unreviewed HIGH flag (paid later, not lost)", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([payment()]);
    prismaMock.user.findMany.mockResolvedValue([tutor()]);
    prismaMock.fraudFlag.findMany.mockResolvedValue([{ targetId: "tutor-1" }]);

    const result = await SettlementService.computeSettlement("2026-05");

    expect(result.lines).toEqual([
      expect.objectContaining({
        tutorUserId: "tutor-1",
        payoutAmountMinor: 40_500n,
        netPayoutMinor: 0n,
        withholdingTaxMinor: 0n,
        eligibilityStatus: "HELD_FRAUD_REVIEW",
      }),
    ]);
    expect(result.totalPayoutSatang).toBe(0n);
  });

  it("counts only the non-refunded part of a partially refunded payment", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([payment({ refundedAmountMinor: 40_000n })]);
    prismaMock.user.findMany.mockResolvedValue([tutor()]);

    const result = await SettlementService.computeSettlement("2026-05");

    expect(result.lines[0]).toMatchObject({ grossVolumeMinor: 60_000n });
  });

  it("keeps a clawback owed by a suspended/unverified tutor instead of wiping it", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([tutor({ verificationStatus: "PENDING" })]);
    prismaMock.adjustment.findMany.mockResolvedValue([
      { adjustmentId: "adj-1", tutorUserId: "tutor-1", amountMinor: -5_000n, volumeMinor: 0n, reason: "chargeback:pi-1:dspt_1:tutor-1" },
    ]);

    const result = await SettlementService.computeSettlement("2026-05");

    expect(result.lines[0]).toMatchObject({ payoutAmountMinor: -5_000n, netPayoutMinor: 0n });
  });

  it("on approval stamps the paid payments and carries debts / held money to the next month", async () => {
    vi.spyOn(SettlementService, "assertRunReadyForReview").mockResolvedValue({
      previewed: true, lineCount: 2, stale: false, reasons: [], changedTutorUserIds: [], checkedAt: "",
    });
    omiseMock.isOmiseConfigured.mockReturnValue(false);
    prismaMock.settlementRun.findUnique.mockResolvedValue({ settlementRunId: "run-may", periodMonth: "2026-05", status: "SUBMITTED" });
    prismaMock.payoutLine.findMany.mockResolvedValue([]);
    prismaMock.settlementRun.updateMany.mockResolvedValue({ count: 1 });
    const lines = [
      { payoutLineId: "l1", tutorUserId: "tutor-1", payoutAmountMinor: -5_000n, withholdingTaxMinor: 0n, netPayoutMinor: 0n, eligibilityStatus: "ELIGIBLE_BASE_ADJUSTED" },
      { payoutLineId: "l2", tutorUserId: "tutor-2", payoutAmountMinor: 40_500n, withholdingTaxMinor: 0n, netPayoutMinor: 0n, eligibilityStatus: "HELD_FRAUD_REVIEW" },
    ];
    prismaMock.settlementRun.findUnique
      .mockResolvedValueOnce({ settlementRunId: "run-may", periodMonth: "2026-05", status: "SUBMITTED" })
      .mockResolvedValueOnce({ settlementRunId: "run-may", periodMonth: "2026-05", status: "APPROVING", payoutLines: lines });

    const approved = await SettlementService.approveSettlement("run-may", "checker-1");

    expect(approved.status).toBe("APPROVED");
    expect(prismaMock.payoutDocument.upsert).not.toHaveBeenCalled(); // held line gets no tax slip
    expect(prismaMock.paymentIntent.updateMany).toHaveBeenCalledWith({
      where: buildSettlementPaymentWhere("2026-05", "run-may"),
      data: { commissionSettlementRunId: "run-may" },
    });
    expect(prismaMock.settlementRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ periodMonth: "2026-06", status: "ADJUSTMENT_PENDING" }),
    });
    expect(prismaMock.adjustment.create.mock.calls.map((call) => call[0].data)).toEqual([
      expect.objectContaining({ settlementRunId: "run-2026-06", tutorUserId: "tutor-1", amountMinor: -5_000n, status: "APPROVED", reason: "carry-forward:run-may:tutor-1" }),
      expect.objectContaining({ settlementRunId: "run-2026-06", tutorUserId: "tutor-2", amountMinor: 40_500n, status: "APPROVED", reason: "held-carry-forward:run-may:tutor-2" }),
    ]);
  });
});

describe("MLM classic differential payout (owner decision 2026-10-22: 55.6%)", () => {
  function chainUsers(pvOfParent = true) {
    return [
      { userId: "gp", sponsorTutorId: null, isActive: true, verificationStatus: "VERIFIED", payoutIdentityVersion: 0, settings: {} },
      { userId: "p", sponsorTutorId: "gp", isActive: true, verificationStatus: "VERIFIED", payoutIdentityVersion: 0, settings: {} },
      { userId: "c", sponsorTutorId: "p", isActive: true, verificationStatus: "VERIFIED", payoutIdentityVersion: 0, settings: {} },
    ].map((user) => ({ ...user, _pv: user.userId !== "p" || pvOfParent }));
  }

  function sale(tutor: string) {
    return {
      paymentIntentId: `pi-${tutor}`, enrollmentId: `en-${tutor}`, earningTutorUserId: tutor,
      amountMinor: 1_000_000n, refundedAmountMinor: 0n, method: "promptpay", status: "SUCCESS",
      paidAt: new Date("2026-05-01T00:00:00.000Z"), events: [],
    };
  }

  beforeEach(() => {
    prismaMock.enrollment.findMany.mockResolvedValue([]);
  });

  it("pays a 3-level chain with 10,000 THB each exactly R(30,000) = 55.6% in total", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([sale("gp"), sale("p"), sale("c")]);
    prismaMock.user.findMany.mockResolvedValue(chainUsers());

    const result = await SettlementService.computeSettlement("2026-05");
    const byTutor = Object.fromEntries(result.lines.map((line) => [line.tutorUserId, line.payoutAmountMinor]));

    expect(byTutor).toEqual({ c: 450_000n, p: 550_000n, gp: 668_193n });
    expect(result.totalPayoutSatang).toBe(1_668_193n); // 16,681.93 THB of 30,000 THB = 55.6%
  });

  it("rolls the share of a sponsor without own sales up to the next sponsor", async () => {
    prismaMock.paymentIntent.findMany.mockResolvedValue([sale("gp"), sale("c")]);
    prismaMock.user.findMany.mockResolvedValue(chainUsers(false));

    const result = await SettlementService.computeSettlement("2026-05");
    const byTutor = Object.fromEntries(result.lines.map((line) => [line.tutorUserId, line]));

    expect(byTutor.c.payoutAmountMinor).toBe(450_000n);
    expect(byTutor.p).toMatchObject({ payoutAmountMinor: 0n, eligibilityStatus: "INELIGIBLE_NO_PV" });
    expect(byTutor.gp.payoutAmountMinor).toBe(550_000n);
    expect(result.totalPayoutSatang).toBe(1_000_000n); // R(20,000) = 50% of 20,000 THB
  });

  it("claws back exactly what a full recalculation would remove, up a 3-level chain", async () => {
    prismaMock.payoutLine.findMany.mockResolvedValue([
      { tutorUserId: "c", grossVolumeMinor: 1_000_000n, payoutAmountMinor: 450_000n, badgeBonusMinor: 0n },
      { tutorUserId: "p", grossVolumeMinor: 2_000_000n, payoutAmountMinor: 550_000n, badgeBonusMinor: 0n },
      { tutorUserId: "gp", grossVolumeMinor: 3_000_000n, payoutAmountMinor: 668_193n, badgeBonusMinor: 0n },
    ]);
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { userId: string } }) => ({
      sponsorTutorId: where.userId === "c" ? "p" : where.userId === "p" ? "gp" : null,
    }));

    const items = await estimateCommissionClawbacks({
      settlementRunId: "run-may", earningTutorUserId: "c", lossMinor: 300_000n,
    });

    // Recalculating the tree with c at 7,000 THB pays 145,500 / 30,000 / 26,352 satang less.
    expect(items).toEqual([
      { tutorUserId: "c", amountMinor: 145_500n },
      { tutorUserId: "p", amountMinor: 30_000n },
      { tutorUserId: "gp", amountMinor: 26_352n },
    ]);
  });
});
