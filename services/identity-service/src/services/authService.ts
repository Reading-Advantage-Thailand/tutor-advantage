import { prisma } from "@tutor-advantage/database";
import { claimTutorInvite, isUsableTutorInvite } from "./tutorInvite";
import jwt from "jsonwebtoken";
import {
  CONSENT_STATUS_GRANTED,
  GUARDIAN_CONSENT_TYPE,
  getJwtSecret,
  requiresGuardianConsent,
} from "@tutor-advantage/shared-config";

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
  verifiedPhoneNumber?: string,
  tutorInviteToken?: string | null,
): Promise<AuthResult> {
  return processLogin(
    provider,
    providerSubject,
    email,
    name,
    picture,
    sponsorTutorId,
    verifiedPhoneNumber,
    "STUDENT",
    { tutorViaInvite: provider !== "line", tutorInviteToken: provider !== "line" ? tutorInviteToken : null },
  );
}

/**
 * Development-only login entry point. Production OAuth never accepts a role;
 * this separate function keeps the local tutor fixture available without
 * exposing that capability through the public callback.
 */
export async function processDevLogin(
  providerSubject: string,
  email: string,
  name: string,
  role: "STUDENT" | "TUTOR",
): Promise<AuthResult> {
  return processLogin(
    "dev",
    providerSubject,
    email,
    name,
    "",
    null,
    undefined,
    role,
  );
}

async function processLogin(
  provider: string,
  providerSubject: string,
  email: string | undefined,
  name: string,
  picture: string,
  sponsorTutorId: string | null | undefined,
  verifiedPhoneNumber: string | undefined,
  requestedRole: "STUDENT" | "TUTOR",
  options: { tutorViaInvite?: boolean; tutorInviteToken?: string | null } = {},
): Promise<AuthResult> {
  let user;
  let roleUpgraded = false;
  let createdNew = false;
  const normalizedEmail = (email && email.trim() !== "") ? email.trim() : null;
  // Only LINE's verified profile may supply a phone number. No other caller
  // can use an arbitrary phone number to discover or attach to an account.
  const normalizedPhone =
    provider === "line" && verifiedPhoneNumber && verifiedPhoneNumber.trim() !== ""
      ? verifiedPhoneNumber.trim()
      : null;
  const invitedSponsorId =
    provider !== "line" && sponsorTutorId
      ? await resolveActiveTutorSponsorId(sponsorTutorId)
      : null;
  // Tutor onboarding: a tutor-app (non-LINE) login that carries a valid
  // invite from an active tutor makes the account a tutor. The role is
  // decided here from the server-checked invite, never taken from the client.
  // A one-time admin invite makes a top-level tutor (no upline) and wins
  // over a sponsor invite. It is consumed once the account is known.
  const topLevelInvite =
    options.tutorInviteToken && (await isUsableTutorInvite(options.tutorInviteToken))
      ? options.tutorInviteToken
      : null;
  const joinsAsTutor = Boolean(options.tutorViaInvite && (invitedSponsorId || topLevelInvite));

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
    if (requestedRole === "TUTOR" && user.role !== "TUTOR") {
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
      createdNew = true;
      // Create user and link identity in one transaction
      user = await prisma.user.create({
        data: {
          role: joinsAsTutor ? "TUTOR" : requestedRole,
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
    !topLevelInvite &&
    invitedSponsorId &&
    user.userId !== invitedSponsorId &&
    !user.sponsorTutorId &&
    !user.sponsorLockedAt
  ) {
    if (await wouldCreateSponsorCycle(user.userId, invitedSponsorId)) {
      throw new Error("SPONSOR_TREE_CYCLE");
    }

    user = await prisma.user.update({
      where: { userId: user.userId },
      data: {
        sponsorTutorId: invitedSponsorId,
        sponsorLockedAt: new Date(),
      },
    });
  }

  // An existing STUDENT account accepted into the tutor network by invite.
  // Real students sign in with LINE, so an account with a LINE identity is
  // never converted; a Google-only "student" is a tutor who signed up before
  // invites worked.
  if (
    joinsAsTutor &&
    user.role === "STUDENT" &&
    user.userId !== invitedSponsorId &&
    !(await hasLineIdentity(user.userId))
  ) {
    user = await prisma.user.update({
      where: { userId: user.userId },
      data: { role: "TUTOR" },
    });
    roleUpgraded = true;
  }

  // Consume the top-level invite for the account it just made a tutor. If a
  // concurrent login already used it (and no sponsor invite applies), the
  // account stays a student.
  if (topLevelInvite && user.role === "TUTOR" && (createdNew || roleUpgraded)) {
    const claimed = await claimTutorInvite(topLevelInvite, user.userId);
    if (!claimed && !invitedSponsorId) {
      user = await prisma.user.update({
        where: { userId: user.userId },
        data: { role: "STUDENT" },
      });
      roleUpgraded = false;
    } else if (
      !claimed &&
      invitedSponsorId &&
      user.userId !== invitedSponsorId &&
      !user.sponsorTutorId &&
      !user.sponsorLockedAt &&
      !(await wouldCreateSponsorCycle(user.userId, invitedSponsorId))
    ) {
      // Fall back to the sponsor invite that was set aside for the top-level one.
      user = await prisma.user.update({
        where: { userId: user.userId },
        data: { sponsorTutorId: invitedSponsorId, sponsorLockedAt: new Date() },
      });
    }
  }

  // Generate JWT token
  const sessionToken = jwt.sign(
    { userId: user.userId, role: user.role },
    getJwtSecret(),
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

async function wouldCreateSponsorCycle(userId: string, sponsorTutorId: string) {
  const visited = new Set<string>();
  let currentId: string | null = sponsorTutorId;

  while (currentId) {
    if (currentId === userId) return true;
    if (visited.has(currentId)) {
      // The existing graph is already corrupt. Do not attach another edge to
      // that component and make the settlement failure larger.
      return true;
    }
    visited.add(currentId);

    const sponsor: { sponsorTutorId: string | null } | null = await prisma.user.findUnique({
      where: { userId: currentId },
      select: { sponsorTutorId: true },
    });
    currentId = sponsor?.sponsorTutorId ?? null;
  }

  return false;
}

async function hasLineIdentity(userId: string) {
  const count = await prisma.oAuthIdentity.count({
    where: { userId, provider: "line" },
  });
  return count > 0;
}

async function resolveActiveTutorSponsorId(sponsorTutorId: string) {
  const sponsor = await prisma.user.findFirst({
    where: { userId: sponsorTutorId, role: "TUTOR", isActive: true },
    select: { userId: true },
  });

  return sponsor?.userId || null;
}
