import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { processDevLogin, processOAuthLogin } from "./authService";

const prisma = vi.hoisted(() => ({
  oAuthIdentity: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
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
    prisma.user.findMany.mockReset().mockResolvedValue([]);
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

  it("always creates a student and ignores non-LINE phone input", async () => {
    prisma.oAuthIdentity.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      userId: "student-3",
      displayName: "New Student",
      role: "STUDENT",
      phoneNumber: null,
      sponsorTutorId: null,
      sponsorLockedAt: null,
    });

    const result = await processOAuthLogin(
      "google",
      "google-subject-3",
      undefined,
      "New Student",
      "",
      null,
      "+66888888888",
    );

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: "STUDENT",
        phoneNumber: null,
      }),
    });
    expect(result.user.role).toBe("STUDENT");
  });

  it("rejects a sponsor invitation that would close a cycle", async () => {
    prisma.user.findFirst.mockResolvedValue({ userId: "tutor-2" });
    prisma.oAuthIdentity.findUnique.mockResolvedValue(null);
    prisma.user.findUnique
      .mockResolvedValueOnce({
        userId: "student-1",
        displayName: "Existing Student",
        email: "student@example.com",
        role: "STUDENT",
        profilePictureUrl: null,
        sponsorTutorId: null,
        sponsorLockedAt: null,
      })
      .mockResolvedValueOnce({ sponsorTutorId: "student-1" });

    await expect(
      processOAuthLogin(
        "google",
        "subject-cycle",
        "student@example.com",
        "Existing Student",
        "",
        "tutor-2",
      ),
    ).rejects.toThrow("SPONSOR_TREE_CYCLE");

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  describe("linking by email", () => {
    const pendingTutor = {
      userId: "tutor-pending",
      displayName: "ครูสมใจ",
      email: "pending.tutor@example.com",
      role: "TUTOR",
      isActive: true,
      profilePictureUrl: null,
      phoneNumber: null,
      sponsorTutorId: null,
      sponsorLockedAt: null,
    };

    beforeEach(() => {
      prisma.oAuthIdentity.findUnique.mockResolvedValue(null);
    });

    it("links a pre-provisioned tutor to a verified Google email that differs only in case", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([pendingTutor]);
      prisma.user.update.mockResolvedValue({ ...pendingTutor, profilePictureUrl: "avatar.png" });

      const result = await processOAuthLogin(
        "google",
        "google-tutor",
        "Pending.Tutor@Example.com",
        "Somjai K.",
        "avatar.png",
        null,
        undefined,
        true,
      );

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "Pending.Tutor@Example.com" },
      });
      // Only rows no login owns yet (admin pre-provisioned) may be claimed
      // through a case-insensitive match.
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            email: { equals: "Pending.Tutor@Example.com", mode: "insensitive" },
            oauthIdentities: { none: {} },
          },
        }),
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.oAuthIdentity.create).toHaveBeenCalledWith({
        data: {
          userId: "tutor-pending",
          provider: "google",
          providerSubject: "google-tutor",
        },
      });
      // Only the missing picture is filled in: the admin-given name and the
      // stored email stay as they are.
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { userId: "tutor-pending" },
        data: { profilePictureUrl: "avatar.png" },
      });
      expect(result.user).toMatchObject({
        id: "tutor-pending",
        name: "ครูสมใจ",
        role: "TUTOR",
      });
      expect(jwt.decode(result.sessionToken)).toMatchObject({
        userId: "tutor-pending",
        role: "TUTOR",
      });
    });

    it("prefers the exact email match over a case-insensitive one", async () => {
      prisma.user.findUnique.mockResolvedValue(pendingTutor);

      await processOAuthLogin(
        "google",
        "google-tutor",
        "pending.tutor@example.com",
        "Somjai K.",
        "",
        null,
        undefined,
        true,
      );

      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.oAuthIdentity.create).toHaveBeenCalledWith({
        data: {
          userId: "tutor-pending",
          provider: "google",
          providerSubject: "google-tutor",
        },
      });
    });

    it.each([
      ["only matches through a LIKE wildcard", ["axb@example.com"]],
      ["is ambiguous", ["a_b@example.com", "A_B@example.com"]],
    ])("does not link when the case-insensitive match %s", async (_case, emails) => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue(
        emails.map((email, index) => ({ ...pendingTutor, userId: `user-${index}`, email })),
      );
      prisma.user.create.mockResolvedValue({
        userId: "student-new",
        displayName: "New Student",
        role: "STUDENT",
        sponsorTutorId: null,
        sponsorLockedAt: null,
      });

      const result = await processOAuthLogin(
        "google",
        "google-new",
        "A_b@example.com",
        "New Student",
        "",
        null,
        undefined,
        true,
      );

      expect(prisma.oAuthIdentity.create).not.toHaveBeenCalled();
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ role: "STUDENT", email: "A_b@example.com" }),
      });
      expect(result.user.id).toBe("student-new");
    });

    it("refuses to link an existing account to an unverified Google email", async () => {
      prisma.user.findUnique.mockResolvedValue(pendingTutor);

      await expect(
        processOAuthLogin(
          "google",
          "google-unverified",
          "pending.tutor@example.com",
          "Someone",
          "avatar.png",
          null,
          undefined,
          false,
        ),
      ).rejects.toThrow("EMAIL_NOT_VERIFIED");

      expect(prisma.oAuthIdentity.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it.each([
      ["a verified Google email", "google", "admin@example.com", undefined, true],
      ["a LINE email", "line", "admin@example.com", undefined, undefined],
      ["a LINE verified phone", "line", undefined, "+66812345678", undefined],
    ])("never links a new login to a staff account through %s", async (_label, provider, email, phone, verified) => {
      const staff = { ...pendingTutor, userId: "staff-1", email: "admin@example.com", phoneNumber: "+66812345678" };
      for (const role of ["ADMIN", "FINANCE_CHECKER"]) {
        vi.clearAllMocks();
        prisma.oAuthIdentity.findUnique.mockResolvedValue(null);
        prisma.user.findUnique.mockResolvedValue({ ...staff, role });
        prisma.user.findFirst.mockResolvedValue({ ...staff, role });

        await expect(
          processOAuthLogin(provider, "new-subject", email, "Someone", "", null, phone, verified),
        ).rejects.toThrow("STAFF_ACCOUNT_LINK_FORBIDDEN");

        expect(prisma.oAuthIdentity.create).not.toHaveBeenCalled();
        expect(prisma.user.update).not.toHaveBeenCalled();
        expect(prisma.user.create).not.toHaveBeenCalled();
      }
    });

    it("still signs in a returning Google user whose email is unverified", async () => {
      prisma.oAuthIdentity.findUnique.mockResolvedValue({
        user: { ...pendingTutor, profilePictureUrl: "avatar.png" },
      });

      const result = await processOAuthLogin(
        "google",
        "google-tutor",
        "pending.tutor@example.com",
        "Somjai K.",
        "avatar.png",
        null,
        undefined,
        false,
      );

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.oAuthIdentity.create).not.toHaveBeenCalled();
      expect(result.user).toMatchObject({ id: "tutor-pending", role: "TUTOR" });
    });

    it("still creates a new student for an unverified Google email with no exact match", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([pendingTutor]);
      prisma.user.create.mockResolvedValue({
        userId: "student-new",
        displayName: "New Student",
        role: "STUDENT",
        sponsorTutorId: null,
        sponsorLockedAt: null,
      });

      const result = await processOAuthLogin(
        "google",
        "google-unverified",
        "Pending.Tutor@Example.com",
        "New Student",
        "",
        null,
        undefined,
        false,
      );

      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.oAuthIdentity.create).not.toHaveBeenCalled();
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: "STUDENT",
          email: "Pending.Tutor@Example.com",
        }),
      });
      expect(result.user.role).toBe("STUDENT");
    });

    it("links LINE logins by exact email without a verification flag", async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...pendingTutor,
        userId: "student-1",
        email: "ada@example.com",
        displayName: "Ada",
        role: "STUDENT",
      });

      await processOAuthLogin("line", "line-subject", "ada@example.com", "Ada");

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "ada@example.com" },
      });
      expect(prisma.oAuthIdentity.create).toHaveBeenCalledWith({
        data: {
          userId: "student-1",
          provider: "line",
          providerSubject: "line-subject",
        },
      });
    });

    it("keeps LINE email matching case-sensitive", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([pendingTutor]);
      prisma.user.create.mockResolvedValue({
        userId: "student-2",
        displayName: "Ada",
        role: "STUDENT",
        sponsorTutorId: null,
        sponsorLockedAt: null,
      });

      await processOAuthLogin("line", "line-subject-2", "Pending.Tutor@Example.com", "Ada");

      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.oAuthIdentity.create).not.toHaveBeenCalled();
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: "STUDENT",
          email: "Pending.Tutor@Example.com",
        }),
      });
    });
  });
});

describe("processDevLogin", () => {
  beforeEach(() => {
    prisma.oAuthIdentity.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      userId: "dev-tutor-1",
      displayName: "Dev Tutor",
      role: "TUTOR",
      sponsorTutorId: null,
      sponsorLockedAt: null,
    });
  });

  it("creates a tutor only through the explicit development login path", async () => {
    const result = await processDevLogin(
      "dev-tutor-subject",
      "dev-tutor@example.com",
      "Dev Tutor",
      "TUTOR",
    );

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: "TUTOR",
        email: "dev-tutor@example.com",
        oauthIdentities: {
          create: {
            provider: "dev",
            providerSubject: "dev-tutor-subject",
          },
        },
      }),
    });
    expect(result.user).toMatchObject({
      id: "dev-tutor-1",
      role: "TUTOR",
    });
  });
});
