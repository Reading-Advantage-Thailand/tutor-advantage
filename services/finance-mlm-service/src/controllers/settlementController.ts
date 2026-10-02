import { logger } from "@tutor-advantage/shared-config";
import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import {
  SettlementService,
  SettlementStaleError,
  isDevMakerCheckerOverrideEnabled,
  type SettlementFreshness,
} from "../services/settlementService";
import { isOmiseConfigured } from "../services/omiseService";
import { prisma } from "@tutor-advantage/database";

function getOmiseRecipientIdFromSettings(settings: unknown) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const recipientId = (settings as { omiseRecipientId?: unknown }).omiseRecipientId;
  return typeof recipientId === "string" && recipientId.trim() ? recipientId.trim() : null;
}

function bankOf(settings: unknown) {
  const record =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};
  const number = typeof record.bankAccountNumber === "string" ? record.bankAccountNumber.replace(/\D/g, "") : "";
  return {
    brand: typeof record.bankBrand === "string" ? record.bankBrand : null,
    last4: number.length >= 4 ? number.slice(-4) : null,
    name: typeof record.taxName === "string" ? record.taxName : null,
  };
}

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
    // A refund webhook may create an ADJUSTMENT_PENDING holder run. Reuse that
    // canonical row when the monthly preview is generated; every other run
    // status is already an idempotent result for this period.
    const existing = await prisma.settlementRun.findFirst({
      where: {
        periodMonth,
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing && !["ADJUSTMENT_PENDING", "REJECTED"].includes(existing.status)) {
      logger.info(
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

    logger.info(
      `[AutoSettlement] Created settlement preview for ${periodMonth}: ${preview.snapshotId}`,
    );

    return res.status(201).json({
      message: "Settlement preview created successfully",
      periodMonth,
      settlementRunId: preview.snapshotId,
      skipped: false,
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("[AutoSettlement] Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Auto-run settlement failed",
        details: error.message,
      },
    });
  }
}

type SettlementRunRow = {
  settlementRunId: string;
  periodMonth: string;
  status: string;
  previewPayload: unknown;
  createdBy: string | null;
  createdAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Statuses whose lines can still change (and therefore can go stale). */
const REVIEWABLE_STATUSES = ["DRAFT", "SUBMITTED"];

function payloadOf(run: { previewPayload: unknown }): Record<string, unknown> {
  const payload = run.previewPayload;
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

/** Adjustment ids a run's lines were calculated with (null for runs calculated before this was recorded). */
function includedAdjustmentIdsOf(run: { previewPayload: unknown }) {
  const ids = payloadOf(run).approvedAdjustmentIds;
  return Array.isArray(ids) ? new Set(ids.map(String)) : null;
}

/** userId → display name (displayName, then email). Non-UUID actors (SYSTEM…) are skipped. */
async function loadUserNames(ids: Array<string | null | undefined>) {
  const userIds = [...new Set(ids.filter((id): id is string => !!id && UUID_RE.test(id)))];
  const names = new Map<string, string>();
  if (userIds.length === 0) return names;
  const users = await prisma.user.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, displayName: true, email: true },
  });
  for (const user of users) {
    names.set(user.userId, user.displayName ?? user.email ?? user.userId);
  }
  return names;
}

function actorName(names: Map<string, string>, id: string | null | undefined) {
  if (!id) return null;
  if (id === "SYSTEM" || id === "SYSTEM_SCHEDULER") return "ระบบอัตโนมัติ";
  return names.get(id) ?? null;
}

async function writeRunAudit(
  actorId: string,
  action: string,
  settlementRunId: string,
  payload: Record<string, unknown>,
) {
  try {
    await prisma.auditEvent.create({
      data: {
        actorId,
        action,
        entityType: "SettlementRun",
        entityId: settlementRunId,
        payload: payload as never,
      },
    });
  } catch (error) {
    logger.error(`Failed to write settlement audit (${action}):`, error);
  }
}

function freshnessJson(freshness: SettlementFreshness, names?: Map<string, string>) {
  return {
    ...freshness,
    changedTutors: freshness.changedTutorUserIds.map((userId) => ({
      userId,
      name: names?.get(userId) ?? null,
    })),
  };
}

/**
 * Maps settlement workflow errors to HTTP responses. Returns false when the
 * error is not a known workflow error (caller logs + 500).
 */
async function sendSettlementWorkflowError(
  error: Error,
  req: AuthenticatedRequest,
  res: Response,
): Promise<boolean> {
  const requestId = req.id;
  if (error instanceof SettlementStaleError) {
    const names = await loadUserNames(error.freshness.changedTutorUserIds).catch(
      () => new Map<string, string>(),
    );
    res.status(409).json({
      error: {
        code: "SETTLEMENT_STALE",
        message:
          "ข้อมูลของรอบนี้เปลี่ยนหลังคำนวณ (ปรับปรุงยอด การชำระเงิน หรือบัญชีรับเงินของครู) ต้องคำนวณใหม่ก่อนส่งตรวจหรืออนุมัติ",
        details: freshnessJson(error.freshness, names),
        tutorUserIds: error.freshness.changedTutorUserIds,
        requestId,
      },
    });
    return true;
  }
  const simple: Record<string, { status: number; message: string }> = {
    NOT_FOUND: { status: 404, message: "Settlement run not found" },
    SETTLEMENT_EMPTY: {
      status: 409,
      message: "รอบนี้ไม่มีรายการจ่ายเงิน (0 รายการ) จึงส่งตรวจหรืออนุมัติไม่ได้",
    },
    SETTLEMENT_NOT_PREVIEWED: {
      status: 409,
      message: "รอบนี้ยังไม่เคยคำนวณ กรุณาคำนวณก่อนส่งตรวจหรืออนุมัติ",
    },
    INVALID_STATUS: {
      status: 400,
      message: "สถานะปัจจุบันของรอบนี้ไม่อนุญาตให้ทำรายการนี้",
    },
    SETTLEMENT_ALREADY_CLAIMED: {
      status: 409,
      message: "Another request is already processing this settlement",
    },
    SETTLEMENT_IMMUTABLE: {
      status: 409,
      message: "Settlement is already being processed or is immutable",
    },
    SETTLEMENT_PERIOD_MISMATCH: { status: 400, message: "Settlement period mismatch" },
    INVALID_PERIOD_MONTH: { status: 400, message: "Valid periodMonth (YYYY-MM) is required" },
    SPONSOR_TREE_CYCLE: { status: 409, message: "Sponsor tree contains a cycle" },
  };
  const mapped = simple[error.message];
  if (mapped) {
    res.status(mapped.status).json({
      error: { code: error.message, message: mapped.message, requestId },
    });
    return true;
  }
  if (
    error.message?.startsWith("PAYOUT_IDENTITY_CHANGED:") ||
    error.message?.startsWith("PAYOUT_IDENTITY_SNAPSHOT_MISSING:") ||
    error.message?.startsWith("PAYOUT_ELIGIBILITY_CHANGED:")
  ) {
    const tutorUserIds = error.message.split(":").slice(1);
    const names = await loadUserNames(tutorUserIds).catch(() => new Map<string, string>());
    res.status(409).json({
      error: {
        code: "PAYOUT_IDENTITY_CHANGED",
        message:
          "Payout eligibility or recipient changed after review. Refresh the settlement and submit it for review again.",
        tutorUserIds,
        details: {
          reason: error.message.split(":")[0],
          tutors: tutorUserIds.map((userId) => ({ userId, name: names.get(userId) ?? null })),
        },
        requestId,
      },
    });
    return true;
  }
  return false;
}

export async function previewSettlement(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const { periodMonth } = req.body; // e.g., '2026-02'

    if (!userId || req.user?.role !== "ADMIN") {
      return res.status(403).json({
        error: {
          code: "UNAUTHORIZED_ROLE",
          message: "Only admins can preview settlements",
          requestId: req.id,
        },
      });
    }

    if (!periodMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth)) {
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

    await writeRunAudit(userId, "PREVIEW", preview.snapshotId, {
      periodMonth,
      payoutLineCount: preview.payoutLineCount,
      totalNetPayoutSatang: String(preview.totalNetPayoutSatang),
    });

    return res.status(200).json({
      message: "Settlement preview generated",
      preview,
    });
  } catch (error_err) {
    const error = error_err as Error & {
      code?: string;
      details?: string;
      existingRunId?: string;
      existingStatus?: string;
    };
    if (error.message === "DRAFT_EXISTS") {
      return res.status(409).json({
        error: {
          code: "DRAFT_EXISTS",
          message: "A settlement run already exists for this period",
          details: error.existingRunId
            ? { snapshotId: error.existingRunId, status: error.existingStatus ?? null }
            : undefined,
          requestId: req.id,
        },
      });
    }
    if (await sendSettlementWorkflowError(error, req, res)) return;
    logger.error("Preview Settlement Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate settlement preview",
        details: error.message,
        requestId: req.id,
      },
    });
  }
}

