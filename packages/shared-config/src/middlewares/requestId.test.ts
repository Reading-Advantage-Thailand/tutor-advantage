import { describe, expect, it, vi } from "vitest";
import { requestIdMiddleware } from "./requestId";

describe("requestIdMiddleware", () => {
  it("reuses an incoming request id header", () => {
    const req = { headers: { "x-request-id": "req-incoming" } };
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    requestIdMiddleware(req as never, res as never, next);

    expect(req).toMatchObject({ id: "req-incoming" });
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-Id", "req-incoming");
    expect(next).toHaveBeenCalledOnce();
  });

  it("generates a request id when no header exists", () => {
    const req = { headers: {} };
    const res = { setHeader: vi.fn() };
    const next = vi.fn();

    requestIdMiddleware(req as never, res as never, next);

    expect(typeof (req as { id: string }).id).toBe("string");
    expect((req as { id: string }).id.length).toBeGreaterThan(0);
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-Id", (req as { id: string }).id);
  });
});
