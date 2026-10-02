import { describe, expect, it } from "vitest";
import { loginErrorCode, safeNextPath } from "./loginParams";

describe("safeNextPath", () => {
  it("keeps same-origin relative paths with query and hash", () => {
    expect(safeNextPath("/settlements")).toBe("/settlements");
    expect(safeNextPath("/coupons?status=ACTIVE&page=2#top")).toBe("/coupons?status=ACTIVE&page=2#top");
    expect(safeNextPath(["/users/abc", "/x"])).toBe("/users/abc");
  });

  it("rejects absolute, protocol-relative and backslash URLs", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example/x",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "settlements",
      "/%0d%0aSet-Cookie:x",
      "/\u0000x",
      "/\tevil",
    ]) {
      const result = safeNextPath(bad);
      expect(result.startsWith("//"), bad).toBe(false);
      expect(result.startsWith("/"), bad).toBe(true);
      expect(result.includes("evil.example") && !result.startsWith("/"), bad).toBe(false);
    }
    expect(safeNextPath("//evil.example/x")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
  });

  it("never loops back to auth pages or APIs", () => {
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath("/login?next=/x")).toBe("/");
    expect(safeNextPath("/unauthorized")).toBe("/");
    expect(safeNextPath("/api/auth/logout")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });
});

describe("loginErrorCode", () => {
  it("maps known codes and buckets the rest as unknown", () => {
    expect(loginErrorCode("email_not_verified")).toBe("email_not_verified");
    expect(loginErrorCode("google_token_failed")).toBe("google_token_failed");
    expect(loginErrorCode("<script>")).toBe("unknown");
    expect(loginErrorCode(undefined)).toBeNull();
  });
});