/**
 * POST /v1/settlements/:snapshotId/refresh — ADMIN recalculates a run in place.
 * DRAFT / REJECTED / ADJUSTMENT_PENDING runs are recalculated; a SUBMITTED run
 * only when its inputs changed after review (it then returns to DRAFT and must
 * be submitted again).
 */
export async function refreshSettlement(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const { role, userId } = req.user!;
    const { snapshotId } = req.params;

    if (role !== "ADMIN") {
      return res.status(403).json({
        error: {
          code: "UNAUTHORIZED_ROLE",
          message: "Only admins can refresh settlements",
          requestId: req.id,
        },
      });
    }

    const run = await prisma.settlementRun.findUnique({
      where: { settlementRunId: snapshotId },
    });
    if (!run) throw new Error("NOT_FOUND");

    let allowSubmitted = false;
    if (run.status === "SUBMITTED") {
      const freshness = await SettlementService.getRunFreshness(run);
      if (!freshness.stale) {
        return res.status(409).json({
          error: {
            code: "SETTLEMENT_NOT_STALE",
            message: "รอบนี้ยังตรงกับข้อมูลล่าสุดและรอผู้ตรวจสอบอยู่ ไม่ต้องคำนวณใหม่",
            requestId: req.id,
          },
        });
      }
      allowSubmitted = true;
    }

    const preview = await SettlementService.refreshSettlementRun(snapshotId, {
      actorId: userId,
      allowSubmitted,
    });
    if (!preview.refreshed) throw new Error("SETTLEMENT_IMMUTABLE");

    await writeRunAudit(userId, "REFRESH", snapshotId, {
      periodMonth: run.periodMonth,
      previousStatus: run.status,
      payoutLineCount: preview.payoutLineCount,
      totalNetPayoutSatang: String(preview.totalNetPayoutSatang),
    });

    return res.status(200).json({
      message: "Settlement refreshed",
      preview,
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    if (await sendSettlementWorkflowError(error, req, res)) return;
    logger.error("Refresh Settlement Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to refresh settlement",
        details: error.message,
        requestId: req.id,
      },
    });
  }
}

