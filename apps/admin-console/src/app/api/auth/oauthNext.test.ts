import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined) }),
}));

const findUnique = vi.fn();
vi.mock("@tutor-advantage/database", () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => findUnique(...args), update: vi.fn() } },
}));

import { GET as startGoogle } from "./google/route";
import { GET as googleCallback } from "./callback/google/route";
import { OAUTH_NEXT_COOKIE } from "../../../lib/nextPath";

function setCookieFor(response: Response, name: string) {
  const header = response.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  return header ?? null;
}

describe("Google OAuth carries ?next", () => {
  beforeEach(() => {
    cookieJar.clear();
    vi.stubEnv("AUTH_GOOGLE_ID", "client-id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "client-secret");
    vi.stubEnv("JWT_SECRET", "test-secret-that-is-long-enough-for-hs256-0123456789");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("stores a validated next in a short-lived httpOnly Lax cookie", async () => {
    const response = await startGoogle(new NextRequest("http://localhost:3005/api/auth/google?next=%2Fcoupons%3Fstatus%3DVOID"));
    const cookie = setCookieFor(response, OAUTH_NEXT_COOKIE)!;
    expect(cookie).toContain(`${OAUTH_NEXT_COOKIE}=${encodeURIComponent("/coupons?status=VOID")}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Max-Age=600/);
  });

  it("does not store unsafe next values (clears instead)", async () => {
    for (const bad of ["https://evil.example", "//evil.example", "/login", ""]) {
      const response = await startGoogle(new NextRequest(`http://localhost:3005/api/auth/google?next=${encodeURIComponent(bad)}`));
      expect(setCookieFor(response, OAUTH_NEXT_COOKIE), bad).toMatch(new RegExp(`^${OAUTH_NEXT_COOKIE}=;`));
    }
  });

  function stubGoogle() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("oauth2.googleapis.com/token")) return Response.json({ access_token: "at" });
        return Response.json({ email: "admin@example.com", verified_email: true, name: "Admin" });
      }),
    );
    findUnique.mockResolvedValue({ userId: "u1", role: "ADMIN", isActive: true, displayName: "Admin", profilePictureUrl: "x" });
  }

  it("redirects to the re-validated next after login and clears the cookie", async () => {
    stubGoogle();
    cookieJar.set("oauth_state", "s1");
    cookieJar.set(OAUTH_NEXT_COOKIE, "/coupons?status=VOID");
    const response = await googleCallback(new NextRequest("http://localhost:3005/api/auth/callback/google?code=c&state=s1"));
    expect(response.headers.get("location")).toBe("http://localhost:3005/coupons?status=VOID");
    expect(setCookieFor(response, OAUTH_NEXT_COOKIE)).toMatch(new RegExp(`^${OAUTH_NEXT_COOKIE}=;`));
    expect(setCookieFor(response, "admin_token")).toBeTruthy();
  });

  it("ignores a tampered cookie and lands on /", async () => {
    stubGoogle();
    cookieJar.set("oauth_state", "s1");
    cookieJar.set(OAUTH_NEXT_COOKIE, "//evil.example/x");
    const response = await googleCallback(new NextRequest("http://localhost:3005/api/auth/callback/google?code=c&state=s1"));
    expect(response.headers.get("location")).toBe("http://localhost:3005/");
  });

  it("clears the cookie on failed callbacks too", async () => {
    cookieJar.set(OAUTH_NEXT_COOKIE, "/coupons");
    const response = await googleCallback(new NextRequest("http://localhost:3005/api/auth/callback/google?code=c&state=bad"));
    expect(new URL(response.headers.get("location")!).search).toBe("?error=invalid_state");
    expect(setCookieFor(response, OAUTH_NEXT_COOKIE)).toMatch(new RegExp(`^${OAUTH_NEXT_COOKIE}=;`));
  });
});
