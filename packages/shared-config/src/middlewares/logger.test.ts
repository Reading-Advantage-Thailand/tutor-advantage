import { describe, expect, it, vi } from "vitest";
import {
  getSafeRequestPath,
  hashIdentifier,
  redactLogValue,
  redactSensitiveText,
  requestLoggerMiddleware,
  logger,
} from "./logger";

describe("secure logging helpers", () => {
  it("redacts credentials from messages and URLs", () => {
    const message =
      "postgresql://db-user:db-password@example.test:5432/app?sslmode=require " +
      "Bearer jwt-secret student-session=session-secret?token=ref-secret";

    const redacted = redactSensitiveText(message);

    expect(redacted).not.toContain("db-password");
    expect(redacted).not.toContain("jwt-secret");
    expect(redacted).not.toContain("session-secret");
    expect(redacted).toContain("[REDACTED_DATABASE_URL]");
    expect(redacted).toContain("Bearer [REDACTED]");
    expect(redacted).toContain("student-session=[REDACTED]");
  });

  it("hashes identifiers and redacts sensitive metadata keys", () => {
    expect(
      redactLogValue({ userId: "user-1", lineUserId: "line-1", token: "secret" }),
    ).toEqual({
      userId: hashIdentifier("user-1"),
      lineUserId: hashIdentifier("line-1"),
      token: "[REDACTED]",
    });
  });

  it("logs matched Express route templates without query strings", () => {
    const req = {
      baseUrl: "",
      route: { path: "/v1/enroll/:referralToken" },
      originalUrl: "/v1/enroll/secret-token/details?referralToken=secret-token",
      url: "/v1/enroll/secret-token/details?referralToken=secret-token",
    };

    expect(getSafeRequestPath(req as never)).toBe("/v1/enroll/:referralToken");
  });

  it("redacts dynamic values when no Express route matched", () => {
    const req = {
      route: undefined,
      originalUrl: "/v1/enroll/secret-token/details?referralToken=secret-token",
      url: "/v1/enroll/secret-token/details?referralToken=secret-token",
    };

    expect(getSafeRequestPath(req as never)).toBe("/v1/enroll/:redacted/details");
  });

  it("uses the first string when Express provides multiple route paths", () => {
    const req = {
      baseUrl: "/v1",
      route: { path: [/ignored/, "/users/:userId"] },
    };

    expect(getSafeRequestPath(req as never)).toBe("/v1/users/:userId");
  });

  it("logs a safe access record after the response finishes", () => {
    let finish: (() => void) | undefined;
    const res = {
      statusCode: 204,
      on: vi.fn((event: string, handler: () => void) => {
        if (event === "finish") finish = handler;
        return res;
      }),
    };
    const req = {
      method: "GET",
      baseUrl: "",
      route: { path: "/v1/health" },
      id: "req-1",
      ip: "127.0.0.1",
    };
    const info = vi.spyOn(logger, "info");
    const next = vi.fn();

    requestLoggerMiddleware(req as never, res as never, next);
    finish?.();

    expect(next).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledWith(
      "HTTP Access",
      expect.objectContaining({
        method: "GET",
        url: "/v1/health",
        status: 204,
        requestId: "req-1",
        ip: "127.0.0.1",
      }),
    );
  });
});
