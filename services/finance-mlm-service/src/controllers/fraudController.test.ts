import { beforeEach, describe, expect, it, vi } from "vitest";
import { shouldReactivateOnRelease, triggerFraudAction } from "./fraudController";

const prismaMock = vi.hoisted(() => {
  const mock: Record<string, any> = {
    fraudFlag: { findUnique: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    user: { findUnique: vi.fn(), updateMany: vi.fn() },
    auditEvent: { create: vi.fn(), findFirst: vi.fn() },
  };
  mock.$transaction = vi.fn((fn: (tx: unknown) => unknown) => fn(mock));
  return mock;
});

vi.mock("@tutor-advantage/database", () => ({ prisma: prismaMock }));
vi.mock("./paymentController", () => ({
  fulfillPaymentIntent: vi.fn(),
  markPaymentIntentFailed: vi.fn(),
  retrieveAndVerifyOmiseCharge: vi.fn(),
}));

const FLAG = "5eed0000-0000-4000-8000-000000000f01";
const TUTOR = "5eed0000-0000-4000-8000-000000000102";

function createResponse() {
  const res = {
    statusCode: 200,
    body: undefined as any,
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

function request(role: string, body: Record<string, unknown>) {
  return { id: "req", params: { id: FLAG }, body, user: { userId: "admin-1", role } } as any;
}

describe("fraudController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock));
    prismaMock.fraudFlag.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.auditEvent.create.mockResolvedValue({});
  });

  it("FREEZE suspends the target account and audits USER_SUSPEND", async () => {
    prismaMock.fraudFlag.findUnique.mockResolvedValue({ flagId: FLAG, status: "INVESTIGATING", targetId: TUTOR, type: "SELF_REFERRAL" });
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ userId: TUTOR, role: "TUTOR", isActive: true })
      .mockResolvedValueOnce({ userId: TUTOR, isActive: false });
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });

    const res = createResponse();
    await triggerFraudAction(request("ADMIN", { action: "FREEZE", reason: "บัญชีซ้ำกับผู้แนะนำ" }), res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ flag: { status: "FROZEN" }, user: { isActive: false }, userChanged: true });
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: TUTOR, isActive: true }, data: expect.objectContaining({ isActive: false }) }),
    );
    const actions = prismaMock.auditEvent.create.mock.calls.map((c: any[]) => c[0].data.action);
    expect(actions).toEqual(["USER_SUSPEND", "FRAUD_FREEZE"]);
  });

  it("refuses FREEZE for a finance checker", async () => {
    prismaMock.fraudFlag.findUnique.mockResolvedValue({ flagId: FLAG, status: "INVESTIGATING", targetId: TUTOR });
    const res = createResponse();
    await triggerFraudAction(request("FINANCE_CHECKER", { action: "FREEZE", reason: "บัญชีซ้ำกับผู้แนะนำ" }), res as any);
    expect(res.statusCode).toBe(403);
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });

  it("requires a reason", async () => {
    const res = createResponse();
    await triggerFraudAction(request("ADMIN", { action: "CLEAR" }), res as any);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("REASON_REQUIRED");
  });

  it("refuses to suspend staff accounts", async () => {
    prismaMock.fraudFlag.findUnique.mockResolvedValue({ flagId: FLAG, status: "INVESTIGATING", targetId: TUTOR });
    prismaMock.user.findUnique.mockResolvedValueOnce({ userId: TUTOR, role: "ADMIN", isActive: true });
    const res = createResponse();
    await triggerFraudAction(request("ADMIN", { action: "FREEZE", reason: "ทดสอบการระงับ" }), res as any);
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe("CANNOT_SUSPEND_STAFF");
  });

  it("UNFREEZE re-activates the account only when this freeze suspended it", async () => {
    prismaMock.fraudFlag.findUnique.mockResolvedValue({ flagId: FLAG, status: "FROZEN", targetId: TUTOR, type: "X" });
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ userId: TUTOR, role: "TUTOR", isActive: false })
      .mockResolvedValueOnce({ userId: TUTOR, isActive: true });
    prismaMock.auditEvent.findFirst.mockResolvedValue({
      action: "USER_SUSPEND",
      payload: { source: "FRAUD_FREEZE", flagId: FLAG },
    });
    prismaMock.fraudFlag.count.mockResolvedValue(0);
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });

    const res = createResponse();
    await triggerFraudAction(request("ADMIN", { action: "UNFREEZE", reason: "ตรวจสอบแล้วไม่พบความผิด" }), res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ flag: { status: "INVESTIGATING" }, userChanged: true, userNote: "RELEASED" });
  });

  it("decides re-activation conservatively", () => {
    const freezeEvent = { action: "USER_SUSPEND", payload: { source: "FRAUD_FREEZE", flagId: "f1" } };
    expect(shouldReactivateOnRelease({ userIsActive: false, flagId: "f1", latestUserStatusEvent: freezeEvent, otherFrozenFlags: 0 }).reactivate).toBe(true);
    expect(shouldReactivateOnRelease({ userIsActive: false, flagId: "f1", latestUserStatusEvent: freezeEvent, otherFrozenFlags: 1 })).toEqual({ reactivate: false, reason: "OTHER_FROZEN_FLAGS" });
    expect(shouldReactivateOnRelease({ userIsActive: false, flagId: "f2", latestUserStatusEvent: freezeEvent, otherFrozenFlags: 0 }).reason).toBe("SUSPENDED_ELSEWHERE");
    expect(shouldReactivateOnRelease({ userIsActive: false, flagId: "f1", latestUserStatusEvent: { action: "USER_SUSPEND", payload: {} }, otherFrozenFlags: 0 }).reason).toBe("SUSPENDED_ELSEWHERE");
    expect(shouldReactivateOnRelease({ userIsActive: true, flagId: "f1", latestUserStatusEvent: null, otherFrozenFlags: 0 }).reason).toBe("ALREADY_ACTIVE");
  });
});
