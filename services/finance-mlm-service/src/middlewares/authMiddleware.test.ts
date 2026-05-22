import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import { authMiddleware, type AuthenticatedRequest } from "./authMiddleware";

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("finance authMiddleware", () => {
  it("rejects requests without a bearer token", () => {
    const req = { id: "req-1", headers: {} } as AuthenticatedRequest;
    const res = createResponse();
    const next = vi.fn();

    authMiddleware(req, res as never, next);

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

  it("attaches the decoded JWT payload and continues", () => {
    const token = jwt.sign({ userId: "user-1", role: "ADMIN" }, "secret-for-dev-only-change-me");
    const req = {
      id: "req-1",
      headers: { authorization: `Bearer ${token}` },
    } as AuthenticatedRequest;
    const res = createResponse();
    const next = vi.fn();

    authMiddleware(req, res as never, next);

    expect(req.user).toMatchObject({ userId: "user-1", role: "ADMIN" });
    expect(next).toHaveBeenCalledOnce();
  });
});
