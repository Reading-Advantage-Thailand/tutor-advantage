"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminOverview = getAdminOverview;
const database_1 = require("@tutor-advantage/database");
const ACTIVE_FRAUD_STATUSES = ["OPEN", "INVESTIGATING", "MONITORING", "FROZEN"];
async function getAdminOverview(req, res) {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const [totalSettlementsLast30Days, pendingApprovals, pendingAdjustments, pendingVerificationUsers, unresolvedExceptions, activeFraudFlags, recentAuditEvents,] = await Promise.all([
            database_1.prisma.settlementRun.count({
                where: { createdAt: { gte: thirtyDaysAgo } },
            }),
            database_1.prisma.settlementRun.count({ where: { status: "SUBMITTED" } }),
            database_1.prisma.adjustment.count({ where: { status: "PENDING" } }),
            database_1.prisma.user.count({ where: { verificationStatus: "PENDING" } }),
            database_1.prisma.exception.count({ where: { status: "UNRESOLVED" } }),
            database_1.prisma.fraudFlag.count({
                where: { status: { in: ACTIVE_FRAUD_STATUSES } },
            }),
            database_1.prisma.auditEvent.findMany({
                orderBy: { createdAt: "desc" },
                take: 8,
            }),
        ]);
        let dbReachable = true;
        try {
            await database_1.prisma.$queryRaw `SELECT 1`;
        }
        catch {
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
                periodMonth: event.payload && typeof event.payload === "object"
                    ? event.payload.periodMonth
                    : "",
                createdAt: event.createdAt,
            })),
            health: {
                api: "ok",
                database: dbReachable ? "ok" : "error",
            },
        });
    }
    catch (error) {
        console.error("Admin Overview Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not fetch admin overview",
                requestId: req.id,
            },
        });
    }
}
