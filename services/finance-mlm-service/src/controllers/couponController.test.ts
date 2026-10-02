import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  teachingHourCoupon: {
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
  auditEvent: {
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@tutor-advantage/database", () => ({
  prisma: prismaMock,
}));

import {
  couponStatusWhere,
  createCoupon,
  effectiveCouponStatus,
  getCoupons,
  searchCouponTutors,
  updateCoupon,
  voidCoupon,
} from "./couponController";

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

const COUPON_ID = "123e4567-e89b-12d3-a456-426614174999";
const TUTOR_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("couponController create validation + audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.teachingHourCoupon.findUnique.mockResolvedValue(null);
    prismaMock.teachingHourCoupon.create.mockImplementation(({ data }: never) => ({
      couponId: "c1",
      ...(data as Record<string, unknown>),
    }));
  });

  it("rejects an expiry in the past", async () => {
    const req = { user: { userId: "admin", role: "ADMIN" }, body: { hours: 2, expiresAt: "2020-01-01T00:00:00Z" } };
    const res = createResponse();
    await createCoupon(req as never, res as never);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe("INVALID_EXPIRY");
  });

  it("rejects a note longer than 500 characters", async () => {
    const req = { user: { userId: "admin", role: "ADMIN" }, body: { hours: 2, note: "x".repeat(501) } };
    const res = createResponse();
    await createCoupon(req as never, res as never);
    expect(res.statusCode).toBe(400);
    expect(prismaMock.teachingHourCoupon.create).not.toHaveBeenCalled();
  });

  it("writes a COUPON_CREATE audit event with a trimmed note", async () => {
    const req = { user: { userId: "admin", role: "ADMIN" }, body: { hours: 3, note: "  campaign  " } };
    const res = createResponse();
    await createCoupon(req as never, res as never);
    expect(res.statusCode).toBe(201);
    expect(prismaMock.teachingHourCoupon.create.mock.calls[0][0].data.note).toBe("campaign");
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "COUPON_CREATE", entityType: "Coupon", entityId: "c1", actorId: "admin" }),
      }),
    );
  });
});

describe("couponController effective status", () => {
  const now = new Date("2026-10-02T00:00:00Z");
  it("reports ACTIVE coupons past expiry as EXPIRED", () => {
    expect(effectiveCouponStatus({ status: "ACTIVE", expiresAt: new Date("2026-10-01T00:00:00Z") }, now)).toBe("EXPIRED");
    expect(effectiveCouponStatus({ status: "ACTIVE", expiresAt: new Date("2026-10-03T00:00:00Z") }, now)).toBe("ACTIVE");
    expect(effectiveCouponStatus({ status: "ACTIVE", expiresAt: null }, now)).toBe("ACTIVE");
    expect(effectiveCouponStatus({ status: "REDEEMED", expiresAt: new Date("2020-01-01") }, now)).toBe("REDEEMED");
  });

  it("builds status filters that match the effective status", () => {
    expect(couponStatusWhere("ACTIVE", now)).toEqual({
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    });
    expect(couponStatusWhere("EXPIRED", now)).toEqual({
      OR: [{ status: "EXPIRED" }, { status: "ACTIVE", expiresAt: { lt: now } }],
    });
    expect(couponStatusWhere("VOID", now)).toEqual({ status: "VOID" });
    expect(couponStatusWhere(null, now)).toEqual({});
  });
});

describe("couponController.getCoupons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.teachingHourCoupon.count.mockResolvedValue(1);
    prismaMock.teachingHourCoupon.findMany.mockResolvedValue([
      {
        couponId: "c1",
        code: "TA-AAAA-BBBB",
        hours: 4,
        status: "ACTIVE",
        expiresAt: new Date("2020-01-01T00:00:00Z"),
        assignedTutorId: TUTOR_ID,
        redeemedByTutorId: null,
      },
    ]);
    prismaMock.teachingHourCoupon.groupBy.mockResolvedValue([
      { status: "ACTIVE", _count: { _all: 3 }, _sum: { hours: 12 } },
      { status: "REDEEMED", _count: { _all: 1 }, _sum: { hours: 5 } },
      { status: "VOID", _count: { _all: 1 }, _sum: { hours: 2 } },
    ]);
    prismaMock.teachingHourCoupon.aggregate.mockResolvedValue({ _count: { _all: 1 }, _sum: { hours: 4 } });
    prismaMock.user.findMany.mockResolvedValue([{ userId: TUTOR_ID, displayName: "ครูเอ" }]);
  });

  it("is admin only", async () => {
    const res = createResponse();
    await getCoupons({ user: { role: "FINANCE_CHECKER" }, query: {} } as never, res as never);
    expect(res.statusCode).toBe(403);
  });

  it("pages, searches, sorts and returns usage stats by effective status", async () => {
    const res = createResponse();
    await getCoupons(
      { user: { role: "ADMIN" }, query: { page: "2", pageSize: "10", q: "TA-AA", sort: "hours", order: "asc", status: "active" } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    const args = prismaMock.teachingHourCoupon.findMany.mock.calls[0][0];
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(args.orderBy[0]).toEqual({ hours: "asc" });
    expect(args.where.AND[0].status).toBe("ACTIVE");
    expect(args.where.AND[1].OR[0]).toEqual({ code: { contains: "TA-AA", mode: "insensitive" } });
    const body = res.body as {
      coupons: Array<{ effectiveStatus: string; assignedTutorName: string }>;
      summary: { total: number; byStatus: Record<string, { count: number; hours: number }>; redemptionRate: number };
    };
    expect(body.coupons[0].effectiveStatus).toBe("EXPIRED");
    expect(body.coupons[0].assignedTutorName).toBe("ครูเอ");
    expect(body.summary.total).toBe(5);
    expect(body.summary.byStatus.ACTIVE).toEqual({ count: 2, hours: 8 });
    expect(body.summary.byStatus.EXPIRED).toEqual({ count: 1, hours: 4 });
    expect(body.summary.redemptionRate).toBeCloseTo(1 / 4);
  });

  it("sorts nullable columns with NULLs last", async () => {
    const res = createResponse();
    await getCoupons({ user: { role: "ADMIN" }, query: { sort: "expiresAt", order: "desc" } } as never, res as never);
    const args = prismaMock.teachingHourCoupon.findMany.mock.calls[0][0];
    expect(args.orderBy[0]).toEqual({ expiresAt: { sort: "desc", nulls: "last" } });
  });

  it("ignores unknown sort keys and statuses", async () => {
    const res = createResponse();
    await getCoupons({ user: { role: "ADMIN" }, query: { sort: "password", status: "BOGUS" } } as never, res as never);
    const args = prismaMock.teachingHourCoupon.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual([{ createdAt: "desc" }]);
    expect(args.where).toEqual({});
  });
});

