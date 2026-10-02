import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

/** Fraud statuses that still need a decision (CLEARED is closed). */
export const ACTIVE_FRAUD_STATUSES = ["OPEN", "INVESTIGATING", "MONITORING", "FROZEN"];
const HIGH_FRAUD_SEVERITIES = ["HIGH", "CRITICAL"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

function toNumber(value: bigint | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "bigint" ? Number(value) : value;
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/**
 * GET /v1/admin/overview: ONE request feeds the shell's nav badges and the
 * overview page (polled by the admin shell every 60 s, visibility-aware).
 *
 * Backward-compatible shape: `stats`, `workQueues`, `recentActivity`, `health`
 * are unchanged; `kpis` and `queueOldest` were added for the overview page.
 *
 * Queue definitions (keep the linked admin lists filtering the same way):
 *  - settlements:   settlement runs with status SUBMITTED (awaiting checker approval)
 *  - adjustments:   adjustments with status PENDING
 *  - verifications: TUTOR users with verificationStatus PENDING
 *  - exceptions:    exceptions with status UNRESOLVED
 *  - fraudFlags:    fraud flags with status OPEN/INVESTIGATING/MONITORING/FROZEN
 */
export async function getAdminOverview(req: AuthenticatedRequest, res: Response) {
  try {
    const now = Date.now();
    const thirtyDaysAgo = new Date(now - 30 * DAY_MS);
    const verificationWhere = { role: "TUTOR", verificationStatus: "PENDING" } as const;
    const fraudWhere = { status: { in: ACTIVE_FRAUD_STATUSES } };

    const [
      totalSettlementsLast30Days,
      pendingApprovals,
      pendingAdjustments,
      pendingVerificationUsers,
      unresolvedExceptions,
      activeFraudFlags,
      highSeverityFraudFlags,
      recentAuditEvents,
      payments30d,
      submittedTotals,
      oldestSubmittedRun,
      oldestAdjustment,
      oldestVerification,
      oldestException,
      oldestFraudFlag,
    ] = await Promise.all([
      prisma.settlementRun.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.settlementRun.count({ where: { status: "SUBMITTED" } }),
      prisma.adjustment.count({ where: { status: "PENDING" } }),
      prisma.user.count({ where: verificationWhere }),
      prisma.exception.count({ where: { status: "UNRESOLVED" } }),
      prisma.fraudFlag.count({ where: fraudWhere }),
      prisma.fraudFlag.count({ where: { ...fraudWhere, severity: { in: HIGH_FRAUD_SEVERITIES } } }),
      prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
      prisma.paymentIntent.aggregate({
        where: { status: "SUCCESS", paidAt: { gte: thirtyDaysAgo } },
        _count: { _all: true },
        _sum: { amountMinor: true },
      }),
      prisma.payoutLine.aggregate({
        where: { settlementRun: { status: "SUBMITTED" } },
        _sum: { netPayoutMinor: true },
        _count: { _all: true },
      }),
      prisma.settlementRun.findFirst({
        where: { status: "SUBMITTED" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, periodMonth: true },
      }),
      prisma.adjustment.findFirst({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      prisma.user.findFirst({ where: verificationWhere, orderBy: { updatedAt: "asc" }, select: { updatedAt: true } }),
      prisma.exception.findFirst({ where: { status: "UNRESOLVED" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      prisma.fraudFlag.findFirst({ where: fraudWhere, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    ]);

    const actorIds = [...new Set(recentAuditEvents.map((e) => e.actorId))].filter((id) => UUID_RE.test(id));
    const actors = actorIds.length
      ? await prisma.user.findMany({
          where: { userId: { in: actorIds } },
          select: { userId: true, displayName: true, email: true },
        })
      : [];
    const actorName = new Map(actors.map((a) => [a.userId, a.displayName ?? a.email ?? null]));

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
      /** Oldest waiting item per queue (ISO), for "waiting since" hints. */
      queueOldest: {
        settlements: iso(oldestSubmittedRun?.createdAt),
        adjustments: iso(oldestAdjustment?.createdAt),
        verifications: iso(oldestVerification?.updatedAt),
        exceptions: iso(oldestException?.createdAt),
        fraudFlags: iso(oldestFraudFlag?.createdAt),
      },
      kpis: {
        paymentsLast30Days: {
          count: payments30d._count._all,
          amountSatang: toNumber(payments30d._sum.amountMinor),
        },
        awaitingApproval: {
          runs: pendingApprovals,
          oldestPeriodMonth: oldestSubmittedRun?.periodMonth ?? null,
          payoutLines: submittedTotals._count._all,
          netPayoutSatang: toNumber(submittedTotals._sum.netPayoutMinor),
        },
        settlementsLast30Days: totalSettlementsLast30Days,
        highSeverityFraudFlags,
      },
      recentActivity: recentAuditEvents.map((event) => {
        const payload =
          event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
            ? (event.payload as Record<string, unknown>)
            : {};
        return {
          auditId: event.auditEventId,
          actionType: event.action,
          actorUserId: event.actorId,
          actorName: actorName.get(event.actorId) ?? (event.actorId === "SYSTEM" ? "SYSTEM" : null),
          targetId: event.entityId,
          entityType: event.entityType,
          periodMonth: typeof payload.periodMonth === "string" ? payload.periodMonth : "",
          createdAt: event.createdAt,
        };
      }),
      // The queries above already hit the database, so reaching here means it is up.
      health: { api: "ok", database: "ok" },
      generatedAt: new Date(now).toISOString(),
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
