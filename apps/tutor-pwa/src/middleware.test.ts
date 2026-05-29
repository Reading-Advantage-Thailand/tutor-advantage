import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose/jwt/sign";
import { middleware } from "./middleware";

const JWT_SECRET = new TextEncoder().encode("secret-for-dev-only-change-me");

async function createSessionToken(role = "TUTOR") {
  return new SignJWT({ userId: "TA-99999", role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(JWT_SECRET);
}

function createRequest(path: string, token?: string) {
  const init: RequestInit = token
    ? { headers: { cookie: `tutor_session=${token}` } }
    : {};

  return new NextRequest(`http://localhost:3000${path}`, init);
}

describe("tutor middleware", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects protected routes and clears stale sessions when the user no longer exists", async () => {
    const token = await createSessionToken();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    );

    const response = await middleware(createRequest("/dashboard", token));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
    expect(response.headers.get("set-cookie")).toContain("tutor_session=");
  });

  it("allows valid tutor sessions through protected routes", async () => {
    const token = await createSessionToken();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({ user: { role: "TUTOR", isActive: true } })
      )
    );

    const response = await middleware(createRequest("/dashboard", token));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not redirect the login page when an existing session belongs to a deleted user", async () => {
    const token = await createSessionToken();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    );

    const response = await middleware(createRequest("/", token));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain("tutor_session=");
  });
});
