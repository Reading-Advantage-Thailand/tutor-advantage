"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTutorNetwork = getTutorNetwork;
const shared_config_1 = require("@tutor-advantage/shared-config");
const database_1 = require("@tutor-advantage/database");
const commissionService_1 = require("../services/commissionService");
async function getTutorNetwork(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                error: { code: "UNAUTHORIZED", message: "User not identified" },
            });
        }
        const periodMonth = typeof req.query.periodMonth === "string"
            ? req.query.periodMonth
            : (0, commissionService_1.formatIctPeriodMonth)();
        const { start, end } = (0, commissionService_1.getIctMonthWindow)(periodMonth);
        const tutors = await database_1.prisma.user.findMany({
            where: { role: "TUTOR", isActive: true },
            select: {
                userId: true,
                displayName: true,
                email: true,
                sponsorTutorId: true,
                sponsorLockedAt: true,
                createdAt: true,
            },
        });
        const currentTutor = tutors.find((t) => t.userId === userId);
        if (!currentTutor) {
            return res.status(403).json({
                error: {
                    code: "FORBIDDEN",
                    message: "Only tutors can view network data",
                    requestId: req.id,
                },
            });
        }
        const classRows = await database_1.prisma.class.findMany({
            select: { classId: true, tutorUserId: true },
        });
        const classTutorMap = new Map(classRows.map((c) => [c.classId, c.tutorUserId]));
        const enrollments = await database_1.prisma.enrollment.findMany({
            where: { classId: { in: classRows.map((c) => c.classId) } },
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
                updatedAt: { gte: start, lte: end },
                enrollmentId: { in: enrollments.map((e) => e.enrollmentId) },
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
                ...tutor,
                personalVolumeMinor: personalVolumes.get(tutor.userId) || 0n,
                groupVolumeMinor: 0n,
                estimatedPayoutMinor: 0n,
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
        const calculateDifferentialPayout = (node, seen = new Set()) => {
            if (seen.has(node.userId))
                throw new Error("SPONSOR_TREE_CYCLE");
            seen.add(node.userId);
            const childPayouts = node.children.reduce((sum, child) => sum + calculateDifferentialPayout(child, new Set(seen)), 0n);
            const grossPayout = (0, commissionService_1.calculatePayoutMinor)(node.groupVolumeMinor, node.rate);
            node.estimatedPayoutMinor =
                grossPayout > childPayouts ? grossPayout - childPayouts : 0n;
            return node.estimatedPayoutMinor;
        };
        for (const node of nodes.values()) {
            if (!node.sponsorTutorId || !nodes.has(node.sponsorTutorId)) {
                calculateGroupVolume(node);
                calculateDifferentialPayout(node);
            }
        }
        // Badge bonus for the current tutor — must match settlementService.BADGE_BONUS_SATANG
        const BADGE_BONUS_SATANG = {
            ELITE_EDUCATOR: 50000,
            TOP_RATED: 30000,
            CLASS_MASTER: 20000,
            NETWORK_BUILDER: 10000,
            RISING_STAR: 5000,
            FAST_RESPONDER: 5000,
            AI_PIONEER: 5000,
        };
        const myBadges = await database_1.prisma.tutorBadge.findMany({
            where: { tutorUserId: userId },
            select: { badgeCode: true },
        });
        const badgeBonusTHB = myBadges.reduce((sum, b) => sum + (BADGE_BONUS_SATANG[b.badgeCode] ?? 0), 0) / 100;
        const me = nodes.get(userId);
        const sponsor = me.sponsorTutorId ? nodes.get(me.sponsorTutorId) : null;
        const upline = buildUpline(me, nodes);
        const subtreeIds = collectSubtreeIds(me).filter((id) => id !== userId);
        const depthCounts = countDepths(me);
        const appBaseUrl = (process.env.TUTOR_APP_BASE_URL ||
            process.env.NEXT_PUBLIC_BASE_URL ||
            "http://localhost:3000").replace(/\/$/, "");
        const inviteUrl = `${appBaseUrl}/invite/${userId}`;
        return res.status(200).json({
            periodMonth,
            inviteUrl,
            sponsor: sponsor ? mapTutorSummary(sponsor) : null,
            upline: upline.map(mapTutorSummary),
            networkTree: mapTutorTree(me),
            summary: {
                directDownlines: me.children.length,
                totalDownlines: subtreeIds.length,
                activeDownlines: subtreeIds.filter((id) => (nodes.get(id)?.personalVolumeMinor || 0n) > 0n).length,
                personalVolumeTHB: toTHB(me.personalVolumeMinor),
                groupVolumeTHB: toTHB(me.groupVolumeMinor),
                currentRate: me.rate,
                estimatedPayoutTHB: toTHB(me.estimatedPayoutMinor) + badgeBonusTHB,
                badgeBonusTHB,
                level1Count: depthCounts.get(1) || 0,
                level2PlusCount: Array.from(depthCounts.entries()).reduce((sum, [level, count]) => (level >= 2 ? sum + count : sum), 0),
            },
            downlines: me.children
                .sort(compareTutorVolumeDesc)
                .map((child) => ({
                ...mapTutorSummary(child),
                totalDownlines: collectSubtreeIds(child).length - 1,
            })),
        });
    }
    catch (error_err) {
        const error = error_err;
        shared_config_1.logger.error("Get Tutor Network Error:", error);
        return res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Could not fetch tutor network",
                details: error.message,
                requestId: req.id,
            },
        });
    }
}
function buildUpline(node, nodes) {
    const upline = [];
    const seen = new Set([node.userId]);
    let current = node;
    while (current?.sponsorTutorId) {
        if (seen.has(current.sponsorTutorId))
            break;
        const sponsor = nodes.get(current.sponsorTutorId);
        if (!sponsor)
            break;
        upline.push(sponsor);
        seen.add(sponsor.userId);
        current = sponsor;
    }
    return upline;
}
function collectSubtreeIds(node) {
    return [
        node.userId,
        ...node.children.flatMap((child) => collectSubtreeIds(child)),
    ];
}
function countDepths(node, depth = 0, counts = new Map()) {
    for (const child of node.children) {
        counts.set(depth + 1, (counts.get(depth + 1) || 0) + 1);
        countDepths(child, depth + 1, counts);
    }
    return counts;
}
function mapTutorSummary(node) {
    return {
        userId: node.userId,
        displayName: node.displayName || node.email || `Tutor ${node.userId.slice(0, 8)}`,
        email: node.email,
        sponsorLockedAt: node.sponsorLockedAt,
        joinedAt: node.createdAt,
        personalVolumeTHB: toTHB(node.personalVolumeMinor),
        groupVolumeTHB: toTHB(node.groupVolumeMinor),
        currentRate: node.rate,
        estimatedPayoutTHB: toTHB(node.estimatedPayoutMinor),
    };
}
function mapTutorTree(node) {
    return {
        ...mapTutorSummary(node),
        totalDownlines: collectSubtreeIds(node).length - 1,
        children: [...node.children]
            .sort(compareTutorVolumeDesc)
            .map((child) => mapTutorTree(child)),
    };
}
function compareTutorVolumeDesc(a, b) {
    if (a.groupVolumeMinor === b.groupVolumeMinor) {
        return a.displayName?.localeCompare(b.displayName || "") || 0;
    }
    return a.groupVolumeMinor > b.groupVolumeMinor ? -1 : 1;
}
function toTHB(value) {
    return Number(value) / 100;
}
