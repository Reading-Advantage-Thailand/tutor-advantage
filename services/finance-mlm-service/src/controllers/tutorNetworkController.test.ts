import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTutorNetwork } from "./tutorNetworkController";

const prisma = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
  class: { findMany: vi.fn() },
  enrollment: { findMany: vi.fn() },
  paymentIntent: { findMany: vi.fn() },
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));

function tutor(userId: string, sponsorTutorId: string | null) {
  return {
    userId,
    displayName: userId,
    email: null,
    sponsorTutorId,
    sponsorLockedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

async function callAs(userId: string) {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  await getTutorNetwork(
    { user: { userId }, query: { periodMonth: "2026-05" } } as never,
    res as never,
  );
  return res.json.mock.calls[0][0];
}

describe("tutor network estimated payout", () => {
  beforeEach(() => {
    vi.stubEnv("COMMISSION_BASE_RATE", "0.5");
    // gp -> p -> (c1, c2). p has no own sales this month.
    prisma.user.findMany.mockResolvedValue([
      tutor("gp", null),
      tutor("p", "gp"),
      tutor("c1", "p"),
      tutor("c2", "p"),
    ]);
    const sellers = ["gp", "c1", "c2"];
    prisma.class.findMany.mockResolvedValue(
      sellers.map((id) => ({ classId: `class-${id}`, tutorUserId: id })),
    );
    prisma.enrollment.findMany.mockResolvedValue(
      sellers.map((id) => ({ enrollmentId: `en-${id}`, classId: `class-${id}` })),
    );
    prisma.paymentIntent.findMany.mockResolvedValue(
      sellers.map((id) => ({ enrollmentId: `en-${id}`, amountMinor: 1_000_000n })),
    );
  });

  it("shows 0 for a sponsor without own sales and rolls the share up, like settlement", async () => {
    const body = await callAs("gp");
    const p = body.networkTree.children[0];

    expect(p.estimatedPayoutTHB).toBe(0);
    expect(p.children.map((c: { estimatedPayoutTHB: number }) => c.estimatedPayoutTHB))
      .toEqual([4_500, 4_500]);
    // R(30,000) x 30,000 = 16,681.93, minus 9,000 paid below.
    expect(body.summary.estimatedPayoutTHB).toBe(7_681.93);
  });
});
