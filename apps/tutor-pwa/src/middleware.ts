import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose/jwt/verify";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "secret-for-dev-only-change-me"
);

const PROTECTED_ROUTES = ["/dashboard", "/lesson"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get("tutor_session")?.value;
  const isAuthPage = pathname === "/";
  const isProtectedRoute = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));

  if (!sessionToken && isProtectedRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (sessionToken && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (sessionToken && isProtectedRoute) {
    try {
      await jwtVerify(sessionToken, JWT_SECRET);
    } catch {
      const response = NextResponse.redirect(new URL("/", request.url));
      response.cookies.delete("tutor_session");
      return response;
    }
  }

  const response = NextResponse.next();

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

export const config = {
  matcher: ["/", "/dashboard/:path*", "/lesson/:path*"],
};
