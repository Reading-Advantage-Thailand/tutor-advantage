import { beforeEach, describe, expect, it, vi } from "vitest";
import { activatePaidEnrollment, issueForPayment } from "./reconciliationController";

const prismaMock = vi.hoisted(() => {
  const mock: Record<string, any> = {
    paymentIntent: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn(), updateMany: vi.fn() },
    enrollmentPackage: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    class: { update: vi.fn() },
    paymentReceipt: { upsert: vi.fn() },
    auditEvent: { create: vi.fn() },
  };
  mock.$transaction = vi.fn((fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});

vi.mock("@tutor-advantage/database", () => ({
  prisma: prismaMock,
}));

vi.mock("./paymentController", () => ({
  fulfillPaymentIntent: vi.fn(),
  markPaymentIntentFailed: vi.fn(),
  retrieveAndVerifyOmiseCharge: vi.fn(),
}));

describe("reconciliationController", () => {
  it("does not report missing enrollment targets as inactive enrollments", () => {
    const issue = issueForPayment({
      status: "SUCCESS",
      createdAt: new Date(),
      enrollmentPackageId: null,
    });

    expect(issue.type).toBe("ENROLLMENT_TARGET_NOT_FOUND");
    expect(issue.type).not.toBe("SUCCESS_NOT_ACTIVE");
  });

  it("reports successful payments with inactive enrollments as success-not-active", () => {
    const issue = issueForPayment(
      {
        status: "SUCCESS",
        createdAt: new Date(),
        enrollmentPackageId: null,
      },
      { status: "PENDING_PAYMENT", paymentTransactionId: null },
    );

    expect(issue.type).toBe("SUCCESS_NOT_ACTIVE");
  });

  it("treats successful active enrollments with a payment reference as aligned", () => {
    const issue = issueForPayment(
      {
        status: "SUCCESS",
        createdAt: new Date(),
        enrollmentPackageId: null,
      },
      { status: "ACTIVE", paymentTransactionId: "chrg_test_1" },
    );

    expect(issue.type).toBe("OK");
  });
});

describe("reconciliationController helpers (G3)", () => {
  it("parses paging with clamped page size", async () => {
    const { parsePaging } = await import("./reconciliationController");
    expect(parsePaging({})).toEqual({ page: 1, pageSize: 20, skip: 0 });
    expect(parsePaging({ page: "3", pageSize: "50" })).toEqual({ page: 3, pageSize: 50, skip: 100 });
    expect(parsePaging({ page: "-2", pageSize: "1000" })).toEqual({ page: 1, pageSize: 100, skip: 0 });
  });

  it("requires a reason of at least 5 characters unless optional", async () => {
    const { readReason } = await import("./reconciliationController");
    expect(() => readReason({ reason: "abc" })).toThrow(/reason/i);
    expect(readReason({ note: "  ปิดเคสแล้ว  " })).toBe("ปิดเคสแล้ว");
    expect(readReason({}, { required: false })).toBe("");
  });

  it("rejects unknown issue filters and accepts known ones", async () => {
    const { issueFilterSql } = await import("./reconciliationController");
    expect(() => issueFilterSql("DROP TABLE")).toThrow();
    expect(() => issueFilterSql("ISSUES")).not.toThrow();
    expect(() => issueFilterSql("STALE_PENDING")).not.toThrow();
  });

  it("offers activation only for successful payments that are not fulfilled", async () => {
    const { availablePaymentActions } = await import("./reconciliationController");
    expect(availablePaymentActions({ status: "SUCCESS", providerRef: "chrg" }, "SUCCESS_NOT_ACTIVE")).toEqual([
      "ACTIVATE_ENROLLMENT",
    ]);
    expect(availablePaymentActions({ status: "PENDING", providerRef: "chrg" }, "STALE_PENDING")).toEqual([
      "VERIFY_WITH_PROVIDER",
    ]);
    expect(availablePaymentActions({ status: "PENDING", providerRef: null }, "STALE_PENDING")).toEqual([]);
    expect(availablePaymentActions({ status: "FAILED", providerRef: "chrg" }, "FAILED_ACTIVE")).toEqual([
      "VERIFY_WITH_PROVIDER",
    ]);
  });
});

describe("activatePaidEnrollment (G3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock));
  });

  it("refuses to activate for a payment that is not SUCCESS", async () => {
    prismaMock.paymentIntent.findUnique.mockResolvedValue({ paymentIntentId: "p1", status: "PENDING" });
    await expect(activatePaidEnrollment("p1", "admin", "reason text", "TEST")).rejects.toMatchObject({
      status: 409,
      code: "PAYMENT_NOT_SUCCESSFUL",
    });
    expect(prismaMock.enrollment.updateMany).not.toHaveBeenCalled();
  });

  it("activates a pending enrollment for a successful payment and writes an audit event", async () => {
    prismaMock.paymentIntent.findUnique.mockResolvedValue({
      paymentIntentId: "p1",
      status: "SUCCESS",
      providerRef: "chrg_1",
      enrollmentId: "e1",
      enrollmentPackageId: null,
      studentUserId: "s1",
      amountMinor: 250000n,
      currency: "THB",
    });
    prismaMock.enrollment.findUnique.mockResolvedValue({
      enrollmentId: "e1",
      classId: "c1",
      status: "CANCELLED",
      paymentTransactionId: null,
    });
    prismaMock.enrollment.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.enrollmentPackage.updateMany.mockResolvedValue({ count: 0 });

    const result = await activatePaidEnrollment("p1", "admin", "reason text", "TEST");

    expect(result).toMatchObject({ changed: true, target: "ENROLLMENT", previousStatus: "CANCELLED" });
    expect(prismaMock.enrollment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enrollmentId: "e1", status: "CANCELLED" },
        data: expect.objectContaining({ status: "ACTIVE", paymentTransactionId: "chrg_1" }),
      }),
    );
    expect(prismaMock.class.update).toHaveBeenCalled();
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "RECONCILIATION_ACTIVATE_ENROLLMENT" }) }),
    );
  });

  it("is idempotent when the enrollment is already active with a reference", async () => {
    prismaMock.paymentIntent.findUnique.mockResolvedValue({
      paymentIntentId: "p1",
      status: "SUCCESS",
      providerRef: "chrg_1",
      enrollmentId: "e1",
      enrollmentPackageId: null,
      studentUserId: "s1",
      amountMinor: 250000n,
      currency: "THB",
    });
    prismaMock.enrollment.findUnique.mockResolvedValue({
      enrollmentId: "e1",
      classId: "c1",
      status: "ACTIVE",
      paymentTransactionId: "chrg_1",
    });
    const result = await activatePaidEnrollment("p1", "admin", "reason text", "TEST");
    expect(result.changed).toBe(false);
    expect(prismaMock.enrollment.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
  });

  it("refuses refunded/transferred enrollments", async () => {
    prismaMock.paymentIntent.findUnique.mockResolvedValue({
      paymentIntentId: "p1",
      status: "SUCCESS",
      providerRef: "chrg_1",
      enrollmentId: "e1",
      enrollmentPackageId: null,
    });
    prismaMock.enrollment.findUnique.mockResolvedValue({ enrollmentId: "e1", status: "REFUNDED" });
    await expect(activatePaidEnrollment("p1", "admin", "reason text", "TEST")).rejects.toMatchObject({
      code: "ENROLLMENT_STATE_NOT_ACTIVATABLE",
    });
  });
});
