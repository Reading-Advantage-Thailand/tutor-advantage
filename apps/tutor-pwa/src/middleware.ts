import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose/jwt/verify";
import { getJwtSecret } from "./lib/security";

const jwtSecret = () => new TextEncoder().encode(getJwtSecret());

const PROTECTED_ROUTES = ["/dashboard", "/lesson"];
const IDENTITY_URL = process.env.IDENTITY_SERVICE_URL || "http://localhost:3001";

/**
 * `loginError` is the `/?error=` code the login page explains: a signed-in
 * non-tutor (e.g. a Google account that was never registered as a tutor) or
 * a suspended tutor. Expired/stale sessions have none and bounce silently.
 */
type SessionValidation =
  | { ok: true }
  | { ok: false; loginError?: "not_tutor" | "account_suspended" };

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  return response;
}

async function validateTutorSession(token: string): Promise<SessionValidation> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    if (payload.role !== "TUTOR") return { ok: false, loginError: "not_tutor" };
  } catch {
    return { ok: false };
  }

  try {
    const res = await fetch(`${IDENTITY_URL}/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      // Identity refuses an inactive user with 403 ACCOUNT_SUSPENDED instead of returning the profile.
      if (res.status === 403) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        if (body?.error?.code === "ACCOUNT_SUSPENDED") return { ok: false, loginError: "account_suspended" };
      }
      return { ok: false };
    }

    const data = (await res.json()) as {
      user?: { role?: string; isActive?: boolean };
    };

    if (data.user?.role !== "TUTOR") return { ok: false, loginError: "not_tutor" };
    if (data.user?.isActive === false) return { ok: false, loginError: "account_suspended" };

    return { ok: true };
  } catch {
    return { ok: false };
  }
}

function clearSession(response: NextResponse) {
  response.cookies.delete("tutor_session");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // A production build leaves the generated worker in public/. Do not let a
  // stale worker reinstall itself while the app is running in development.
  if (process.env.NODE_ENV === "development" && pathname === "/sw.js") {
    return new NextResponse(null, {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const sessionToken = request.cookies.get("tutor_session")?.value;
  const isAuthPage = pathname === "/";
  const isProtectedRoute = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));

  if (!sessionToken && isProtectedRoute) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/", request.url)));
  }

  if (sessionToken && (isAuthPage || isProtectedRoute)) {
    const validation = await validateTutorSession(sessionToken);

    if (!validation.ok) {
      const { loginError } = validation;
      const showLoginError =
        loginError && request.nextUrl.searchParams.get("error") !== loginError;
      if (!isProtectedRoute && !showLoginError) {
        return withSecurityHeaders(clearSession(NextResponse.next()));
      }
      const loginUrl = new URL("/", request.url);
      // On the login page keep the rest of the query (?sponsor= from an invite link).
      if (isAuthPage) loginUrl.search = request.nextUrl.search;
      if (loginError) loginUrl.searchParams.set("error", loginError);
      return withSecurityHeaders(clearSession(NextResponse.redirect(loginUrl)));
    }
  }

  if (sessionToken && isAuthPage) {
    return withSecurityHeaders(
      NextResponse.redirect(new URL("/dashboard", request.url))
    );
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/lesson/:path*", "/sw.js"],
};
