import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { v4 as uuidv4 } from "uuid";

export async function generateReferral(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const { classId } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "User ID missing from token",
          requestId: req.id,
        },
      });
    }

    if (!classId) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "classId is required",
          requestId: req.id,
        },
      });
    }

    const targetClass = await prisma.class.findUnique({
      where: { classId },
    });

    if (!targetClass) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Class not found",
          requestId: req.id,
        },
      });
    }

    if (targetClass.tutorUserId !== userId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You can only generate referrals for your own classes",
          requestId: req.id,
        },
      });
    }

    if (targetClass.status !== "OPEN") {
      return res.status(400).json({
        error: {
          code: "CLASS_CLOSED",
          message: "Cannot generate referral for a closed class",
          requestId: req.id,
        },
      });
    }

    // Generate unique token
    const token = uuidv4();

    // In a real scenario, this domain would be configurable via env vars
    // For now, aligning with the PWA/LIFF architecture plan
    const baseUrl = process.env.FRONTEND_APP_URL || "http://localhost:3000";
    const referralUrl = `${baseUrl}/enroll?token=${token}`;

    const newReferral = await prisma.referral.create({
      data: {
        token: token,
        classId: classId,
        tutorUserId: userId,
        status: "ACTIVE",
      },
    });

    return res.status(200).json({
      message: "Referral generated successfully",
      referralToken: newReferral.token,
      url: referralUrl,
      qrPayload: referralUrl, // For QR generation on the frontend
    });
  } catch (error: any) {
    console.error("Generate Referral Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not generate referral",
        details: error.message,
        requestId: req.id,
      },
    });
  }
}
