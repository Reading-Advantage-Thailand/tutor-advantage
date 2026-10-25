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
    updateMany: vi.fn(),
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
  retrieveOmiseToken: vi.fn(),
  retrieveOmiseDispute: vi.fn(),
  listOmiseDisputes: vi.fn(),
  listOmiseRefunds: vi.fn(),
  omiseRefId: (ref: unknown) =>
    typeof ref === "string" ? ref : (ref as { id?: string } | null)?.id ?? null,
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
    refundedAmountMinor: 0n,
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
    prisma.paymentIntent.updateMany.mockResolvedValue({ count: 1 });
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

  it("does not deduplicate a later paid notification as the earlier pending event", async () => {
    const pendingRequest = {
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
    const pendingResponse = response();

    await handleWebhook(pendingRequest as never, pendingResponse as never);
    const pendingEventId =
      prisma.paymentEvent.create.mock.calls[0][0].data.providerEventId;

    prisma.paymentIntent.findUnique.mockResolvedValue(paymentIntent({ status: "PENDING" }));
    prisma.paymentIntent.findFirst.mockResolvedValue(null);
    prisma.paymentIntent.update.mockResolvedValue(paymentIntent({ status: "SUCCESS" }));
    prisma.enrollment.findUnique.mockResolvedValue({
      status: "PENDING_PAYMENT",
      classId: "class-1",
      class: { tutorUserId: "tutor-1" },
    });
    prisma.enrollment.update.mockResolvedValue({});
    prisma.enrollmentPackage.updateMany.mockResolvedValue({ count: 0 });
    prisma.paymentReceipt.upsert.mockResolvedValue({});
    omiseMock.retrieveOmiseCharge.mockResolvedValue({
      id: "chrg_1",
      amount: 250000,
      currency: "THB",
      metadata: { paymentIntentId: "pi-1" },
      status: "successful",
      paid: true,
    });

    const successfulRequest = {
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
    const successfulResponse = response();

    await handleWebhook(successfulRequest as never, successfulResponse as never);

    const eventCalls = prisma.paymentEvent.create.mock.calls;
    expect(eventCalls).toHaveLength(2);
    expect(eventCalls[1][0].data.providerEventId).not.toBe(pendingEventId);
    expect(prisma.paymentIntent.update).toHaveBeenCalledWith({
      where: { paymentIntentId: "pi-1" },
      data: {
        status: "SUCCESS",
        providerRef: "chrg_1",
        paidAt: expect.any(Date),
        earningTutorUserId: "tutor-1",
      },
    });
  });

  it("does not let a stale failure notification move a paid intent backwards", async () => {
    prisma.paymentIntent.findUnique.mockResolvedValue(
      paymentIntent({ status: "SUCCESS", paidAt: new Date("2026-08-14T01:00:00.000Z") }),
    );
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
        type: "charge.update",
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

    expect(prisma.paymentIntent.update).not.toHaveBeenCalled();
    expect(prisma.paymentEvent.create).toHaveBeenCalledOnce();
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
      class: { tutorUserId: "tutor-original" },
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
        earningTutorUserId: "tutor-original",
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

  it("does not disclose an idempotency-key payment to another student", async () => {
    prisma.enrollment.findUnique.mockResolvedValue({
      enrollmentId: "enrollment-2",
      studentUserId: "student-2",
      status: "PENDING_PAYMENT",
      class: { packagePriceMinor: 250000n },
    });
    prisma.user.findUnique.mockResolvedValue({ dateOfBirth: new Date("2000-01-01T00:00:00.000Z") });
    prisma.paymentIntent.findUnique.mockResolvedValue(paymentIntent({
      enrollmentId: "enrollment-1",
      studentUserId: "student-1",
      idempotencyKey: "shared-key",
      providerRef: "chrg_private",
      status: "PENDING",
    }));

    const req = {
      id: "req-idempotency",
      user: { userId: "student-2" },
      body: {
        enrollmentId: "enrollment-2",
        amountSatang: 250000,
        method: "card",
        omiseToken: "tok_test",
        idempotencyKey: "shared-key",
      },
      headers: {},
    };
    const res = response();

    await createPaymentIntent(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: "IDEMPOTENCY_KEY_REUSED" }),
    });
    expect(omiseMock.retrieveOmiseCharge).not.toHaveBeenCalled();
    expect(omiseMock.createOmiseCharge).not.toHaveBeenCalled();
  });

  it("serializes the refunded amount when returning an existing payment intent", async () => {
    prisma.enrollment.findUnique.mockResolvedValue({
      enrollmentId: "enrollment-1",
      studentUserId: "student-1",
      status: "PENDING_PAYMENT",
      class: { packagePriceMinor: 250000n },
    });
    prisma.user.findUnique.mockResolvedValue({ dateOfBirth: new Date("2000-01-01T00:00:00.000Z") });
    prisma.paymentIntent.findFirst.mockResolvedValue(paymentIntent({ status: "PENDING", refundedAmountMinor: 0n }));

    const req = {
      id: "req-existing-payment",
      user: { userId: "student-1" },
      body: { enrollmentId: "enrollment-1", amountSatang: 250000, method: "promptpay" },
      headers: {},
    };
    const res = response();

    await createPaymentIntent(req as never, res as never);

    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.intent).toMatchObject({ amountMinor: 250000, refundedAmountMinor: 0 });
    expect(() => JSON.stringify(responseBody)).not.toThrow();
  });

  it("handles a real Omise refund.create event: revokes access, no clawback while commission is unpaid", async () => {
    const intent = paymentIntent({
      status: "SUCCESS",
      paidAt: new Date("2026-08-13T00:00:00.000Z"),
      refundedAmountMinor: 0n,
      commissionSettlementRunId: null,
    });
    prisma.paymentIntent.findFirst.mockResolvedValue(intent);
    prisma.paymentIntent.findUnique.mockResolvedValue(intent);
    prisma.enrollment.updateMany.mockResolvedValue({ count: 1 });
    prisma.enrollmentPackage.updateMany.mockResolvedValue({ count: 1 });
    prisma.enrollment.findUnique.mockResolvedValue({
      classId: "class-1",
      class: { enrolledCount: 1 },
    });
    prisma.class.update.mockResolvedValue({});
    omiseMock.retrieveOmiseCharge.mockResolvedValue({
      id: "chrg_1",
      amount: 250000,
      currency: "THB",
      metadata: { paymentIntentId: "pi-1" },
      status: "successful",
      paid: true,
      refunded_amount: 250000,
    });

    // Real Omise shape: data is a refund object pointing at the charge.
    const req = {
      body: {
        object: "event",
        id: "evnt_refund_1",
        key: "refund.create",
        data: { object: "refund", id: "rfnd_1", amount: 250000, currency: "thb", charge: "chrg_1" },
      },
      headers: {},
    };
    const res = response();

    await handleWebhook(req as never, res as never);

    expect(prisma.paymentIntent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { providerRef: "chrg_1" } }),
    );
    expect(prisma.paymentIntent.update).toHaveBeenCalledWith({
      where: { paymentIntentId: "pi-1" },
      data: { refundedAmountMinor: 250000n, status: "REFUNDED" },
    });
    expect(prisma.enrollment.updateMany).toHaveBeenCalledWith({
      where: {
        enrollmentId: "enrollment-1",
        status: { in: ["PENDING_PAYMENT", "ACTIVE"] },
      },
      data: { status: "REVOKED", paymentExpiresAt: null },
    });
    // Commission not paid yet (inside hold period): nothing to claw back.
    expect(prisma.adjustment.create).not.toHaveBeenCalled();
    expect(prisma.paymentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ paymentIntentId: "pi-1", eventType: "refund.create" }),
    });
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
