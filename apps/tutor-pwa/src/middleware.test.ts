import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose/jwt/sign";
import { middleware } from "./middleware";
import { getJwtSecret } from "./lib/security";

const JWT_SECRET = new TextEncoder().encode(getJwtSecret());

async function createSessionToken(role = "TUTOR") {
  return new SignJWT({ userId: "TA-99999", role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(JWT_SECRET);
}

function createRequest(path: string, token?: string) {
  // Inline the init so TS infers a shape compatible with Next's own
  // RequestInit (its `signal` does not accept null, unlike the DOM type).
  return new NextRequest(
    `http://localhost:3000${path}`,
    token ? { headers: { cookie: `tutor_session=${token}` } } : {},
  );
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

  it("sends a signed-in student to the login page with the not_tutor message", async () => {
    const token = await createSessionToken("STUDENT");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await middleware(createRequest("/dashboard?signedIn=1", token));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/?error=not_tutor");
    expect(response.headers.get("set-cookie")).toContain("tutor_session=");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the identity role over a stale tutor claim", async () => {
    const token = await createSessionToken();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ user: { role: "STUDENT", isActive: true } }))
    );

    const response = await middleware(createRequest("/dashboard", token));

    expect(response.headers.get("location")).toBe("http://localhost:3000/?error=not_tutor");
  });

  it("explains a suspended tutor account", async () => {
    const token = await createSessionToken();
    // Identity's auth middleware answers an inactive user with 403 ACCOUNT_SUSPENDED.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({ error: { code: "ACCOUNT_SUSPENDED", message: "This account is suspended" } }, { status: 403 })
      )
    );

    const response = await middleware(createRequest("/lesson/class-1", token));

    expect(response.headers.get("location")).toBe("http://localhost:3000/?error=account_suspended");
    expect(response.headers.get("set-cookie")).toContain("tutor_session=");
  });

  it("bounces other identity refusals without a message", async () => {
    const token = await createSessionToken();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 }))
    );

    const response = await middleware(createRequest("/dashboard", token));

    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("keeps an invite link's sponsor when adding the not_tutor message", async () => {
    const token = await createSessionToken("STUDENT");
    vi.stubGlobal("fetch", vi.fn());

    const response = await middleware(createRequest("/?sponsor=TA-12345", token));

    expect(response.headers.get("location")).toBe("http://localhost:3000/?sponsor=TA-12345&error=not_tutor");
  });

  it("adds the not_tutor message on the login page once, without looping", async () => {
    const token = await createSessionToken("STUDENT");
    vi.stubGlobal("fetch", vi.fn());

    const first = await middleware(createRequest("/", token));
    expect(first.status).toBe(307);
    expect(first.headers.get("location")).toBe("http://localhost:3000/?error=not_tutor");

    const second = await middleware(createRequest("/?error=not_tutor", token));
    expect(second.status).toBe(200);
    expect(second.headers.get("location")).toBeNull();
    expect(second.headers.get("set-cookie")).toContain("tutor_session=");
  });
});
