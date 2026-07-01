import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitGuardianConsent } from "./consentController";

const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  userConsent: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function request() {
  return {
    id: "req-1",
    user: { userId: "student-1", role: "STUDENT" },
    body: {
      guardianName: "Parent One",
      guardianContact: "Mother",
      consentGiven: true,
    },
  };
}

describe("submitGuardianConsent", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockReset();
    prisma.userConsent.findFirst.mockReset();
    prisma.$transaction.mockReset();
  });

  it("requires a date of birth before recording consent", async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: "STUDENT",
      dateOfBirth: null,
    });
    const res = response();

    await submitGuardianConsent(request() as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: "DATE_OF_BIRTH_REQUIRED" }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns the existing consent without creating duplicates", async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: "STUDENT",
      dateOfBirth: new Date("2012-01-01T00:00:00.000Z"),
    });
    prisma.userConsent.findFirst.mockResolvedValue({
      userConsentId: "consent-1",
    });
    const res = response();

    await submitGuardianConsent(request() as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Consent already recorded",
      alreadyRecorded: true,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
