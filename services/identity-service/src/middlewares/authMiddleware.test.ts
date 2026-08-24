import jwt from "jsonwebtoken";
import { getJwtSecret } from "@tutor-advantage/shared-config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware, type AuthenticatedRequest } from "./authMiddleware";

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

describe("identity authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findUnique.mockImplementation(async ({ where }: { where: { userId: string } }) => ({
      userId: where.userId,
      role: "STUDENT",
      isActive: true,
    }));
  });

  it("rejects missing bearer tokens", async () => {
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

  it("loads the active user and ignores stale JWT role claims", async () => {
    const token = jwt.sign({ userId: "user-1", role: "STUDENT" }, getJwtSecret());
    const req = {
      id: "req-1",
      headers: { authorization: `Bearer ${token}` },
    } as AuthenticatedRequest;
    const res = createResponse();
    const next = vi.fn();

    prisma.user.findUnique.mockResolvedValue({
      userId: "user-1",
      role: "ADMIN",
      isActive: true,
    });
    await authMiddleware(req, res as never, next);

    expect(req.user).toMatchObject({ userId: "user-1", role: "ADMIN" });
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects a suspended user even when the JWT is still valid", async () => {
    const token = jwt.sign({ userId: "user-2", role: "STUDENT" }, getJwtSecret());
    const req = {
      id: "req-2",
      headers: { authorization: `Bearer ${token}` },
    } as AuthenticatedRequest;
    const res = createResponse();
    const next = vi.fn();

    prisma.user.findUnique.mockResolvedValue({
      userId: "user-2",
      role: "STUDENT",
      isActive: false,
    });
    await authMiddleware(req, res as never, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: "ACCOUNT_SUSPENDED" }),
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts the HttpOnly session cookie used by same-origin proxies", async () => {
    const token = jwt.sign({ userId: "user-2", role: "STUDENT" }, getJwtSecret());
    const req = {
      id: "req-2",
      headers: { cookie: `student-session=${token}` },
    } as AuthenticatedRequest;
    const res = createResponse();
    const next = vi.fn();

    await authMiddleware(req, res as never, next);

    expect(req.user).toMatchObject({ userId: "user-2", role: "STUDENT" });
    expect(next).toHaveBeenCalledOnce();
  });
});
