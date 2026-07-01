import { afterEach, describe, expect, it, vi } from "vitest";
import { devRoutesEnabled, getJwtSecret } from "./security";

describe("application security configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects the development secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "secret-for-dev-only-change-me");
    expect(() => getJwtSecret()).toThrow("JWT_SECRET");
  });

  it("requires an explicit flag for development routes", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_DEV_ROUTES", "");
    expect(devRoutesEnabled()).toBe(false);
    vi.stubEnv("ENABLE_DEV_ROUTES", "true");
    expect(devRoutesEnabled()).toBe(true);
  });
});
