import { logger } from "@tutor-advantage/shared-config";
import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { SettlementService } from "../services/settlementService";

function canCreateAdjustment(role?: string) {
  return role === "ADMIN" || role === "FINANCE_MAKER";
}

function canCheckAdjustment(role?: string) {
  return role === "ADMIN" || role === "FINANCE_CHECKER";
}

function noteFrom(body: unknown) {
  const raw = (body as { reason?: unknown } | undefined)?.reason;
  return typeof raw === "string" ? raw.trim().slice(0, 1000) : "";
}

function normalizeAmountSatang(value: unknown) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error("INVALID_AMOUNT");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * After an adjustment decision, keep an already-calculated DRAFT run in sync.
 * Holders (ADJUSTMENT_PENDING), never-calculated drafts, rejected runs and
 * SUBMITTED runs are left alone: they are recalculated by an explicit preview,
 * and a SUBMITTED run now reports itself as stale until it is recalculated
 * (submit/approve refuse stale runs).
 */
async function refreshSettlementAfterAdjustment(settlementRunId: string, actorId: string) {
  const run = await prisma.settlementRun.findUnique({
    where: { settlementRunId },
    select: { settlementRunId: true, periodMonth: true, status: true, previewPayload: true },
  });
  if (!run) return { refreshed: false, status: null, stale: false };

  const previewed =
    !!run.previewPayload &&
    typeof run.previewPayload === "object" &&
    Object.keys(run.previewPayload as object).length > 0;

  if (run.status === "DRAFT" && previewed) {
    try {
      const refreshed = await SettlementService.refreshSettlementRun(settlementRunId, { actorId });
      return { ...refreshed, stale: false };
    } catch (error) {
      // The decision itself is already committed; the draft simply stays
      // stale (submit refuses it) until someone recalculates it.
      logger.error("Adjustment follow-up refresh failed:", error);
      return { refreshed: false, status: run.status, stale: true };
    }
  }
  return {
    refreshed: false,
    status: run.status,
    // Lines of a submitted run no longer include this decision.
    stale: run.status === "SUBMITTED",
  };
}

/**
 * GET /v1/adjustments?status=PENDING
 */
export async function getAdjustments(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      status,
      periodMonth,
      tutorUserId,
      page = "1",
      pageSize = "50",
    } = req.query as Record<string, string>;
    const filter = {
      ...(status && /^[A-Z_]{2,30}$/.test(status) ? { status } : {}),
      ...(tutorUserId && UUID_RE.test(tutorUserId) ? { tutorUserId } : {}),
      ...(periodMonth && /^\d{4}-\d{2}$/.test(periodMonth)
        ? { settlementRun: { periodMonth } }
        : {}),
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 50));

    const [total, adjustments] = await Promise.all([
      prisma.adjustment.count({ where: filter }),
      prisma.adjustment.findMany({
        where: filter,
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limit,
        take: limit,
      }),
    ]);

    // ดึง displayName ของ tutors และ creators (กรอง UUID เท่านั้น)
    const userIds = [
      ...new Set([
        ...adjustments.map((a) => a.tutorUserId),
        ...adjustments.map((a) => a.createdBy),
        ...adjustments.map((a) => a.approvedBy).filter(Boolean) as string[],
      ]),
    ].filter((id) => UUID_RE.test(id));

    const userMap = new Map<string, string>();
    if (userIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, displayName: true, email: true },
      });
      for (const u of users) {
        userMap.set(u.userId, u.displayName ?? u.email ?? u.userId);
      }
    }

    // ดึง periodMonth จาก settlementRun
    const runIds = [...new Set(adjustments.map((a) => a.settlementRunId))];
    const runs = await prisma.settlementRun.findMany({
      where: { settlementRunId: { in: runIds } },
      select: { settlementRunId: true, periodMonth: true, status: true },
    });
    const runMap = new Map(runs.map((r) => [r.settlementRunId, r.periodMonth]));
    const runStatusMap = new Map(runs.map((r) => [r.settlementRunId, r.status]));

    const getName = (id: string) =>
      userMap.get(id) ?? (id.includes("-") ? `User …${id.slice(-4)}` : id);

    const mapped = adjustments.map((adj) => ({
      adjustmentId: adj.adjustmentId,
      tutorUserId: adj.tutorUserId,
      tutorName: getName(adj.tutorUserId),
      periodMonth: runMap.get(adj.settlementRunId) ?? "",
      settlementRunId: adj.settlementRunId,
      settlementRunStatus: runStatusMap.get(adj.settlementRunId) ?? null,
      amountSatang: Number(adj.amountMinor),
      reason: adj.reason,
      status: adj.status,
      createdByUserId: adj.createdBy,
      createdByName: getName(adj.createdBy),
      createdAt: adj.createdAt,
      approvedByUserId: adj.approvedBy ?? null,
      approvedByName: adj.approvedBy ? getName(adj.approvedBy) : null,
      approvedAt: adj.approvedAt ?? null,
    }));

    return res.status(200).json({
      adjustments: mapped,
      pagination: {
        total,
        page: pageNum,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("GetAdjustments Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch adjustments",
        requestId: req.id,
      },
    });
  }
}

