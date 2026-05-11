"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.previewSettlement = previewSettlement;
exports.rejectSettlement = rejectSettlement;
exports.exportSettlementCsv = exportSettlementCsv;
exports.getSettlementSummary = getSettlementSummary;
exports.approveSettlement = approveSettlement;
exports.getSettlements = getSettlements;
const settlementService_1 = require("../services/settlementService");
const database_1 = require("@tutor-advantage/database");
async function previewSettlement(req, res) {
    try {
        const userId = req.user?.userId;
        const { periodMonth } = req.body; // e.g., '2026-02'
        // Mocking an ADMIN role check
        if (!userId || req.user?.role !== "ADMIN") {
            return res.status(401).json({
                error: {
                    code: "UNAUTHORIZED_ROLE",
                    message: "Only admins can preview settlements",
                    requestId: req.id,
                },
            });
        }
        if (!periodMonth || !/^\d{4}-\d{2}$/.test(periodMonth)) {
            return res.status(400).json({
                error: {
                    code: "BAD_REQUEST",
                    message: "Valid periodMonth (YYYY-MM) is required",
                    requestId: req.id,
                },
            });
        }
        const preview = await settlementService_1.SettlementService.previewSettlement(periodMonth, userId);
        return res.status(200).json({
            message: "Settlement preview generated",
            preview,
        });
    }
    catch (error) {
        console.error("Preview Settlement Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not generate settlement preview",
                details: error.message,
                requestId: req.id,
            },
        });
    }
}
/**
 * POST /v1/settlements/:snapshotId/reject
 */
async function rejectSettlement(req, res) {
    try {
        const userId = req.user?.userId;
        const { snapshotId } = req.params;
        if (!userId ||
            (req.user?.role !== "FINANCE_CHECKER" && req.user?.role !== "ADMIN")) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "Only authorized checkers can reject settlements",
                    requestId: req.id,
                },
            });
        }
        const run = await database_1.prisma.settlementRun.findUnique({
            where: { settlementRunId: snapshotId },
        });
        if (!run) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Settlement run not found",
                    requestId: req.id,
                },
            });
        }
        if (run.status !== "DRAFT") {
            return res.status(400).json({
                error: {
                    code: "INVALID_STATUS",
                    message: "Settlement must be DRAFT to reject",
                    requestId: req.id,
                },
            });
        }
        await database_1.prisma.settlementRun.update({
            where: { settlementRunId: snapshotId },
            data: { status: "REJECTED" },
        });
        await database_1.prisma.auditEvent.create({
            data: {
                actorId: userId,
                action: "REJECT",
                entityType: "SettlementRun",
                entityId: snapshotId,
                payload: { periodMonth: run.periodMonth },
            },
        });
        return res.status(200).json({ message: "Settlement rejected" });
    }
    catch (error) {
        console.error("Reject Settlement Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not reject settlement",
                requestId: req.id,
            },
        });
    }
}
/**
 * GET /v1/settlements/:snapshotId/export
 * ส่ง CSV ของ PayoutLines ใน settlement นั้น
 */
