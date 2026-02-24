import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

export async function enrollStudent(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { referralToken } = req.params;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "User ID missing from token",
          requestId: req.id,
        },
      });
    }

    if (!referralToken) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "referralToken is required",
          requestId: req.id,
        },
      });
    }

    // Wrap the entire enrollment + fallback logic in a transaction
    const enrollmentResult = await prisma.$transaction(async (tx) => {
      // 1. Find the referral
      const referral = await tx.referral.findUnique({
        where: { token: referralToken },
        include: {
          class: true,
        },
      });

      if (!referral || referral.status !== "ACTIVE") {
        throw new Error("REFERRAL_INVALID");
      }

      // 2. Check primary class capacity
      const primaryClass = referral.class;
      let targetClassId = primaryClass.classId;

      if (
        primaryClass.status !== "OPEN" ||
        primaryClass.enrolledCount >= primaryClass.capacity
      ) {
        // Fallback Logic: Primary class is full or closed. Look for another OPEN class by the same tutor.
        const availableClasses = await tx.class.findMany({
          where: {
            tutorUserId: primaryClass.tutorUserId,
            status: "OPEN",
          },
        });

        // Find the first class that still has capacity
        const fallbackClass = availableClasses.find(
          (c) => c.enrolledCount < c.capacity,
        );

        if (!fallbackClass) {
          throw new Error("NO_FALLBACK_AVAILABLE");
        }

        targetClassId = fallbackClass.classId;
      }

      // 3. Create the enrollment in PENDING_PAYMENT state
      const enrollment = await tx.enrollment.create({
        data: {
          classId: targetClassId,
          studentUserId: userId,
          referralToken: referral.token,
          status: "PENDING_PAYMENT",
        },
      });

      // 4. Increment the enrolled count for the target class
      await tx.class.update({
        where: { classId: targetClassId },
        data: {
          enrolledCount: {
            increment: 1,
          },
        },
      });

      return {
        enrollmentId: enrollment.enrollmentId,
        classId: enrollment.classId,
        isFallback: targetClassId !== primaryClass.classId,
      };
    });

    return res.status(200).json({
      message: "Enrollment successful. Pending payment.",
      enrollmentId: enrollmentResult.enrollmentId,
      classId: enrollmentResult.classId,
      placement: enrollmentResult.isFallback ? "FALLBACK" : "PRIMARY",
    });
  } catch (error: any) {
    if (error.message === "REFERRAL_INVALID") {
      return res.status(400).json({
        error: {
          code: "REFERRAL_INVALID",
          message: "The referral token is invalid or expired",
          requestId: req.id,
        },
      });
    }

    if (error.message === "NO_FALLBACK_AVAILABLE") {
      return res.status(400).json({
        error: {
          code: "CLASS_FULL",
          message:
            "The target class is full and no alternative classes are available from this tutor",
          requestId: req.id,
        },
      });
    }

    console.error("Enrollment Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not process enrollment",
        details: error.message,
        requestId: req.id,
      },
    });
  }
}
