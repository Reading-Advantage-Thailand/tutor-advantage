import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { processOAuthLogin } from "./authService";

const prisma = vi.hoisted(() => ({
  oAuthIdentity: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  userConsent: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));

describe("processOAuthLogin", () => {
  beforeEach(() => {
    prisma.oAuthIdentity.findUnique.mockReset();
    prisma.oAuthIdentity.create.mockReset();
    prisma.user.findFirst.mockReset();
    prisma.user.findUnique.mockReset();
    prisma.user.create.mockReset();
    prisma.user.update.mockReset();
    prisma.userConsent.findFirst.mockReset();
  });

  it("returns an existing OAuth user and signs a session token", async () => {
    prisma.oAuthIdentity.findUnique.mockResolvedValue({
      user: {
        userId: "user-1",
        displayName: "Ada",
        role: "STUDENT",
        profilePictureUrl: "avatar.png",
      },
    });

    const result = await processOAuthLogin("google", "subject-1", "ada@example.com", "Ada");

    expect(result.user).toEqual({
      id: "user-1",
      name: "Ada",
      role: "STUDENT",
      dateOfBirth: null,
      requiresGuardian: true,
    });
    expect(jwt.decode(result.sessionToken)).toMatchObject({
      userId: "user-1",
      role: "STUDENT",
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("returns the persisted guardian state for a minor", async () => {
    prisma.oAuthIdentity.findUnique.mockResolvedValue({
      user: {
        userId: "user-minor",
        displayName: "Minor Student",
        role: "STUDENT",
        dateOfBirth: new Date("2012-01-01T00:00:00.000Z"),
        profilePictureUrl: null,
      },
    });
    prisma.userConsent.findFirst.mockResolvedValue({
      userConsentId: "consent-1",
    });

    const result = await processOAuthLogin(
      "line",
      "subject-minor",
      undefined,
      "Minor Student",
    );

    expect(prisma.userConsent.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-minor",
        consentType: "GUARDIAN_CONTACT_PAYMENT",
        status: "granted",
      },
    });
    expect(result.user).toMatchObject({
      dateOfBirth: "2012-01-01",
      requiresGuardian: false,
    });
  });

  it("creates a new student and links a valid non-LINE sponsor", async () => {
    prisma.user.findFirst.mockResolvedValue({ userId: "tutor-1" });
    prisma.oAuthIdentity.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      userId: "student-1",
      displayName: "New Student",
      role: "STUDENT",
      sponsorTutorId: null,
      sponsorLockedAt: null,
    });
    prisma.user.update.mockResolvedValue({
      userId: "student-1",
      displayName: "New Student",
      role: "STUDENT",
      sponsorTutorId: "tutor-1",
      sponsorLockedAt: new Date("2026-05-14T00:00:00.000Z"),
    });

    const result = await processOAuthLogin(
      "google",
      "subject-1",
      "student@example.com",
      "New Student",
      "avatar.png",
      "tutor-1",
    );

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { userId: "tutor-1", role: "TUTOR", isActive: true },
      select: { userId: true },
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: "STUDENT",
        displayName: "New Student",
        email: "student@example.com",
        oauthIdentities: {
          create: {
            provider: "google",
            providerSubject: "subject-1",
          },
        },
      }),
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { userId: "student-1" },
      data: expect.objectContaining({
        sponsorTutorId: "tutor-1",
        sponsorLockedAt: expect.any(Date),
      }),
    });
    expect(result.user.id).toBe("student-1");
  });

  it("links a new OAuth provider to an existing email account", async () => {
    prisma.oAuthIdentity.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({
      userId: "user-1",
      displayName: "Ada",
      email: "ada@example.com",
      role: "STUDENT",
      profilePictureUrl: null,
    });
    prisma.user.update.mockResolvedValue({
      userId: "user-1",
      displayName: "Ada",
      email: "ada@example.com",
      role: "STUDENT",
      profilePictureUrl: "avatar.png",
    });

    await processOAuthLogin("facebook", "fb-subject", "ada@example.com", "Ada", "avatar.png");

    expect(prisma.oAuthIdentity.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        provider: "facebook",
        providerSubject: "fb-subject",
      },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { profilePictureUrl: "avatar.png" },
    });
  });

  it("creates a new student with no email but a phone number", async () => {
    prisma.oAuthIdentity.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      userId: "student-2",
      displayName: "Phone Student",
      role: "STUDENT",
      email: null,
      phoneNumber: "+66899999999",
      sponsorTutorId: null,
      sponsorLockedAt: null,
    });

    const result = await processOAuthLogin(
      "line",
      "line-subject-1",
      undefined,
      "Phone Student",
      "avatar.png",
      null,
      undefined,
      "+66899999999",
    );

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { phoneNumber: "+66899999999" },
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: "STUDENT",
        displayName: "Phone Student",
        email: null,
        phoneNumber: "+66899999999",
        oauthIdentities: {
          create: {
            provider: "line",
            providerSubject: "line-subject-1",
          },
        },
      }),
    });
    expect(result.user.id).toBe("student-2");
  });

  it("links a new OAuth provider by matching existing phone number when email is missing", async () => {
    prisma.oAuthIdentity.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue({
      userId: "user-2",
      displayName: "Phone Student",
      email: null,
      phoneNumber: "+66899999999",
      role: "STUDENT",
      profilePictureUrl: null,
    });
    prisma.user.update.mockResolvedValue({
      userId: "user-2",
      displayName: "Phone Student",
      email: null,
      phoneNumber: "+66899999999",
      role: "STUDENT",
      profilePictureUrl: "avatar.png",
    });

    await processOAuthLogin(
      "line",
      "line-subject-2",
      undefined,
      "Phone Student",
      "avatar.png",
      null,
      undefined,
      "+66899999999",
    );

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { phoneNumber: "+66899999999" },
    });
    expect(prisma.oAuthIdentity.create).toHaveBeenCalledWith({
      data: {
        userId: "user-2",
        provider: "line",
        providerSubject: "line-subject-2",
      },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { userId: "user-2" },
      data: { profilePictureUrl: "avatar.png" },
    });
  });
});
