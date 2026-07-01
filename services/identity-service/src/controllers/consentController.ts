import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import {
  CONSENT_STATUS_GRANTED,
  GUARDIAN_CONSENT_TYPE,
  isUnderGuardianAge,
  logger,
} from "@tutor-advantage/shared-config";

export async function getGuardianConsentStatus(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "User ID missing from token" } });
    }

    const existing = await prisma.userConsent.findFirst({
      where: {
        userId,
        consentType: GUARDIAN_CONSENT_TYPE,
        status: CONSENT_STATUS_GRANTED,
      },
      select: { userConsentId: true },
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

    const student = await prisma.user.findUnique({
      where: { userId },
      select: { role: true, dateOfBirth: true },
    });
    if (!student?.dateOfBirth) {
      return res.status(400).json({
        error: {
          code: "DATE_OF_BIRTH_REQUIRED",
          message: "Date of birth is required before guardian consent",
          requestId: req.id,
        },
      });
    }
    if (student.role !== "STUDENT" || !isUnderGuardianAge(student.dateOfBirth)) {
      return res.status(400).json({
        error: {
          code: "GUARDIAN_CONSENT_NOT_REQUIRED",
          message: "Guardian consent is only required for students under 18",
          requestId: req.id,
        },
      });
    }

    const existingConsent = await prisma.userConsent.findFirst({
      where: {
        userId,
        consentType: GUARDIAN_CONSENT_TYPE,
        status: CONSENT_STATUS_GRANTED,
      },
      select: { userConsentId: true },
    });
    if (existingConsent) {
      return res.status(200).json({
        message: "Consent already recorded",
        alreadyRecorded: true,
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
          consentType: GUARDIAN_CONSENT_TYPE,
          status: CONSENT_STATUS_GRANTED,
          effectiveAt: new Date(),
        },
      });
    });

    return res.status(200).json({
      message: "Consent recorded successfully",
      alreadyRecorded: false,
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

export async function submitUserConsent(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const { consentType } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User ID missing from token" },
      });
    }

    if (!consentType || consentType !== "TERMS_AND_PRIVACY") {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Invalid or missing consentType" },
      });
    }

    await prisma.userConsent.create({
      data: {
        userId,
        consentType,
        status: "ACCEPTED",
        effectiveAt: new Date(),
      },
    });

    return res.status(200).json({ message: "Consent recorded successfully" });
  } catch (error) {
    const err = error as Error;
    logger.error("Submit User Consent Error:", err);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Could not record user consent" },
    });
  }
}
