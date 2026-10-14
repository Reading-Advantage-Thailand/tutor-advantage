import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { devRoutesEnabled, getAppEnvironment, signAdminToken, verifyAdminToken } from "./security";

describe("security helpers", () => {
  beforeEach(() => vi.stubEnv("JWT_SECRET", "test-secret-that-is-long-enough-for-hs256-0123456789"));
  afterEach(() => vi.unstubAllEnvs());

  it("dev routes are opt-in and never in production", () => {
    expect(devRoutesEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(devRoutesEnabled({ NODE_ENV: "development", ENABLE_DEV_ROUTES: "1" })).toBe(false);
    expect(devRoutesEnabled({ NODE_ENV: "development", ENABLE_DEV_ROUTES: "true" })).toBe(true);
    expect(devRoutesEnabled({ NODE_ENV: "production", ENABLE_DEV_ROUTES: "true" })).toBe(false);
  });

  it("round-trips an admin session", async () => {
    const token = await signAdminToken({ userId: "u1", role: "FINANCE_CHECKER", email: "c@example.com", name: "C" });
    await expect(verifyAdminToken(token)).resolves.toEqual({ userId: "u1", role: "FINANCE_CHECKER", email: "c@example.com", name: "C" });
    await expect(verifyAdminToken(`${token}x`)).resolves.toBeNull();
    await expect(verifyAdminToken(undefined)).resolves.toBeNull();
  });

  it("labels the environment", () => {
    expect(getAppEnvironment({ NODE_ENV: "development" })).toBe("development");
    expect(getAppEnvironment({ NODE_ENV: "production" })).toBe("production");
    expect(getAppEnvironment({ NODE_ENV: "production", APP_ENV: "staging" })).toBe("staging");
  });
});
