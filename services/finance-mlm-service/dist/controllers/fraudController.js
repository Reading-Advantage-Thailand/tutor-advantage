"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerFraudAction = exports.getFraudFlags = void 0;
const shared_config_1 = require("@tutor-advantage/shared-config");
const database_1 = require("@tutor-advantage/database");
const ACTIVE_STATUSES = ["OPEN", "INVESTIGATING", "MONITORING", "FROZEN"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mapActionToStatus = (action) => {
    switch (action.toUpperCase()) {
        case "CLEAR":
            return "CLEARED";
        case "MONITOR":
            return "MONITORING";
        case "FREEZE":
            return "FROZEN";
        default:
            return "INVESTIGATING";
    }
};
const getFraudFlags = async (req, res) => {
    try {
        const { q, status } = req.query;
        const where = {};
        if (status && status !== "ALL") {
            where.status = status;
        }
        if (q?.trim()) {
            const search = q.trim();
            where.OR = [
                ...(UUID_RE.test(search) ? [{ flagId: search }] : []),
                { type: { contains: search, mode: "insensitive" } },
                { severity: { contains: search, mode: "insensitive" } },
                { targetId: { contains: search, mode: "insensitive" } },
                { targetName: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ];
        }
        const [flags, activeCount, autoSuspensions, highRiskCount] = await Promise.all([
            database_1.prisma.fraudFlag.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: 100,
            }),
            database_1.prisma.fraudFlag.count({
                where: { status: { in: ACTIVE_STATUSES } },
            }),
            database_1.prisma.fraudFlag.count({ where: { status: "FROZEN" } }),
            database_1.prisma.fraudFlag.count({
                where: {
                    status: { in: ACTIVE_STATUSES },
                    severity: { in: ["HIGH", "CRITICAL"] },
                },
            }),
        ]);
        res.status(200).json({
            flags: flags.map((flag) => ({
                id: flag.flagId,
                type: flag.type,
                severity: flag.severity,
                targetId: flag.targetId,
                targetName: flag.targetName ?? flag.targetId,
                description: flag.description ?? "",
                status: flag.status,
                createdAt: flag.createdAt,
                updatedAt: flag.updatedAt,
            })),
            stats: {
                activeCount,
                velocityStatus: highRiskCount > 0 ? "Review" : "Normal",
                autoSuspensions,
            },
        });
    }
    catch (error) {
        shared_config_1.logger.error("Get Fraud Flags Error:", error);
        res.status(500).json({ error: "Could not fetch fraud flags" });
    }
};
exports.getFraudFlags = getFraudFlags;
const triggerFraudAction = async (req, res) => {
    const { id } = req.params;
    const { action } = req.body;
    const userId = req.user?.userId;
    if (!action) {
        return res.status(400).json({ error: "action is required" });
    }
    try {
        const current = await database_1.prisma.fraudFlag.findUnique({
            where: { flagId: id },
        });
        if (!current) {
            return res.status(404).json({ error: "Fraud flag not found" });
        }
        const newStatus = mapActionToStatus(action);
        const flag = await database_1.prisma.fraudFlag.update({
            where: { flagId: id },
            data: { status: newStatus, updatedAt: new Date() },
        });
        if (userId) {
            await database_1.prisma.auditEvent.create({
                data: {
                    actorId: userId,
                    action: `FRAUD_${action.toUpperCase()}`,
                    entityType: "FraudFlag",
                    entityId: id,
                    payload: {
                        previousStatus: current.status,
                        newStatus,
                        targetId: current.targetId,
                        type: current.type,
                    },
                },
            });
        }
        res.status(200).json({
            success: true,
            message: `Fraud flag ${id} updated to ${newStatus}`,
            flag: {
                id: flag.flagId,
                status: flag.status,
            },
        });
    }
    catch (error) {
        shared_config_1.logger.error("Fraud Action Error:", error);
        res.status(500).json({ error: "Could not update fraud flag" });
    }
};
exports.triggerFraudAction = triggerFraudAction;
