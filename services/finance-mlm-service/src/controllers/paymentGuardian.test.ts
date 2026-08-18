import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPaymentIntent,
  getPaymentGuardianGate,
  getPaymentStatus,
  handleWebhook,
} from "./paymentController";

const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  userConsent: { findFirst: vi.fn() },
  paymentIntent: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  paymentEvent: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  paymentReceipt: { upsert: vi.fn() },
  enrollment: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  enrollmentPackage: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  class: { update: vi.fn() },
  adjustment: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  settlementRun: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  payoutLine: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

const omiseMock = vi.hoisted(() => ({
  createOmiseCharge: vi.fn(),
  downloadOmiseDocumentAsDataUri: vi.fn(),
  getOmisePublicKey: vi.fn(),
  isOmiseConfigured: vi.fn(),
  retrieveOmiseCharge: vi.fn(),
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));
vi.mock("../services/omiseService", () => omiseMock);

describe("payment guardian gate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T12:00:00.000Z"));
    prisma.user.findUnique.mockReset();
    prisma.userConsent.findFirst.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fails closed when date of birth is missing", async () => {
    prisma.user.findUnique.mockResolvedValue({ dateOfBirth: null });

    await expect(getPaymentGuardianGate("student-1")).resolves.toMatchObject({
      status: 400,
      code: "DATE_OF_BIRTH_REQUIRED",
    });
    expect(prisma.userConsent.findFirst).not.toHaveBeenCalled();
  });

  it("requires consent for a 17-year-old", async () => {
    prisma.user.findUnique.mockResolvedValue({
      dateOfBirth: new Date("2008-07-02T00:00:00.000Z"),
    });
    prisma.userConsent.findFirst.mockResolvedValue(null);

    await expect(getPaymentGuardianGate("student-1")).resolves.toMatchObject({
      status: 403,
      code: "GUARDIAN_CONSENT_REQUIRED",
    });
  });

  it("allows a minor with consent and an 18-year-old without consent", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        dateOfBirth: new Date("2012-01-01T00:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        dateOfBirth: new Date("2008-07-01T00:00:00.000Z"),
      });
    prisma.userConsent.findFirst.mockResolvedValue({ userConsentId: "consent-1" });

    await expect(getPaymentGuardianGate("minor")).resolves.toBeNull();
    await expect(getPaymentGuardianGate("adult")).resolves.toBeNull();
    expect(prisma.userConsent.findFirst).toHaveBeenCalledTimes(1);
  });
});

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

function paymentIntent(overrides: Record<string, unknown> = {}) {
  return {
    paymentIntentId: "pi-1",
    enrollmentId: "enrollment-1",
    enrollmentPackageId: null,
    studentUserId: "student-1",
    amountMinor: 250000n,
    currency: "THB",
    method: "promptpay",
    status: "FAILED",
    idempotencyKey: null,
    providerRef: "chrg_1",
    paidAt: null,
    createdAt: new Date("2026-08-13T00:00:00.000Z"),
    updatedAt: new Date("2026-08-13T00:00:00.000Z"),
    ...overrides,
  };
}

