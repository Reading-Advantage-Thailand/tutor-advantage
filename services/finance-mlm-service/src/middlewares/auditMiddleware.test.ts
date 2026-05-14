import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditTrailMiddleware } from "./auditMiddleware";
import type { AuthenticatedRequest } from "./authMiddleware";

const { auditCreate } = vi.hoisted(() => ({
  auditCreate: vi.fn(),
}));

vi.mock("@tutor-advantage/database", () => ({
  prisma: {
    auditEvent: {
      create: auditCreate,
    },
  },
}));

describe("auditTrailMiddleware", () => {
  beforeEach(() => {
    auditCreate.mockResolvedValue({});
  });

  it("writes an audit event when a successful response is sent", () => {
    const req = {
      user: { userId: "admin-1", role: "ADMIN" },
      params: { snapshotId: "settlement-1" },
      body: { approved: true },
      ip: "127.0.0.1",
    } as unknown as AuthenticatedRequest;
    const originalJson = vi.fn();
    const res = {
      statusCode: 200,
      json: originalJson,
    };
    const next = vi.fn();

    auditTrailMiddleware("APPROVE_SETTLEMENT")(req, res as never, next);
    res.json({ ok: true });

    expect(next).toHaveBeenCalledOnce();
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "admin-1",
        action: "APPROVE_SETTLEMENT",
        entityId: "settlement-1",
      }),
    });
    expect(originalJson).toHaveBeenCalledWith({ ok: true });
  });

  it("does not write audit events for failed responses", () => {
    const req = {
      user: { userId: "admin-1", role: "ADMIN" },
      params: {},
      body: {},
    } as unknown as AuthenticatedRequest;
    const res = {
      statusCode: 400,
      json: vi.fn(),
    };

    auditTrailMiddleware("FAILED_ACTION")(req, res as never, vi.fn());
    res.json({ ok: false });

    expect(auditCreate).not.toHaveBeenCalled();
  });
});
