"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEarningsSummary = getEarningsSummary;
exports.getEarningsHistory = getEarningsHistory;
exports.syncTutorTransfer = syncTutorTransfer;
const shared_config_1 = require("@tutor-advantage/shared-config");
const database_1 = require("@tutor-advantage/database");
const commissionService_1 = require("../services/commissionService");
const settlementService_1 = require("../services/settlementService");
async function getEarningsSummary(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                error: { code: "UNAUTHORIZED", message: "User not identified" },
            });
        }
        const periodMonth = (0, commissionService_1.formatIctPeriodMonth)();
        const projection = await calculateTutorPeriodProjection(userId, periodMonth);
        return res.status(200).json({
            periodMonth,
            grossVolumeTHB: projection.groupVolumeTHB,
            personalVolumeTHB: projection.personalVolumeTHB,
            currentRate: projection.rate,
            nextTierTargetTHB: projection.nextTarget,
            estimatedCommissionTHB: projection.totalPayoutTHB,
            networkBonusTHB: projection.networkBonusTHB,
        });
    }
    catch (error_err) {
        const error = error_err;
        shared_config_1.logger.error("Get Earnings Summary Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not calculate earnings summary",
                requestId: req.id,
            },
        });
    }
}
async function getEarningsHistory(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                error: {
                    code: "UNAUTHORIZED",
                    message: "User not identified",
                    requestId: req.id,
                },
            });
        }
        const periodMonth = (0, commissionService_1.formatIctPeriodMonth)();
        const { start: monthStart, end: monthEnd } = (0, commissionService_1.getIctMonthWindow)(periodMonth);
        const projection = await calculateTutorPeriodProjection(userId, periodMonth);
        const [currentAdjustments, currentBadges] = await Promise.all([
            database_1.prisma.adjustment.findMany({
                where: {
                    tutorUserId: userId,
                    status: "APPROVED",
                    createdAt: { gte: monthStart, lte: monthEnd },
                },
            }),
            database_1.prisma.tutorBadge.findMany({
                where: { tutorUserId: userId },
                select: { badgeCode: true },
            }),
        ]);
        const currentClawbackTHB = currentAdjustments.reduce((sum, adj) => sum + Number(adj.amountMinor) / 100, 0);
        // Badge bonus amounts in satang — must match settlementService.BADGE_BONUS_SATANG
        const BADGE_BONUS_SATANG = {
            ELITE_EDUCATOR: 50000,
            TOP_RATED: 30000,
            CLASS_MASTER: 20000,
            NETWORK_BUILDER: 10000,
            RISING_STAR: 5000,
            FAST_RESPONDER: 5000,
            AI_PIONEER: 5000,
        };
        const badgeBonusSatang = currentBadges.reduce((sum, b) => sum + (BADGE_BONUS_SATANG[b.badgeCode] ?? 0), 0);
        const badgeBonusTHB = badgeBonusSatang / 100;
        const currentProjection = {
            directSales: projection.directSalesTHB,
            networkBonus: projection.networkBonusTHB,
            badgeBonus: badgeBonusTHB,
            clawback: currentClawbackTHB,
            adjustments: currentAdjustments.map(a => ({
                reason: a.reason,
                amount: Number(a.amountMinor) / 100
            })),
            total: projection.totalPayoutTHB + badgeBonusTHB + currentClawbackTHB,
        };
        // 2. Past History
        const pastLines = await database_1.prisma.payoutLine.findMany({
            where: { tutorUserId: userId },
            include: { settlementRun: true, payoutDocument: true },
            orderBy: { settlementRun: { createdAt: "desc" } },
        });
        const approvedAdjustments = await database_1.prisma.adjustment.findMany({
            where: { tutorUserId: userId, status: "APPROVED" },
            orderBy: { createdAt: "desc" },
        });
        const adjustmentsByRun = new Map();
        const clawbackByRun = new Map();
        for (const adjustment of approvedAdjustments) {
            const current = clawbackByRun.get(adjustment.settlementRunId) || 0;
            clawbackByRun.set(adjustment.settlementRunId, current + Number(adjustment.amountMinor) / 100);
            if (!adjustmentsByRun.has(adjustment.settlementRunId)) {
                adjustmentsByRun.set(adjustment.settlementRunId, []);
            }
            adjustmentsByRun.get(adjustment.settlementRunId).push(adjustment);
        }
        const history = await Promise.all(pastLines.map(async (line) => {
            const totalAmount = Number(line.payoutAmountMinor) / 100;
            const periodProjection = await calculateTutorPeriodProjection(userId, line.settlementRun.periodMonth);
            const networkAmount = Math.min(totalAmount, Math.max(0, periodProjection.networkBonusTHB));
            const clawback = clawbackByRun.get(line.settlementRunId) || 0;
            const badgeBonus = Number(line.badgeBonusMinor) / 100;
            return {
                date: line.settlementRun.periodMonth,
                payoutLineId: line.payoutLineId,
                // Separate badge bonus out of direct so the frontend can show it as its own line
                direct: totalAmount - networkAmount - badgeBonus,
                network: networkAmount,
                badgeBonus,
                clawback: clawback,
                adjustments: (adjustmentsByRun.get(line.settlementRunId) || []).map(a => ({
                    reason: a.reason,
                    amount: Number(a.amountMinor) / 100
                })),
                withholdingTax: Number(line.withholdingTaxMinor) / 100,
                netPayout: Number(line.netPayoutMinor) / 100,
                payoutDocument: line.payoutDocument
                    ? {
                        documentNumber: line.payoutDocument.documentNumber,
                        documentType: line.payoutDocument.documentType,
                        status: line.payoutDocument.status,
                        issuedAt: line.payoutDocument.issuedAt,
                        transferStatus: line.payoutDocument.transferStatus,
                        transferredAt: line.payoutDocument.transferredAt,
                    }
                    : null,
                status: line.settlementRun.status.toLowerCase(),
            };
        }));
        // 3. Clawbacks (Adjustments)
        const clawbacks = approvedAdjustments.map((adj) => ({
            date: adj.createdAt.toLocaleDateString("th-TH", {
                month: "short",
                year: "numeric",
            }),
            amount: Number(adj.amountMinor) / 100,
            reason: adj.reason,
        }));
        return res.status(200).json({
            periodMonth,
            currentProjection,
            history,
            clawbacks,
            rateInfo: {
                rate: projection.rate,
                volume: projection.groupVolumeTHB,
                personalVolume: projection.personalVolumeTHB,
                nextTarget: projection.nextTarget,
            },
        });
    }
    catch (error_err) {
        const error = error_err;
        shared_config_1.logger.error("Get Earnings History Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not fetch earnings history",
                requestId: req.id,
            },
        });
    }
}
/**
 * POST /v1/tutors/earnings/transfers/:payoutLineId/sync
 * Lets a tutor refresh the Omise transfer status for their own payout line.
 */
