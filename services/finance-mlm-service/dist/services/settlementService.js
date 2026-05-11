"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementService = void 0;
const database_1 = require("@tutor-advantage/database");
const client_1 = require("@prisma/client");
const commissionService_1 = require("./commissionService");
const taxService_1 = require("./taxService");
class SettlementService {
    /**
     * Generates a preview for a settlement period.
     * This calculation uses a Bottom-Up approach for a unilevel or differential tree.
     */
    static async previewSettlement(periodMonth, createdBy) {
        const { start: startOfMonth, end: endOfMonth } = (0, commissionService_1.getIctMonthWindow)(periodMonth);
        const payments = await database_1.prisma.paymentIntent.findMany({
            where: {
                status: "SUCCESS",
                updatedAt: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                },
            },
            include: {
                events: true, // Used for more granular audit if needed
            },
        });
        // 2. Aggregate Personal Volume (PV) by student's class's tutor
        const tutorVolumes = new Map();
        // To properly map to tutors, we need the enrollments for these payments
        // because PaymentIntent maps to the Student, but the money goes to the Tutor of the Class.
        const enrollmentIds = payments.map((p) => p.enrollmentId);
        const enrollments = await database_1.prisma.enrollment.findMany({
            where: { enrollmentId: { in: enrollmentIds } },
            include: { class: true },
        });
        const enrollmentTutorMap = new Map();
        for (const enr of enrollments) {
            enrollmentTutorMap.set(enr.enrollmentId, enr.class.tutorUserId);
        }
        for (const payment of payments) {
            const tutorId = enrollmentTutorMap.get(payment.enrollmentId);
            if (!tutorId)
                continue; // Safety check
            const currentVol = tutorVolumes.get(tutorId) || 0n;
            tutorVolumes.set(tutorId, currentVol + payment.amountMinor);
        }
        // 3. Build the organizational tree to calculate Group Volume (GV) and Payouts
        // For a real MLM tree, we need the upline structure.
        const allUsers = await database_1.prisma.user.findMany({
            where: { role: "TUTOR", isActive: true },
            select: { userId: true, sponsorTutorId: true },
        });
        const nodes = new Map();
        for (const u of allUsers) {
            nodes.set(u.userId, {
                userId: u.userId,
                sponsorId: u.sponsorTutorId,
                personalVolumeMinor: tutorVolumes.get(u.userId) || 0n,
                groupVolumeMinor: tutorVolumes.get(u.userId) || 0n, // Initially GV = PV
                payoutRate: 0,
                payoutAmountMinor: 0n,
                eligibilityStatus: "ELIGIBLE_BASE",
            });
        }
        // 4. Graph traversal for accurate GV and Payout calculation.
        const childMap = new Map();
        for (const node of nodes.values()) {
            if (node.sponsorId) {
                if (!childMap.has(node.sponsorId)) {
                    childMap.set(node.sponsorId, []);
                }
                childMap.get(node.sponsorId).push(node.userId);
            }
        }
        // Recursive function to calculate GV bottom-up
        const calculateGV = (userId) => {
            const node = nodes.get(userId);
            let totalGV = node.personalVolumeMinor;
            const children = childMap.get(userId) || [];
            for (const childId of children) {
                totalGV += calculateGV(childId);
            }
            node.groupVolumeMinor = totalGV;
            return totalGV;
        };
        // Find roots (users without sponsors) and calculate their trees
        for (const node of nodes.values()) {
            if (!node.sponsorId) {
                calculateGV(node.userId);
            }
        }
        let totalPayoutSatang = 0n;
        const calculatePayouts = (userId, visiting = new Set()) => {
            if (visiting.has(userId)) {
                throw new Error("SPONSOR_TREE_CYCLE");
            }
            visiting.add(userId);
            const node = nodes.get(userId);
            const myRate = (0, commissionService_1.calculateCommissionInfo)(Number(node.groupVolumeMinor) / 100).rate;
            node.payoutRate = myRate;
            const children = childMap.get(userId) || [];
            let childPayouts = 0n;
            for (const childId of children) {
                childPayouts += calculatePayouts(childId, new Set(visiting));
            }
            let payoutForMe = (0, commissionService_1.calculatePayoutMinor)(node.groupVolumeMinor, myRate) - childPayouts;
            if (payoutForMe < 0n)
                payoutForMe = 0n;
            if (node.personalVolumeMinor === 0n && children.length > 0) {
                node.eligibilityStatus = "INELIGIBLE_NO_PV";
                payoutForMe = 0n;
            }
            else if (payoutForMe > 0n) {
                node.eligibilityStatus = "ELIGIBLE";
            }
            node.payoutAmountMinor = payoutForMe;
            totalPayoutSatang += payoutForMe;
            return payoutForMe;
        };
        // Find roots again and start the top-down payout calculation
        for (const node of nodes.values()) {
            if (!node.sponsorId) {
                calculatePayouts(node.userId);
            }
        }
        // 6. Persist Draft Settlement Run
        const run = await database_1.prisma.settlementRun.create({
            data: {
                periodMonth,
                status: "DRAFT",
                createdBy,
                previewPayload: {}, // Store stringified generic info if needed
            },
        });
        // Bulk insert payout lines
        for (const node of nodes.values()) {
            if (node.payoutAmountMinor > 0n || node.groupVolumeMinor > 0n) {
                const tax = (0, taxService_1.calculateWithholdingTax)(node.payoutAmountMinor);
                await database_1.prisma.payoutLine.create({
                    data: {
                        settlementRunId: run.settlementRunId,
                        tutorUserId: node.userId,
                        grossVolumeMinor: node.groupVolumeMinor,
                        payoutRate: new client_1.Prisma.Decimal(node.payoutRate),
                        payoutAmountMinor: node.payoutAmountMinor,
                        withholdingTaxMinor: tax.withholdingTaxMinor,
                        netPayoutMinor: tax.netPayoutMinor,
                        eligibilityStatus: node.eligibilityStatus,
                    },
                });
            }
        }
        return {
            snapshotId: run.settlementRunId,
            periodMonth,
            totalPayoutSatang: Number(totalPayoutSatang),
            status: run.status,
        };
    }
    /**
     * Approves a DRAFT settlement run
     */
    static async approveSettlement(snapshotId, approvedBy) {
        const run = await database_1.prisma.settlementRun.findUnique({
            where: { settlementRunId: snapshotId },
        });
        if (!run)
            throw new Error("NOT_FOUND");
        if (run.status !== "DRAFT")
            throw new Error("INVALID_STATUS");
        if (run.createdBy === approvedBy)
            throw new Error("MAKER_CHECKER_VIOLATION");
        const updated = await database_1.prisma.$transaction(async (tx) => {
            const approvedRun = await tx.settlementRun.update({
                where: { settlementRunId: snapshotId },
                data: {
                    status: "APPROVED",
                    approvedBy,
                    approvedAt: new Date(),
                },
                include: { payoutLines: true },
            });
            for (const line of approvedRun.payoutLines) {
                await tx.payoutDocument.upsert({
                    where: { payoutLineId: line.payoutLineId },
                    update: {},
                    create: {
                        payoutLineId: line.payoutLineId,
                        tutorUserId: line.tutorUserId,
                        documentNumber: (0, taxService_1.buildPayoutDocumentNumber)(line.payoutLineId),
                        documentType: "PAY_SLIP_50_TAWI",
                        grossAmountMinor: line.payoutAmountMinor,
                        withholdingTaxMinor: line.withholdingTaxMinor,
                        netAmountMinor: line.netPayoutMinor,
                    },
                });
            }
            return approvedRun;
        });
        return updated;
    }
}
exports.SettlementService = SettlementService;
