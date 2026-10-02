import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose/jwt/sign";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { ADMIN_AUDIENCE, ADMIN_ISSUER } from "./lib/routes";
import { signAdminToken } from "./lib/security";

const SECRET = "test-secret-that-is-long-enough-for-hs256-0123456789";

async function token(claims: Record<string, unknown>, { iss = ADMIN_ISSUER, aud = ADMIN_AUDIENCE, secret = SECRET } = {}) {
  let jwt = new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h");
  if (iss) jwt = jwt.setIssuer(iss);
  if (aud) jwt = jwt.setAudience(aud);
  return jwt.sign(new TextEncoder().encode(secret));
}

function request(path: string, cookie?: string) {
  return new NextRequest(new URL(path, "http://localhost:3005"), {
    headers: cookie ? { cookie: `admin_token=${cookie}` } : {},
  });
}

function location(response: Response) {
  const value = response.headers.get("location");
  return value ? new URL(value).pathname : null;
}

describe("admin middleware", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", SECRET);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ENABLE_DEV_ROUTES", "true");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects anonymous users to /login on every admin page", async () => {
    for (const path of ["/", "/settlements", "/coupons", "/settings/roles", "/users/abc", "/some/new/page"]) {
      const response = await middleware(request(path));
      expect(location(response), path).toBe("/login");
    }
  });

  it("keeps the path and query string (relative only) in ?next", async () => {
    const response = await middleware(request("/coupons?status=VOID&page=2"));
    const url = new URL(response.headers.get("location")!);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("next")).toBe("/coupons?status=VOID&page=2");
    const root = new URL((await middleware(request("/"))).headers.get("location")!);
    expect(root.searchParams.has("next")).toBe(false);
    const rootWithQuery = new URL((await middleware(request("/?x=1"))).headers.get("location")!);
    expect(rootWithQuery.searchParams.get("next")).toBe("/?x=1");
  });

  it("lets anonymous users reach /login and /unauthorized", async () => {
    expect((await middleware(request("/login"))).headers.get("location")).toBeNull();
    expect((await middleware(request("/unauthorized"))).headers.get("location")).toBeNull();
  });

  it("allows ADMIN everywhere in the role map", async () => {
    const admin = await signAdminToken({ userId: "u-admin", role: "ADMIN", email: null, name: null });
    for (const path of ["/", "/users", "/users/123", "/coupons", "/settings/roles", "/voice-operations", "/dev", "/dev/ui-kit"]) {
      const response = await middleware(request(path, admin));
      expect(response.headers.get("location"), path).toBeNull();
      expect(response.status, path).toBe(200);
    }
  });

  it("limits FINANCE_CHECKER to finance/ops routes", async () => {
    const checker = await signAdminToken({ userId: "u-chk", role: "FINANCE_CHECKER", email: null, name: null });
    for (const path of ["/", "/settlements", "/adjustments", "/audit", "/reconciliation", "/operations/exceptions", "/fraud", "/docs"]) {
      expect(location(await middleware(request(path, checker))), path).toBeNull();
    }
    for (const path of ["/users", "/users/123", "/coupons", "/settings/roles", "/voice-operations", "/dev", "/dev/database", "/brand-new-page"]) {
      expect(location(await middleware(request(path, checker))), path).toBe("/unauthorized");
    }
  });

  it("rejects tutor/student tokens signed with the same secret", async () => {
    const tutor = await token({ userId: "t1", role: "TUTOR" }, { iss: "", aud: "" });
    const forgedAdminNoIssuer = await token({ userId: "x", role: "ADMIN" }, { iss: "", aud: "" });
    const wrongIssuer = await token({ userId: "x", role: "ADMIN" }, { iss: "identity-service" });
    const wrongAudience = await token({ userId: "x", role: "ADMIN" }, { aud: "lesson-socket" });
    const tutorWithAdminIssuer = await token({ userId: "t1", role: "TUTOR" });
    for (const bad of [tutor, forgedAdminNoIssuer, wrongIssuer, wrongAudience, tutorWithAdminIssuer]) {
      const response = await middleware(request("/settlements", bad));
      expect(location(response)).toBe("/login");
      expect(response.headers.get("set-cookie")).toContain("admin_token=;");
    }
  });

  it("rejects a token signed with another secret", async () => {
    const forged = await token({ userId: "x", role: "ADMIN" }, { secret: "another-secret-another-secret-another-secret" });
    expect(location(await middleware(request("/", forged)))).toBe("/login");
  });

  it("clears every admin cookie when the session is invalid", async () => {
    const response = await middleware(request("/", "garbage"));
    const cookies = response.headers.get("set-cookie") ?? "";
    for (const name of ["admin_token", "admin_role", "admin_email", "admin_name", "admin_picture", "admin_user_id"]) {
      expect(cookies).toContain(`${name}=;`);
    }
  });

  it("sends signed-in admins away from /login", async () => {
    const admin = await signAdminToken({ userId: "u-admin", role: "ADMIN", email: null, name: null });
    expect(location(await middleware(request("/login", admin)))).toBe("/");
  });

  it("404s dev routes unless ENABLE_DEV_ROUTES=true outside production", async () => {
    const admin = await signAdminToken({ userId: "u-admin", role: "ADMIN", email: null, name: null });
    vi.stubEnv("ENABLE_DEV_ROUTES", "");
    expect((await middleware(request("/dev/database", admin))).status).toBe(404);
    expect((await middleware(request("/api/dev/database", admin))).status).toBe(404);
    vi.stubEnv("ENABLE_DEV_ROUTES", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect((await middleware(request("/dev", admin))).status).toBe(404);
  });

  it("guards /api/dev/* by role", async () => {
    const checker = await signAdminToken({ userId: "u-chk", role: "FINANCE_CHECKER", email: null, name: null });
    const admin = await signAdminToken({ userId: "u-admin", role: "ADMIN", email: null, name: null });
    expect((await middleware(request("/api/dev/database"))).status).toBe(401);
    expect((await middleware(request("/api/dev/database", checker))).status).toBe(403);
    expect((await middleware(request("/api/dev/database", admin))).status).toBe(200);
  });
});
