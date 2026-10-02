import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeResolution, resolveException, statusForResolution } from "./operationsController";

const prismaMock = vi.hoisted(() => {
  const mock: Record<string, any> = {
    exception: { findUnique: vi.fn(), updateMany: vi.fn() },
    enrollment: { findMany: vi.fn() },
    paymentIntent: { findMany: vi.fn() },
    auditEvent: { create: vi.fn() },
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

const EXC = "5eed0000-0000-4000-8000-000000000e03";
const STUDENT = "5eed0000-0000-4000-8000-000000000203";
const CLASS = "5eed0000-0000-4000-8000-000000000401";

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

const req = (action: string, body: Record<string, unknown>) =>
  ({ id: "r", params: { id: EXC, action }, body, user: { userId: "admin-1", role: "ADMIN" } }) as any;

describe("operationsController exceptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock));
  });

  it("maps resolutions and legacy actions honestly", () => {
    expect(normalizeResolution("VOID_CANCEL")).toBe("DISMISS");
    expect(normalizeResolution("FORCE_ACTIVE")).toBeNull();
    expect(normalizeResolution("mark resolved")).toBe("MARK_RESOLVED");
    expect(statusForResolution("DISMISS")).toBe("VOIDED");
    expect(statusForResolution("ACTIVATE_ENROLLMENT")).toBe("RESOLVED");
  });

  it("rejects the old FORCE_ACTIVE action that never activated anything", async () => {
    const res = createResponse();
    await resolveException(req("FORCE_ACTIVE", { note: "ทดสอบการปิดเคส" }), res as any);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("UNSUPPORTED_EXCEPTION_ACTION");
  });

  it("requires a note", async () => {
    const res = createResponse();
    await resolveException(req("resolve", { resolution: "MARK_RESOLVED" }), res as any);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("REASON_REQUIRED");
  });

  it("refuses ACTIVATE_ENROLLMENT without a successful payment", async () => {
    prismaMock.exception.findUnique.mockResolvedValue({ exceptionId: EXC, status: "UNRESOLVED", studentUserId: STUDENT, classId: CLASS, type: "ENROLLMENT_ACTIVATION_FAILED" });
    prismaMock.enrollment.findMany.mockResolvedValue([{ enrollmentId: "e1", studentUserId: STUDENT, classId: CLASS, status: "PENDING_PAYMENT", class: { title: "x" } }]);
    prismaMock.paymentIntent.findMany.mockResolvedValue([{ paymentIntentId: "p1", enrollmentId: "e1", status: "FAILED", amountMinor: 1n, providerRef: null }]);
    const res = createResponse();
    await resolveException(req("resolve", { resolution: "ACTIVATE_ENROLLMENT", note: "เปิดสิทธิ์ให้นักเรียน" }), res as any);
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe("NO_SUCCESSFUL_PAYMENT");
    expect(prismaMock.exception.updateMany).not.toHaveBeenCalled();
  });

  it("closes a case with a note and audit event, status-guarded", async () => {
    prismaMock.exception.findUnique.mockResolvedValue({ exceptionId: EXC, status: "UNRESOLVED", type: "REFUND_REQUESTED" });
    prismaMock.exception.updateMany.mockResolvedValue({ count: 1 });
    const res = createResponse();
    await resolveException(req("resolve", { resolution: "MARK_RESOLVED", note: "คืนเงินใน Omise แล้ว rfnd_1" }), res as any);
    expect(res.statusCode).toBe(200);
    expect(prismaMock.exception.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { exceptionId: EXC, status: "UNRESOLVED" } }),
    );
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "EXCEPTION_MARK_RESOLVED", payload: expect.objectContaining({ note: "คืนเงินใน Omise แล้ว rfnd_1" }) }),
      }),
    );
  });

  it("returns 409 when closing an already closed case differently", async () => {
    prismaMock.exception.findUnique.mockResolvedValue({ exceptionId: EXC, status: "VOIDED", type: "X" });
    const res = createResponse();
    await resolveException(req("resolve", { resolution: "MARK_RESOLVED", note: "ปิดเคสซ้ำ" }), res as any);
    expect(res.statusCode).toBe(409);
  });
});
