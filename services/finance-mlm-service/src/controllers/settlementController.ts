import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { SettlementService } from "../services/settlementService";
import { prisma } from "@tutor-advantage/database";

/**
 * Computes the previous calendar month in ICT (UTC+7) as "YYYY-MM".
 * e.g. called in June 2026 → returns "2026-05"
 */
function getPreviousIctMonth(): string {
  const nowUtc = new Date();
  // Shift to ICT (UTC+7)
  const nowIct = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
  // Go to first moment of this ICT month, then subtract 1ms → previous month
  const firstOfThisMonth = new Date(
    Date.UTC(nowIct.getUTCFullYear(), nowIct.getUTCMonth(), 1),
  );
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
export async function autoRunSettlement(req: Request, res: Response) {
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
    const existing = await prisma.settlementRun.findFirst({
      where: { periodMonth },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      console.log(
        `[AutoSettlement] Run for ${periodMonth} already exists (${existing.settlementRunId}). Skipping.`,
      );
      return res.status(200).json({
        message: "Settlement run already exists for this period — skipped",
        periodMonth,
        settlementRunId: existing.settlementRunId,
        skipped: true,
      });
    }

    const preview = await SettlementService.previewSettlement(
      periodMonth,
      "SYSTEM_SCHEDULER",
    );

    console.log(
      `[AutoSettlement] Created settlement preview for ${periodMonth}: ${preview.snapshotId}`,
    );

    return res.status(201).json({
      message: "Settlement preview created successfully",
      periodMonth,
      settlementRunId: preview.snapshotId,
      skipped: false,
    });
  } catch (error: any) {
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

export async function previewSettlement(
  req: AuthenticatedRequest,
  res: Response,
) {
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

    // Only allow manual preview on the 1st of the month (ICT) — dev bypass
    if (process.env.NODE_ENV === "production") {
      const nowUtc = new Date();
      const nowIct = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
      if (nowIct.getUTCDate() !== 1) {
        return res.status(403).json({
          error: {
            code: "NOT_SETTLEMENT_DAY",
            message: "สร้างรายการได้เฉพาะวันที่ 1 ของเดือนเท่านั้น",
            requestId: req.id,
          },
        });
      }
    }

    const preview = await SettlementService.previewSettlement(
      periodMonth,
      userId,
    );

    return res.status(200).json({
      message: "Settlement preview generated",
      preview,
    });
  } catch (error: any) {
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
 * POST /v1/settlements/:snapshotId/submit
 * Admin submits a DRAFT for Finance Checker review → SUBMITTED
 */
export async function submitSettlement(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const { snapshotId } = req.params;

    if (!userId || req.user?.role !== "ADMIN") {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only admins can submit settlements for review",
          requestId: req.id,
        },
      });
    }

    const run = await prisma.settlementRun.findUnique({
      where: { settlementRunId: snapshotId },
    });
    if (!run) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Settlement run not found", requestId: req.id },
      });
    }
    if (run.status !== "DRAFT") {
      return res.status(400).json({
        error: {
          code: "INVALID_STATUS",
          message: "Settlement must be DRAFT to submit",
          requestId: req.id,
        },
      });
    }

    await prisma.settlementRun.update({
      where: { settlementRunId: snapshotId },
      data: { status: "SUBMITTED" },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: userId,
        action: "SUBMIT",
        entityType: "SettlementRun",
        entityId: snapshotId,
        payload: { periodMonth: run.periodMonth },
      },
    });

    return res.status(200).json({ message: "Settlement submitted for review" });
  } catch (error: any) {
    console.error("Submit Settlement Error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Could not submit settlement", requestId: req.id },
    });
  }
}

/**
 * POST /v1/settlements/:snapshotId/reject
 */
