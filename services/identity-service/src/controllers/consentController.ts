import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logger } from "@tutor-advantage/shared-config";

export async function getGuardianConsentStatus(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "User ID missing from token" } });
    }

    const existing = await prisma.guardianConsent.findFirst({
      where: { studentUserId: userId },
      select: { consentId: true },
    });

    return res.status(200).json({ hasConsent: !!existing });
  } catch (error) {
    const err = error as Error;
    logger.error("Get Guardian Consent Status Error:", err);
    return res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Could not fetch consent status" } });
  }
}

export async function submitGuardianConsent(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const { guardianName, guardianContact, consentGiven } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "User ID missing from token",
          requestId: req.id,
        },
      });
    }

    if (!guardianName || !consentGiven || consentGiven !== true) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "Valid guardian name and active consent must be provided",
          requestId: req.id,
        },
      });
    }

    // Execute within a transaction to ensure both records are created
    await prisma.$transaction(async (tx) => {
      // 1. Record the Guardian relationship explicitly
      await tx.guardianConsent.create({
        data: {
          studentUserId: userId,
          guardianName,
          relation: guardianContact || "Guardian", // Fallback if contact field used as relation description
          consentedAt: new Date(),
        },
      });

      // 2. Write the PDPA consent log for the user
      await tx.userConsent.create({
        data: {
          userId: userId,
          consentType: "GUARDIAN_CONTACT_PAYMENT",
          status: "granted",
          effectiveAt: new Date(),
        },
      });
    });

    return res.status(200).json({
      message: "Consent recorded successfully",
    });
  } catch (error) {
    const err = error as Error;
    logger.error("Submit Guardian Consent Error:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not record guardian consent",
        details: err.message,
        requestId: req.id,
      },
    });
  }
}
