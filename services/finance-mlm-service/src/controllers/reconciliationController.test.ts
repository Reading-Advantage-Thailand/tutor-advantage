import { describe, expect, it, vi } from "vitest";
import { issueForPayment } from "./reconciliationController";

vi.mock("@tutor-advantage/database", () => ({
  prisma: {},
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
