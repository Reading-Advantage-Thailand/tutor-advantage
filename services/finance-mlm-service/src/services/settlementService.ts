import { prisma } from "@tutor-advantage/database";
import { Prisma } from "@prisma/client";

export interface PayoutNode {
  userId: string;
  sponsorId: string | null;
  personalVolumeMinor: bigint;
  groupVolumeMinor: bigint;
  payoutRate: number;
  payoutAmountMinor: bigint;
  eligibilityStatus: string;
}

export class SettlementService {
  /**
   * Generates a preview for a settlement period.
   * This calculation uses a Bottom-Up approach for a unilevel or differential tree.
   */
  static async previewSettlement(periodMonth: string, createdBy: string) {
    // 1. Fetch all SUCCESSful PaymentIntents for the period
    const startOfMonth = new Date(`${periodMonth}-01T00:00:00Z`);

    // Calculate end of month
    const year = parseInt(periodMonth.split("-")[0], 10);
    const month = parseInt(periodMonth.split("-")[1], 10);
    const endOfMonth = new Date(Date.UTC(year, month, 1));
    endOfMonth.setMilliseconds(-1);

    const payments = await prisma.paymentIntent.findMany({
      where: {
        status: "SUCCESS",
        createdAt: {
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
      if (!tutorId) continue; // Safety check

      const currentVol = tutorVolumes.get(tutorId) || 0n;
      tutorVolumes.set(tutorId, currentVol + payment.amountMinor);
    }

    // 3. Build the organizational tree to calculate Group Volume (GV) and Payouts
    // For a real MLM tree, we need the upline structure.
    const allUsers = await prisma.user.findMany({
      where: { role: "TUTOR", isActive: true },
      select: { userId: true, sponsorTutorId: true },
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
      });
    }

    // 4. Calculate Group Volume (Bottom-up)
    // We need a topological sort from leaves to root.
    // simpler method: keep iterating until no GV changes occur.
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of nodes.values()) {
        const sponsorId = node.sponsorId;
        if (sponsorId && nodes.has(sponsorId)) {
          const sponsorNode = nodes.get(sponsorId)!;
          // In a real multi-level system, this accumulation logic can be complex
          // to prevent double-counting. We use a graph traversal to sum properly.
        }
      }
    }

    // Graph traversal for accurate GV and Payout calculation
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

    // 5. Differential Payout Calculation
    // Payout logic:
    // e.g. Tier 1 (GV 0 - 50k THB) = 10%
    // Tier 2 (GV 50k - 150k THB) = 15%
    // Tier 3 (GV > 150k THB) = 20%
    const getRate = (gvSatang: bigint): number => {
      const gvTHB = Number(gvSatang) / 100;
      if (gvTHB >= 150000) return 0.2;
      if (gvTHB >= 50000) return 0.15;
      return 0.1; // Base 10% for everyone handling payments
    };

    let totalPayoutSatang = 0n;

    // Traverse top-down to apply differential logic
    // Root total volume * root rate
    // minus (Child total volume * child rate)
    const calculatePayouts = (userId: string, currentRate: number) => {
      const node = nodes.get(userId)!;
      const myRate = getRate(node.groupVolumeMinor);
      node.payoutRate = myRate;

      // Ensure rate is always at least the minimum allowed (or equal to child's rate to prevent negative)
      // Note: In real MLMs, if downline matches your rank, payout is 0 (breakaway).
      const effectiveRateToUseForMe = Math.max(0, myRate);

      const children = childMap.get(userId) || [];
      let payoutForMe =
        (node.groupVolumeMinor *
          BigInt(Math.floor(effectiveRateToUseForMe * 100))) /
        100n;

      for (const childId of children) {
        const childNode = nodes.get(childId)!;
        const childRate = getRate(childNode.groupVolumeMinor);
        // Subtract the chunk the child gets from my theoretical total payout
        const childsChunk =
          (childNode.groupVolumeMinor * BigInt(Math.floor(childRate * 100))) /
          100n;
        payoutForMe -= childsChunk;

        // Recurse for the child
        calculatePayouts(childId, childRate);
      }

      // Safety guard against negative payouts in complex trees
      if (payoutForMe < 0n) payoutForMe = 0n;

      // Optional Rule: Must have Personal Volume to be eligible for tree bonuses
      if (node.personalVolumeMinor === 0n && children.length > 0) {
        node.eligibilityStatus = "INELIGIBLE_NO_PV";
        payoutForMe = 0n; // Flush their earnings up? Depends on plan. Setting to 0 here.
      } else if (payoutForMe > 0n) {
        node.eligibilityStatus = "ELIGIBLE";
      }

      node.payoutAmountMinor = payoutForMe;
      totalPayoutSatang += payoutForMe;
    };

    // Find roots again and start the top-down payout calculation
    for (const node of nodes.values()) {
      if (!node.sponsorId) {
        calculatePayouts(node.userId, 0);
      }
    }

    // 6. Persist Draft Settlement Run
    const run = await prisma.settlementRun.create({
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
        await prisma.payoutLine.create({
          data: {
            settlementRunId: run.settlementRunId,
            tutorUserId: node.userId,
            grossVolumeMinor: node.groupVolumeMinor,
            payoutRate: new Prisma.Decimal(node.payoutRate),
            payoutAmountMinor: node.payoutAmountMinor,
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
  static async approveSettlement(snapshotId: string, approvedBy: string) {
    const run = await prisma.settlementRun.findUnique({
      where: { settlementRunId: snapshotId },
    });

    if (!run) throw new Error("NOT_FOUND");
    if (run.status !== "DRAFT") throw new Error("INVALID_STATUS");

    const updated = await prisma.settlementRun.update({
      where: { settlementRunId: snapshotId },
      data: {
        status: "APPROVED",
        approvedBy,
        approvedAt: new Date(),
      },
    });

    return updated;
  }
}
