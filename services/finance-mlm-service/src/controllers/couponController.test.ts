import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  teachingHourCoupon: {
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@tutor-advantage/database", () => ({
  prisma: prismaMock,
}));

import { createCoupon, voidCoupon } from "./couponController";

function createResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
  };
  return res;
}

describe("couponController.createCoupon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("rejects non-admin callers", async () => {
    const req = { user: { userId: "u1", role: "TUTOR" }, body: { hours: 5 } };
    const res = createResponse();
    await createCoupon(req as never, res as never);
    expect(res.statusCode).toBe(403);
    expect(prismaMock.teachingHourCoupon.create).not.toHaveBeenCalled();
  });

  it("rejects invalid hours", async () => {
    const req = { user: { userId: "admin", role: "ADMIN" }, body: { hours: 0 } };
    const res = createResponse();
    await createCoupon(req as never, res as never);
    expect(res.statusCode).toBe(400);
    expect(prismaMock.teachingHourCoupon.create).not.toHaveBeenCalled();
  });

  it("issues a coupon with a generated TA-code for an admin", async () => {
    prismaMock.teachingHourCoupon.findUnique.mockResolvedValue(null);
    prismaMock.teachingHourCoupon.create.mockImplementation(({ data }: never) => ({
      couponId: "c1",
      ...(data as Record<string, unknown>),
    }));

    const req = { user: { userId: "admin", role: "ADMIN" }, body: { hours: 12 } };
    const res = createResponse();
    await createCoupon(req as never, res as never);

    expect(res.statusCode).toBe(201);
    const created = prismaMock.teachingHourCoupon.create.mock.calls[0][0].data;
    expect(created.hours).toBe(12);
    expect(created.createdByUserId).toBe("admin");
    expect(created.code).toMatch(/^TA-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("rejects an assignedTutorId that is not a tutor", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ userId: "x", role: "STUDENT" });
    const req = {
      user: { userId: "admin", role: "ADMIN" },
      body: { hours: 5, assignedTutorId: "123e4567-e89b-12d3-a456-426614174000" },
    };
    const res = createResponse();
    await createCoupon(req as never, res as never);
    expect(res.statusCode).toBe(404);
    expect(prismaMock.teachingHourCoupon.create).not.toHaveBeenCalled();
  });
});

describe("couponController.voidCoupon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("returns 409 when no active coupon is voided", async () => {
    prismaMock.teachingHourCoupon.updateMany.mockResolvedValue({ count: 0 });
    const req = { user: { role: "ADMIN" }, params: { couponId: "c1" } };
    const res = createResponse();
    await voidCoupon(req as never, res as never);
    expect(res.statusCode).toBe(409);
  });

  it("voids an active coupon", async () => {
    prismaMock.teachingHourCoupon.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.teachingHourCoupon.findUnique.mockResolvedValue({
      couponId: "c1",
      status: "VOID",
    });
    const req = { user: { role: "ADMIN" }, params: { couponId: "c1" } };
    const res = createResponse();
    await voidCoupon(req as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(prismaMock.teachingHourCoupon.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { couponId: "c1", status: "ACTIVE" },
      }),
    );
  });
});
