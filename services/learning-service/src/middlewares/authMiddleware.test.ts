import jwt from "jsonwebtoken";
import { getJwtSecret } from "@tutor-advantage/shared-config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware, type AuthenticatedRequest } from "./authMiddleware";

const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}));

vi.mock("@tutor-advantage/database", () => ({ prisma }));

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("learning authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      userId: "user-1",
      role: "STUDENT",
      isActive: true,
    });
  });

  it("uses the active database role instead of the JWT role", async () => {
    const token = jwt.sign({ userId: "user-1", role: "STUDENT" }, getJwtSecret());
    const req = {
      id: "req-1",
      headers: { authorization: `Bearer ${token}` },
    } as AuthenticatedRequest;
    const res = response();
    const next = vi.fn();

    prisma.user.findUnique.mockResolvedValue({
      userId: "user-1",
      role: "TUTOR",
      isActive: true,
    });
    await authMiddleware(req, res as never, next);

    expect(req.user).toEqual({ userId: "user-1", role: "TUTOR" });
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects suspended students before enrollment routes run", async () => {
    const token = jwt.sign({ userId: "user-1", role: "STUDENT" }, getJwtSecret());
    const req = {
      id: "req-1",
      headers: { authorization: `Bearer ${token}` },
    } as AuthenticatedRequest;
    const res = response();
    const next = vi.fn();

    prisma.user.findUnique.mockResolvedValue({
      userId: "user-1",
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
});
