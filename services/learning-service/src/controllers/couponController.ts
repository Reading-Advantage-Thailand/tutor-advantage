import { Response } from "express";
import { prisma } from "@tutor-advantage/database";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import {
  validateCoupon,
  redeemCoupon,
  CouponError,
} from "../services/couponService";

function couponErrorStatus(code: CouponError["code"]): number {
  switch (code) {
    case "COUPON_NOT_FOUND":
      return 404;
    case "COUPON_NOT_ASSIGNED":
      return 403;
    default:
      return 409;
  }
}

// POST /v1/coupons/validate — tutor checks a code before redeeming
export async function validateCouponCode(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    if (!userId || role !== "TUTOR") {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Only tutors can use coupons", requestId: req.id },
      });
    }

    const { code } = req.body ?? {};
    if (!code || typeof code !== "string") {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "code is required", requestId: req.id },
      });
    }

    const coupon = await validateCoupon(code, userId);
    return res.status(200).json({
      valid: true,
      code: coupon.code,
      hours: coupon.hours,
      expiresAt: coupon.expiresAt,
    });
  } catch (error) {
    if (error instanceof CouponError) {
      return res.status(couponErrorStatus(error.code)).json({
        error: { code: error.code, message: error.message, requestId: req.id },
      });
    }
    console.error("Validate Coupon Error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Could not validate coupon", requestId: req.id },
    });
  }
}

// POST /v1/classes/:classId/apply-coupon — extend an existing class with coupon hours
export async function applyCouponToClass(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    if (!userId || role !== "TUTOR") {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Only tutors can use coupons", requestId: req.id },
      });
    }

    const { classId } = req.params;
    const { code } = req.body ?? {};
    if (!code || typeof code !== "string") {
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "code is required", requestId: req.id },
      });
    }

    const cls = await prisma.class.findUnique({
      where: { classId },
      select: { classId: true, tutorUserId: true, freeHours: true },
    });
    if (!cls) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Class not found", requestId: req.id },
      });
    }
    if (cls.tutorUserId !== userId) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You do not own this class", requestId: req.id },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const hours = await redeemCoupon(tx, code, userId, classId, "EXTEND_CLASS");
      return tx.class.update({
        where: { classId },
        data: { freeHours: { increment: hours } },
        select: { classId: true, freeHours: true },
      });
    });

    return res.status(200).json({
      message: "Coupon applied",
      classId: updated.classId,
      freeHours: updated.freeHours,
    });
  } catch (error) {
    if (error instanceof CouponError) {
      return res.status(couponErrorStatus(error.code)).json({
        error: { code: error.code, message: error.message, requestId: req.id },
      });
    }
    console.error("Apply Coupon Error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Could not apply coupon", requestId: req.id },
    });
  }
}

// GET /v1/coupons/mine — coupons assigned to or redeemed by the tutor
export async function getMyCoupons(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;
    if (!userId || role !== "TUTOR") {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Only tutors can view coupons", requestId: req.id },
      });
    }

    const coupons = await prisma.teachingHourCoupon.findMany({
      where: {
        OR: [{ assignedTutorId: userId }, { redeemedByTutorId: userId }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        couponId: true,
        code: true,
        hours: true,
        status: true,
        redemptionMode: true,
        redeemedClassId: true,
        redeemedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return res.status(200).json({ coupons });
  } catch (error) {
    console.error("Get My Coupons Error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Could not fetch coupons", requestId: req.id },
    });
  }
}
