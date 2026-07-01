import { describe, expect, it } from "vitest";
import {
  areDevRoutesEnabled,
  assertProductionSecurityConfig,
  getAllowedOrigins,
  getJwtSecret,
  isOriginAllowed,
} from "./securityConfig";

describe("security configuration", () => {
  it("fails closed when production secrets or origins are missing", () => {
    expect(() => getJwtSecret({ NODE_ENV: "production" })).toThrow(
      "JWT_SECRET",
    );
    expect(() =>
      getJwtSecret({
        NODE_ENV: "production",
        JWT_SECRET: "short",
      }),
    ).toThrow("JWT_SECRET");
    expect(() =>
      getAllowedOrigins({ NODE_ENV: "production" }),
    ).toThrow("ALLOWED_ORIGINS");
    expect(() =>
      assertProductionSecurityConfig({
        NODE_ENV: "production",
        JWT_SECRET: "a-secure-production-secret-with-32-characters",
      }),
    ).toThrow("ALLOWED_ORIGINS");
  });

  it("enables dev routes only through an explicit non-production flag", () => {
    expect(areDevRoutesEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(
      areDevRoutesEnabled({
        NODE_ENV: "development",
        ENABLE_DEV_ROUTES: "true",
      }),
    ).toBe(true);
    expect(
      areDevRoutesEnabled({
        NODE_ENV: "production",
        ENABLE_DEV_ROUTES: "true",
      }),
    ).toBe(false);
  });

  it("does not allow arbitrary or ngrok origins by default", () => {
    const allowed = getAllowedOrigins({ NODE_ENV: "development" });
    expect(
      isOriginAllowed("https://attacker.example", allowed, {
        NODE_ENV: "development",
      }),
    ).toBe(false);
    expect(
      isOriginAllowed("https://demo.ngrok-free.app", allowed, {
        NODE_ENV: "development",
      }),
    ).toBe(false);
    expect(
      isOriginAllowed("https://demo.ngrok-free.app", allowed, {
        NODE_ENV: "development",
        ALLOW_NGROK_ORIGINS: "true",
      }),
    ).toBe(true);
  });
});