/**
 * POST /v1/adjustments
 * Body: { tutorUserId, periodMonth, amountSatang, reason }
 */
export async function createAdjustment(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    if (!userId || !canCreateAdjustment(req.user?.role)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only finance makers or admins can create adjustments",
          requestId: req.id,
        },
      });
    }

    const { tutorUserId, periodMonth, amountSatang, reason } = req.body;

    if (!tutorUserId || !periodMonth || amountSatang == null || !reason) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "tutorUserId, periodMonth, amountSatang, reason required",
          requestId: req.id,
        },
      });
    }

    let normalizedAmount: bigint;
    try {
      normalizedAmount = normalizeAmountSatang(amountSatang);
    } catch {
      return res.status(400).json({
        error: {
          code: "INVALID_AMOUNT",
          message: "amountSatang must be an integer in Satang",
          requestId: req.id,
        },
      });
    }

    if (normalizedAmount === 0n) {
      return res.status(400).json({
        error: {
          code: "INVALID_AMOUNT",
          message: "amountSatang cannot be zero",
          requestId: req.id,
        },
      });
    }

    if (typeof periodMonth !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth)) {
      return res.status(400).json({
        error: {
          code: "INVALID_PERIOD_MONTH",
          message: "รูปแบบเดือนไม่ถูกต้อง (YYYY-MM)",
          requestId: req.id,
        },
      });
    }

    const trimmedReason = typeof reason === "string" ? reason.trim() : "";
    if (!trimmedReason) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "กรุณาระบุเหตุผลของการปรับปรุงยอด",
          requestId: req.id,
        },
      });
    }

    // A malformed id used to reach Postgres' uuid cast and surface as a 500.
    if (typeof tutorUserId !== "string" || !UUID_RE.test(tutorUserId.trim())) {
      return res.status(400).json({
        error: {
          code: "INVALID_TUTOR_ID",
          message: "รหัสครูไม่ถูกต้อง กรุณาเลือกครูจากรายการ",
          requestId: req.id,
        },
      });
    }
    const normalizedTutorId = tutorUserId.trim();
    const tutor = await prisma.user.findUnique({
      where: { userId: normalizedTutorId },
      select: { userId: true, role: true },
    });
    if (!tutor || tutor.role !== "TUTOR") {
      return res.status(404).json({
        error: {
          code: "TUTOR_NOT_FOUND",
          message: "ไม่พบครูตามรหัสที่ระบุ",
          requestId: req.id,
        },
      });
    }

    // หา SettlementRun ของ period นั้น. ถ้ายังไม่มี ให้สร้าง "holder" สถานะ
    // ADJUSTMENT_PENDING (ไม่ใช่ DRAFT) — การคำนวณรอบจริงจะ refresh holder นี้
    // แทนการชน DRAFT_EXISTS และ holder ส่งตรวจ/อนุมัติไม่ได้ (F-2)
    let run = await prisma.settlementRun.findFirst({
      where: { periodMonth },
      orderBy: { createdAt: "desc" },
    });

    if (!run) {
      try {
        run = await prisma.settlementRun.create({
          data: {
            periodMonth,
            status: "ADJUSTMENT_PENDING",
            createdBy: userId,
            previewPayload: {},
          },
        });
      } catch (createError) {
        if ((createError as { code?: string }).code !== "P2002") throw createError;
        run = await prisma.settlementRun.findFirst({ where: { periodMonth } });
        if (!run) throw createError;
      }
    }

    if (!["DRAFT", "ADJUSTMENT_PENDING", "REJECTED"].includes(run.status)) {
      return res.status(409).json({
        error: {
          code: "SETTLEMENT_IMMUTABLE",
          message: "Cannot add an adjustment to a submitted or approved settlement",
          requestId: req.id,
        },
      });
    }

    const adj = await prisma.adjustment.create({
      data: {
        settlementRunId: run.settlementRunId,
        tutorUserId: normalizedTutorId,
        amountMinor: normalizedAmount,
        reason: trimmedReason,
        createdBy: userId,
      },
    });

    // บันทึก AuditEvent
    await prisma.auditEvent.create({
      data: {
        actorId: userId,
        action: "ADJUST_CREATE",
        entityType: "Adjustment",
        entityId: adj.adjustmentId,
        payload: {
          amountSatang: normalizedAmount.toString(),
          reason: trimmedReason,
          periodMonth,
          tutorUserId: normalizedTutorId,
          settlementRunId: run.settlementRunId,
        },
      },
    });

    return res.status(201).json({
      message: "Adjustment created",
      adjustmentId: adj.adjustmentId,
      settlementRunId: run.settlementRunId,
      settlementRunStatus: run.status,
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("CreateAdjustment Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not create adjustment",
        requestId: req.id,
      },
    });
  }
}