describe("couponController.searchCouponTutors", () => {
  beforeEach(() => vi.clearAllMocks());

  it("searches active tutors by name/email and caps results", async () => {
    prismaMock.user.findMany.mockResolvedValue([{ userId: TUTOR_ID, displayName: "ครูเอ", email: "a@x.com" }]);
    const res = createResponse();
    await searchCouponTutors({ user: { role: "ADMIN" }, query: { q: "ครู" } } as never, res as never);
    expect(res.statusCode).toBe(200);
    const args = prismaMock.user.findMany.mock.calls[0][0];
    expect(args.where.role).toBe("TUTOR");
    expect(args.where.isActive).toBe(true);
    expect(args.take).toBe(10);
  });
});

describe("couponController.updateCoupon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.teachingHourCoupon.findUnique.mockResolvedValue({
      couponId: COUPON_ID,
      code: "TA-AAAA-BBBB",
      note: null,
      expiresAt: null,
      assignedTutorId: null,
      status: "ACTIVE",
    });
  });

  it("returns 409 when the coupon is no longer active", async () => {
    prismaMock.teachingHourCoupon.updateMany.mockResolvedValue({ count: 0 });
    const res = createResponse();
    await updateCoupon(
      { user: { userId: "admin", role: "ADMIN" }, params: { couponId: COUPON_ID }, body: { note: "new" } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(409);
    expect((res.body as { error: { code: string } }).error.code).toBe("COUPON_NOT_EDITABLE");
  });

  it("updates note/expiry of an ACTIVE coupon and audits before/after", async () => {
    prismaMock.teachingHourCoupon.updateMany.mockResolvedValue({ count: 1 });
    const res = createResponse();
    await updateCoupon(
      {
        user: { userId: "admin", role: "ADMIN" },
        params: { couponId: COUPON_ID },
        body: { note: "แคมเปญ", expiresAt: "2999-12-31T16:59:59.999Z" },
      } as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    const call = prismaMock.teachingHourCoupon.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ couponId: COUPON_ID, status: "ACTIVE" });
    expect(call.data.note).toBe("แคมเปญ");
    expect(call.data.expiresAt).toEqual(new Date("2999-12-31T16:59:59.999Z"));
    expect(prismaMock.auditEvent.create.mock.calls[0][0].data.action).toBe("COUPON_UPDATE");
  });

  it("rejects an empty update and a non-tutor assignee", async () => {
    const res = createResponse();
    await updateCoupon(
      { user: { userId: "admin", role: "ADMIN" }, params: { couponId: COUPON_ID }, body: {} } as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);

    prismaMock.user.findUnique.mockResolvedValue({ userId: TUTOR_ID, role: "STUDENT" });
    const res2 = createResponse();
    await updateCoupon(
      { user: { userId: "admin", role: "ADMIN" }, params: { couponId: COUPON_ID }, body: { assignedTutorId: TUTOR_ID } } as never,
      res2 as never,
    );
    expect(res2.statusCode).toBe(404);
    expect(prismaMock.teachingHourCoupon.updateMany).not.toHaveBeenCalled();
  });
});

describe("couponController.voidCoupon reason + audit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a too-short reason", async () => {
    const res = createResponse();
    await voidCoupon(
      { user: { userId: "admin", role: "ADMIN" }, params: { couponId: "c1" }, body: { reason: "no" } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect(prismaMock.teachingHourCoupon.updateMany).not.toHaveBeenCalled();
  });

  it("records the reason in a COUPON_VOID audit event", async () => {
    prismaMock.teachingHourCoupon.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.teachingHourCoupon.findUnique.mockResolvedValue({ couponId: "c1", code: "TA-X", hours: 3, status: "VOID" });
    const res = createResponse();
    await voidCoupon(
      { user: { userId: "admin", role: "ADMIN" }, params: { couponId: "c1" }, body: { reason: "ออกผิดครู" } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(prismaMock.auditEvent.create.mock.calls[0][0].data).toMatchObject({
      action: "COUPON_VOID",
      entityId: "c1",
      payload: { reason: "ออกผิดครู", hours: 3 },
    });
  });
});
