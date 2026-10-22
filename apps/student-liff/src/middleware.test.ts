import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose/jwt/sign";
import { middleware } from "./middleware";
import { getJwtSecret } from "./lib/security";

const JWT_SECRET = new TextEncoder().encode(getJwtSecret());

async function createSessionToken() {
  return new SignJWT({ userId: "ST-99999", role: "STUDENT" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(JWT_SECRET);
}

function createRequest(path: string, token?: string, headers?: HeadersInit) {
  const requestHeaders = new Headers(headers);
  if (token && !requestHeaders.has("cookie")) {
    requestHeaders.set("cookie", `student-session=${token}`);
  }

  return new NextRequest(`http://localhost:3004${path}`, {
    headers: requestHeaders,
  });
}

describe("student LIFF middleware", () => {
  it("allows the official Omise script and tokenization hosts without a wildcard", async () => {
    const response = await middleware(createRequest("/courses"));
    const csp = response.headers.get("content-security-policy") || "";
    const directives = new Map(csp.split("; ").map((entry) => [entry.split(" ")[0], entry]));
    expect(directives.get("script-src")).toContain("https://cdn.omise.co");
    expect(directives.get("connect-src")).toContain("https://vault.omise.co");
    expect(directives.get("connect-src")).toContain("https://api.omise.co");
    expect(directives.get("frame-src")).toContain("https://cdn.omise.co");
    expect(csp).not.toContain("*.omise.co");
    expect(directives.get("object-src")).toBe("object-src 'none'");
  });
  it("serves public information anonymously while enrollment and checkout remain private", async () => {
    for (const path of ["/courses", "/courses/12345678-1234-4234-8234-123456789abc", "/privacy", "/terms"]) {
      const response = await middleware(createRequest(path));
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
    for (const path of ["/classes", "/enroll", "/payment"]) {
      const response = await middleware(createRequest(path));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login?redirect=");
    }
  });
  it("redirects protected routes without a session to login with a return path", async () => {
    const response = await middleware(createRequest("/dashboard?tab=classes"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3004/login?redirect=%2Fdashboard%3Ftab%3Dclasses"
    );
  });

  it("allows LIFF bootstrap params through protected routes before the session cookie exists", async () => {
    const response = await middleware(
      createRequest("/dashboard?liff.state=%2Fdashboard&lineAppVersion=14.0.0")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-security-policy")).toContain(
      "https://liff.line.me"
    );
  });

  it("allows LINE in-app browser requests through when LIFF opens the protected endpoint directly", async () => {
    const response = await middleware(
      createRequest("/dashboard", undefined, {
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Line/14.0.0",
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows protected routes when the student session token is valid", async () => {
    const token = await createSessionToken();
    const response = await middleware(createRequest("/dashboard", token));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("clears invalid student sessions and redirects back to login", async () => {
    const response = await middleware(createRequest("/dashboard", "invalid-token"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3004/login?redirect=%2Fdashboard"
    );
    expect(response.headers.get("set-cookie")).toContain("student-session=");
  });

  it("uses only the student session for student service API requests", async () => {
    const token = await createSessionToken();
    const response = await middleware(createRequest(
      "/api/learning/book-cycles/cycle-1/voice-entitlement",
      undefined,
      { cookie: `tutor_session=tutor-token; student-session=${token}` },
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-request-authorization")).toBe(`Bearer ${token}`);
    expect(response.headers.get("x-middleware-request-cookie") || "").not.toContain("tutor-token");
  });

  it("rejects student service API requests without a student session", async () => {
    const response = await middleware(createRequest(
      "/api/learning/dashboard/summary",
      undefined,
      { cookie: "tutor_session=tutor-token" },
    ));

    expect(response.status).toBe(401);
  });
});
