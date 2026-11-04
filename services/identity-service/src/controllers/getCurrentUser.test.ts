import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  userConsent: { findFirst: vi.fn() },
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));
vi.mock("../lib/storage", () => ({
  deleteFromGCS: vi.fn(),
  getSignedVerificationUrl: vi.fn().mockResolvedValue("https://signed.example/doc"),
  isOwnedVerificationObjectKey: vi.fn(),
}));

import { getCurrentUser } from "./userController";

function response() {
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

function dbUser(overrides: Record<string, unknown> = {}) {
  return {
    userId: "tutor-1",
    displayName: "Tutor",
    email: "tutor@example.com",
    phoneNumber: null,
    profilePictureUrl: null,
    dateOfBirth: null,
    role: "TUTOR",
    isActive: true,
    settings: {},
    idCardImageUrl: null,
    bankBookImageUrl: null,
    verificationStatus: "VERIFIED",
    verificationComment: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    idType: "PASSPORT",
    passportNumberLast4: "1234",
    passportNationality: "GBR",
    passportExpiresOn: new Date("2026-11-20T00:00:00.000Z"),
    teachingLocation: "THAILAND",
    workPermitImageUrl: null,
    workPermitExpiresOn: new Date("2027-06-01T00:00:00.000Z"),
    rightToWorkConfirmedAt: null,
    taxResidency: "NON_RESIDENT",
    userConsents: [],
    ...overrides,
  };
}

async function fetchMe(role = "TUTOR") {
  const res = response();
  await getCurrentUser({ id: "req-1", user: { userId: "tutor-1", role } } as never, res as never);
  return res;
}

describe("getCurrentUser expiry warnings", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 10:00 on 4 Nov 2026 in Bangkok.
    vi.setSystemTime(new Date("2026-11-04T03:00:00.000Z"));
    prisma.userConsent.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("warns a tutor about a passport that expires within 30 days", async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser());

    const res = await fetchMe();

    expect(res.statusCode).toBe(200);
    expect(res.body.user.identity.payoutBlock).toBeNull();
    expect(res.body.user.identity.expiryWarnings).toEqual([
      { document: "PASSPORT", expiresOn: "2026-11-20", daysLeft: 16 },
    ]);
  });

  it("returns no warnings once the document has expired (payoutBlock instead)", async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser({ passportExpiresOn: new Date("2026-11-03T00:00:00.000Z") }));

    const res = await fetchMe();

    expect(res.body.user.identity.payoutBlock).toBe("PASSPORT_EXPIRED");
    expect(res.body.user.identity.expiryWarnings).toEqual([]);
  });

  it("returns an empty list for non-tutor roles", async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser({ role: "ADMIN" }));

    const res = await fetchMe("ADMIN");

    expect(res.body.user.identity.expiryWarnings).toEqual([]);
  });
});