async function exportSettlementCsv(req, res) {
    try {
        const { snapshotId } = req.params;
        const userId = req.user?.userId;
        const run = await database_1.prisma.settlementRun.findUnique({
            where: { settlementRunId: snapshotId },
            include: { payoutLines: true },
        });
        if (!run) {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Settlement run not found",
                    requestId: req.id,
                },
            });
        }
        // สร้าง CSV
        const header = "tutor_user_id,gross_volume_thb,payout_rate,gross_payout_thb,wht_3pct_thb,net_payout_thb,eligibility_status";
        const rows = run.payoutLines.map((line) => {
            const grossTHB = (Number(line.grossVolumeMinor) / 100).toFixed(2);
            const payoutTHB = (Number(line.payoutAmountMinor) / 100).toFixed(2);
            const whtTHB = (Number(line.withholdingTaxMinor) / 100).toFixed(2);
            const netTHB = (Number(line.netPayoutMinor) / 100).toFixed(2);
            return `${line.tutorUserId},${grossTHB},${line.payoutRate},${payoutTHB},${whtTHB},${netTHB},${line.eligibilityStatus}`;
        });
        const csv = [header, ...rows].join("\n");
        // บันทึก AuditEvent
        if (userId) {
            await database_1.prisma.auditEvent.create({
                data: {
                    actorId: userId,
                    action: "EXPORT",
                    entityType: "SettlementRun",
                    entityId: snapshotId,
                    payload: {
                        filename: `settlement-${run.periodMonth}-${snapshotId.slice(0, 8)}.csv`,
                    },
                },
            });
        }
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="settlement-${run.periodMonth}-${snapshotId.slice(0, 8)}.csv"`);
        return res.status(200).send(csv);
    }
    catch (error) {
        console.error("Export CSV Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not export CSV",
                requestId: req.id,
            },
        });
    }
}
/**
 * GET /v1/settlements/summary
 * สำหรับ Dashboard StatCards
 */
async function getSettlementSummary(req, res) {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const [totalLast30, pendingCount, pendingAdjCount] = await Promise.all([
            database_1.prisma.settlementRun.count({
                where: { createdAt: { gte: thirtyDaysAgo } },
            }),
            database_1.prisma.settlementRun.count({
                where: { status: "DRAFT" },
            }),
            database_1.prisma.adjustment.count({
                where: { status: "PENDING" },
            }),
        ]);
        return res.status(200).json({
            totalSettlementsLast30Days: totalLast30,
            pendingApprovals: pendingCount,
            pendingAdjustments: pendingAdjCount,
        });
    }
    catch (error) {
        console.error("Summary Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not fetch summary",
                requestId: req.id,
            },
        });
    }
}
async function approveSettlement(req, res) {
    try {
        const userId = req.user?.userId;
        const { snapshotId } = req.params;
        // Simulate Checker Role - Maker-Checker workflow
        if (!userId ||
            (req.user?.role !== "FINANCE_CHECKER" && req.user?.role !== "ADMIN")) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "Only authorized checkers can approve settlements",
                    requestId: req.id,
                },
            });
        }
        if (!snapshotId) {
            return res.status(400).json({
                error: {
                    code: "BAD_REQUEST",
                    message: "snapshotId is required in the path",
                    requestId: req.id,
                },
            });
        }
        const approvedRun = await settlementService_1.SettlementService.approveSettlement(snapshotId, userId);
        return res.status(200).json({
            message: "Settlement run approved",
            run: approvedRun,
        });
    }
    catch (error) {
        if (error.message === "NOT_FOUND") {
            return res.status(404).json({
                error: {
                    code: "NOT_FOUND",
                    message: "Settlement run not found",
                    requestId: req.id,
                },
            });
        }
        if (error.message === "INVALID_STATUS") {
            return res.status(400).json({
                error: {
                    code: "INVALID_STATUS",
                    message: "Settlement run must be in DRAFT to approve",
                    requestId: req.id,
                },
            });
        }
        if (error.message === "MAKER_CHECKER_VIOLATION") {
            return res.status(403).json({
                error: {
                    code: "MAKER_CHECKER_VIOLATION",
                    message: "Settlement approver must be different from creator",
                    requestId: req.id,
                },
            });
        }
        console.error("Approve Settlement Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not approve settlement run",
                details: error.message,
                requestId: req.id,
            },
        });
    }
}
/**
 * GET /v1/settlements
 * คืน list ของทุก SettlementRun เรียงจากล่าสุด
 */
async function getSettlements(req, res) {
    try {
        const runs = await database_1.prisma.settlementRun.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                _count: { select: { payoutLines: true } },
            },
        });
        const mapped = runs.map((r) => ({
            snapshotId: r.settlementRunId,
            periodMonth: r.periodMonth,
            status: r.status,
            createdBy: r.createdBy,
            createdAt: r.createdAt,
            approvedBy: r.approvedBy,
            approvedAt: r.approvedAt,
            payoutLineCount: r._count.payoutLines,
        }));
        return res.status(200).json({ settlements: mapped });
    }
    catch (error) {
        console.error("GetSettlements Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not fetch settlements",
                requestId: req.id,
            },
        });
    }
}
