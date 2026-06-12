import { prisma, type Prisma, type PrismaClient } from "@tutor-advantage/database";

export type TxClient = Prisma.TransactionClient | PrismaClient;

export type CouponErrorCode =
  | "COUPON_NOT_FOUND"
  | "COUPON_NOT_ACTIVE"
  | "COUPON_EXPIRED"
  | "COUPON_NOT_ASSIGNED";

export class CouponError extends Error {
  code: CouponErrorCode;
  constructor(code: CouponErrorCode, message: string) {
    super(message);
    this.name = "CouponError";
    this.code = code;
  }
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

type ValidatedCoupon = {
  couponId: string;
  code: string;
  hours: number;
  assignedTutorId: string | null;
  expiresAt: Date | null;
};

// Read-only validation — throws CouponError on any problem.
export async function validateCoupon(
  code: string,
  tutorId: string,
  client: TxClient = prisma,
): Promise<ValidatedCoupon> {
  const coupon = await client.teachingHourCoupon.findUnique({
    where: { code: normalizeCode(code) },
    select: {
      couponId: true,
      code: true,
      hours: true,
      status: true,
      assignedTutorId: true,
      expiresAt: true,
    },
  });

  if (!coupon) {
    throw new CouponError("COUPON_NOT_FOUND", "Coupon code not found");
  }
  if (coupon.status !== "ACTIVE") {
    throw new CouponError(
      "COUPON_NOT_ACTIVE",
      "Coupon has already been used or is no longer valid",
    );
  }
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    throw new CouponError("COUPON_EXPIRED", "Coupon has expired");
  }
  if (coupon.assignedTutorId && coupon.assignedTutorId !== tutorId) {
    throw new CouponError(
      "COUPON_NOT_ASSIGNED",
      "Coupon is reserved for another tutor",
    );
  }

  return {
    couponId: coupon.couponId,
    code: coupon.code,
    hours: coupon.hours,
    assignedTutorId: coupon.assignedTutorId,
    expiresAt: coupon.expiresAt,
  };
}

// Atomically redeem a validated coupon. Must run inside a transaction together
// with the class create/update so the hour grant and redemption stay consistent.
// Returns the granted hours. Throws CouponError on validation or race failure.
export async function redeemCoupon(
  tx: TxClient,
  code: string,
  tutorId: string,
  classId: string,
  mode: "NEW_CLASS" | "EXTEND_CLASS",
): Promise<number> {
  const coupon = await validateCoupon(code, tutorId, tx);

  // Atomic guard against double-redeem races: only flip an ACTIVE row.
  const result = await tx.teachingHourCoupon.updateMany({
    where: { couponId: coupon.couponId, status: "ACTIVE" },
    data: {
      status: "REDEEMED",
      redeemedByTutorId: tutorId,
      redeemedClassId: classId,
      redemptionMode: mode,
      redeemedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  if (result.count === 0) {
    throw new CouponError(
      "COUPON_NOT_ACTIVE",
      "Coupon has already been used or is no longer valid",
    );
  }

  return coupon.hours;
}