/**
 * POST /v1/settlements/:snapshotId/submit
 * Admin submits a DRAFT for Finance Checker review → SUBMITTED.
 * Refuses empty runs and runs whose inputs changed since they were calculated.
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

    const freshness = await SettlementService.assertRunReadyForReview(run);

    const submitted = await prisma.settlementRun.updateMany({
      where: { settlementRunId: snapshotId, status: "DRAFT" },
      data: { status: "SUBMITTED" },
    });
    if (submitted.count !== 1) {
      return res.status(409).json({
        error: {
          code: "INVALID_STATUS",
          message: "Settlement changed before it could be submitted",
          requestId: req.id,
        },
      });
    }

    await writeRunAudit(userId, "SUBMIT", snapshotId, {
      periodMonth: run.periodMonth,
      payoutLineCount: freshness.lineCount,
      totalNetPayoutSatang: payloadOf(run).totalNetPayoutSatang ?? null,
    });

    return res.status(200).json({ message: "Settlement submitted for review" });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    if (await sendSettlementWorkflowError(error, req, res)) return;
    logger.error("Submit Settlement Error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Could not submit settlement", requestId: req.id },
    });
  }
}

/**
 * POST /v1/settlements/:snapshotId/reject
 * Body (optional): { reason } — recorded in the audit trail.
 */
