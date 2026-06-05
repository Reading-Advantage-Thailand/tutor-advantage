import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    teachingHourCoupon: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(function PrismaClient() {
    return mockPrisma;
  }),
}));

import {
  validateCoupon,
  redeemCoupon,
  normalizeCode,
  CouponError,
} from "./couponService";

const TUTOR = "tutor-1";
const OTHER_TUTOR = "tutor-2";

function activeCoupon(overrides: Record<string, unknown> = {}) {
  return {
    couponId: "coupon-1",
    code: "TA-ABCD-2345",
    hours: 10,
    status: "ACTIVE",
    assignedTutorId: null,
    expiresAt: null,
    ...overrides,
  };
}

describe("couponService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes codes to trimmed uppercase", () => {
    expect(normalizeCode("  ta-abcd-2345 ")).toBe("TA-ABCD-2345");
  });

  describe("validateCoupon", () => {
    it("returns coupon details for a valid coupon", async () => {
      mockPrisma.teachingHourCoupon.findUnique.mockResolvedValue(activeCoupon());
      const result = await validateCoupon("ta-abcd-2345", TUTOR, mockPrisma as never);
      expect(result.hours).toBe(10);
      expect(mockPrisma.teachingHourCoupon.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { code: "TA-ABCD-2345" } }),
      );
    });

    it("throws COUPON_NOT_FOUND when the code does not exist", async () => {
      mockPrisma.teachingHourCoupon.findUnique.mockResolvedValue(null);
      await expect(
        validateCoupon("nope", TUTOR, mockPrisma as never),
      ).rejects.toMatchObject({ code: "COUPON_NOT_FOUND" });
    });

    it("throws COUPON_NOT_ACTIVE for a redeemed coupon", async () => {
      mockPrisma.teachingHourCoupon.findUnique.mockResolvedValue(
        activeCoupon({ status: "REDEEMED" }),
      );
      await expect(
        validateCoupon("x", TUTOR, mockPrisma as never),
      ).rejects.toMatchObject({ code: "COUPON_NOT_ACTIVE" });
    });

    it("throws COUPON_EXPIRED past the expiry date", async () => {
      mockPrisma.teachingHourCoupon.findUnique.mockResolvedValue(
        activeCoupon({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(
        validateCoupon("x", TUTOR, mockPrisma as never),
      ).rejects.toMatchObject({ code: "COUPON_EXPIRED" });
    });

    it("throws COUPON_NOT_ASSIGNED when reserved for another tutor", async () => {
      mockPrisma.teachingHourCoupon.findUnique.mockResolvedValue(
        activeCoupon({ assignedTutorId: OTHER_TUTOR }),
      );
      await expect(
        validateCoupon("x", TUTOR, mockPrisma as never),
      ).rejects.toMatchObject({ code: "COUPON_NOT_ASSIGNED" });
    });

    it("allows a coupon assigned to the redeeming tutor", async () => {
      mockPrisma.teachingHourCoupon.findUnique.mockResolvedValue(
        activeCoupon({ assignedTutorId: TUTOR }),
      );
      const result = await validateCoupon("x", TUTOR, mockPrisma as never);
      expect(result.hours).toBe(10);
    });
  });

  describe("redeemCoupon", () => {
    it("marks the coupon redeemed and returns granted hours", async () => {
      mockPrisma.teachingHourCoupon.findUnique.mockResolvedValue(activeCoupon());
      mockPrisma.teachingHourCoupon.updateMany.mockResolvedValue({ count: 1 });

      const hours = await redeemCoupon(
        mockPrisma as never,
        "ta-abcd-2345",
        TUTOR,
        "class-9",
        "NEW_CLASS",
      );

      expect(hours).toBe(10);
      expect(mockPrisma.teachingHourCoupon.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { couponId: "coupon-1", status: "ACTIVE" },
          data: expect.objectContaining({
            status: "REDEEMED",
            redeemedByTutorId: TUTOR,
            redeemedClassId: "class-9",
            redemptionMode: "NEW_CLASS",
          }),
        }),
      );
    });

    it("throws when a concurrent redeem already claimed the coupon", async () => {
      mockPrisma.teachingHourCoupon.findUnique.mockResolvedValue(activeCoupon());
      mockPrisma.teachingHourCoupon.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        redeemCoupon(mockPrisma as never, "x", TUTOR, "class-9", "EXTEND_CLASS"),
      ).rejects.toMatchObject({ code: "COUPON_NOT_ACTIVE" });
    });

    it("does not attempt an update for an invalid coupon", async () => {
      mockPrisma.teachingHourCoupon.findUnique.mockResolvedValue(null);
      await expect(
        redeemCoupon(mockPrisma as never, "x", TUTOR, "class-9", "NEW_CLASS"),
      ).rejects.toBeInstanceOf(CouponError);
      expect(mockPrisma.teachingHourCoupon.updateMany).not.toHaveBeenCalled();
    });
  });
});
