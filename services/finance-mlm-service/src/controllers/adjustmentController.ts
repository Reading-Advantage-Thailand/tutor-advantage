import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

function canCreateAdjustment(role?: string) {
  return role === "ADMIN" || role === "FINANCE_MAKER";
}

function canCheckAdjustment(role?: string) {
  return role === "ADMIN" || role === "FINANCE_CHECKER";
}

function normalizeAmountSatang(value: unknown) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error("INVALID_AMOUNT");
}

/**
 * GET /v1/adjustments?status=PENDING
 */
export async function getAdjustments(req: AuthenticatedRequest, res: Response) {
  try {
    const {
      status,
      page = "1",
      pageSize = "50",
    } = req.query as Record<string, string>;
    const filter = status ? { status } : {};

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
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const userIds = [
      ...new Set([
        ...adjustments.map((a) => a.tutorUserId),
        ...adjustments.map((a) => a.createdBy),
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
      select: { settlementRunId: true, periodMonth: true },
    });
    const runMap = new Map(runs.map((r) => [r.settlementRunId, r.periodMonth]));

    const getName = (id: string) =>
      userMap.get(id) ?? (id.includes("-") ? `User …${id.slice(-4)}` : id);

    const mapped = adjustments.map((adj) => ({
      adjustmentId: adj.adjustmentId,
      tutorUserId: adj.tutorUserId,
      tutorName: getName(adj.tutorUserId),
      periodMonth: runMap.get(adj.settlementRunId) ?? "",
      amountSatang: Number(adj.amountMinor),
      reason: adj.reason,
      status: adj.status,
      createdByUserId: adj.createdBy,
      createdByName: getName(adj.createdBy),
      createdAt: adj.createdAt,
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
  } catch (error: any) {
    console.error("GetAdjustments Error:", error);
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

    // หา SettlementRun ของ period นั้น (หรือสร้างใหม่ถ้าไม่มี)
    let run = await prisma.settlementRun.findFirst({
      where: { periodMonth },
      orderBy: { createdAt: "desc" },
    });

    if (!run) {
      run = await prisma.settlementRun.create({
        data: {
          periodMonth,
          status: "DRAFT",
          createdBy: userId,
          previewPayload: {},
        },
      });
    }

    const adj = await prisma.adjustment.create({
      data: {
        settlementRunId: run.settlementRunId,
        tutorUserId,
        amountMinor: normalizedAmount,
        reason,
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
        payload: { amountSatang: normalizedAmount.toString(), reason, periodMonth },
      },
    });

    return res.status(201).json({
      message: "Adjustment created",
      adjustmentId: adj.adjustmentId,
    });
  } catch (error: any) {
    console.error("CreateAdjustment Error:", error);
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

    await prisma.adjustment.update({
      where: { adjustmentId },
      data: { status: "APPROVED" },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: userId,
        action: "ADJUST_APPROVE",
        entityType: "Adjustment",
        entityId: adjustmentId,
        payload: {
          createdBy: adj.createdBy,
          amountSatang: adj.amountMinor.toString(),
        },
      },
    });

    return res.status(200).json({ message: "Adjustment approved" });
  } catch (error: any) {
    console.error("ApproveAdjustment Error:", error);
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

    await prisma.adjustment.update({
      where: { adjustmentId },
      data: { status: "REJECTED" },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: userId,
        action: "ADJUST_REJECT",
        entityType: "Adjustment",
        entityId: adjustmentId,
        payload: {
          createdBy: adj.createdBy,
          amountSatang: adj.amountMinor.toString(),
        },
      },
    });

    return res.status(200).json({ message: "Adjustment rejected" });
  } catch (error: any) {
    console.error("RejectAdjustment Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not reject",
        requestId: req.id,
      },
    });
  }
}
