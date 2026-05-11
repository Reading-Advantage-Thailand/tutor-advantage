import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import {
  calculateCommissionInfo,
  formatIctPeriodMonth,
  getIctMonthWindow,
} from "../services/commissionService";

export async function getEarningsSummary(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User not identified" },
      });
    }

    const periodMonth = formatIctPeriodMonth();
    const { start: monthStart, end: monthEnd } = getIctMonthWindow(periodMonth);

    const classes = await prisma.class.findMany({
      where: { tutorUserId: userId },
      select: { classId: true },
    });
    const classIds = classes.map((c) => c.classId);

    const enrollments = await prisma.enrollment.findMany({
      where: { classId: { in: classIds } },
      select: { enrollmentId: true },
    });
    const enrollmentIds = enrollments.map((e) => e.enrollmentId);

    const successfulPayments = await prisma.paymentIntent.findMany({
      where: {
        status: "SUCCESS",
        updatedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
        enrollmentId: {
          in: enrollmentIds,
        },
      },
    });

    const currentGrossVolumeMinor = successfulPayments.reduce(
      (sum, p) => sum + Number(p.amountMinor),
      0,
    );

    const grossVolumeTHB = currentGrossVolumeMinor / 100;
    const { rate, nextTarget } = calculateCommissionInfo(grossVolumeTHB);
    const estimatedCommissionTHB = grossVolumeTHB * rate;

    return res.status(200).json({
      periodMonth,
      grossVolumeTHB,
      currentRate: rate,
      nextTierTargetTHB: nextTarget,
      estimatedCommissionTHB,
    });
  } catch (error: any) {
    console.error("Get Earnings Summary Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not calculate earnings summary",
        requestId: req.id,
      },
    });
  }
}

export async function getEarningsHistory(
  req: AuthenticatedRequest,
  res: Response,
) {
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

    const periodMonth = formatIctPeriodMonth();
    const { start: monthStart, end: monthEnd } = getIctMonthWindow(periodMonth);

    // 1. Current Month Projection
    const classes = await prisma.class.findMany({
      where: { tutorUserId: userId },
      select: { classId: true },
    });
    const classIds = classes.map((c) => c.classId);

    const enrollments = await prisma.enrollment.findMany({
      where: { classId: { in: classIds } },
      select: { enrollmentId: true },
    });
    const enrollmentIds = enrollments.map((e) => e.enrollmentId);

    const successfulPayments = await prisma.paymentIntent.findMany({
      where: {
        status: "SUCCESS",
        updatedAt: { gte: monthStart, lte: monthEnd },
        enrollmentId: { in: enrollmentIds },
      },
    });

    const currentGrossVolumeMinor = successfulPayments.reduce(
      (sum, p) => sum + Number(p.amountMinor),
      0,
    );
    const grossVolumeTHB = currentGrossVolumeMinor / 100;
    const { rate, nextTarget } = calculateCommissionInfo(grossVolumeTHB);
    const estimatedCommissionTHB = grossVolumeTHB * rate;

    const currentAdjustments = await prisma.adjustment.findMany({
      where: {
        tutorUserId: userId,
        status: "APPROVED",
        amountMinor: { lt: 0 },
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    });

    const currentClawbackTHB = currentAdjustments.reduce(
      (sum, adj) => sum + Number(adj.amountMinor) / 100,
      0,
    );

    const currentProjection = {
      directSales: Math.round(estimatedCommissionTHB),
      networkBonus: 0,
      clawback: Math.round(currentClawbackTHB),
      total: Math.round(estimatedCommissionTHB + currentClawbackTHB),
    };

    // 2. Past History
    const pastLines = await prisma.payoutLine.findMany({
      where: { tutorUserId: userId },
      include: { settlementRun: true, payoutDocument: true },
      orderBy: { settlementRun: { createdAt: "desc" } },
    });

    const approvedAdjustments = await prisma.adjustment.findMany({
      where: { tutorUserId: userId, status: "APPROVED", amountMinor: { lt: 0 } },
      orderBy: { createdAt: "desc" },
    });

    const clawbackByRun = new Map<string, number>();
    for (const adjustment of approvedAdjustments) {
      const current = clawbackByRun.get(adjustment.settlementRunId) || 0;
      clawbackByRun.set(
        adjustment.settlementRunId,
        current + Number(adjustment.amountMinor) / 100,
      );
    }

    const history = pastLines.map((line) => {
      const totalAmount = Number(line.payoutAmountMinor) / 100;
      const clawback = clawbackByRun.get(line.settlementRunId) || 0;
      return {
        date: line.settlementRun.periodMonth,
        direct: Math.round(totalAmount),
        network: 0,
        clawback: Math.round(clawback),
        withholdingTax: Math.round(Number(line.withholdingTaxMinor) / 100),
        netPayout: Math.round(Number(line.netPayoutMinor) / 100),
        payoutDocument: line.payoutDocument
          ? {
              documentNumber: line.payoutDocument.documentNumber,
              documentType: line.payoutDocument.documentType,
              status: line.payoutDocument.status,
              issuedAt: line.payoutDocument.issuedAt,
            }
          : null,
        status: line.settlementRun.status.toLowerCase(),
      };
    });

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
        rate,
        volume: grossVolumeTHB,
        nextTarget,
      },
    });
  } catch (error: any) {
    console.error("Get Earnings History Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch earnings history",
        requestId: req.id,
      },
    });
  }
}