/**
 * POST /v1/adjustments/:adjustmentId/approve
 */
export async function approveAdjustment(
  req: AuthenticatedRequest,
  res: Response,
) {
  const { adjustmentId } = req.params;
  const userId = req.user?.userId;

  try {
    if (!userId || !canCheckAdjustment(req.user?.role)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only finance checkers or admins can approve adjustments",
          requestId: req.id,
        },
      });
    }

    const adj = await prisma.adjustment.findUnique({ where: { adjustmentId } });
    if (!adj) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Adjustment not found",
          requestId: req.id,
        },
      });
    }

    // ห้าม approve รายการที่ตัวเองสร้าง
    if (adj.createdBy === userId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message:
            "You cannot approve your own adjustment (Makers-Checkers rule)",
          requestId: req.id,
        },
      });
    }

    // An approved (or approving) run is final: approving a late adjustment
    // would silently never be paid. It must go to the next period instead.
    const targetRun = await prisma.settlementRun.findUnique({
      where: { settlementRunId: adj.settlementRunId },
      select: { status: true },
    });
    if (targetRun && ["APPROVING", "APPROVED", "PAID"].includes(targetRun.status)) {
      return res.status(409).json({
        error: {
          code: "SETTLEMENT_IMMUTABLE",
          message: "รอบจ่ายเงินของรายการนี้อนุมัติแล้ว จึงอนุมัติการปรับยอดเพิ่มไม่ได้",
          requestId: req.id,
        },
      });
    }

    const note = noteFrom(req.body);
    const now = new Date();
    const decision = await prisma.adjustment.updateMany({
      where: { adjustmentId, status: "PENDING" },
      data: { status: "APPROVED", approvedBy: userId, approvedAt: now },
    });
    if (decision.count !== 1) {
      return res.status(409).json({
        error: {
          code: "INVALID_STATUS",
          message: "Only pending adjustments can be approved",
          requestId: req.id,
        },
      });
    }
    const settlementRefresh = await refreshSettlementAfterAdjustment(
      adj.settlementRunId,
      userId,
    );

    await prisma.auditEvent.create({
      data: {
        actorId: userId,
        action: "ADJUST_APPROVE",
        entityType: "Adjustment",
        entityId: adjustmentId,
        payload: {
          createdBy: adj.createdBy,
          approvedBy: userId,
          amountSatang: adj.amountMinor.toString(),
          ...(note ? { reason: note } : {}),
          settlementStale: settlementRefresh.stale,
        },
      },
    });

    return res.status(200).json({
      message: "Adjustment approved",
      settlementRefresh,
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("ApproveAdjustment Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not approve",
        requestId: req.id,
      },
    });
  }
}

/**
 * POST /v1/adjustments/:adjustmentId/reject
 */
export async function rejectAdjustment(
  req: AuthenticatedRequest,
  res: Response,
) {
  const { adjustmentId } = req.params;
  const userId = req.user?.userId;

  try {
    if (!userId || !canCheckAdjustment(req.user?.role)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only finance checkers or admins can reject adjustments",
          requestId: req.id,
        },
      });
    }

    const adj = await prisma.adjustment.findUnique({ where: { adjustmentId } });
    if (!adj) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Adjustment not found",
          requestId: req.id,
        },
      });
    }

    if (adj.createdBy === userId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message:
            "You cannot reject your own adjustment (Makers-Checkers rule)",
          requestId: req.id,
        },
      });
    }

    const note = noteFrom(req.body);
    const now = new Date();
    const decision = await prisma.adjustment.updateMany({
      where: { adjustmentId, status: "PENDING" },
      data: { status: "REJECTED", approvedBy: userId, approvedAt: now },
    });
    if (decision.count !== 1) {
      return res.status(409).json({
        error: {
          code: "INVALID_STATUS",
          message: "Only pending adjustments can be rejected",
          requestId: req.id,
        },
      });
    }
    const settlementRefresh = await refreshSettlementAfterAdjustment(
      adj.settlementRunId,
      userId,
    );

    await prisma.auditEvent.create({
      data: {
        actorId: userId,
        action: "ADJUST_REJECT",
        entityType: "Adjustment",
        entityId: adjustmentId,
        payload: {
          createdBy: adj.createdBy,
          rejectedBy: userId,
          amountSatang: adj.amountMinor.toString(),
          ...(note ? { reason: note } : {}),
        },
      },
    });

    return res.status(200).json({
      message: "Adjustment rejected",
      settlementRefresh,
    });
  } catch (error_err) {
    const error = error_err as Error & { code?: string; details?: string; };
    logger.error("RejectAdjustment Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not reject",
        requestId: req.id,
      },
    });
  }
}
