import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { logger } from "@tutor-advantage/shared-config";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { TUTOR_INVITE_TTL_DAYS, hashInviteToken, newInviteToken } from "../services/tutorInvite";

/**
 * POST /v1/admin/tutor-invites (ADMIN) — issues a one-time link that makes
 * the person who opens it a tutor with no upline. The raw token is returned
 * once and never stored.
 */
export async function createTutorInvite(req: AuthenticatedRequest, res: Response) {
  const actorId = req.user?.userId;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
  if (!actorId) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "User not identified", requestId: req.id } });
  }
  if (reason.length < 5) {
    return res.status(400).json({
      error: { code: "REASON_REQUIRED", message: "A reason of at least 5 characters is required", requestId: req.id },
    });
  }

  try {
    const token = newInviteToken();
    const expiresAt = new Date(Date.now() + TUTOR_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
    const invite = await prisma.$transaction(async (tx) => {
      const created = await tx.tutorInvite.create({
        data: { tokenHash: hashInviteToken(token), createdBy: actorId, reason, expiresAt },
        select: { tutorInviteId: true, expiresAt: true },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: "TUTOR_INVITE_CREATE",
          entityType: "TutorInvite",
          entityId: created.tutorInviteId,
          payload: { reason, expiresAt: expiresAt.toISOString(), kind: "TOP_LEVEL" },
        },
      });
      return created;
    });

    const baseUrl = (process.env.TUTOR_APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
    return res.status(201).json({
      inviteId: invite.tutorInviteId,
      inviteUrl: `${baseUrl}/invite/root/${token}`,
      expiresAt: invite.expiresAt.toISOString(),
    });
  } catch (error) {
    logger.error("Create Tutor Invite Error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Could not create the invite", requestId: req.id },
    });
  }
}