async function syncTutorTransfer(req, res) {
    try {
        const userId = req.user?.userId;
        const { payoutLineId } = req.params;
        if (!userId) {
            return res.status(401).json({
                error: { code: "UNAUTHORIZED", message: "User not identified", requestId: req.id },
            });
        }
        if (!payoutLineId) {
            return res.status(400).json({
                error: { code: "BAD_REQUEST", message: "payoutLineId is required", requestId: req.id },
            });
        }
        const line = await database_1.prisma.payoutLine.findUnique({
            where: { payoutLineId },
            select: { tutorUserId: true },
        });
        if (!line) {
            return res.status(404).json({
                error: { code: "NOT_FOUND", message: "Payout line not found", requestId: req.id },
            });
        }
        if (line.tutorUserId !== userId) {
            return res.status(403).json({
                error: { code: "FORBIDDEN", message: "Not your payout line", requestId: req.id },
            });
        }
        const result = await settlementService_1.SettlementService.syncPayoutTransferStatus(payoutLineId);
        return res.status(200).json({ transfer: result });
    }
    catch (error_err) {
        const error = error_err;
        if (error.message === "OMISE_PAYOUTS_NOT_CONFIGURED") {
            return res.status(502).json({
                error: { code: error.message, message: "Omise keys are not configured", requestId: req.id },
            });
        }
        shared_config_1.logger.error("Sync Tutor Transfer Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not sync transfer status",
                requestId: req.id,
            },
        });
    }
}
async function calculateTutorPeriodProjection(userId, periodMonth) {
    const { start: monthStart, end: monthEnd } = (0, commissionService_1.getIctMonthWindow)(periodMonth);
    const tutors = await database_1.prisma.user.findMany({
        where: { role: "TUTOR", isActive: true },
        select: { userId: true, sponsorTutorId: true },
    });
    const classRows = await database_1.prisma.class.findMany({
        select: { classId: true, tutorUserId: true },
    });
    const classTutorMap = new Map(classRows.map((classRow) => [classRow.classId, classRow.tutorUserId]));
    const enrollments = await database_1.prisma.enrollment.findMany({
        where: { classId: { in: classRows.map((classRow) => classRow.classId) } },
        select: { enrollmentId: true, classId: true },
    });
    const enrollmentTutorMap = new Map();
    for (const enrollment of enrollments) {
        const tutorId = classTutorMap.get(enrollment.classId);
        if (tutorId)
            enrollmentTutorMap.set(enrollment.enrollmentId, tutorId);
    }
    const successfulPayments = await database_1.prisma.paymentIntent.findMany({
        where: {
            status: "SUCCESS",
            updatedAt: { gte: monthStart, lte: monthEnd },
            enrollmentId: { in: enrollments.map((enrollment) => enrollment.enrollmentId) },
        },
        select: { enrollmentId: true, amountMinor: true },
    });
    const personalVolumes = new Map();
    for (const payment of successfulPayments) {
        const tutorId = enrollmentTutorMap.get(payment.enrollmentId);
        if (!tutorId)
            continue;
        personalVolumes.set(tutorId, (personalVolumes.get(tutorId) || 0n) + payment.amountMinor);
    }
    const nodes = new Map();
    for (const tutor of tutors) {
        nodes.set(tutor.userId, {
            userId: tutor.userId,
            sponsorTutorId: tutor.sponsorTutorId,
            personalVolumeMinor: personalVolumes.get(tutor.userId) || 0n,
            groupVolumeMinor: 0n,
            payoutAmountMinor: 0n,
            rate: 0,
            children: [],
        });
    }
    for (const node of nodes.values()) {
        if (node.sponsorTutorId && nodes.has(node.sponsorTutorId)) {
            nodes.get(node.sponsorTutorId).children.push(node);
        }
    }
    const calculateGroupVolume = (node, seen = new Set()) => {
        if (seen.has(node.userId))
            throw new Error("SPONSOR_TREE_CYCLE");
        seen.add(node.userId);
        node.groupVolumeMinor =
            node.personalVolumeMinor +
                node.children.reduce((sum, child) => sum + calculateGroupVolume(child, new Set(seen)), 0n);
        node.rate = (0, commissionService_1.calculateCommissionInfo)(Number(node.groupVolumeMinor) / 100).rate;
        return node.groupVolumeMinor;
    };
    const calculatePayout = (node, seen = new Set()) => {
        if (seen.has(node.userId))
            throw new Error("SPONSOR_TREE_CYCLE");
        seen.add(node.userId);
        const childPayouts = node.children.reduce((sum, child) => sum + calculatePayout(child, new Set(seen)), 0n);
        const grossPayout = (0, commissionService_1.calculatePayoutMinor)(node.groupVolumeMinor, node.rate);
        node.payoutAmountMinor =
            grossPayout > childPayouts ? grossPayout - childPayouts : 0n;
        if (node.personalVolumeMinor === 0n && node.children.length > 0) {
            node.payoutAmountMinor = 0n;
        }
        return node.payoutAmountMinor;
    };
    for (const node of nodes.values()) {
        if (!node.sponsorTutorId || !nodes.has(node.sponsorTutorId)) {
            calculateGroupVolume(node);
            calculatePayout(node);
        }
    }
    const node = nodes.get(userId);
    if (!node) {
        return {
            personalVolumeTHB: 0,
            groupVolumeTHB: 0,
            rate: 0,
            nextTarget: 0,
            directSalesTHB: 0,
            networkBonusTHB: 0,
            totalPayoutTHB: 0,
        };
    }
    const { nextTarget } = (0, commissionService_1.calculateCommissionInfo)(Number(node.groupVolumeMinor) / 100);
    const directSalesMinor = (0, commissionService_1.calculatePayoutMinor)(node.personalVolumeMinor, node.rate);
    const networkBonusMinor = node.payoutAmountMinor > directSalesMinor
        ? node.payoutAmountMinor - directSalesMinor
        : 0n;
    return {
        personalVolumeTHB: Number(node.personalVolumeMinor) / 100,
        groupVolumeTHB: Number(node.groupVolumeMinor) / 100,
        rate: node.rate,
        nextTarget,
        directSalesTHB: Number(directSalesMinor) / 100,
        networkBonusTHB: Number(networkBonusMinor) / 100,
        totalPayoutTHB: Number(node.payoutAmountMinor) / 100,
    };
}
