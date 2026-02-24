import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

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
  } catch (error: any) {
    console.error("Submit Guardian Consent Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not record guardian consent",
        details: error.message,
        requestId: req.id,
      },
    });
  }
}
