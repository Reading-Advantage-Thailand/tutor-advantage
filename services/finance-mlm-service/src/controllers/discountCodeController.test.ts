import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => {
  const mock: Record<string, any> = {
    class: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    classBookCycle: { findUnique: vi.fn() },
    discountCode: {
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      fields: { maxRedemptions: "discount_codes.max_redemptions" },
    },
    discountCodeRedemption: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    enrollment: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    enrollmentPackage: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    paymentIntent: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    paymentEvent: { create: vi.fn() },
    paymentReceipt: { upsert: vi.fn() },
    auditEvent: { create: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    userConsent: { findFirst: vi.fn() },
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
  };
  mock.$transaction = vi.fn((fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});

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

import {
  createDiscountCode,
  getDiscountCodeRedemptions,
  getDiscountCodes,
  previewDiscountCode,
  redeemDiscountCode,
  voidDiscountCode,
} from "./discountCodeController";

const STUDENT_ID = "11111111-1111-4111-8111-111111111111";
const CLASS_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_CLASS_ID = "33333333-3333-4333-8333-333333333333";
const CODE_ID = "44444444-4444-4444-8444-444444444444";
const ENROLLMENT_ID = "55555555-5555-4555-8555-555555555555";
const PACKAGE_ID = "66666666-6666-4666-8666-666666666666";
const CYCLE_ID = "77777777-7777-4777-8777-777777777777";
const ADMIN_ID = "88888888-8888-4888-8888-888888888888";
const TUTOR_ID = "99999999-9999-4999-8999-999999999999";
const INTENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MAX_REF = "discount_codes.max_redemptions";

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

function studentRequest(body: Record<string, unknown>) {
  return { id: "req-1", user: { userId: STUDENT_ID, role: "STUDENT" }, body, headers: {} };
}

function adminRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-admin",
    user: { userId: ADMIN_ID, role: "ADMIN" },
    body: {},
    query: {},
    params: {},
    headers: {},
    ...overrides,
  };
}

function discountCodeRow(overrides: Record<string, unknown> = {}) {
  return {
    discountCodeId: CODE_ID,
    code: "DC-ABCD-EFGH",
    classId: CLASS_ID,
    maxRedemptions: 1,
    redeemedCount: 0,
    status: "ACTIVE",
    note: null,
    createdByUserId: ADMIN_ID,
    creationIdempotencyKey: null,
    expiresAt: null,
    voidedAt: null,
    voidedByUserId: null,
    voidReason: null,
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    updatedAt: new Date("2026-11-01T00:00:00.000Z"),
    ...overrides,
  };
}

function enrollmentRow(overrides: Record<string, unknown> = {}) {
  return {
    enrollmentId: ENROLLMENT_ID,
    classId: CLASS_ID,
    studentUserId: STUDENT_ID,
    status: "PENDING_PAYMENT",
    class: { classId: CLASS_ID, tutorUserId: TUTOR_ID, packagePriceMinor: 300000n },
    ...overrides,
  };
}

function errorCode(res: ReturnType<typeof createResponse>) {
  return res.body?.error?.code;
}

/** Payment intents created during a test, so fulfilment reads back what redeem wrote. */
let intents: Map<string, Record<string, unknown>>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));

  intents = new Map();
  prisma.paymentIntent.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    const row = {
      paymentIntentId: INTENT_ID,
      refundedAmountMinor: 0n,
      paidAt: null,
      earningTutorUserId: null,
      createdAt: new Date("2026-11-02T03:00:00.000Z"),
      updatedAt: new Date("2026-11-02T03:00:00.000Z"),
      ...data,
      enrollmentPackageId: data.enrollmentPackageId ?? null,
    };
    intents.set(INTENT_ID, row);
    return row;
  });
  prisma.paymentIntent.findUnique.mockImplementation(
    async ({ where }: { where: { paymentIntentId: string } }) => intents.get(where.paymentIntentId) ?? null,
  );
  prisma.paymentIntent.update.mockImplementation(
    async ({ where, data }: { where: { paymentIntentId: string }; data: Record<string, unknown> }) => {
      const row = { ...intents.get(where.paymentIntentId), ...data };
      intents.set(where.paymentIntentId, row);
      return row;
    },
  );
  prisma.paymentIntent.findFirst.mockResolvedValue(null);
  prisma.paymentIntent.findMany.mockResolvedValue([]);
  prisma.paymentIntent.updateMany.mockResolvedValue({ count: 1 });

  prisma.enrollment.findUnique.mockResolvedValue(enrollmentRow());
  prisma.enrollment.update.mockResolvedValue({});
  prisma.enrollmentPackage.update.mockResolvedValue({});
  prisma.enrollmentPackage.updateMany.mockResolvedValue({ count: 0 });
  prisma.class.update.mockResolvedValue({});
  prisma.paymentReceipt.upsert.mockResolvedValue({});
  prisma.paymentEvent.create.mockResolvedValue({});
  prisma.auditEvent.create.mockResolvedValue({});
  prisma.user.findUnique.mockResolvedValue({ dateOfBirth: new Date("2000-01-01T00:00:00.000Z") });
  prisma.userConsent.findFirst.mockResolvedValue(null);
  prisma.discountCode.findUnique.mockResolvedValue(discountCodeRow());
  prisma.discountCodeRedemption.findUnique.mockResolvedValue(null);
  prisma.discountCodeRedemption.findFirst.mockResolvedValue(null);
  prisma.discountCodeRedemption.create.mockResolvedValue({});
  prisma.$executeRaw.mockResolvedValue(1);
});

