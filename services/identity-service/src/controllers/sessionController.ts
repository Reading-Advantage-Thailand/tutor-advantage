import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import {
  CONSENT_STATUS_GRANTED,
  GUARDIAN_CONSENT_TYPE,
  logger,
  requiresGuardianConsent,
} from "@tutor-advantage/shared-config";

export async function getSession(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "User ID missing from token",
          requestId: req.id,
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { userId },
    });

    if (!user) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "User no longer exists",
          requestId: req.id,
        },
      });
    }

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
    const requiresGuardian = requiresGuardianConsent(
      user.role,
      user.dateOfBirth,
      Boolean(existingConsent),
    );

    return res.status(200).json({
      id: user.userId,
      name: user.displayName || "",
      role: user.role,
      dateOfBirth: user.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      requiresGuardian,
    });
  } catch (error) {
    const err = error as Error;
    logger.error("Session Details Error:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch session details",
        details: err.message,
        requestId: req.id,
      },
    });
  }
}
