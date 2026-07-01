import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPaymentGuardianGate } from "./paymentController";

const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  userConsent: { findFirst: vi.fn() },
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));

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
