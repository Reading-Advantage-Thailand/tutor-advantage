import jwt from "jsonwebtoken";
import { getJwtSecret } from "@tutor-advantage/shared-config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authMiddleware,
  requireRoles,
  type AuthenticatedRequest,
} from "./authMiddleware";

const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("finance authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findUnique.mockImplementation(async ({ where }: { where: { userId: string } }) => ({
      userId: where.userId,
      role: "ADMIN",
      isActive: true,
    }));
  });

  it("rejects requests without a bearer token", async () => {
    const req = { id: "req-1", headers: {} } as AuthenticatedRequest;
    const res = createResponse();
    const next = vi.fn();

    await authMiddleware(req, res as never, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid Authorization header",
        requestId: "req-1",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches the current database role and continues", async () => {
    const token = jwt.sign({ userId: "user-1", role: "ADMIN" }, getJwtSecret());
    const req = {
      id: "req-1",
      headers: { authorization: `Bearer ${token}` },
    } as AuthenticatedRequest;
    const res = createResponse();
    const next = vi.fn();

    await authMiddleware(req, res as never, next);

    expect(req.user).toMatchObject({ userId: "user-1", role: "ADMIN" });
    expect(next).toHaveBeenCalledOnce();
  });

  it("blocks suspended accounts before finance authorization runs", async () => {
    const token = jwt.sign({ userId: "user-2", role: "ADMIN" }, getJwtSecret());
    const req = {
      id: "req-2",
      headers: { authorization: `Bearer ${token}` },
    } as AuthenticatedRequest;
    const res = createResponse();
    const next = vi.fn();

    prisma.user.findUnique.mockResolvedValue({
      userId: "user-2",
      role: "ADMIN",
      isActive: false,
    });
    await authMiddleware(req, res as never, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: "ACCOUNT_SUSPENDED" }),
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireRoles", () => {
  const adminOrChecker = requireRoles("ADMIN", "FINANCE_CHECKER");

  it.each(["ADMIN", "FINANCE_CHECKER"])("allows %s", (role) => {
    const req = {
      id: "req-2",
      user: { userId: "user-1", role },
    } as AuthenticatedRequest;
    const res = createResponse();
    const next = vi.fn();

    adminOrChecker(req, res as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each(["STUDENT", "TUTOR", "FINANCE_MAKER"])("rejects %s", (role) => {
    const req = {
      id: "req-3",
      user: { userId: "user-1", role },
    } as AuthenticatedRequest;
    const res = createResponse();
    const next = vi.fn();

    adminOrChecker(req, res as never, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "FORBIDDEN",
        message: "You do not have permission to access this resource",
        requestId: "req-3",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a request without an authenticated user", () => {
    const req = { id: "req-4" } as AuthenticatedRequest;
    const res = createResponse();
    const next = vi.fn();

    adminOrChecker(req, res as never, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
