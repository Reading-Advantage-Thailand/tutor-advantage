import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

const ACTIVE_FRAUD_STATUSES = ["OPEN", "INVESTIGATING", "MONITORING", "FROZEN"];

export async function getAdminOverview(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalSettlementsLast30Days,
      pendingApprovals,
      pendingAdjustments,
      pendingVerificationUsers,
      unresolvedExceptions,
      activeFraudFlags,
      recentAuditEvents,
    ] = await Promise.all([
      prisma.settlementRun.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.settlementRun.count({ where: { status: "SUBMITTED" } }),
      prisma.adjustment.count({ where: { status: "PENDING" } }),
      prisma.user.count({ where: { verificationStatus: "PENDING" } }),
      prisma.exception.count({ where: { status: "UNRESOLVED" } }),
      prisma.fraudFlag.count({
        where: { status: { in: ACTIVE_FRAUD_STATUSES } },
      }),
      prisma.auditEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

    let dbReachable = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbReachable = false;
    }

    return res.status(200).json({
      stats: {
        totalSettlementsLast30Days,
        pendingApprovals,
        pendingAdjustments,
        pendingVerificationUsers,
        unresolvedExceptions,
        activeFraudFlags,
      },
      workQueues: {
        settlements: pendingApprovals,
        adjustments: pendingAdjustments,
        verifications: pendingVerificationUsers,
        exceptions: unresolvedExceptions,
        fraudFlags: activeFraudFlags,
      },
      recentActivity: recentAuditEvents.map((event) => ({
        auditId: event.auditEventId,
        actionType: event.action,
        actorUserId: event.actorId,
        targetId: event.entityId,
        entityType: event.entityType,
        periodMonth:
          event.payload && typeof event.payload === "object"
            ? (event.payload as Record<string, unknown>).periodMonth
            : "",
        createdAt: event.createdAt,
      })),
      health: {
        api: "ok",
        database: dbReachable ? "ok" : "error",
      },
    });
  } catch (error) {
    logger.error("Admin Overview Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch admin overview",
        requestId: req.id,
      },
    });
  }
}
