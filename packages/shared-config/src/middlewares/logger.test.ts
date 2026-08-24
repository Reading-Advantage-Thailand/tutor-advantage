import { describe, expect, it } from "vitest";
import {
  getSafeRequestPath,
  hashIdentifier,
  redactLogValue,
  redactSensitiveText,
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
});
