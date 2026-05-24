"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoRunSettlement = autoRunSettlement;
exports.previewSettlement = previewSettlement;
exports.rejectSettlement = rejectSettlement;
exports.exportSettlementCsv = exportSettlementCsv;
exports.getSettlementSummary = getSettlementSummary;
exports.approveSettlement = approveSettlement;
exports.getSettlements = getSettlements;
const settlementService_1 = require("../services/settlementService");
const database_1 = require("@tutor-advantage/database");
/**
 * Computes the previous calendar month in ICT (UTC+7) as "YYYY-MM".
 * e.g. called in June 2026 → returns "2026-05"
 */
function getPreviousIctMonth() {
    const nowUtc = new Date();
    // Shift to ICT (UTC+7)
    const nowIct = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
    // Go to first moment of this ICT month, then subtract 1ms → previous month
    const firstOfThisMonth = new Date(Date.UTC(nowIct.getUTCFullYear(), nowIct.getUTCMonth(), 1));
    const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 1);
    const y = lastOfPrevMonth.getUTCFullYear();
    const m = String(lastOfPrevMonth.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}
/**
 * POST /v1/internal/settlement/auto-run
 * Called by Google Cloud Scheduler on the 1st of each month.
 * Protected by X-Internal-Key header (shared secret), NOT JWT.
 */
async function autoRunSettlement(req, res) {
    const internalKey = process.env.INTERNAL_API_KEY;
    const providedKey = req.headers["x-internal-key"];
    if (!internalKey || providedKey !== internalKey) {
        return res.status(401).json({
            error: { code: "UNAUTHORIZED", message: "Invalid internal key" },
        });
    }
    const periodMonth = getPreviousIctMonth();
    try {
        // Idempotency: skip if a run already exists for this period
        const existing = await database_1.prisma.settlementRun.findFirst({
            where: { periodMonth },
            orderBy: { createdAt: "desc" },
        });
        if (existing) {
            console.log(`[AutoSettlement] Run for ${periodMonth} already exists (${existing.settlementRunId}). Skipping.`);
            return res.status(200).json({
                message: "Settlement run already exists for this period — skipped",
                periodMonth,
                settlementRunId: existing.settlementRunId,
                skipped: true,
            });
        }
        const preview = await settlementService_1.SettlementService.previewSettlement(periodMonth, "SYSTEM_SCHEDULER");
        console.log(`[AutoSettlement] Created settlement preview for ${periodMonth}: ${preview.snapshotId}`);
        return res.status(201).json({
            message: "Settlement preview created successfully",
            periodMonth,
            settlementRunId: preview.snapshotId,
            skipped: false,
        });
    }
    catch (error) {
        console.error("[AutoSettlement] Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Auto-run settlement failed",
                details: error.message,
            },
        });
    }
}
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
        if (error.message === "DRAFT_EXISTS") {
            return res.status(409).json({
                error: {
                    code: "DRAFT_EXISTS",
                    message: "A draft settlement already exists for this period",
                    requestId: req.id,
                },
            });
        }
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
        const header = "tutor_user_id,gross_volume_thb,payout_rate,gross_payout_thb,badge_bonus_thb,wht_3pct_thb,net_payout_thb,eligibility_status";
        const rows = run.payoutLines.map((line) => {
            const grossTHB = (Number(line.grossVolumeMinor) / 100).toFixed(2);
            const payoutTHB = (Number(line.payoutAmountMinor) / 100).toFixed(2);
            const badgeTHB = (Number(line.badgeBonusMinor) / 100).toFixed(2);
            const whtTHB = (Number(line.withholdingTaxMinor) / 100).toFixed(2);
            const netTHB = (Number(line.netPayoutMinor) / 100).toFixed(2);
            return `${line.tutorUserId},${grossTHB},${line.payoutRate},${payoutTHB},${badgeTHB},${whtTHB},${netTHB},${line.eligibilityStatus}`;
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
        const userId = req.user?.userId;
        if (!userId || (req.user?.role !== "ADMIN" && req.user?.role !== "FINANCE_CHECKER")) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "Only authorized checkers can view settlements",
                    requestId: req.id,
                },
            });
        }
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