export async function rejectSettlement(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const { snapshotId } = req.params;
    const rawReason = (req.body as { reason?: unknown } | undefined)?.reason;
    const reason = typeof rawReason === "string" ? rawReason.trim().slice(0, 1000) : "";

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

    const rejected = await prisma.settlementRun.updateMany({
      where: { settlementRunId: snapshotId, status: allowedStatus },
      data: { status: "REJECTED" },
    });
    if (rejected.count !== 1) {
      return res.status(409).json({
        error: {
          code: "INVALID_STATUS",
          message: "Settlement changed before it could be rejected",
          requestId: req.id,
        },
      });
    }

    await writeRunAudit(userId, "REJECT", snapshotId, {
      periodMonth: run.periodMonth,
      previousStatus: run.status,
      ...(reason ? { reason } : {}),
    });

    return res.status(200).json({ message: "Settlement rejected" });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Reject Settlement Error:", error);
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
      select: { adjustmentId: true, tutorUserId: true, amountMinor: true },
    });
    const includedAdjustmentIds = includedAdjustmentIdsOf(run);
    const adjustmentMap = new Map<string, bigint>();
    for (const adjustment of approvedAdjustments) {
      if (includedAdjustmentIds && !includedAdjustmentIds.has(adjustment.adjustmentId)) continue;
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
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Export CSV Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not export CSV",
        requestId: req.id,
      },
    });
  }
}

const TIMELINE_ACTIONS = ["PREVIEW", "REFRESH", "SUBMIT", "APPROVE", "REJECT"];

