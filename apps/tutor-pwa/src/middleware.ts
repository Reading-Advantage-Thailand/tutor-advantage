import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose/jwt/verify";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "secret-for-dev-only-change-me"
);

const PROTECTED_ROUTES = ["/dashboard", "/lesson"];
const IDENTITY_URL = process.env.IDENTITY_SERVICE_URL || "http://localhost:3001";

type SessionValidation =
  | { ok: true }
  | { ok: false };

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
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "TUTOR") return { ok: false };
  } catch {
    return { ok: false };
  }

  try {
    const res = await fetch(`${IDENTITY_URL}/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) return { ok: false };

    const data = (await res.json()) as {
      user?: { role?: string; isActive?: boolean };
    };

    if (data.user?.role !== "TUTOR") return { ok: false };
    if (data.user?.isActive === false) return { ok: false };

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
  const sessionToken = request.cookies.get("tutor_session")?.value;
  const isAuthPage = pathname === "/";
  const isProtectedRoute = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));

  if (!sessionToken && isProtectedRoute) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/", request.url)));
  }

  if (sessionToken && (isAuthPage || isProtectedRoute)) {
    const validation = await validateTutorSession(sessionToken);

    if (!validation.ok) {
      const response = isProtectedRoute
        ? NextResponse.redirect(new URL("/", request.url))
        : NextResponse.next();
      return withSecurityHeaders(clearSession(response));
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
  matcher: ["/", "/dashboard/:path*", "/lesson/:path*"],
};
