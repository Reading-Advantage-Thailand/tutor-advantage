"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdjustments = getAdjustments;
exports.createAdjustment = createAdjustment;
exports.approveAdjustment = approveAdjustment;
exports.rejectAdjustment = rejectAdjustment;
const database_1 = require("@tutor-advantage/database");
const settlementService_1 = require("../services/settlementService");
function canCreateAdjustment(role) {
    return role === "ADMIN" || role === "FINANCE_MAKER";
}
function canCheckAdjustment(role) {
    return role === "ADMIN" || role === "FINANCE_CHECKER";
}
function normalizeAmountSatang(value) {
    if (typeof value === "bigint")
        return value;
    if (typeof value === "number" && Number.isInteger(value))
        return BigInt(value);
    if (typeof value === "string" && /^-?\d+$/.test(value))
        return BigInt(value);
    throw new Error("INVALID_AMOUNT");
}
/**
 * GET /v1/adjustments?status=PENDING
 */
async function getAdjustments(req, res) {
    try {
        const { status, page = "1", pageSize = "50", } = req.query;
        const filter = status ? { status } : {};
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 50));
        const [total, adjustments] = await Promise.all([
            database_1.prisma.adjustment.count({ where: filter }),
            database_1.prisma.adjustment.findMany({
                where: filter,
                orderBy: { createdAt: "desc" },
                skip: (pageNum - 1) * limit,
                take: limit,
            }),
        ]);
        // ดึง displayName ของ tutors และ creators (กรอง UUID เท่านั้น)
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const userIds = [
            ...new Set([
                ...adjustments.map((a) => a.tutorUserId),
                ...adjustments.map((a) => a.createdBy),
                ...adjustments.map((a) => a.approvedBy).filter(Boolean),
            ]),
        ].filter((id) => UUID_RE.test(id));
        const userMap = new Map();
        if (userIds.length > 0) {
            const users = await database_1.prisma.user.findMany({
                where: { userId: { in: userIds } },
                select: { userId: true, displayName: true, email: true },
            });
            for (const u of users) {
                userMap.set(u.userId, u.displayName ?? u.email ?? u.userId);
            }
        }
        // ดึง periodMonth จาก settlementRun
        const runIds = [...new Set(adjustments.map((a) => a.settlementRunId))];
        const runs = await database_1.prisma.settlementRun.findMany({
            where: { settlementRunId: { in: runIds } },
            select: { settlementRunId: true, periodMonth: true },
        });
        const runMap = new Map(runs.map((r) => [r.settlementRunId, r.periodMonth]));
        const getName = (id) => userMap.get(id) ?? (id.includes("-") ? `User …${id.slice(-4)}` : id);
        const mapped = adjustments.map((adj) => ({
            adjustmentId: adj.adjustmentId,
            tutorUserId: adj.tutorUserId,
            tutorName: getName(adj.tutorUserId),
            periodMonth: runMap.get(adj.settlementRunId) ?? "",
            amountSatang: Number(adj.amountMinor),
            reason: adj.reason,
            status: adj.status,
            createdByUserId: adj.createdBy,
            createdByName: getName(adj.createdBy),
            createdAt: adj.createdAt,
            approvedByUserId: adj.approvedBy ?? null,
            approvedByName: adj.approvedBy ? getName(adj.approvedBy) : null,
            approvedAt: adj.approvedAt ?? null,
        }));
        return res.status(200).json({
            adjustments: mapped,
            pagination: {
                total,
                page: pageNum,
                pageSize: limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error("GetAdjustments Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not fetch adjustments",
                requestId: req.id,
            },
        });
    }
}
/**
 * POST /v1/adjustments
 * Body: { tutorUserId, periodMonth, amountSatang, reason }
 */
