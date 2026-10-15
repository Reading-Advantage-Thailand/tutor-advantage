import crypto from "crypto";
import { prisma } from "@tutor-advantage/database";

/**
 * One-time invites for top-level tutors (no upline), issued by an admin.
 * Only the sha256 of a token is stored; the raw token travels in the invite
 * link and the tutor app's httpOnly cookie.
 */
export const TUTOR_INVITE_TTL_DAYS = 7;

export function hashInviteToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newInviteToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function isWellFormed(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

/** The invite is unused and not expired (does not consume it). */
export async function isUsableTutorInvite(token: unknown, now = new Date()) {
  if (!isWellFormed(token)) return false;
  const invite = await prisma.tutorInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: { usedAt: true, expiresAt: true },
  });
  return Boolean(invite && !invite.usedAt && invite.expiresAt > now);
}

/** Atomically marks the invite used by `userId`; false if someone else won. */
export async function claimTutorInvite(token: unknown, userId: string, now = new Date()) {
  if (!isWellFormed(token)) return false;
  const claimed = await prisma.tutorInvite.updateMany({
    where: { tokenHash: hashInviteToken(token), usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now, usedByUserId: userId },
  });
  return claimed.count === 1;
}
