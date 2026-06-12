import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

// Human-friendly code: TA-XXXX-XXXX (no ambiguous chars O/0/I/1)
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBlock(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

function generateCode(): string {
  return `TA-${randomBlock(4)}-${randomBlock(4)}`;
}

async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode();
    const existing = await prisma.teachingHourCoupon.findUnique({
      where: { code },
      select: { couponId: true },
    });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique coupon code");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// POST /v1/coupons — admin issues a single coupon
export async function createCoupon(req: AuthenticatedRequest, res: Response) {
  try {
    const role = req.user?.role;
    const userId = req.user?.userId;
    if (!userId || role !== "ADMIN") {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only admins can issue coupons",
          requestId: req.id,
        },
      });
    }

    const { hours, note, assignedTutorId, expiresAt } = req.body ?? {};

    if (!Number.isInteger(hours) || hours <= 0 || hours > 1000) {
      return res.status(400).json({
        error: {
          code: "INVALID_HOURS",
          message: "hours must be a positive integer (max 1000)",
          requestId: req.id,
        },
      });
    }

    if (assignedTutorId && !UUID_RE.test(assignedTutorId)) {
      return res.status(400).json({
        error: {
          code: "INVALID_TUTOR_ID",
          message: "assignedTutorId must be a valid UUID",
          requestId: req.id,
        },
      });
    }

    let expiresAtDate: Date | null = null;
    if (expiresAt) {
      expiresAtDate = new Date(expiresAt);
      if (Number.isNaN(expiresAtDate.getTime())) {
        return res.status(400).json({
          error: {
            code: "INVALID_EXPIRY",
            message: "expiresAt must be a valid date",
            requestId: req.id,
          },
        });
      }
    }

    if (assignedTutorId) {
      const tutor = await prisma.user.findUnique({
        where: { userId: assignedTutorId },
        select: { userId: true, role: true },
      });
      if (!tutor || tutor.role !== "TUTOR") {
        return res.status(404).json({
          error: {
            code: "TUTOR_NOT_FOUND",
            message: "assignedTutorId does not match an existing tutor",
            requestId: req.id,
          },
        });
      }
    }

    const code = await generateUniqueCode();
    const coupon = await prisma.teachingHourCoupon.create({
      data: {
        code,
        hours,
        note: note ?? null,
        createdByUserId: userId,
        assignedTutorId: assignedTutorId ?? null,
        expiresAt: expiresAtDate,
      },
    });

    return res.status(201).json({ coupon });
  } catch (error) {
    console.error("Create Coupon Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not create coupon",
        requestId: req.id,
      },
    });
  }
}

// GET /v1/coupons?status=&page=&pageSize= — admin lists coupons
export async function getCoupons(req: AuthenticatedRequest, res: Response) {
  try {
    const role = req.user?.role;
    if (role !== "ADMIN") {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only admins can view coupons",
          requestId: req.id,
        },
      });
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.pageSize ?? "50"), 10) || 50),
    );
    const status = req.query.status ? String(req.query.status) : null;

    const where = status && status !== "ALL" ? { status } : {};

    const [total, coupons] = await Promise.all([
      prisma.teachingHourCoupon.count({ where }),
      prisma.teachingHourCoupon.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // Resolve tutor display names for assigned/redeemed tutors
    const tutorIds = Array.from(
      new Set(
        coupons
          .flatMap((c) => [c.assignedTutorId, c.redeemedByTutorId])
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const tutors = tutorIds.length
      ? await prisma.user.findMany({
          where: { userId: { in: tutorIds } },
          select: { userId: true, displayName: true },
        })
      : [];
    const nameById = new Map(tutors.map((t) => [t.userId, t.displayName]));

    return res.status(200).json({
      coupons: coupons.map((c) => ({
        ...c,
        assignedTutorName: c.assignedTutorId
          ? nameById.get(c.assignedTutorId) ?? null
          : null,
        redeemedByTutorName: c.redeemedByTutorId
          ? nameById.get(c.redeemedByTutorId) ?? null
          : null,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    console.error("Get Coupons Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not fetch coupons",
        requestId: req.id,
      },
    });
  }
}

// POST /v1/coupons/:couponId/void — admin voids an unredeemed coupon
export async function voidCoupon(req: AuthenticatedRequest, res: Response) {
  try {
    const role = req.user?.role;
    if (role !== "ADMIN") {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only admins can void coupons",
          requestId: req.id,
        },
      });
    }

    const { couponId } = req.params;

    // Only ACTIVE coupons can be voided (atomic guard)
    const result = await prisma.teachingHourCoupon.updateMany({
      where: { couponId, status: "ACTIVE" },
      data: { status: "VOID", updatedAt: new Date() },
    });

    if (result.count === 0) {
      return res.status(409).json({
        error: {
          code: "CANNOT_VOID",
          message: "Coupon not found or is not active",
          requestId: req.id,
        },
      });
    }

    const coupon = await prisma.teachingHourCoupon.findUnique({
      where: { couponId },
    });
    return res.status(200).json({ coupon });
  } catch (error) {
    console.error("Void Coupon Error:", error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not void coupon",
        requestId: req.id,
      },
    });
  }
}
