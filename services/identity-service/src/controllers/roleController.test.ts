import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const mock = {
    user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn(), create: vi.fn() },
    auditEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return mock;
});

vi.mock("@tutor-advantage/database", () => ({ prisma: prismaMock }));

import { decideRoleChange, upsertSystemRole } from "./roleController";

const ACTOR = "ad000000-1111-4000-8000-000000000001";

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

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
});

describe("decideRoleChange", () => {
  const staff = (role: string, isActive = true, userId = "u2") => ({ userId, role, isActive });

  it("never gives a staff role to a student or tutor account", () => {
    for (const role of ["STUDENT", "TUTOR", "GUARDIAN"]) {
      const d = decideRoleChange({ actorId: ACTOR, current: staff(role), targetRole: "ADMIN", targetActive: true, otherActiveAdmins: 2 });
      expect(d).toMatchObject({ ok: false, code: "ROLE_TRANSITION_NOT_ALLOWED" });
    }
  });

  it("pre-provisions a new email", () => {
    expect(decideRoleChange({ actorId: ACTOR, current: null, targetRole: "FINANCE_CHECKER", targetActive: true, otherActiveAdmins: 1 })).toEqual({ ok: true, kind: "CREATE" });
  });

  it("blocks removing the last active admin (demote or revoke)", () => {
    expect(decideRoleChange({ actorId: ACTOR, current: staff("ADMIN"), targetRole: "FINANCE_CHECKER", targetActive: true, otherActiveAdmins: 0 })).toMatchObject({ ok: false, code: "LAST_ADMIN" });
    expect(decideRoleChange({ actorId: ACTOR, current: staff("ADMIN"), targetRole: "ADMIN", targetActive: false, otherActiveAdmins: 0 })).toMatchObject({ ok: false, code: "LAST_ADMIN" });
    expect(decideRoleChange({ actorId: ACTOR, current: staff("ADMIN"), targetRole: "FINANCE_CHECKER", targetActive: true, otherActiveAdmins: 1 })).toEqual({ ok: true, kind: "CHANGE" });
  });

  it("blocks changing your own role", () => {
    expect(decideRoleChange({ actorId: ACTOR, current: staff("ADMIN", true, ACTOR), targetRole: "FINANCE_CHECKER", targetActive: true, otherActiveAdmins: 3 })).toMatchObject({ ok: false, code: "CANNOT_CHANGE_SELF" });
  });

  it("classifies grant / revoke / restore / unchanged", () => {
    expect(decideRoleChange({ actorId: ACTOR, current: staff("FINANCE_CHECKER"), targetRole: "ADMIN", targetActive: true, otherActiveAdmins: 1 })).toEqual({ ok: true, kind: "GRANT" });
    expect(decideRoleChange({ actorId: ACTOR, current: staff("FINANCE_CHECKER"), targetRole: "FINANCE_CHECKER", targetActive: false, otherActiveAdmins: 1 })).toEqual({ ok: true, kind: "REVOKE" });
    expect(decideRoleChange({ actorId: ACTOR, current: staff("FINANCE_CHECKER", false), targetRole: "FINANCE_CHECKER", targetActive: true, otherActiveAdmins: 1 })).toEqual({ ok: true, kind: "RESTORE" });
    expect(decideRoleChange({ actorId: ACTOR, current: staff("ADMIN"), targetRole: "ADMIN", targetActive: true, otherActiveAdmins: 0 })).toEqual({ ok: true, kind: "UNCHANGED" });
  });
});

describe("upsertSystemRole", () => {
  const req = (body: Record<string, unknown>, role = "ADMIN") => ({ user: { userId: ACTOR, role }, body });

  it("requires ADMIN and a reason", async () => {
    const res = createResponse();
    await upsertSystemRole(req({ email: "a@b.co", role: "ADMIN" }, "FINANCE_CHECKER") as never, res as never);
    expect(res.statusCode).toBe(403);
    const res2 = createResponse();
    await upsertSystemRole(req({ email: "a@b.co", role: "ADMIN" }) as never, res2 as never);
    expect(res2.statusCode).toBe(400);
    expect(res2.body.error.code).toBe("REASON_REQUIRED");
  });

  it("refuses TUTOR as a target role (no learner roles from this page)", async () => {
    const res = createResponse();
    await upsertSystemRole(req({ email: "a@b.co", role: "TUTOR", reason: "ย้ายงาน" }) as never, res as never);
    expect(res.statusCode).toBe(400);
  });

  it("refuses promoting a student and writes nothing", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ userId: "s1", role: "STUDENT", isActive: true });
    prismaMock.user.count.mockResolvedValueOnce(2);
    const res = createResponse();
    await upsertSystemRole(req({ email: "kid@example.com", role: "ADMIN", reason: "ทดสอบสิทธิ์" }) as never, res as never);
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe("ROLE_TRANSITION_NOT_ALLOWED");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
  });

  it("changes a staff role and audits it in the same transaction", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ userId: "c1", role: "FINANCE_CHECKER", isActive: true, email: "c@x.co" });
    prismaMock.user.count.mockResolvedValueOnce(1);
    prismaMock.user.update.mockResolvedValueOnce({ userId: "c1", role: "ADMIN", isActive: true, email: "c@x.co", displayName: "C" });
    const res = createResponse();
    await upsertSystemRole(req({ email: "C@x.co", role: "ADMIN", reason: "รับหน้าที่ผู้ดูแล" }) as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body.change).toBe("GRANT");
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ROLE_CHANGE",
        entityId: "c1",
        payload: expect.objectContaining({ kind: "GRANT", fromRole: "FINANCE_CHECKER", toRole: "ADMIN", reason: "รับหน้าที่ผู้ดูแล" }),
      }),
    });
  });
});
