import { prisma } from "@tutor-advantage/database";
import { Prisma } from "@prisma/client";
import {
  calculateCommissionInfo,
  calculatePayoutMinor,
  getIctMonthWindow,
} from "./commissionService";
import {
  buildPayoutDocumentNumber,
  calculateWithholdingTax,
} from "./taxService";

export interface PayoutNode {
  userId: string;
  sponsorId: string | null;
  personalVolumeMinor: bigint;
  groupVolumeMinor: bigint;
  payoutRate: number;
  payoutAmountMinor: bigint;
  eligibilityStatus: string;
  verified: boolean;
}

export class SettlementService {
  /**
   * Generates a preview for a settlement period.
   * This calculation uses a Bottom-Up approach for a unilevel or differential tree.
   */
  static async previewSettlement(periodMonth: string, createdBy: string) {
    const { start: startOfMonth, end: endOfMonth } =
      getIctMonthWindow(periodMonth);

    // Block if an active (DRAFT or SUBMITTED) run already exists for this period
    const existingActive = await prisma.settlementRun.findFirst({
      where: { periodMonth, status: { in: ["DRAFT", "SUBMITTED"] } },
    });
    if (existingActive) throw new Error("DRAFT_EXISTS");

    const payments = await prisma.paymentIntent.findMany({
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
    const tutorVolumes = new Map<string, bigint>();

    // To properly map to tutors, we need the enrollments for these payments
    // because PaymentIntent maps to the Student, but the money goes to the Tutor of the Class.
    const enrollmentIds = payments.map((p) => p.enrollmentId);

    const enrollments = await prisma.enrollment.findMany({
      where: { enrollmentId: { in: enrollmentIds } },
      include: { class: true },
    });

    const enrollmentTutorMap = new Map<string, string>();
    for (const enr of enrollments) {
      enrollmentTutorMap.set(enr.enrollmentId, enr.class.tutorUserId);
    }

    for (const payment of payments) {
      const tutorId = enrollmentTutorMap.get(payment.enrollmentId);
      if (!tutorId) continue;

      const currentVol = tutorVolumes.get(tutorId) || 0n;
      tutorVolumes.set(tutorId, currentVol + payment.amountMinor);
    }

    const approvedAdjustments = await prisma.adjustment.findMany({
      where: {
        status: "APPROVED",
        settlementRun: {
          periodMonth,
        },
      },
      select: {
        adjustmentId: true,
        tutorUserId: true,
        amountMinor: true,
        reason: true,
      },
    });

    const adjustmentTotals = new Map<string, bigint>();
    for (const adjustment of approvedAdjustments) {
      adjustmentTotals.set(
        adjustment.tutorUserId,
        (adjustmentTotals.get(adjustment.tutorUserId) || 0n) +
          adjustment.amountMinor,
      );
    }

    // 3. Build the organizational tree to calculate Group Volume (GV) and Payouts
    // For a real MLM tree, we need the upline structure.
    // Load all active tutors for tree structure — verification checked per-node below
    const allUsers = await prisma.user.findMany({
      where: { role: "TUTOR", isActive: true },
      select: { userId: true, sponsorTutorId: true, verificationStatus: true },
    });

    const nodes = new Map<string, PayoutNode>();
    for (const u of allUsers) {
      nodes.set(u.userId, {
        userId: u.userId,
        sponsorId: u.sponsorTutorId,
        personalVolumeMinor: tutorVolumes.get(u.userId) || 0n,
        groupVolumeMinor: tutorVolumes.get(u.userId) || 0n, // Initially GV = PV
        payoutRate: 0,
        payoutAmountMinor: 0n,
        eligibilityStatus: "ELIGIBLE_BASE",
        verified: u.verificationStatus === "VERIFIED",
      });
    }

    for (const [tutorUserId] of adjustmentTotals) {
      if (!nodes.has(tutorUserId)) {
        nodes.set(tutorUserId, {
          userId: tutorUserId,
          sponsorId: null,
          personalVolumeMinor: 0n,
          groupVolumeMinor: 0n,
          payoutRate: 0,
          payoutAmountMinor: 0n,
          eligibilityStatus: "ADJUSTMENT_ONLY",
          verified: false, // no user record → treat as unverified
        });
      }
    }

    // 4. Graph traversal for accurate GV and Payout calculation.
    const childMap = new Map<string, string[]>();
    for (const node of nodes.values()) {
      if (node.sponsorId) {
        if (!childMap.has(node.sponsorId)) {
          childMap.set(node.sponsorId, []);
        }
        childMap.get(node.sponsorId)!.push(node.userId);
      }
    }

    // Recursive function to calculate GV bottom-up
    const calculateGV = (userId: string): bigint => {
      const node = nodes.get(userId)!;
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

    const calculatePayouts = (userId: string, visiting = new Set<string>()) => {
      if (visiting.has(userId)) {
        throw new Error("SPONSOR_TREE_CYCLE");
      }
      visiting.add(userId);

      const node = nodes.get(userId)!;
      const myRate = calculateCommissionInfo(
        Number(node.groupVolumeMinor) / 100,
      ).rate;
      node.payoutRate = myRate;

      const children = childMap.get(userId) || [];
      let childPayouts = 0n;

      for (const childId of children) {
        childPayouts += calculatePayouts(childId, new Set(visiting));
      }

      let payoutForMe =
        calculatePayoutMinor(node.groupVolumeMinor, myRate) - childPayouts;

      if (payoutForMe < 0n) payoutForMe = 0n;

      if (node.personalVolumeMinor === 0n && children.length > 0) {
        node.eligibilityStatus = "INELIGIBLE_NO_PV";
        payoutForMe = 0n;
      } else if (payoutForMe > 0n) {
        node.eligibilityStatus = "ELIGIBLE";
      }

      node.payoutAmountMinor = payoutForMe;
      return payoutForMe;
    };

    // Find roots again and start the top-down payout calculation
    for (const node of nodes.values()) {
      if (!node.sponsorId) {
        calculatePayouts(node.userId);
      }
    }

    // Override: unverified tutors cannot receive payout regardless of calculated amount
    for (const node of nodes.values()) {
      if (!node.verified) {
        node.payoutAmountMinor = 0n;
        node.eligibilityStatus = "INELIGIBLE_NOT_VERIFIED";
      }
    }

    // 6. Persist Draft Settlement Run
    const run = await prisma.settlementRun.create({
      data: {
        periodMonth,
        status: "DRAFT",
        createdBy,
        previewPayload: {
          paymentCount: payments.length,
          approvedAdjustmentCount: approvedAdjustments.length,
          approvedAdjustmentTotalSatang: approvedAdjustments
            .reduce((sum, adjustment) => sum + adjustment.amountMinor, 0n)
            .toString(),
        },
      },
    });

    // Fetch badge bonuses for all tutors in this settlement
    // Badge bonus amounts in Satang — must match BadgeService.BADGE_BONUS_SATANG
    const BADGE_BONUS_SATANG: Record<string, bigint> = {
      ELITE_EDUCATOR:  50000n,
      TOP_RATED:       30000n,
      CLASS_MASTER:    20000n,
      NETWORK_BUILDER: 10000n,
      RISING_STAR:      5000n,
      FAST_RESPONDER:   5000n,
      AI_PIONEER:       5000n,
    };

    const tutorIds = Array.from(nodes.keys());
    const allBadges = await prisma.tutorBadge.findMany({
      where: { tutorUserId: { in: tutorIds } },
      select: { tutorUserId: true, badgeCode: true },
    });

    const badgeBonusMap = new Map<string, bigint>();
    for (const badge of allBadges) {
      const bonus = BADGE_BONUS_SATANG[badge.badgeCode] ?? 0n;
      badgeBonusMap.set(
        badge.tutorUserId,
        (badgeBonusMap.get(badge.tutorUserId) ?? 0n) + bonus,
      );
    }

    // Bulk insert payout lines
    for (const node of nodes.values()) {
      // Unverified tutors are blocked from ALL payouts — commission was already zeroed above.
      // Also block badge bonuses and adjustments so unverified tutors receive nothing.
      const effectiveAdjustment = node.verified
        ? (adjustmentTotals.get(node.userId) || 0n)
        : 0n;
      const effectiveBadgeBonus = node.verified
        ? (badgeBonusMap.get(node.userId) ?? 0n)
        : 0n;

      const adjustedPayoutMinor =
        node.payoutAmountMinor + effectiveAdjustment + effectiveBadgeBonus;

      // Include in payout lines if: has volume, has actual payout,
      // or had a BLOCKED adjustment (for audit visibility — shows adjustment was withheld)
      const blockedAdjustment = !node.verified
        ? (adjustmentTotals.get(node.userId) || 0n)
        : 0n;
      const hasActivity =
        adjustedPayoutMinor !== 0n ||
        node.groupVolumeMinor > 0n ||
        blockedAdjustment !== 0n;

      if (!hasActivity) continue;

      const tax =
        adjustedPayoutMinor > 0n
          ? calculateWithholdingTax(adjustedPayoutMinor)
          : { withholdingTaxMinor: 0n, netPayoutMinor: 0n };

      totalPayoutSatang += adjustedPayoutMinor;

      // Only mark as _ADJUSTED if the tutor is verified and actually received extras
      const eligibilityStatus =
        node.verified && (effectiveAdjustment !== 0n || effectiveBadgeBonus !== 0n)
          ? `${node.eligibilityStatus}_ADJUSTED`
          : node.eligibilityStatus;

      await prisma.payoutLine.create({
        data: {
          settlementRunId: run.settlementRunId,
          tutorUserId: node.userId,
          grossVolumeMinor: node.groupVolumeMinor,
          payoutRate: new Prisma.Decimal(node.payoutRate),
          payoutAmountMinor: adjustedPayoutMinor,
          withholdingTaxMinor: tax.withholdingTaxMinor,
          netPayoutMinor: tax.netPayoutMinor,
          badgeBonusMinor: effectiveBadgeBonus,
          eligibilityStatus,
        },
      });
    }

    return {
      snapshotId: run.settlementRunId,
      periodMonth,
      totalPayoutSatang: Number(totalPayoutSatang),
      status: run.status,
    };
  }

  /**
   * Approves a SUBMITTED settlement run (Finance Checker only).
   */
  static async approveSettlement(snapshotId: string, approvedBy: string) {
    const run = await prisma.settlementRun.findUnique({
      where: { settlementRunId: snapshotId },
    });

    if (!run) throw new Error("NOT_FOUND");
    if (run.status !== "SUBMITTED") throw new Error("INVALID_STATUS");

    const updated = await prisma.$transaction(async (tx) => {
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
            documentNumber: buildPayoutDocumentNumber(line.payoutLineId),
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
