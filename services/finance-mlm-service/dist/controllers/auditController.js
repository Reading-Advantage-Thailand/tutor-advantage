"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogs = getAuditLogs;
const database_1 = require("@tutor-advantage/database");
/**
 * GET /v1/audit-logs
 * Query params: periodMonth, actionType
 */
async function getAuditLogs(req, res) {
    try {
        const { periodMonth, actionType, page = "1", pageSize = "50", } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 50));
        const where = {};
        // กรองตาม periodMonth จาก payload
        if (periodMonth) {
            where.payload = { path: ["periodMonth"], equals: periodMonth };
        }
        // กรองตาม actionType
        if (actionType) {
            where.action = actionType;
        }
        const [total, logs] = await Promise.all([
            database_1.prisma.auditEvent.count({ where }),
            database_1.prisma.auditEvent.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (pageNum - 1) * limit,
                take: limit,
            }),
        ]);
        // ดึง displayName ของ actors ทั้งหมดในครั้งเดียว — กรองแค่ UUID format เท่านั้น
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const actorIds = [...new Set(logs.map((l) => l.actorId))].filter((id) => UUID_RE.test(id));
        const actorMap = new Map();
        if (actorIds.length > 0) {
            const actors = await database_1.prisma.user.findMany({
                where: { userId: { in: actorIds } },
                select: { userId: true, displayName: true, email: true },
            });
            for (const u of actors) {
                actorMap.set(u.userId, u.displayName ?? u.email ?? u.userId);
            }
        }
        // Map AuditEvent schema → frontend format
        const mapped = logs.map((ev) => {
            const found = actorMap.get(ev.actorId);
            // fallback: ถ้าไม่เจอใน DB ให้แสดง "User …xxxx" แทน UUID เต็ม
            const displayName = found ??
                (ev.actorId.includes("-")
                    ? `User …${ev.actorId.slice(-4)}`
                    : ev.actorId);
            return {
                auditId: ev.auditEventId,
                actionType: ev.action,
                actorUserId: ev.actorId,
                displayName,
                targetId: ev.entityId,
                periodMonth: ev.payload?.periodMonth ?? "",
                previousStatus: undefined,
                newStatus: undefined,
                createdAt: ev.createdAt,
                metadata: ev.payload,
            };
        });
        return res.status(200).json({
            logs: mapped,
            pagination: {
                total,
                page: pageNum,
                pageSize: limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error("AuditLogs Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not fetch audit logs",
                requestId: req.id,
            },
        });
    }
}
