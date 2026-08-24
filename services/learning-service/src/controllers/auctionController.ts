import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

// Get open class transfer requests (auction)
export const getAuctionClasses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const openRequests = await prisma.classTransferRequest.findMany({
      where: {
        status: "OPEN",
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ],
        // Don't show tutor's own classes in auction
        originalTutorId: { not: userId }
      },
      include: {
        class: {
          include: {
            book: {
              select: {
                title: true,
                classHours: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedAuctions = openRequests.map((req) => ({
      id: req.transferId,
      classId: req.classId,
      title: req.class.title,
      subject: req.class.book.title,
      students: req.class.enrolledCount,
      networkBonusRate: req.networkBonusRate.toNumber(),
      reason: req.reason || "ไม่ระบุเหตุผล",
      expiresAt: req.expiresAt,
    }));

    res.status(200).json({ auctions: formattedAuctions });
  } catch (error) {
    logger.error("Failed to fetch auction classes", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Claim an opened class transfer
export const claimAuctionClass = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { transferId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Use transaction to ensure thread-safety when claiming
    const result = await prisma.$transaction(async (tx) => {
      const transferRequest = await tx.classTransferRequest.findUnique({
        where: { transferId },
        include: { class: true }
      });

      if (!transferRequest) {
        throw new Error("Transfer request not found");
      }

      if (transferRequest.status !== "OPEN") {
        throw new Error("Class is no longer available");
      }

      if (transferRequest.expiresAt && transferRequest.expiresAt < new Date()) {
        throw new Error("Transfer request has expired");
      }

      if (transferRequest.originalTutorId === userId) {
        throw new Error("Cannot claim your own class");
      }

      const claimant = await tx.user.findUnique({
        where: { userId },
        select: {
          role: true,
          verificationStatus: true,
          isActive: true,
        },
      });

      if (
        !claimant ||
        claimant.role !== "TUTOR" ||
        claimant.verificationStatus !== "VERIFIED" ||
        !claimant.isActive
      ) {
        throw new Error("Tutor verification is required to claim a class");
      }

      // Claim only while the request is still open. The conditional update is
      // the concurrency guard; two transactions may both read OPEN, but only
      // one can change it to TRANSFERRED.
      const claimed = await tx.classTransferRequest.updateMany({
        where: { transferId, status: "OPEN" },
        data: {
          status: "TRANSFERRED",
          newTutorId: userId,
          updatedAt: new Date(),
        }
      });

      if (claimed.count !== 1) {
        throw new Error("Class is no longer available");
      }

      // Transfer the class to the new tutor
      const transferred = await tx.class.updateMany({
        where: {
          classId: transferRequest.classId,
          tutorUserId: transferRequest.originalTutorId,
        },
        data: {
          tutorUserId: userId,
          updatedAt: new Date(),
        }
      });

      if (transferred.count !== 1) {
        throw new Error("Class is no longer owned by the releasing tutor");
      }

      // Record in audit log (using untyped query as it's in a different schema, but typically we'd structure this better)
      try {
         await tx.$executeRaw`
           INSERT INTO "finance_mlm"."audit_events" 
           ("audit_event_id", "actor_id", "action", "entity_type", "entity_id", "payload", "created_at") 
           VALUES (gen_random_uuid(), ${userId}, 'CLAIM_CLASS_TRANSFER', 'CLASS', ${transferRequest.classId}, ${JSON.stringify({ 
             transferId, 
             originalTutorId: transferRequest.originalTutorId,
             bonusRate: transferRequest.networkBonusRate
           })}::jsonb, NOW())`;
      } catch (e) {
         // Silently fail audit log if it doesn't work across schemas in this transaction setup
         logger.error("Audit log failed", e);
      }

      return {
        transferId: transferRequest.transferId,
        classId: transferRequest.classId,
      };
    });

    res.status(200).json({ 
      success: true, 
      message: "Class claimed successfully",
      transfer: {
        id: result.transferId,
        classId: result.classId,
      }
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Failed to claim auction class", error, req.params.transferId);
    
    // Provide user-friendly errors for known conditions
    if (error.message === "Class is no longer available" || 
        error.message === "Transfer request has expired" ||
        error.message === "Cannot claim your own class") {
      res.status(400).json({ error: error.message });
      return;
    }

    if (
      error.message === "Tutor verification is required to claim a class" ||
      error.message === "Class is no longer owned by the releasing tutor"
    ) {
      res.status(403).json({ error: error.message });
      return;
    }
    
    res.status(500).json({ error: "Internal server error" });
  }
};