describe("payment intent reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OMISE_WEBHOOK_SECRET", "");
    vi.stubEnv("ENABLE_DEV_ROUTES", "true");
    omiseMock.isOmiseConfigured.mockReturnValue(true);
    prisma.paymentEvent.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when staging has no webhook secret and dev routes are disabled", async () => {
    vi.stubEnv("NODE_ENV", "staging");
    vi.stubEnv("ENABLE_DEV_ROUTES", "false");
    const req = {
      body: {
        type: "charge.complete",
        data: { id: "chrg_1", status: "successful", metadata: { paymentIntentId: "pi-1" } },
      },
      headers: {},
    };
    const res = response();

    await handleWebhook(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.paymentEvent.create).not.toHaveBeenCalled();
  });

  it("does not fail a payment intent for a non-terminal PromptPay webhook", async () => {
    const req = {
      body: {
        type: "charge.update",
        data: {
          id: "chrg_1",
          status: "pending",
          metadata: { paymentIntentId: "pi-1" },
        },
      },
      headers: {},
    };
    const res = response();

    await handleWebhook(req as never, res as never);

    expect(omiseMock.retrieveOmiseCharge).not.toHaveBeenCalled();
    expect(prisma.paymentIntent.update).not.toHaveBeenCalled();
    expect(prisma.paymentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentIntentId: "pi-1",
        eventType: "charge.update",
      }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("does not fulfill a successful-looking webhook until Omise confirms the charge", async () => {
    prisma.paymentIntent.findUnique.mockResolvedValue(paymentIntent({ status: "PENDING" }));
    omiseMock.retrieveOmiseCharge.mockResolvedValue({
      id: "chrg_1",
      amount: 250000,
      currency: "THB",
      metadata: { paymentIntentId: "pi-1" },
      status: "pending",
      paid: false,
    });
    const req = {
      body: {
        type: "charge.complete",
        data: {
          id: "chrg_1",
          status: "successful",
          metadata: { paymentIntentId: "pi-1" },
        },
      },
      headers: {},
    };
    const res = response();

    await handleWebhook(req as never, res as never);

    expect(omiseMock.retrieveOmiseCharge).toHaveBeenCalledWith("chrg_1");
    expect(prisma.paymentIntent.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("reconciles a FAILED intent when status polling finds a paid charge", async () => {
    const failedIntent = paymentIntent();
    const recoveredIntent = paymentIntent({
      status: "SUCCESS",
      paidAt: new Date("2026-08-14T01:00:00.000Z"),
    });
    prisma.paymentIntent.findUnique.mockResolvedValue(failedIntent);
    prisma.paymentIntent.findFirst.mockResolvedValue(null);
    prisma.paymentIntent.update.mockResolvedValue(recoveredIntent);
    prisma.enrollment.findUnique.mockResolvedValue({
      status: "CANCELLED",
      classId: "class-1",
    });
    prisma.enrollment.update.mockResolvedValue({});
    prisma.enrollmentPackage.updateMany.mockResolvedValue({ count: 0 });
    prisma.class.update.mockResolvedValue({});
    prisma.paymentReceipt.upsert.mockResolvedValue({});
    omiseMock.retrieveOmiseCharge.mockResolvedValue({
      id: "chrg_1",
      status: "successful",
      paid: true,
    });
    const req = {
      id: "req-1",
      user: { userId: "student-1" },
      params: { paymentIntentId: "pi-1" },
    };
    const res = response();

    await getPaymentStatus(req as never, res as never);

    expect(omiseMock.retrieveOmiseCharge).toHaveBeenCalledWith("chrg_1");
    expect(prisma.paymentIntent.update).toHaveBeenCalledWith({
      where: { paymentIntentId: "pi-1" },
      data: {
        status: "SUCCESS",
        providerRef: "chrg_1",
        paidAt: expect.any(Date),
      },
    });
    expect(prisma.class.update).toHaveBeenCalledWith({
      where: { classId: "class-1" },
      data: { enrolledCount: { increment: 1 } },
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      intent: expect.objectContaining({ status: "SUCCESS" }),
    }));
  });

  it("rejects a second payment when the enrollment already has a SUCCESS intent", async () => {
    prisma.enrollment.findUnique.mockResolvedValue({
      enrollmentId: "enrollment-1",
      studentUserId: "student-1",
      status: "PENDING_PAYMENT",
      class: { packagePriceMinor: 250000n },
    });
    prisma.user.findUnique.mockResolvedValue({ dateOfBirth: new Date("2000-01-01T00:00:00.000Z") });
    prisma.paymentIntent.findFirst.mockResolvedValue(paymentIntent({ status: "SUCCESS" }));
    const req = {
      id: "req-2",
      user: { userId: "student-1" },
      body: {
        enrollmentId: "enrollment-1",
        amountSatang: 250000,
        method: "card",
        omiseToken: "tok_test",
      },
      headers: {},
    };
    const res = response();

    await createPaymentIntent(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: "PAYMENT_ALREADY_COMPLETED" }),
    });
    expect(omiseMock.createOmiseCharge).not.toHaveBeenCalled();
  });

  it("revokes access and creates a pending commission-only clawback for a refund", async () => {
    prisma.paymentIntent.findUnique.mockResolvedValue(
      paymentIntent({ status: "SUCCESS", paidAt: new Date("2026-08-13T00:00:00.000Z") }),
    );
    prisma.enrollment.findUnique.mockResolvedValue({
      enrollmentId: "enrollment-1",
      classId: "class-1",
      class: { tutorUserId: "tutor-1", enrolledCount: 1 },
    });
    prisma.adjustment.findFirst.mockResolvedValue(null);
    prisma.settlementRun.findFirst.mockResolvedValue(null);
    prisma.settlementRun.create.mockResolvedValue({
      settlementRunId: "run-adjustment-holder",
      status: "ADJUSTMENT_PENDING",
      periodMonth: "2026-08",
    });
    prisma.enrollment.updateMany.mockResolvedValue({ count: 1 });
    prisma.enrollmentPackage.updateMany.mockResolvedValue({ count: 1 });
    prisma.class.update.mockResolvedValue({});
    prisma.adjustment.create.mockResolvedValue({ adjustmentId: "adj-1" });
    omiseMock.retrieveOmiseCharge.mockResolvedValue({
      id: "chrg_1",
      amount: 250000,
      currency: "THB",
      metadata: { paymentIntentId: "pi-1" },
      status: "failed",
      paid: false,
    });

    const req = {
      body: {
        type: "charge.refunded",
        id: "evt-refund-1",
        data: {
          id: "chrg_1",
          status: "failed",
          metadata: { paymentIntentId: "pi-1" },
        },
      },
      headers: {},
    };
    const res = response();

    await handleWebhook(req as never, res as never);

    expect(prisma.enrollment.updateMany).toHaveBeenCalledWith({
      where: {
        enrollmentId: "enrollment-1",
        status: { in: ["PENDING_PAYMENT", "ACTIVE"] },
      },
      data: { status: "REVOKED", paymentExpiresAt: null },
    });
    expect(prisma.adjustment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        settlementRunId: "run-adjustment-holder",
        tutorUserId: "tutor-1",
        status: "PENDING",
      }),
    });
    const adjustment = prisma.adjustment.create.mock.calls[0][0].data;
    expect(typeof adjustment.amountMinor).toBe("bigint");
    expect(adjustment.amountMinor).toBeLessThan(0n);
    expect(adjustment.amountMinor).toBeGreaterThan(-250000n);
    expect(adjustment.volumeMinor).toBe(-250000n);
    expect(prisma.paymentIntent.update).toHaveBeenCalledWith({
      where: { paymentIntentId: "pi-1" },
      data: {
        status: "REFUNDED",
        providerRef: "chrg_1",
      },
    });
    expect(prisma.paymentEvent.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("does not fulfill a signed event when the retrieved charge does not match the intent", async () => {
    prisma.paymentIntent.findUnique.mockResolvedValue(paymentIntent({ status: "PENDING" }));
    omiseMock.retrieveOmiseCharge.mockResolvedValue({
      id: "chrg_other",
      amount: 250000,
      currency: "THB",
      metadata: { paymentIntentId: "pi-1" },
      status: "successful",
      paid: true,
    });
    const req = {
      body: {
        type: "charge.complete",
        data: {
          id: "chrg_1",
          status: "successful",
          metadata: { paymentIntentId: "pi-1" },
        },
      },
      headers: {},
    };
    const res = response();

    await handleWebhook(req as never, res as never);

    expect(prisma.paymentIntent.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