describe("discountCodeController.previewDiscountCode", () => {
  beforeEach(() => {
    prisma.class.findUnique.mockResolvedValue({ classId: CLASS_ID, packagePriceMinor: 300000n });
  });

  it("is for students only", async () => {
    const res = createResponse();
    await previewDiscountCode(
      { ...studentRequest({ code: "DC-ABCD-EFGH", classId: CLASS_ID }), user: { userId: TUTOR_ID, role: "TUTOR" } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe("STUDENT_ROLE_REQUIRED");
  });

  it("rejects a missing or malformed classId / cycleId", async () => {
    for (const body of [
      { code: "DC-ABCD-EFGH" },
      { code: "DC-ABCD-EFGH", classId: "class-1" },
      { code: "DC-ABCD-EFGH", classId: CLASS_ID, cycleId: "cycle-1" },
    ]) {
      const res = createResponse();
      await previewDiscountCode(studentRequest(body) as never, res as never);
      expect(res.statusCode).toBe(400);
      expect(errorCode(res)).toBe("INVALID_REQUEST");
    }
  });

  it("quotes the class price as fully discounted without writing anything", async () => {
    const res = createResponse();
    await previewDiscountCode(studentRequest({ code: " dc-abcd efgh ", classId: CLASS_ID }) as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      discount: {
        code: "DC-ABCD-EFGH",
        discountCodeId: CODE_ID,
        classId: CLASS_ID,
        cycleId: null,
        originalAmountSatang: 300000,
        discountSatang: 300000,
        finalAmountSatang: 0,
      },
    });
    expect(prisma.discountCode.findUnique).toHaveBeenCalledWith({ where: { code: "DC-ABCDEFGH" } });
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.discountCodeRedemption.create).not.toHaveBeenCalled();
  });

  it("uses the book cycle price, and only for a cycle of the same class", async () => {
    prisma.classBookCycle.findUnique.mockResolvedValueOnce({ classId: CLASS_ID, packagePriceMinor: 350000n });
    const res = createResponse();
    await previewDiscountCode(
      studentRequest({ code: "DC-ABCD-EFGH", classId: CLASS_ID, cycleId: CYCLE_ID }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.discount).toMatchObject({ cycleId: CYCLE_ID, originalAmountSatang: 350000, finalAmountSatang: 0 });

    prisma.classBookCycle.findUnique.mockResolvedValueOnce({ classId: OTHER_CLASS_ID, packagePriceMinor: 1n });
    const res2 = createResponse();
    await previewDiscountCode(
      studentRequest({ code: "DC-ABCD-EFGH", classId: CLASS_ID, cycleId: CYCLE_ID }) as never,
      res2 as never,
    );
    expect(res2.statusCode).toBe(400);
    expect(errorCode(res2)).toBe("INVALID_REQUEST");
  });

  it("reports an unknown class and a code for another class", async () => {
    prisma.class.findUnique.mockResolvedValueOnce(null);
    const res = createResponse();
    await previewDiscountCode(studentRequest({ code: "DC-ABCD-EFGH", classId: CLASS_ID }) as never, res as never);
    expect(res.statusCode).toBe(404);
    expect(errorCode(res)).toBe("CLASS_NOT_FOUND");

    prisma.discountCode.findUnique.mockResolvedValueOnce(discountCodeRow({ classId: OTHER_CLASS_ID }));
    const res2 = createResponse();
    await previewDiscountCode(studentRequest({ code: "DC-ABCD-EFGH", classId: CLASS_ID }) as never, res2 as never);
    expect(res2.statusCode).toBe(409);
    expect(errorCode(res2)).toBe("DISCOUNT_CODE_WRONG_CLASS");
  });

  it("answers odd input with not found, not a 400", async () => {
    const res = createResponse();
    await previewDiscountCode(studentRequest({ code: "ไม่ใช่โค้ด", classId: CLASS_ID }) as never, res as never);
    expect(res.statusCode).toBe(404);
    expect(errorCode(res)).toBe("DISCOUNT_CODE_NOT_FOUND");
  });
});

describe("discountCodeController.redeemDiscountCode", () => {
  async function redeem(body: Record<string, unknown> = {}) {
    const res = createResponse();
    await redeemDiscountCode(
      studentRequest({ code: "dc-abcd-efgh", enrollmentId: ENROLLMENT_ID, ...body }) as never,
      res as never,
    );
    return res;
  }

  function expectNoRedemptionWrites() {
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.paymentIntent.create).not.toHaveBeenCalled();
    expect(prisma.discountCodeRedemption.create).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  }

  it("activates an enrollment with a 0 THB discount payment in one transaction", async () => {
    const res = await redeem();

    expect(res.statusCode).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    const intentData = prisma.paymentIntent.create.mock.calls[0][0].data;
    expect(intentData).toMatchObject({
      enrollmentId: ENROLLMENT_ID,
      studentUserId: STUDENT_ID,
      amountMinor: 0n,
      currency: "THB",
      method: "DISCOUNT_CODE",
      status: "PENDING",
    });
    const providerRef = intentData.idempotencyKey as string;
    expect(providerRef).toMatch(/^discount:[0-9a-f-]{36}$/);
    const redemptionId = providerRef.slice("discount:".length);

    // One use claimed with a guarded UPDATE.
    const [sql, codeId] = prisma.$executeRaw.mock.calls[0];
    expect(sql.join("?")).toContain("redeemed_count < max_redemptions");
    expect(sql.join("?")).toContain("status = 'ACTIVE'");
    expect(codeId).toBe(CODE_ID);

    expect(prisma.discountCodeRedemption.create).toHaveBeenCalledWith({
      data: {
        redemptionId,
        discountCodeId: CODE_ID,
        studentUserId: STUDENT_ID,
        classId: CLASS_ID,
        enrollmentId: ENROLLMENT_ID,
        enrollmentPackageId: null,
        paymentIntentId: INTENT_ID,
        originalAmountMinor: 300000n,
        discountAmountMinor: 300000n,
      },
    });
    expect(prisma.paymentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentIntentId: INTENT_ID,
        providerEventId: `${providerRef}:redeemed`,
        eventType: "discount_code.redeemed",
        rawPayload: { discountCodeId: CODE_ID, redemptionId, code: "DC-ABCD-EFGH", originalAmountMinor: "300000" },
      }),
    });

    // Activated through the shared fulfilment path (enrollment + packages + receipt).
    expect(prisma.paymentIntent.update).toHaveBeenCalledWith({
      where: { paymentIntentId: INTENT_ID },
      data: { status: "SUCCESS", providerRef, paidAt: expect.any(Date), earningTutorUserId: TUTOR_ID },
    });
    expect(prisma.enrollment.update).toHaveBeenCalledWith({
      where: { enrollmentId: ENROLLMENT_ID },
      data: { status: "ACTIVE", paymentTransactionId: providerRef },
    });
    expect(prisma.enrollmentPackage.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: ENROLLMENT_ID, status: "PENDING_PAYMENT" },
      data: { status: "ACTIVE", paymentTransactionId: providerRef },
    });
    expect(prisma.paymentReceipt.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ grossAmountMinor: 0n, netAmountMinor: 0n, vatAmountMinor: 0n }),
      }),
    );
    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: STUDENT_ID,
        action: "DISCOUNT_CODE_REDEEM",
        entityType: "DiscountCode",
        entityId: CODE_ID,
        payload: expect.objectContaining({
          redemptionId,
          paymentIntentId: INTENT_ID,
          enrollmentId: ENROLLMENT_ID,
          enrollmentPackageId: null,
          classId: CLASS_ID,
          originalAmountMinor: "300000",
          requestId: "req-1",
        }),
      }),
    });

    expect(res.body).toEqual({
      intent: expect.objectContaining({
        paymentIntentId: INTENT_ID,
        status: "SUCCESS",
        amountMinor: 0,
        method: "DISCOUNT_CODE",
        providerRef,
      }),
      checkout: null,
      discount: {
        code: "DC-ABCD-EFGH",
        discountCodeId: CODE_ID,
        classId: CLASS_ID,
        cycleId: null,
        originalAmountSatang: 300000,
        discountSatang: 300000,
        finalAmountSatang: 0,
      },
    });
    expect(() => JSON.stringify(res.body)).not.toThrow();
    expect(omiseMock.createOmiseCharge).not.toHaveBeenCalled();
    expect(omiseMock.retrieveOmiseCharge).not.toHaveBeenCalled();
  });

  it("activates a book-cycle package at the cycle price", async () => {
    prisma.enrollment.findUnique.mockResolvedValue(enrollmentRow({ status: "ACTIVE" }));
    prisma.enrollmentPackage.findUnique.mockResolvedValue({
      enrollmentPackageId: PACKAGE_ID,
      enrollmentId: ENROLLMENT_ID,
      studentUserId: STUDENT_ID,
      classBookCycleId: CYCLE_ID,
      status: "PENDING_PAYMENT",
      classBookCycle: { classBookCycleId: CYCLE_ID, packagePriceMinor: 350000n },
    });

    const res = await redeem({ enrollmentPackageId: PACKAGE_ID });

    expect(res.statusCode).toBe(200);
    expect(prisma.paymentIntent.findMany).toHaveBeenCalledWith({
      where: {
        enrollmentId: ENROLLMENT_ID,
        enrollmentPackageId: PACKAGE_ID,
        studentUserId: STUDENT_ID,
        status: { not: "FAILED" },
      },
    });
    expect(prisma.paymentIntent.create.mock.calls[0][0].data.enrollmentPackageId).toBe(PACKAGE_ID);
    const providerRef = prisma.paymentIntent.create.mock.calls[0][0].data.providerRef;
    expect(prisma.enrollmentPackage.update).toHaveBeenCalledWith({
      where: { enrollmentPackageId: PACKAGE_ID },
      data: { status: "ACTIVE", paymentTransactionId: providerRef },
    });
    expect(prisma.enrollment.update).not.toHaveBeenCalled();
    expect(prisma.discountCodeRedemption.create.mock.calls[0][0].data).toMatchObject({
      enrollmentPackageId: PACKAGE_ID,
      originalAmountMinor: 350000n,
    });
    expect(res.body.discount).toMatchObject({ cycleId: CYCLE_ID, originalAmountSatang: 350000, finalAmountSatang: 0 });
  });

  it("returns the earlier result when the same redemption is retried", async () => {
    const paidIntent = {
      paymentIntentId: INTENT_ID,
      enrollmentId: ENROLLMENT_ID,
      enrollmentPackageId: null,
      studentUserId: STUDENT_ID,
      amountMinor: 0n,
      refundedAmountMinor: 0n,
      currency: "THB",
      method: "DISCOUNT_CODE",
      status: "SUCCESS",
      idempotencyKey: "discount:r1",
      providerRef: "discount:r1",
      paidAt: new Date("2026-11-02T03:00:00.000Z"),
      createdAt: new Date("2026-11-02T03:00:00.000Z"),
      updatedAt: new Date("2026-11-02T03:00:00.000Z"),
    };
    prisma.enrollment.findUnique.mockResolvedValue(enrollmentRow({ status: "ACTIVE" }));
    prisma.discountCodeRedemption.findFirst.mockResolvedValue({
      redemptionId: "r1",
      discountCodeId: CODE_ID,
      classId: CLASS_ID,
      enrollmentId: ENROLLMENT_ID,
      enrollmentPackageId: null,
      originalAmountMinor: 300000n,
      discountCode: discountCodeRow({ redeemedCount: 1 }),
      paymentIntent: paidIntent,
    });

    const res = await redeem();

    expect(res.statusCode).toBe(200);
    expect(prisma.discountCodeRedemption.findFirst).toHaveBeenCalledWith({
      where: { studentUserId: STUDENT_ID, discountCode: { code: "DC-ABCD-EFGH" } },
      include: { discountCode: true, paymentIntent: true },
    });
    expect(res.body).toMatchObject({
      intent: { paymentIntentId: INTENT_ID, status: "SUCCESS", amountMinor: 0 },
      checkout: null,
      discount: { code: "DC-ABCD-EFGH", originalAmountSatang: 300000, finalAmountSatang: 0 },
    });
    expectNoRedemptionWrites();
  });

  it.each([
    ["used up", { redeemedCount: 1 }, "DISCOUNT_CODE_USED_UP"],
    ["expired", { expiresAt: new Date("2026-01-01T00:00:00.000Z") }, "DISCOUNT_CODE_EXPIRED"],
    ["void", { status: "VOID" }, "DISCOUNT_CODE_VOID"],
    ["for another class", { classId: OTHER_CLASS_ID }, "DISCOUNT_CODE_WRONG_CLASS"],
  ])("rejects a code that is %s", async (_label, overrides, code) => {
    prisma.discountCode.findUnique.mockResolvedValue(discountCodeRow(overrides));
    const res = await redeem();
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe(code);
    expectNoRedemptionWrites();
  });

  it("rejects a code this student already used for another enrollment", async () => {
    prisma.discountCode.findUnique.mockResolvedValue(discountCodeRow({ maxRedemptions: 5, redeemedCount: 1 }));
    prisma.discountCodeRedemption.findFirst.mockResolvedValue({
      enrollmentId: "other-enrollment",
      enrollmentPackageId: null,
      paymentIntent: { status: "SUCCESS" },
    });
    prisma.discountCodeRedemption.findUnique.mockResolvedValue({ redemptionId: "r-old" });
    const res = await redeem();
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe("DISCOUNT_CODE_ALREADY_USED");
    expectNoRedemptionWrites();
  });

  it("applies the same date-of-birth / guardian gate as a paid checkout", async () => {
    prisma.user.findUnique.mockResolvedValue({ dateOfBirth: null });
    const res = await redeem();
    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe("DATE_OF_BIRTH_REQUIRED");

    prisma.user.findUnique.mockResolvedValue({ dateOfBirth: new Date("2015-01-01T00:00:00.000Z") });
    prisma.userConsent.findFirst.mockResolvedValue(null);
    const res2 = await redeem();
    expect(res2.statusCode).toBe(403);
    expect(errorCode(res2)).toBe("GUARDIAN_CONSENT_REQUIRED");
    expectNoRedemptionWrites();
  });

  it("runs the guardian gate on the transaction client (no second pool connection)", async () => {
    const txUser = { findUnique: vi.fn().mockResolvedValue({ dateOfBirth: null }) };
    prisma.$transaction.mockImplementationOnce((fn: (tx: unknown) => unknown) => fn({ ...prisma, user: txUser }));
    const res = await redeem();
    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe("DATE_OF_BIRTH_REQUIRED");
    expect(txUser.findUnique).toHaveBeenCalledWith({
      where: { userId: STUDENT_ID },
      select: { dateOfBirth: true },
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("retires a pending intent that never got an Omise charge, without cancelling the enrollment", async () => {
    prisma.paymentIntent.findMany.mockResolvedValue([
      {
        paymentIntentId: "pi-stuck",
        status: "PENDING",
        providerRef: null,
        method: "promptpay",
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
      },
    ]);

    const res = await redeem();

    expect(res.statusCode).toBe(200);
    expect(prisma.paymentIntent.updateMany).toHaveBeenCalledWith({
      where: {
        paymentIntentId: "pi-stuck",
        status: "PENDING",
        providerRef: null,
        createdAt: { lt: expect.any(Date) },
      },
      data: { status: "FAILED", updatedAt: expect.any(Date) },
    });
    expect(prisma.enrollment.updateMany).not.toHaveBeenCalled();
    expect(res.body.intent.status).toBe("SUCCESS");
  });

  it("does not retire a recent uncharged intent whose Omise call may still be in flight", async () => {
    prisma.paymentIntent.findMany.mockResolvedValue([
      {
        paymentIntentId: "pi-creating",
        status: "PENDING",
        providerRef: null,
        method: "card",
        createdAt: new Date(Date.now() - 5 * 1000),
      },
    ]);

    const res = await redeem();

    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe("PAYMENT_IN_PROGRESS");
    expect(prisma.paymentIntent.updateMany).not.toHaveBeenCalled();
    expectNoRedemptionWrites();
  });

  it("refuses while a live Omise charge is pending", async () => {
    prisma.paymentIntent.findMany.mockResolvedValue([
      { paymentIntentId: "pi-live", status: "PENDING", providerRef: "chrg_live", method: "promptpay" },
    ]);
    const res = await redeem();
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe("PAYMENT_IN_PROGRESS");
    expect(prisma.paymentIntent.updateMany).not.toHaveBeenCalled();
    expect(omiseMock.retrieveOmiseCharge).not.toHaveBeenCalled();
    expectNoRedemptionWrites();
  });

  it("refuses an enrollment that is already paid", async () => {
    prisma.enrollment.findUnique.mockResolvedValue(enrollmentRow({ status: "ACTIVE" }));
    const res = await redeem();
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe("PAYMENT_ALREADY_COMPLETED");

    prisma.enrollment.findUnique.mockResolvedValue(enrollmentRow({ status: "CANCELLED" }));
    const res2 = await redeem();
    expect(res2.statusCode).toBe(409);
    expect(errorCode(res2)).toBe("ENROLLMENT_NOT_PENDING_PAYMENT");
    expectNoRedemptionWrites();
  });

  it("checks the enrollment belongs to the student", async () => {
    prisma.enrollment.findUnique.mockResolvedValue(enrollmentRow({ studentUserId: TUTOR_ID }));
    const res = await redeem();
    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe("FORBIDDEN");

    prisma.enrollment.findUnique.mockResolvedValue(null);
    const res2 = await redeem();
    expect(res2.statusCode).toBe(404);
    expect(errorCode(res2)).toBe("ENROLLMENT_NOT_FOUND");

    const res3 = await redeem({ enrollmentId: "enrollment-1" });
    expect(res3.statusCode).toBe(400);
    expect(errorCode(res3)).toBe("INVALID_REQUEST");
  });

  it("reports the precise reason when another redemption wins the race", async () => {
    prisma.$executeRaw.mockResolvedValue(0);
    prisma.discountCode.findUnique
      .mockResolvedValueOnce(discountCodeRow())
      .mockResolvedValueOnce(discountCodeRow({ redeemedCount: 1 }));
    const res = await redeem();
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe("DISCOUNT_CODE_USED_UP");
    expect(prisma.paymentIntent.create).not.toHaveBeenCalled();
  });

  it("maps unique-index races to ALREADY_USED / PAYMENT_IN_PROGRESS", async () => {
    prisma.discountCodeRedemption.create.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
        meta: { modelName: "DiscountCodeRedemption", target: ["discount_code_id", "student_user_id"] },
      }),
    );
    const res = await redeem();
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe("DISCOUNT_CODE_ALREADY_USED");

    prisma.paymentIntent.create.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
        meta: { modelName: "PaymentIntent", target: "payment_intents_active_enrollment_key" },
      }),
    );
    const res2 = await redeem();
    expect(res2.statusCode).toBe(409);
    expect(errorCode(res2)).toBe("PAYMENT_IN_PROGRESS");
  });

  it("maps only the redemption-limit CHECK to USED_UP; other CHECK failures stay 500", async () => {
    prisma.$executeRaw.mockRejectedValueOnce(
      Object.assign(new Error("Raw query failed"), {
        code: "P2010",
        meta: {
          code: "23514",
          message:
            'new row for relation "discount_codes" violates check constraint "discount_codes_redemptions_within_limit"',
        },
      }),
    );
    const res = await redeem();
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe("DISCOUNT_CODE_USED_UP");

    prisma.enrollment.update.mockRejectedValueOnce(
      Object.assign(new Error("Raw query failed"), {
        code: "P2010",
        meta: { code: "23514", message: 'violates check constraint "enrollments_status_check"' },
      }),
    );
    const res2 = await redeem();
    expect(res2.statusCode).toBe(500);
    expect(errorCode(res2)).toBe("INTERNAL_SERVER_ERROR");
  });

  it("rolls back when another paid intent already activated the target", async () => {
    // fulfillPaymentIntentTx finds a SUCCESS intent for the same target.
    prisma.paymentIntent.findFirst.mockResolvedValue({ paymentIntentId: "pi-paid", status: "SUCCESS" });
    const res = await redeem();
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe("PAYMENT_ALREADY_COMPLETED");
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it("is for students only", async () => {
    const res = createResponse();
    await redeemDiscountCode(
      { ...studentRequest({ code: "DC-ABCD-EFGH", enrollmentId: ENROLLMENT_ID }), user: { userId: ADMIN_ID, role: "ADMIN" } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe("STUDENT_ROLE_REQUIRED");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("discountCodeController.createDiscountCode", () => {
  const future = "2999-12-31T16:59:59.999Z";

  beforeEach(() => {
    prisma.discountCode.findUnique.mockResolvedValue(null);
    prisma.discountCode.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      discountCodeRow({ ...data, discountCodeId: CODE_ID }),
    );
    prisma.class.findUnique.mockResolvedValue({ classId: CLASS_ID, title: "English", isDemo: false });
    prisma.class.findMany.mockResolvedValue([
      { classId: CLASS_ID, title: "English", tutorUserId: TUTOR_ID, packagePriceMinor: 300000n, book: { bookCode: "PO2" } },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { userId: TUTOR_ID, displayName: "T.นกเอี้ยง", email: "tutor@example.test" },
      { userId: ADMIN_ID, displayName: null, email: "admin@example.test" },
    ]);
  });

  it("is admin only", async () => {
    const res = createResponse();
    await createDiscountCode(
      adminRequest({ user: { userId: ADMIN_ID, role: "FINANCE_CHECKER" }, body: { classId: CLASS_ID } }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(403);
    expect(prisma.discountCode.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ classId: "class-1" }, "INVALID_CLASS_ID"],
    [{ classId: CLASS_ID, maxRedemptions: 0 }, "INVALID_MAX_REDEMPTIONS"],
    [{ classId: CLASS_ID, maxRedemptions: 501 }, "INVALID_MAX_REDEMPTIONS"],
    [{ classId: CLASS_ID, maxRedemptions: 1.5 }, "INVALID_MAX_REDEMPTIONS"],
    [{ classId: CLASS_ID, expiresAt: "2020-01-01T00:00:00Z" }, "INVALID_EXPIRY"],
    [{ classId: CLASS_ID, expiresAt: "tomorrow" }, "INVALID_EXPIRY"],
    [{ classId: CLASS_ID, note: "x".repeat(501) }, "INVALID_NOTE"],
  ])("rejects %o with %s", async (body, code) => {
    const res = createResponse();
    await createDiscountCode(adminRequest({ body }) as never, res as never);
    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe(code);
    expect(prisma.discountCode.create).not.toHaveBeenCalled();
  });

  it("requires an existing, non-demo class", async () => {
    prisma.class.findUnique.mockResolvedValueOnce(null);
    const res = createResponse();
    await createDiscountCode(adminRequest({ body: { classId: CLASS_ID } }) as never, res as never);
    expect(res.statusCode).toBe(404);
    expect(errorCode(res)).toBe("CLASS_NOT_FOUND");

    prisma.class.findUnique.mockResolvedValueOnce({ classId: CLASS_ID, title: "Demo", isDemo: true });
    const res2 = createResponse();
    await createDiscountCode(adminRequest({ body: { classId: CLASS_ID } }) as never, res2 as never);
    expect(res2.statusCode).toBe(409);
    expect(errorCode(res2)).toBe("CLASS_NOT_ELIGIBLE");
    expect(prisma.discountCode.create).not.toHaveBeenCalled();
  });

  it("issues a DC- code bound to the class and audits it", async () => {
    const res = createResponse();
    await createDiscountCode(
      adminRequest({
        headers: { "idempotency-key": "sheet-key-1" },
        body: { classId: CLASS_ID, maxRedemptions: 3, expiresAt: future, note: "  ชำระเงินสด  " },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(201);
    const data = prisma.discountCode.create.mock.calls[0][0].data;
    expect(data.code).toMatch(/^DC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(data).toMatchObject({
      classId: CLASS_ID,
      maxRedemptions: 3,
      note: "ชำระเงินสด",
      createdByUserId: ADMIN_ID,
      creationIdempotencyKey: "sheet-key-1",
      expiresAt: new Date(future),
    });
    expect(res.body.discountCode).toMatchObject({
      discountCodeId: CODE_ID,
      code: data.code,
      classId: CLASS_ID,
      classTitle: "English",
      bookCode: "PO2",
      packagePriceSatang: 300000,
      tutorUserId: TUTOR_ID,
      tutorName: "T.นกเอี้ยง",
      tutorEmail: "tutor@example.test",
      maxRedemptions: 3,
      redeemedCount: 0,
      remaining: 3,
      status: "ACTIVE",
      note: "ชำระเงินสด",
      expiresAt: future,
      createdByUserId: ADMIN_ID,
      createdByName: "admin@example.test",
      voidedAt: null,
    });
    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: ADMIN_ID,
        action: "DISCOUNT_CODE_CREATE",
        entityType: "DiscountCode",
        entityId: CODE_ID,
        payload: expect.objectContaining({ code: data.code, classId: CLASS_ID, maxRedemptions: 3 }),
      }),
    });
  });

  it("defaults to one use", async () => {
    const res = createResponse();
    await createDiscountCode(adminRequest({ body: { classId: CLASS_ID } }) as never, res as never);
    expect(res.statusCode).toBe(201);
    expect(prisma.discountCode.create.mock.calls[0][0].data).toMatchObject({
      maxRedemptions: 1,
      expiresAt: null,
      note: null,
      creationIdempotencyKey: null,
    });
  });

  it("returns the existing code when the Idempotency-Key is replayed", async () => {
    prisma.discountCode.findUnique.mockResolvedValueOnce(
      discountCodeRow({ creationIdempotencyKey: "sheet-key-1" }),
    );
    const res = createResponse();
    await createDiscountCode(
      adminRequest({ headers: { "idempotency-key": "sheet-key-1" }, body: { classId: CLASS_ID } }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(prisma.discountCode.findUnique).toHaveBeenCalledWith({
      where: { creationIdempotencyKey: "sheet-key-1" },
    });
    expect(res.body.discountCode).toMatchObject({ discountCodeId: CODE_ID, code: "DC-ABCD-EFGH" });
    expect(prisma.discountCode.create).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it("refuses a replayed Idempotency-Key for a different class", async () => {
    prisma.discountCode.findUnique.mockResolvedValueOnce(
      discountCodeRow({ classId: OTHER_CLASS_ID, creationIdempotencyKey: "sheet-key-1" }),
    );
    const res = createResponse();
    await createDiscountCode(
      adminRequest({ headers: { "idempotency-key": "sheet-key-1" }, body: { classId: CLASS_ID } }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("returns the racing request's code on a unique violation of the Idempotency-Key", async () => {
    prisma.discountCode.findUnique
      .mockResolvedValueOnce(null) // key lookup
      .mockResolvedValueOnce(null) // generated code is free
      .mockResolvedValueOnce(discountCodeRow({ creationIdempotencyKey: "sheet-key-1" })); // re-read by key
    prisma.discountCode.create.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );
    const res = createResponse();
    await createDiscountCode(
      adminRequest({ headers: { "idempotency-key": "sheet-key-1" }, body: { classId: CLASS_ID } }) as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.discountCode.discountCodeId).toBe(CODE_ID);
    expect(prisma.discountCode.create).toHaveBeenCalledTimes(1);
  });

  it("retries with a new code when the generated one collides", async () => {
    prisma.discountCode.create.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );
    const res = createResponse();
    await createDiscountCode(adminRequest({ body: { classId: CLASS_ID } }) as never, res as never);
    expect(res.statusCode).toBe(201);
    expect(prisma.discountCode.create).toHaveBeenCalledTimes(2);
  });
});

describe("discountCodeController.getDiscountCodes", () => {
  beforeEach(() => {
    prisma.discountCode.count.mockResolvedValue(1);
    prisma.discountCode.findMany.mockResolvedValue([discountCodeRow({ redeemedCount: 1 })]);
    prisma.$queryRaw.mockResolvedValue([
      { total: 10n, void_count: 2n, used_up_count: 3n, expired_count: 1n, redemptions: 7n },
    ]);
    prisma.class.findMany.mockResolvedValue([
      { classId: CLASS_ID, title: "English", tutorUserId: TUTOR_ID, packagePriceMinor: 300000n, book: { bookCode: "PO2" } },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { userId: TUTOR_ID, displayName: "T.นกเอี้ยง", email: "tutor@example.test" },
      { userId: ADMIN_ID, displayName: "แอดมิน", email: "admin@example.test" },
    ]);
  });

  it("is admin only", async () => {
    const res = createResponse();
    await getDiscountCodes(adminRequest({ user: { userId: ADMIN_ID, role: "FINANCE_CHECKER" } }) as never, res as never);
    expect(res.statusCode).toBe(403);
  });

  it("filters by effective status, search and class, and summarizes all codes", async () => {
    const res = createResponse();
    await getDiscountCodes(
      adminRequest({
        query: {
          page: "2",
          pageSize: "10",
          status: "used_up",
          q: "dc-ab",
          classId: CLASS_ID,
          sort: "redeemedCount",
          order: "asc",
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    const args = prisma.discountCode.findMany.mock.calls[0][0];
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(args.orderBy).toEqual([{ redeemedCount: "asc" }, { createdAt: "desc" }]);
    expect(args.where.AND[0]).toEqual({ status: "ACTIVE", redeemedCount: { gte: MAX_REF } });
    expect(args.where.AND[1].OR[0]).toEqual({ code: { contains: "dc-ab", mode: "insensitive" } });
    expect(args.where.AND[2]).toEqual({ classId: CLASS_ID });
    expect(prisma.discountCode.count).toHaveBeenCalledWith({ where: args.where });

    expect(res.body).toMatchObject({
      total: 1,
      page: 2,
      pageSize: 10,
      summary: { total: 10, ACTIVE: 4, USED_UP: 3, EXPIRED: 1, VOID: 2, redemptions: 7 },
    });
    expect(res.body.items[0]).toMatchObject({
      discountCodeId: CODE_ID,
      status: "USED_UP",
      remaining: 0,
      classTitle: "English",
      tutorName: "T.นกเอี้ยง",
      createdByName: "แอดมิน",
      createdAt: "2026-11-01T00:00:00.000Z",
    });
  });

  it("searches ids exactly and sorts expiry with no-expiry codes last", async () => {
    const res = createResponse();
    await getDiscountCodes(adminRequest({ query: { q: CODE_ID, sort: "expiresAt", order: "desc" } }) as never, res as never);
    const args = prisma.discountCode.findMany.mock.calls[0][0];
    expect(args.where.AND[1].OR).toContainEqual({ discountCodeId: CODE_ID });
    expect(args.where.AND[1].OR).toContainEqual({ classId: CODE_ID });
    expect(args.orderBy[0]).toEqual({ expiresAt: { sort: "desc", nulls: "last" } });
  });

  it("ignores unknown statuses and sort keys, and rejects a malformed classId", async () => {
    const res = createResponse();
    await getDiscountCodes(adminRequest({ query: { status: "DELETED", sort: "password" } }) as never, res as never);
    const args = prisma.discountCode.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ AND: [{}] });
    expect(args.orderBy).toEqual([{ createdAt: "desc" }]);
    expect(args.take).toBe(20);

    // Inherited object keys are not sort fields either.
    const resProto = createResponse();
    await getDiscountCodes(adminRequest({ query: { sort: "toString" } }) as never, resProto as never);
    expect(prisma.discountCode.findMany.mock.calls[1][0].orderBy).toEqual([{ createdAt: "desc" }]);

    const res2 = createResponse();
    await getDiscountCodes(adminRequest({ query: { classId: "abc" } }) as never, res2 as never);
    expect(res2.statusCode).toBe(400);
    expect(errorCode(res2)).toBe("INVALID_CLASS_ID");
  });
});

describe("discountCodeController.voidDiscountCode", () => {
  beforeEach(() => {
    prisma.class.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
  });

  it("validates the id and reason", async () => {
    const res = createResponse();
    await voidDiscountCode(adminRequest({ params: { discountCodeId: "c1" } }) as never, res as never);
    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe("INVALID_DISCOUNT_CODE_ID");

    const res2 = createResponse();
    await voidDiscountCode(
      adminRequest({ params: { discountCodeId: CODE_ID }, body: { reason: "no" } }) as never,
      res2 as never,
    );
    expect(res2.statusCode).toBe(400);
    expect(errorCode(res2)).toBe("INVALID_REASON");
    expect(prisma.discountCode.updateMany).not.toHaveBeenCalled();
  });

  it("voids an active code with a guarded update and audits the reason", async () => {
    prisma.discountCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.discountCode.findUnique.mockResolvedValue(
      discountCodeRow({ status: "VOID", voidReason: "ออกผิดคลาส", voidedAt: new Date("2026-11-02T03:00:00.000Z") }),
    );
    const res = createResponse();
    await voidDiscountCode(
      adminRequest({ params: { discountCodeId: CODE_ID }, body: { reason: " ออกผิดคลาส " } }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(prisma.discountCode.updateMany).toHaveBeenCalledWith({
      where: { discountCodeId: CODE_ID, status: "ACTIVE" },
      data: {
        status: "VOID",
        voidedAt: expect.any(Date),
        voidedByUserId: ADMIN_ID,
        voidReason: "ออกผิดคลาส",
        updatedAt: expect.any(Date),
      },
    });
    expect(res.body.discountCode).toMatchObject({ status: "VOID", voidReason: "ออกผิดคลาส" });
    expect(prisma.auditEvent.create.mock.calls[0][0].data).toMatchObject({
      action: "DISCOUNT_CODE_VOID",
      entityType: "DiscountCode",
      entityId: CODE_ID,
      payload: { reason: "ออกผิดคลาส", code: "DC-ABCD-EFGH" },
    });
  });

  it("returns 404 for an unknown code and 409 for one that is already void", async () => {
    prisma.discountCode.updateMany.mockResolvedValue({ count: 0 });
    prisma.discountCode.findUnique.mockResolvedValueOnce(null);
    const res = createResponse();
    await voidDiscountCode(adminRequest({ params: { discountCodeId: CODE_ID } }) as never, res as never);
    expect(res.statusCode).toBe(404);
    expect(errorCode(res)).toBe("DISCOUNT_CODE_NOT_FOUND");

    prisma.discountCode.findUnique.mockResolvedValueOnce(discountCodeRow({ status: "VOID" }));
    const res2 = createResponse();
    await voidDiscountCode(adminRequest({ params: { discountCodeId: CODE_ID } }) as never, res2 as never);
    expect(res2.statusCode).toBe(409);
    expect(errorCode(res2)).toBe("CANNOT_VOID");
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });
});

describe("discountCodeController.getDiscountCodeRedemptions", () => {
  it("returns 404 for an unknown code", async () => {
    prisma.discountCode.findUnique.mockResolvedValue(null);
    const res = createResponse();
    await getDiscountCodeRedemptions(adminRequest({ params: { discountCodeId: CODE_ID } }) as never, res as never);
    expect(res.statusCode).toBe(404);
    expect(errorCode(res)).toBe("DISCOUNT_CODE_NOT_FOUND");
  });

  it("lists who used the code, newest first", async () => {
    prisma.discountCode.findUnique.mockResolvedValue({ discountCodeId: CODE_ID });
    prisma.discountCodeRedemption.findMany.mockResolvedValue([
      {
        redemptionId: "r1",
        discountCodeId: CODE_ID,
        studentUserId: STUDENT_ID,
        classId: CLASS_ID,
        enrollmentId: ENROLLMENT_ID,
        enrollmentPackageId: null,
        paymentIntentId: INTENT_ID,
        originalAmountMinor: 300000n,
        discountAmountMinor: 300000n,
        createdAt: new Date("2026-11-02T03:00:00.000Z"),
      },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { userId: STUDENT_ID, displayName: "นักเรียน", email: "student@example.test" },
    ]);
    prisma.enrollment.findMany.mockResolvedValue([{ enrollmentId: ENROLLMENT_ID, status: "ACTIVE" }]);

    const res = createResponse();
    await getDiscountCodeRedemptions(adminRequest({ params: { discountCodeId: CODE_ID } }) as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(prisma.discountCodeRedemption.findMany).toHaveBeenCalledWith({
      where: { discountCodeId: CODE_ID },
      orderBy: { createdAt: "desc" },
    });
    expect(res.body).toEqual({
      items: [
        {
          redemptionId: "r1",
          studentUserId: STUDENT_ID,
          studentName: "นักเรียน",
          studentEmail: "student@example.test",
          enrollmentId: ENROLLMENT_ID,
          enrollmentPackageId: null,
          enrollmentStatus: "ACTIVE",
          paymentIntentId: INTENT_ID,
          originalAmountSatang: 300000,
          createdAt: "2026-11-02T03:00:00.000Z",
        },
      ],
    });
  });
});