export async function rejectSettlement(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const { snapshotId } = req.params;

    const role = req.user?.role;
    if (!userId || (role !== "FINANCE_CHECKER" && role !== "ADMIN")) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only ADMIN or FINANCE_CHECKER can reject settlements",
          requestId: req.id,
        },
      });
    }

    const run = await prisma.settlementRun.findUnique({
      where: { settlementRunId: snapshotId },
    });
    if (!run) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Settlement run not found", requestId: req.id },
      });
    }

    // ADMIN can cancel their own DRAFT; FINANCE_CHECKER rejects SUBMITTED
    const allowedStatus = role === "ADMIN" ? "DRAFT" : "SUBMITTED";
    if (run.status !== allowedStatus) {
      return res.status(400).json({
        error: {
          code: "INVALID_STATUS",
          message: `Settlement must be ${allowedStatus} to reject`,
          requestId: req.id,
        },
      });
    }

    await prisma.settlementRun.update({
      where: { settlementRunId: snapshotId },
      data: { status: "REJECTED" },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: userId,
        action: "REJECT",
        entityType: "SettlementRun",
        entityId: snapshotId,
        payload: { periodMonth: run.periodMonth },
      },
    });

    return res.status(200).json({ message: "Settlement rejected" });
  } catch (error: any) {
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
export async function exportSettlementCsv(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const { snapshotId } = req.params;
    const userId = req.user?.userId;

    const run = await prisma.settlementRun.findUnique({
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
    const approvedAdjustments = await prisma.adjustment.findMany({
      where: { settlementRunId: snapshotId, status: "APPROVED" },
      select: { tutorUserId: true, amountMinor: true },
    });
    const adjustmentMap = new Map<string, bigint>();
    for (const adjustment of approvedAdjustments) {
      adjustmentMap.set(
        adjustment.tutorUserId,
        (adjustmentMap.get(adjustment.tutorUserId) ?? 0n) +
          adjustment.amountMinor,
      );
    }

    const header =
      "tutor_user_id,gross_volume_thb,payout_rate,base_payout_thb,adjustment_thb,badge_bonus_thb,gross_payout_thb,wht_3pct_thb,net_payout_thb,eligibility_status";
    const rows = run.payoutLines.map((line) => {
      const grossTHB = (Number(line.grossVolumeMinor) / 100).toFixed(2);
      const adjustmentMinor = adjustmentMap.get(line.tutorUserId) ?? 0n;
      const basePayoutMinor =
        line.payoutAmountMinor - line.badgeBonusMinor - adjustmentMinor;
      const basePayoutTHB = (Number(basePayoutMinor) / 100).toFixed(2);
      const adjustmentTHB = (Number(adjustmentMinor) / 100).toFixed(2);
      const payoutTHB = (Number(line.payoutAmountMinor) / 100).toFixed(2);
      const badgeTHB = (Number(line.badgeBonusMinor) / 100).toFixed(2);
      const whtTHB = (Number(line.withholdingTaxMinor) / 100).toFixed(2);
      const netTHB = (Number(line.netPayoutMinor) / 100).toFixed(2);
      return `${line.tutorUserId},${grossTHB},${line.payoutRate},${basePayoutTHB},${adjustmentTHB},${badgeTHB},${payoutTHB},${whtTHB},${netTHB},${line.eligibilityStatus}`;
    });
    const csv = [header, ...rows].join("\n");

    // บันทึก AuditEvent
    if (userId) {
      await prisma.auditEvent.create({
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
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="settlement-${run.periodMonth}-${snapshotId.slice(0, 8)}.csv"`,
    );
    return res.status(200).send(csv);
  } catch (error: any) {
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
 * GET /v1/settlements/:snapshotId/lines — return payout lines as JSON for in-browser viewing
 * No audit trail created (view-only, not an export action)
 */
export async function getSettlementLines(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const { snapshotId } = req.params;
    const { role } = req.user ?? {};

    if (role !== "ADMIN" && role !== "FINANCE_CHECKER") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Access denied" } });
    }

    const run = await prisma.settlementRun.findUnique({
      where: { settlementRunId: snapshotId },
      include: {
        payoutLines: {
          include: {
            payoutDocument: { select: { documentNumber: true, status: true } },
          },
          orderBy: { netPayoutMinor: "desc" },
        },
      },
    });

    if (!run) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Settlement run not found" } });
    }

    // Batch-fetch tutor user info
    const tutorIds = [...new Set(run.payoutLines.map((l) => l.tutorUserId))];
    const tutors = await prisma.user.findMany({
      where: { userId: { in: tutorIds } },
      select: { userId: true, displayName: true, email: true, settings: true },
    });
    const tutorMap = new Map(tutors.map((t) => [t.userId, t]));
    const payoutLineIds = run.payoutLines.map((l) => l.payoutLineId);
    const transferRows =
      payoutLineIds.length > 0
        ? await prisma.$queryRaw<
            Array<{
              payout_line_id: string;
              provider: string | null;
              provider_transfer_id: string | null;
              transfer_status: string;
              transfer_failure_code: string | null;
              transfer_failure_message: string | null;
              transferred_at: Date | null;
            }>
          >`
            SELECT
              "payout_line_id",
              "provider",
              "provider_transfer_id",
              "transfer_status",
              "transfer_failure_code",
              "transfer_failure_message",
              "transferred_at"
            FROM "finance_mlm"."payout_documents"
            WHERE "payout_line_id" = ANY(${payoutLineIds}::uuid[])
          `
        : [];
    const transferMap = new Map(
      transferRows.map((row) => [row.payout_line_id, row]),
    );
    const approvedAdjustments = await prisma.adjustment.findMany({
      where: {
        settlementRunId: snapshotId,
        status: "APPROVED",
        tutorUserId: { in: tutorIds },
      },
      select: {
        tutorUserId: true,
        amountMinor: true,
      },
    });
    const adjustmentMap = new Map<string, bigint>();
    for (const adjustment of approvedAdjustments) {
      adjustmentMap.set(
        adjustment.tutorUserId,
        (adjustmentMap.get(adjustment.tutorUserId) ?? 0n) +
          adjustment.amountMinor,
      );
    }

    const lines = run.payoutLines.map((l) => {
      const tutor = tutorMap.get(l.tutorUserId);
      const transfer = transferMap.get(l.payoutLineId);
      const adjustmentMinor = adjustmentMap.get(l.tutorUserId) ?? 0n;
      const basePayoutMinor =
        l.payoutAmountMinor - l.badgeBonusMinor - adjustmentMinor;
      const hasOmiseRecipientId =
        tutor?.settings &&
        typeof tutor.settings === "object" &&
        !Array.isArray(tutor.settings) &&
        typeof (tutor.settings as { omiseRecipientId?: unknown }).omiseRecipientId ===
          "string" &&
        Boolean((tutor.settings as { omiseRecipientId?: string }).omiseRecipientId?.trim());
      return {
        payoutLineId: l.payoutLineId,
        tutorUserId: l.tutorUserId,
        tutorName: tutor?.displayName ?? null,
        tutorEmail: tutor?.email ?? null,
        grossVolumeTHB: Number(l.grossVolumeMinor) / 100,
        payoutRate: Number(l.payoutRate),
        basePayoutTHB: Number(basePayoutMinor) / 100,
        adjustmentTHB: Number(adjustmentMinor) / 100,
        grossPayoutTHB: Number(l.payoutAmountMinor) / 100,
        badgeBonusTHB: Number(l.badgeBonusMinor) / 100,
        whtTHB: Number(l.withholdingTaxMinor) / 100,
        netPayoutTHB: Number(l.netPayoutMinor) / 100,
        eligibilityStatus: l.eligibilityStatus,
        documentNumber: l.payoutDocument?.documentNumber ?? null,
        documentStatus: l.payoutDocument?.status ?? null,
        transferProvider: transfer?.provider ?? null,
        transferId: transfer?.provider_transfer_id ?? null,
        transferStatus: transfer?.transfer_status ?? null,
        transferFailureCode: transfer?.transfer_failure_code ?? null,
        transferFailureMessage: transfer?.transfer_failure_message ?? null,
        transferredAt: transfer?.transferred_at?.toISOString() ?? null,
        canSendTransfer:
          run.status === "APPROVED" &&
          l.netPayoutMinor > 0n &&
          hasOmiseRecipientId &&
          !["PENDING_TRANSFER", "CREATED", "SENT_PENDING", "SENT", "PAID"].includes(
            transfer?.transfer_status ?? "NOT_SENT",
          ),
        transferBlockedReason: !hasOmiseRecipientId
          ? "ยังไม่มี Omise recipient"
          : null,
      };
    });

    return res.status(200).json({
      snapshotId,
      periodMonth: run.periodMonth,
      status: run.status,
      totalNetPayoutTHB: lines.reduce((s, l) => s + l.netPayoutTHB, 0),
      lines,
    });
  } catch (error: any) {
    console.error("getSettlementLines error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Could not fetch lines" },
    });
  }
}

/**
 * GET /v1/settlements/summary
 * สำหรับ Dashboard StatCards
 */
export async function getSettlementSummary(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalLast30, pendingCount, pendingAdjCount] = await Promise.all([
      prisma.settlementRun.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      // Count SUBMITTED — those awaiting Finance Checker approval
      prisma.settlementRun.count({
        where: { status: "SUBMITTED" },
      }),
      prisma.adjustment.count({
        where: { status: "PENDING" },
      }),
    ]);

    return res.status(200).json({
      totalSettlementsLast30Days: totalLast30,
      pendingApprovals: pendingCount,
      pendingAdjustments: pendingAdjCount,
    });
  } catch (error: any) {
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

export async function approveSettlement(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const { snapshotId } = req.params;
    const role = req.user?.role;

    // Dev mode lets an ADMIN approve directly (and skip the SUBMITTED step) to ease
    // local testing. Production keeps the strict Maker-Checker rule: only FINANCE_CHECKER
    // approves, and only a SUBMITTED run.
    const isDevMode = process.env.NODE_ENV !== "production";
    const canApprove =
      role === "FINANCE_CHECKER" || (isDevMode && role === "ADMIN");

    if (!userId || !canApprove) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Finance Checkers can approve settlements",
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

    // Pre-flight: verify run exists and is SUBMITTED before checking adjustments
    const run = await prisma.settlementRun.findUnique({
      where: { settlementRunId: snapshotId },
      select: { periodMonth: true, status: true },
    });
    if (!run) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Settlement run not found", requestId: req.id },
      });
    }
    const approvableStatuses = isDevMode ? ["DRAFT", "SUBMITTED"] : ["SUBMITTED"];
    if (!approvableStatuses.includes(run.status)) {
      return res.status(400).json({
        error: {
          code: "INVALID_STATUS",
          message: "Settlement run must be in SUBMITTED status to approve",
          requestId: req.id,
        },
      });
    }

    // Block approval if there are pending adjustments for the same period
    const pendingAdjCount = await prisma.adjustment.count({
      where: {
        status: "PENDING",
        settlementRun: { periodMonth: run.periodMonth },
      },
    });
    if (pendingAdjCount > 0) {
      return res.status(409).json({
        error: {
          code: "PENDING_ADJUSTMENTS_EXIST",
          message: `ไม่สามารถอนุมัติได้ — มีการปรับยอด ${pendingAdjCount} รายการที่ยังรออนุมัติสำหรับรอบนี้ กรุณา approve หรือ reject ก่อน`,
          pendingCount: pendingAdjCount,
          requestId: req.id,
        },
      });
    }

    const approvedRun = await SettlementService.approveSettlement(
      snapshotId,
      userId,
      { allowDirectFromDraft: isDevMode },
    );

    return res.status(200).json({
      message: "Settlement run approved",
      run: serializeSettlementRun(approvedRun),
    });
  } catch (error: any) {
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
          message: "Settlement run must be in SUBMITTED status to approve",
          requestId: req.id,
        },
      });
    }

    if (error.message === "OMISE_PAYOUTS_NOT_CONFIGURED") {
      return res.status(502).json({
        error: {
          code: "OMISE_PAYOUTS_NOT_CONFIGURED",
          message:
            "Omise payouts are enabled but Omise keys are not configured",
          requestId: req.id,
        },
      });
    }

    if (error.message?.startsWith("MISSING_OMISE_RECIPIENT:")) {
      return res.status(409).json({
        error: {
          code: "MISSING_OMISE_RECIPIENT",
          message:
            "Some tutors do not have settings.omiseRecipientId configured",
          tutorUserIds: error.message.replace("MISSING_OMISE_RECIPIENT:", "").split(","),
          requestId: req.id,
        },
      });
    }

    if (error.message?.startsWith("OMISE_TRANSFER_FAILED:")) {
      return res.status(502).json({
        error: {
          code: "OMISE_TRANSFER_FAILED",
          message: "Omise transfer failed after settlement approval",
          details: error.message,
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

export async function retryPayoutTransfer(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const { snapshotId, payoutLineId } = req.params;

    if (req.user?.role !== "FINANCE_CHECKER") {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only Finance Checkers can send payout transfers",
          requestId: req.id,
        },
      });
    }

    if (!payoutLineId) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "payoutLineId is required in the path",
          requestId: req.id,
        },
      });
    }

    const transfer = await SettlementService.retryPayoutTransfer(
      payoutLineId,
      snapshotId,
    );

    return res.status(200).json({
      message: "Payout transfer sent",
      transfer,
    });
  } catch (error: any) {
    const errorMap: Record<string, { status: number; message: string }> = {
      PAYOUT_LINE_NOT_FOUND: {
        status: 404,
        message: "Payout line not found",
      },
      PAYOUT_LINE_NOT_IN_SETTLEMENT: {
        status: 404,
        message: "Payout line does not belong to this settlement",
      },
      SETTLEMENT_NOT_APPROVED: {
        status: 400,
        message: "Settlement must be approved before sending a transfer",
      },
      NO_TRANSFER_REQUIRED: {
        status: 400,
        message: "This payout line has no positive net payout to transfer",
      },
      PAYOUT_DOCUMENT_NOT_FOUND: {
        status: 409,
        message: "Payout document must exist before sending a transfer",
      },
      TRANSFER_ALREADY_ACTIVE: {
        status: 409,
        message:
          "This payout already has an active or successful transfer. Refusing to send a duplicate transfer.",
      },
      OMISE_PAYOUTS_NOT_CONFIGURED: {
        status: 502,
        message: "Omise keys are not configured",
      },
    };

    if (error.message?.startsWith("MISSING_OMISE_RECIPIENT:")) {
      return res.status(409).json({
        error: {
          code: "MISSING_OMISE_RECIPIENT",
          message: "Tutor does not have settings.omiseRecipientId configured",
          tutorUserId: error.message.replace("MISSING_OMISE_RECIPIENT:", ""),
          requestId: req.id,
        },
      });
    }

    if (error.message?.startsWith("OMISE_TRANSFER_FAILED:")) {
      return res.status(502).json({
        error: {
          code: "OMISE_TRANSFER_FAILED",
          message: "Omise transfer failed",
          details: error.message,
          requestId: req.id,
        },
      });
    }

    const mapped = errorMap[error.message];
    if (mapped) {
      return res.status(mapped.status).json({
        error: {
          code: error.message,
          message: mapped.message,
          requestId: req.id,
        },
      });
    }

    console.error("Retry Payout Transfer Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not send payout transfer",
        requestId: req.id,
      },
    });
  }
}

function serializeSettlementRun(run: {
  settlementRunId: string;
  periodMonth: string;
  timezone: string;
  status: string;
  previewPayload: unknown;
  createdBy: string | null;
  createdAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
  payoutLines?: Array<{
    payoutLineId: string;
    settlementRunId: string;
    tutorUserId: string;
    grossVolumeMinor: bigint;
    payoutRate: unknown;
    payoutAmountMinor: bigint;
    withholdingTaxMinor: bigint;
    netPayoutMinor: bigint;
    badgeBonusMinor: bigint;
    eligibilityStatus: string;
    createdAt: Date;
    payoutDocument?: {
      payoutDocumentId: string;
      payoutLineId: string;
      tutorUserId: string;
      documentNumber: string;
      documentType: string;
      grossAmountMinor: bigint;
      withholdingTaxMinor: bigint;
      netAmountMinor: bigint;
      status: string;
      issuedAt: Date;
      createdAt: Date;
    } | null;
  }>;
}) {
  return {
    ...run,
    createdAt: run.createdAt.toISOString(),
    approvedAt: run.approvedAt?.toISOString() ?? null,
    payoutLines: run.payoutLines?.map((line) => ({
      ...line,
      grossVolumeMinor: Number(line.grossVolumeMinor),
      payoutRate: String(line.payoutRate),
      payoutAmountMinor: Number(line.payoutAmountMinor),
      withholdingTaxMinor: Number(line.withholdingTaxMinor),
      netPayoutMinor: Number(line.netPayoutMinor),
      badgeBonusMinor: Number(line.badgeBonusMinor),
      createdAt: line.createdAt.toISOString(),
      payoutDocument: line.payoutDocument
        ? {
            ...line.payoutDocument,
            grossAmountMinor: Number(line.payoutDocument.grossAmountMinor),
            withholdingTaxMinor: Number(
              line.payoutDocument.withholdingTaxMinor,
            ),
            netAmountMinor: Number(line.payoutDocument.netAmountMinor),
            issuedAt: line.payoutDocument.issuedAt.toISOString(),
            createdAt: line.payoutDocument.createdAt.toISOString(),
          }
        : null,
    })),
  };
}

/**
 * GET /v1/settlements
 * คืน list ของทุก SettlementRun เรียงจากล่าสุด
 */
export async function getSettlements(req: AuthenticatedRequest, res: Response) {
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

    const runs = await prisma.settlementRun.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { payoutLines: true } },
        payoutLines: {
          select: {
            payoutAmountMinor: true,
            netPayoutMinor: true,
          },
        },
      },
    });

    // Batch-count pending adjustments per periodMonth (single query, no N+1)
    const periodMonths = [...new Set(runs.map((r) => r.periodMonth))];
    const pendingAdjs = await prisma.adjustment.findMany({
      where: {
        status: "PENDING",
        settlementRun: { periodMonth: { in: periodMonths } },
      },
      include: { settlementRun: { select: { periodMonth: true } } },
    });
    const pendingAdjByPeriod = new Map<string, number>();
    for (const adj of pendingAdjs) {
      if (adj.settlementRun) {
        const pm = adj.settlementRun.periodMonth;
        pendingAdjByPeriod.set(pm, (pendingAdjByPeriod.get(pm) ?? 0) + 1);
      }
    }

    const mapped = runs.map((r) => ({
      snapshotId: r.settlementRunId,
      periodMonth: r.periodMonth,
      status: r.status,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt,
      payoutLineCount: r._count.payoutLines,
      totalPayoutSatang: Number(
        r.payoutLines.reduce((sum, line) => sum + line.payoutAmountMinor, 0n),
      ),
      totalNetPayoutSatang: Number(
        r.payoutLines.reduce((sum, line) => sum + line.netPayoutMinor, 0n),
      ),
      pendingAdjustmentCount: pendingAdjByPeriod.get(r.periodMonth) ?? 0,
    }));

    return res.status(200).json({ settlements: mapped });
  } catch (error: any) {
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
