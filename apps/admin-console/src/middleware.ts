import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose/jwt/verify";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "secret-for-dev-only-change-me"
);

// Routes that require ADMIN role (FINANCE_CHECKER is denied)
const ADMIN_ONLY_ROUTES = ["/users", "/fraud"];

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === "/login" || pathname === "/unauthorized";

  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (token && !isAuthPage) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);

      const isAdminOnly = ADMIN_ONLY_ROUTES.some((route) =>
        pathname.startsWith(route)
      );
      if (isAdminOnly && payload.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    } catch {
      // Token expired or tampered — clear cookies and force re-login
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("admin_token");
      response.cookies.delete("admin_role");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.svg).*)",
  ],
};