/** Run header shared by the list and the detail endpoint. */
async function buildRunTimeline(run: SettlementRunRow) {
  const events = await prisma.auditEvent.findMany({
    where: {
      entityType: "SettlementRun",
      entityId: run.settlementRunId,
      action: { in: TIMELINE_ACTIONS },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { action: true, actorId: true, createdAt: true, payload: true },
  });
  return events;
}

/**
 * GET /v1/settlements/:snapshotId/lines — payout lines plus the run header
 * (totals, timeline, freshness, transfer plan) for the run detail page.
 * No audit trail created (view-only, not an export action).
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

    if (!UUID_RE.test(snapshotId ?? "")) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Settlement run not found", requestId: req.id } });
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
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Settlement run not found", requestId: req.id } });
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
    const [approvedAdjustments, pendingAdjustmentCount, timelineEvents] = await Promise.all([
      prisma.adjustment.findMany({
        where: {
          settlementRunId: snapshotId,
          status: "APPROVED",
        },
        select: {
          adjustmentId: true,
          tutorUserId: true,
          amountMinor: true,
        },
      }),
      prisma.adjustment.count({
        where: { settlementRunId: snapshotId, status: "PENDING" },
      }),
      buildRunTimeline(run),
    ]);
    // Split each line using the adjustments that were part of its calculation
    // (an adjustment approved after the preview is not in the stored amount).
    const includedAdjustmentIds = includedAdjustmentIdsOf(run);
    const adjustmentMap = new Map<string, bigint>();
    for (const adjustment of approvedAdjustments) {
      if (includedAdjustmentIds && !includedAdjustmentIds.has(adjustment.adjustmentId)) continue;
      adjustmentMap.set(
        adjustment.tutorUserId,
        (adjustmentMap.get(adjustment.tutorUserId) ?? 0n) +
          adjustment.amountMinor,
      );
    }

    const omiseConfigured = isOmiseConfigured();
    let totalPayoutMinor = 0n;
    let totalWhtMinor = 0n;
    let totalNetMinor = 0n;
    let transferCount = 0;
    let transferTotalMinor = 0n;
    let missingRecipientCount = 0;
    let missingRecipientTotalMinor = 0n;
    let pendingTransferCount = 0;

    const lines = run.payoutLines.map((l) => {
      const tutor = tutorMap.get(l.tutorUserId);
      const transfer = transferMap.get(l.payoutLineId);
      const adjustmentMinor = adjustmentMap.get(l.tutorUserId) ?? 0n;
      const basePayoutMinor =
        l.payoutAmountMinor - l.badgeBonusMinor - adjustmentMinor;
      const hasOmiseRecipientId = Boolean(getOmiseRecipientIdFromSettings(tutor?.settings));
      const transferStatus = transfer?.transfer_status ?? null;

      totalPayoutMinor += l.payoutAmountMinor;
      totalWhtMinor += l.withholdingTaxMinor;
      totalNetMinor += l.netPayoutMinor;
      if (l.netPayoutMinor > 0n) {
        if (l.recipientSnapshot) {
          transferCount += 1;
          transferTotalMinor += l.netPayoutMinor;
        } else {
          missingRecipientCount += 1;
          missingRecipientTotalMinor += l.netPayoutMinor;
        }
      }
      if (["PENDING_TRANSFER", "CREATED", "SENT_PENDING", "SENT"].includes(transferStatus ?? "")) {
        pendingTransferCount += 1;
      }

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
        // Minor units (satang) as strings: exact, for the admin UI.
        grossVolumeSatang: l.grossVolumeMinor.toString(),
        basePayoutSatang: basePayoutMinor.toString(),
        adjustmentSatang: adjustmentMinor.toString(),
        grossPayoutSatang: l.payoutAmountMinor.toString(),
        badgeBonusSatang: l.badgeBonusMinor.toString(),
        whtSatang: l.withholdingTaxMinor.toString(),
        netPayoutSatang: l.netPayoutMinor.toString(),
        eligibilityStatus: l.eligibilityStatus,
        hasRecipientSnapshot: Boolean(l.recipientSnapshot),
        // Masked payout destination for confirmation dialogs (never the full number).
        bankBrand: bankOf(tutor?.settings).brand,
        bankAccountLast4: bankOf(tutor?.settings).last4,
        bankAccountName: bankOf(tutor?.settings).name,
        documentNumber: l.payoutDocument?.documentNumber ?? null,
        documentStatus: l.payoutDocument?.status ?? null,
        transferProvider: transfer?.provider ?? null,
        transferId: transfer?.provider_transfer_id ?? null,
        transferStatus,
        transferFailureCode: transfer?.transfer_failure_code ?? null,
        transferFailureMessage: transfer?.transfer_failure_message ?? null,
        transferredAt: transfer?.transferred_at?.toISOString() ?? null,
        canSendTransfer:
          run.status === "APPROVED" &&
          l.netPayoutMinor > 0n &&
          hasOmiseRecipientId &&
          !["PENDING_TRANSFER", "CREATED", "SENT_PENDING", "SENT", "PAID"].includes(
            transferStatus ?? "NOT_SENT",
          ),
        transferBlockedReason: !hasOmiseRecipientId
          ? "ยังไม่มี Omise recipient"
          : null,
      };
    });

    const payload = payloadOf(run);
    const previewedBy = typeof payload.previewedBy === "string" ? payload.previewedBy : null;
    const names = await loadUserNames([
      run.createdBy,
      run.approvedBy,
      previewedBy,
      ...timelineEvents.map((event) => event.actorId),
    ]);

    let freshness: ReturnType<typeof freshnessJson> | null = null;
    if (REVIEWABLE_STATUSES.includes(run.status)) {
      try {
        const result = await SettlementService.getRunFreshness(run);
        const changedNames = await loadUserNames(result.changedTutorUserIds);
        freshness = freshnessJson(result, changedNames);
      } catch (error) {
        logger.error("getSettlementLines freshness error:", error);
      }
    }

    const timeline = [
      {
        action: "CREATE",
        actorId: run.createdBy,
        actorName: actorName(names, run.createdBy),
        at: run.createdAt.toISOString(),
        note: null as string | null,
        devOverride: false,
      },
      ...timelineEvents.map((event) => {
        const eventPayload =
          event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
            ? (event.payload as Record<string, unknown>)
            : {};
        return {
          action: event.action,
          actorId: event.actorId,
          actorName: actorName(names, event.actorId),
          at: event.createdAt.toISOString(),
          note: typeof eventPayload.reason === "string" ? eventPayload.reason : null,
          devOverride: eventPayload.devOverride === true,
        };
      }),
    ];
    // Runs calculated before timeline events existed: fall back to the payload / columns.
    if (!timeline.some((entry) => entry.action === "PREVIEW" || entry.action === "REFRESH") &&
        typeof payload.previewedAt === "string") {
      timeline.push({
        action: "PREVIEW",
        actorId: previewedBy,
        actorName: actorName(names, previewedBy),
        at: payload.previewedAt,
        note: null,
        devOverride: false,
      });
    }
    if (run.approvedAt && !timeline.some((entry) => entry.action === "APPROVE")) {
      timeline.push({
        action: "APPROVE",
        actorId: run.approvedBy,
        actorName: actorName(names, run.approvedBy),
        at: run.approvedAt.toISOString(),
        note: null,
        devOverride: false,
      });
    }
    timeline.sort((a, b) => a.at.localeCompare(b.at));

    return res.status(200).json({
      snapshotId,
      periodMonth: run.periodMonth,
      status: run.status,
      totalNetPayoutTHB: lines.reduce((s, l) => s + l.netPayoutTHB, 0),
      lines,
      run: {
        snapshotId,
        periodMonth: run.periodMonth,
        status: run.status,
        createdBy: run.createdBy,
        createdByName: actorName(names, run.createdBy),
        createdAt: run.createdAt.toISOString(),
        approvedBy: run.approvedBy,
        approvedByName: actorName(names, run.approvedBy),
        approvedAt: run.approvedAt?.toISOString() ?? null,
        previewedAt: typeof payload.previewedAt === "string" ? payload.previewedAt : null,
        previewedBy,
        previewedByName: actorName(names, previewedBy),
        paymentCount: typeof payload.paymentCount === "number" ? payload.paymentCount : null,
        payoutLineCount: lines.length,
        totalPayoutSatang: totalPayoutMinor.toString(),
        totalWithholdingSatang: totalWhtMinor.toString(),
        totalNetPayoutSatang: totalNetMinor.toString(),
        pendingAdjustmentCount,
        approvedAdjustmentCount: approvedAdjustments.length,
        transferPlan: {
          // What approval will do: one Omise transfer per line with a positive
          // net payout and a recipient snapshot (automatic when Omise is configured).
          automatic: omiseConfigured,
          count: transferCount,
          totalNetSatang: transferTotalMinor.toString(),
          missingRecipientCount,
          missingRecipientTotalSatang: missingRecipientTotalMinor.toString(),
        },
        pendingTransferCount,
        freshness,
        timeline,
      },
      omiseConfigured,
      devMakerCheckerOverride: isDevMakerCheckerOverrideEnabled(),
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("getSettlementLines error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Could not fetch lines", requestId: req.id },
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
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("Summary Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch summary",
        requestId: req.id,
      },
    });
  }
}

/**
 * POST /v1/settlements/:snapshotId/approve
 *
 * Maker-checker: only a FINANCE_CHECKER approves, and only a SUBMITTED run.
 * The single exception is the explicit local-dev override
 * (ENABLE_DEV_ROUTES=true AND NODE_ENV !== "production"), which lets an ADMIN
 * approve a DRAFT directly; such approvals are flagged in the audit trail.
 *
 * BUSINESS RULE (pending owner decision, unchanged): approval automatically
 * creates Omise transfers for every positive net line when Omise is configured.
 */
export async function approveSettlement(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const { snapshotId } = req.params;
    const role = req.user?.role;

    const devOverride = isDevMakerCheckerOverrideEnabled() && role === "ADMIN";
    const canApprove = role === "FINANCE_CHECKER" || devOverride;

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
    const approvableStatuses = devOverride ? ["DRAFT", "SUBMITTED"] : ["SUBMITTED"];
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
          details: { pendingCount: pendingAdjCount, periodMonth: run.periodMonth },
          requestId: req.id,
        },
      });
    }

    const approvedRun = await SettlementService.approveSettlement(
      snapshotId,
      userId,
      { allowDirectFromDraft: devOverride },
    );

    await writeRunAudit(userId, "APPROVE", snapshotId, {
      periodMonth: run.periodMonth,
      previousStatus: run.status,
      devOverride,
    });

    return res.status(200).json({
      message: "Settlement run approved",
      devOverride,
      run: serializeSettlementRun(approvedRun),
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    if (error.message === "INVALID_STATUS") {
      return res.status(400).json({
        error: {
          code: "INVALID_STATUS",
          message: "Settlement run must be in SUBMITTED status to approve",
          requestId: req.id,
        },
      });
    }
    if (await sendSettlementWorkflowError(error, req, res)) return;

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

    logger.error("Approve Settlement Error:", error);
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
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
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

    if (
      error.message?.startsWith("PAYOUT_IDENTITY_CHANGED:") ||
      error.message?.startsWith("PAYOUT_IDENTITY_SNAPSHOT_MISSING:") ||
      error.message?.startsWith("PAYOUT_ELIGIBILITY_CHANGED:")
    ) {
      return res.status(409).json({
        error: {
          code: "PAYOUT_IDENTITY_CHANGED",
          message:
            "Payout eligibility or recipient changed after review. Refresh the settlement before retrying.",
          tutorUserId: error.message.split(":").slice(1).join(":"),
          requestId: req.id,
        },
      });
    }

    if (error.message?.startsWith("TRANSFER_RECOVERY_FAILED:")) {
      return res.status(502).json({
        error: {
          code: "TRANSFER_RECOVERY_FAILED",
          message: "Could not reconcile the existing Omise transfer before retrying",
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

    logger.error("Retry Payout Transfer Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not send payout transfer",
        requestId: req.id,
      },
    });
  }
}

/**
 * POST /v1/settlements/:snapshotId/lines/:payoutLineId/sync-transfer
 * Pulls the latest Omise transfer status onto the payout document.
 */
export async function syncPayoutTransfer(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const { payoutLineId } = req.params;
    const role = req.user?.role;

    if (role !== "ADMIN" && role !== "FINANCE_CHECKER") {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only ADMIN or FINANCE_CHECKER can sync transfer status",
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

    const result = await SettlementService.syncPayoutTransferStatus(payoutLineId);

    return res.status(200).json({ message: "Transfer status synced", transfer: result });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    const errorMap: Record<string, { status: number; message: string }> = {
      PAYOUT_LINE_NOT_FOUND: { status: 404, message: "Payout line not found" },
      PAYOUT_DOCUMENT_NOT_FOUND: {
        status: 409,
        message: "Payout document does not exist for this line",
      },
      OMISE_PAYOUTS_NOT_CONFIGURED: {
        status: 502,
        message: "Omise keys are not configured",
      },
    };

    const mapped = errorMap[error.message];
    if (mapped) {
      return res.status(mapped.status).json({
        error: { code: error.message, message: mapped.message, requestId: req.id },
      });
    }

    logger.error("Sync Payout Transfer Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not sync transfer status",
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
 * GET /v1/settlements?page=1&pageSize=20&status=SUBMITTED&periodMonth=2026-08
 * Paged list of SettlementRuns (newest period first). Totals come from a
 * single grouped SUM over payout lines for the page — lines are not loaded.
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

    const query = req.query as Record<string, string | undefined>;
    const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(query.pageSize ?? "20", 10) || 20));
    const status = typeof query.status === "string" && /^[A-Z_]{2,40}$/.test(query.status)
      ? query.status
      : undefined;
    const periodMonth = typeof query.periodMonth === "string" && /^\d{4}-\d{2}$/.test(query.periodMonth)
      ? query.periodMonth
      : undefined;
    const where = {
      ...(status ? { status } : {}),
      ...(periodMonth ? { periodMonth } : {}),
    };

    const [total, runs, statusGroups] = await Promise.all([
      prisma.settlementRun.count({ where }),
      prisma.settlementRun.findMany({
        where,
        orderBy: [{ periodMonth: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.settlementRun.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    const runIds = runs.map((r) => r.settlementRunId);
    const periodMonths = [...new Set(runs.map((r) => r.periodMonth))];
    const [lineSums, pendingAdjs] = await Promise.all([
      runIds.length > 0
        ? prisma.payoutLine.groupBy({
            by: ["settlementRunId"],
            where: { settlementRunId: { in: runIds } },
            _count: { _all: true },
            _sum: {
              payoutAmountMinor: true,
              withholdingTaxMinor: true,
              netPayoutMinor: true,
            },
          })
        : Promise.resolve([]),
      periodMonths.length > 0
        ? prisma.adjustment.groupBy({
            by: ["settlementRunId"],
            where: { status: "PENDING", settlementRunId: { in: runIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);
    const sumByRun = new Map(lineSums.map((row) => [row.settlementRunId, row]));
    const pendingByRun = new Map(
      pendingAdjs.map((row) => [row.settlementRunId, row._count._all]),
    );

    // Freshness only matters for runs that can still be submitted/approved.
    const freshnessByRun = new Map<string, SettlementFreshness | null>();
    await Promise.all(
      runs
        .filter((r) => REVIEWABLE_STATUSES.includes(r.status))
        .map(async (r) => {
          try {
            freshnessByRun.set(r.settlementRunId, await SettlementService.getRunFreshness(r));
          } catch (error) {
            logger.error("getSettlements freshness error:", error);
            freshnessByRun.set(r.settlementRunId, null);
          }
        }),
    );

    const names = await loadUserNames(runs.flatMap((r) => [r.createdBy, r.approvedBy]));

    const mapped = runs.map((r) => {
      const sums = sumByRun.get(r.settlementRunId);
      const freshness = freshnessByRun.get(r.settlementRunId) ?? null;
      const payload = payloadOf(r);
      return {
        snapshotId: r.settlementRunId,
        periodMonth: r.periodMonth,
        status: r.status,
        createdBy: r.createdBy,
        createdByName: actorName(names, r.createdBy),
        createdAt: r.createdAt,
        approvedBy: r.approvedBy,
        approvedByName: actorName(names, r.approvedBy),
        approvedAt: r.approvedAt,
        previewedAt: typeof payload.previewedAt === "string" ? payload.previewedAt : null,
        payoutLineCount: sums?._count._all ?? 0,
        totalPayoutSatang: Number(sums?._sum.payoutAmountMinor ?? 0n),
        totalWithholdingSatang: Number(sums?._sum.withholdingTaxMinor ?? 0n),
        totalNetPayoutSatang: Number(sums?._sum.netPayoutMinor ?? 0n),
        pendingAdjustmentCount: pendingByRun.get(r.settlementRunId) ?? 0,
        stale: freshness ? freshness.stale : null,
        staleReasons: freshness?.reasons ?? [],
      };
    });

    const statusCounts = statusGroups.map((group) => ({
      status: group.status,
      count: group._count._all,
    }));

    return res.status(200).json({
      settlements: mapped,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      statusCounts,
      omiseConfigured: isOmiseConfigured(),
      devMakerCheckerOverride: isDevMakerCheckerOverrideEnabled(),
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("GetSettlements Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch settlements",
        requestId: req.id,
      },
    });
  }
}
