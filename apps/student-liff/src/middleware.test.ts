import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose/jwt/sign";
import { middleware } from "./middleware";

const JWT_SECRET = new TextEncoder().encode("secret-for-dev-only-change-me");

async function createSessionToken() {
  return new SignJWT({ userId: "ST-99999", role: "STUDENT" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(JWT_SECRET);
}

function createRequest(path: string, token?: string, headers?: HeadersInit) {
  const requestHeaders = new Headers(headers);
  if (token) {
    requestHeaders.set("cookie", `student-session=${token}`);
  }

  return new NextRequest(`http://localhost:3004${path}`, {
    headers: requestHeaders,
  });
}

describe("student LIFF middleware", () => {
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
});
