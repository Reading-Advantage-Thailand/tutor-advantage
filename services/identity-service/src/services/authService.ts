import { prisma } from "@tutor-advantage/database";
import jwt from "jsonwebtoken";
import {
  CONSENT_STATUS_GRANTED,
  GUARDIAN_CONSENT_TYPE,
  requiresGuardianConsent,
} from "@tutor-advantage/shared-config";

const JWT_SECRET = process.env.JWT_SECRET || "secret-for-dev-only-change-me";

export interface AuthResult {
  sessionToken: string;
  roleUpgraded: boolean;
  user: {
    id: string;
    name: string;
    role: string;
    dateOfBirth: string | null;
    requiresGuardian: boolean;
  };
}

export async function processOAuthLogin(
  provider: string,
  providerSubject: string,
  email: string | undefined,
  name: string,
  picture: string = "",
  sponsorTutorId?: string | null,
  defaultRole?: string,
  phoneNumber?: string,
): Promise<AuthResult> {
  let user;
  let roleUpgraded = false;
  const normalizedEmail = (email && email.trim() !== "") ? email.trim() : null;
  const normalizedPhone = (phoneNumber && phoneNumber.trim() !== "") ? phoneNumber.trim() : null;
  const invitedSponsorId =
    provider !== "line" && sponsorTutorId
      ? await resolveActiveTutorSponsorId(sponsorTutorId)
      : null;

  // 1. Check if OAuth Identity already exists
  const existingIdentity = await prisma.oAuthIdentity.findUnique({
    where: {
      provider_providerSubject: {
        provider,
        providerSubject,
      },
    },
    include: {
      user: true,
    },
  });

  if (existingIdentity) {
    user = existingIdentity.user;

    const updateData: Record<string, unknown> = {};
    if (picture && !user.profilePictureUrl) updateData.profilePictureUrl = picture;
    if (normalizedPhone && !user.phoneNumber) updateData.phoneNumber = normalizedPhone;
    if (defaultRole === "TUTOR" && user.role !== "TUTOR") {
      updateData.role = "TUTOR";
      roleUpgraded = true;
    }
    if (name && (user.displayName?.toLowerCase() === user.email?.toLowerCase() || !user.displayName)) {
      updateData.displayName = name;
    }
    if (Object.keys(updateData).length > 0) {
      user = await prisma.user.update({ where: { userId: user.userId }, data: updateData });
    }
  } else {
    // 2. If no identity, check if user exists by email, fallback to checking phone number
    if (normalizedEmail) {
      user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
    } else if (normalizedPhone) {
      user = await prisma.user.findFirst({
        where: { phoneNumber: normalizedPhone },
      });
    }

    // 3. If still no user, create a new one.
    if (!user) {
      const role = defaultRole === "TUTOR" ? "TUTOR" : "STUDENT";

      // Create user and link identity in one transaction
      user = await prisma.user.create({
        data: {
          role,
          displayName: name,
          email: normalizedEmail,
          phoneNumber: normalizedPhone,
          profilePictureUrl: picture || null,
          sponsorTutorId: null,
          sponsorLockedAt: null,
          oauthIdentities: {
            create: {
              provider,
              providerSubject,
            },
          },
        },
      });
    } else {
      // User exists by email/phone, but new provider linkage
      // Optionally update picture, phone number, or displayName if they were placeholder/missing
      const updateData: Record<string, unknown> = {};
      if (picture && !user.profilePictureUrl) {
        updateData.profilePictureUrl = picture;
      }
      if (normalizedPhone && !user.phoneNumber) {
        updateData.phoneNumber = normalizedPhone;
      }
      if (name && (user.displayName?.toLowerCase() === user.email?.toLowerCase() || !user.displayName)) {
        updateData.displayName = name;
      }

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { userId: user.userId },
          data: updateData,
        });
      }

      await prisma.oAuthIdentity.create({
        data: {
          userId: user.userId,
          provider,
          providerSubject,
        },
      });
    }
  }

  if (
    provider !== "line" &&
    invitedSponsorId &&
    user.userId !== invitedSponsorId &&
    !user.sponsorTutorId &&
    !user.sponsorLockedAt
  ) {
    user = await prisma.user.update({
      where: { userId: user.userId },
      data: {
        sponsorTutorId: invitedSponsorId,
        sponsorLockedAt: new Date(),
      },
    });
  }

  // Generate JWT token
  const sessionToken = jwt.sign(
    { userId: user.userId, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

  const existingConsent =
    user.role === "STUDENT" && user.dateOfBirth
      ? await prisma.userConsent.findFirst({
          where: {
            userId: user.userId,
            consentType: GUARDIAN_CONSENT_TYPE,
            status: CONSENT_STATUS_GRANTED,
          },
        })
      : null;

  return {
    sessionToken,
    roleUpgraded,
    user: {
      id: user.userId,
      name: user.displayName || "",
      role: user.role,
      dateOfBirth: user.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      requiresGuardian: requiresGuardianConsent(
        user.role,
        user.dateOfBirth,
        Boolean(existingConsent),
      ),
    },
  };
}

async function resolveActiveTutorSponsorId(sponsorTutorId: string) {
  const sponsor = await prisma.user.findFirst({
    where: { userId: sponsorTutorId, role: "TUTOR", isActive: true },
    select: { userId: true },
  });

  return sponsor?.userId || null;
}
