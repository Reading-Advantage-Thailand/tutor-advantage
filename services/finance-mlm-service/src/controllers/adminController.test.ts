import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  settlementRun: { count: vi.fn(), findFirst: vi.fn() },
  adjustment: { count: vi.fn(), findFirst: vi.fn() },
  user: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  exception: { count: vi.fn(), findFirst: vi.fn() },
  fraudFlag: { count: vi.fn(), findFirst: vi.fn() },
  auditEvent: { findMany: vi.fn() },
  paymentIntent: { aggregate: vi.fn() },
  payoutLine: { aggregate: vi.fn() },
}));
vi.mock("@tutor-advantage/database", () => ({ prisma: prismaMock }));

import { getAdminOverview } from "./adminController";

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

describe("getAdminOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.settlementRun.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    prismaMock.adjustment.count.mockResolvedValue(2);
    prismaMock.user.count.mockResolvedValue(4);
    prismaMock.exception.count.mockResolvedValue(5);
    prismaMock.fraudFlag.count.mockResolvedValueOnce(6).mockResolvedValueOnce(2);
    prismaMock.auditEvent.findMany.mockResolvedValue([
      { auditEventId: "e1", actorId: "ad000000-1111-4000-8000-000000000001", action: "SUBMIT", entityType: "SettlementRun", entityId: "r1", payload: { periodMonth: "2026-08" }, createdAt: new Date("2026-10-01T00:00:00Z") },
    ]);
    prismaMock.user.findMany.mockResolvedValue([{ userId: "ad000000-1111-4000-8000-000000000001", displayName: "Finance Admin", email: "a@x" }]);
    prismaMock.paymentIntent.aggregate.mockResolvedValue({ _count: { _all: 7 }, _sum: { amountMinor: 1234500n } });
    prismaMock.payoutLine.aggregate.mockResolvedValue({ _count: { _all: 3 }, _sum: { netPayoutMinor: 99900n } });
    prismaMock.settlementRun.findFirst.mockResolvedValue({ createdAt: new Date("2026-09-01T00:00:00Z"), periodMonth: "2026-08" });
    prismaMock.adjustment.findFirst.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.exception.findFirst.mockResolvedValue(null);
    prismaMock.fraudFlag.findFirst.mockResolvedValue(null);
  });

  it("returns queues, KPIs and named activity in one response", async () => {
    const res = createResponse();
    await getAdminOverview({ id: "r" } as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      workQueues: { settlements: 1, adjustments: 2, verifications: 4, exceptions: 5, fraudFlags: 6 },
      kpis: {
        paymentsLast30Days: { count: 7, amountSatang: 1234500 },
        awaitingApproval: { runs: 1, payoutLines: 3, netPayoutSatang: 99900, oldestPeriodMonth: "2026-08" },
        highSeverityFraudFlags: 2,
      },
      queueOldest: { settlements: "2026-09-01T00:00:00.000Z", adjustments: null },
      recentActivity: [{ actionType: "SUBMIT", actorName: "Finance Admin", periodMonth: "2026-08" }],
    });
    // Verification queue counts tutors only.
    expect(prismaMock.user.count).toHaveBeenCalledWith({ where: { role: "TUTOR", verificationStatus: "PENDING" } });
  });
});