async function createAdjustment(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId || !canCreateAdjustment(req.user?.role)) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "Only finance makers or admins can create adjustments",
                    requestId: req.id,
                },
            });
        }
        const { tutorUserId, periodMonth, amountSatang, reason } = req.body;
        if (!tutorUserId || !periodMonth || amountSatang == null || !reason) {
            return res.status(400).json({
                error: {
                    code: "BAD_REQUEST",
                    message: "tutorUserId, periodMonth, amountSatang, reason required",
                    requestId: req.id,
                },
            });
        }
        let normalizedAmount;
        try {
            normalizedAmount = normalizeAmountSatang(amountSatang);
        }
        catch {
            return res.status(400).json({
                error: {
                    code: "INVALID_AMOUNT",
                    message: "amountSatang must be an integer in Satang",
                    requestId: req.id,
                },
            });
        }
        if (normalizedAmount === 0n) {
            return res.status(400).json({
                error: {
                    code: "INVALID_AMOUNT",
                    message: "amountSatang cannot be zero",
                    requestId: req.id,
                },
            });
        }
        // หา SettlementRun ของ period นั้น (หรือสร้างใหม่ถ้าไม่มี)
        let run = await database_1.prisma.settlementRun.findFirst({
            where: { periodMonth },
            orderBy: { createdAt: "desc" },
        });
        if (!run) {
            run = await database_1.prisma.settlementRun.create({
                data: {
                    periodMonth,
                    status: "DRAFT",
                    createdBy: userId,
                    previewPayload: {},
                },
            });
        }
        const adj = await database_1.prisma.adjustment.create({
            data: {
                settlementRunId: run.settlementRunId,
                tutorUserId,
                amountMinor: normalizedAmount,
                reason,
                createdBy: userId,
            },
        });
        // บันทึก AuditEvent
        await database_1.prisma.auditEvent.create({
            data: {
                actorId: userId,
                action: "ADJUST_CREATE",
                entityType: "Adjustment",
                entityId: adj.adjustmentId,
                payload: { amountSatang: normalizedAmount.toString(), reason, periodMonth },
            },
        });
        return res.status(201).json({
            message: "Adjustment created",
            adjustmentId: adj.adjustmentId,
        });
    }
    catch (error) {
        console.error("CreateAdjustment Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not create adjustment",
                requestId: req.id,
            },
        });
    }
}
/**
 * POST /v1/adjustments/:adjustmentId/approve
 */
async function approveAdjustment(req, res) {
    const { adjustmentId } = req.params;
    const userId = req.user?.userId;
    try {
        if (!userId || !canCheckAdjustment(req.user?.role)) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "Only finance checkers or admins can approve adjustments",
                    requestId: req.id,
                },
            });
        }
        const adj = await database_1.prisma.adjustment.findUnique({ where: { adjustmentId } });
        if (!adj) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Adjustment not found",
                    requestId: req.id,
                },
            });
        }
        // ห้าม approve รายการที่ตัวเองสร้าง
        if (adj.createdBy === userId) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You cannot approve your own adjustment (Makers-Checkers rule)",
                    requestId: req.id,
                },
            });
        }
        const now = new Date();
        await database_1.prisma.adjustment.update({
            where: { adjustmentId },
            data: { status: "APPROVED", approvedBy: userId, approvedAt: now },
        });
        const settlementRefresh = await settlementService_1.SettlementService.refreshSettlementRun(adj.settlementRunId);
        await database_1.prisma.auditEvent.create({
            data: {
                actorId: userId,
                action: "ADJUST_APPROVE",
                entityType: "Adjustment",
                entityId: adjustmentId,
                payload: {
                    createdBy: adj.createdBy,
                    approvedBy: userId,
                    amountSatang: adj.amountMinor.toString(),
                },
            },
        });
        return res.status(200).json({
            message: "Adjustment approved",
            settlementRefresh,
        });
    }
    catch (error) {
        console.error("ApproveAdjustment Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not approve",
                requestId: req.id,
            },
        });
    }
}
/**
 * POST /v1/adjustments/:adjustmentId/reject
 */
async function rejectAdjustment(req, res) {
    const { adjustmentId } = req.params;
    const userId = req.user?.userId;
    try {
        if (!userId || !canCheckAdjustment(req.user?.role)) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "Only finance checkers or admins can reject adjustments",
                    requestId: req.id,
                },
            });
        }
        const adj = await database_1.prisma.adjustment.findUnique({ where: { adjustmentId } });
        if (!adj) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Adjustment not found",
                    requestId: req.id,
                },
            });
        }
        if (adj.createdBy === userId) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "You cannot reject your own adjustment (Makers-Checkers rule)",
                    requestId: req.id,
                },
            });
        }
        const now = new Date();
        await database_1.prisma.adjustment.update({
            where: { adjustmentId },
            data: { status: "REJECTED", approvedBy: userId, approvedAt: now },
        });
        const settlementRefresh = await settlementService_1.SettlementService.refreshSettlementRun(adj.settlementRunId);
        await database_1.prisma.auditEvent.create({
            data: {
                actorId: userId,
                action: "ADJUST_REJECT",
                entityType: "Adjustment",
                entityId: adjustmentId,
                payload: {
                    createdBy: adj.createdBy,
                    rejectedBy: userId,
                    amountSatang: adj.amountMinor.toString(),
                },
            },
        });
        return res.status(200).json({
            message: "Adjustment rejected",
            settlementRefresh,
        });
    }
    catch (error) {
        console.error("RejectAdjustment Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not reject",
                requestId: req.id,
            },
        });
    }
}
