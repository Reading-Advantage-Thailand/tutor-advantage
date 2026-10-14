import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decideAccess, isPublicPath } from "./lib/routes";
import { ADMIN_TOKEN_COOKIE, clearAdminCookies, devRoutesEnabled, verifyAdminToken } from "./lib/security";

/**
 * Guards EVERY admin page (and /api/dev/*):
 * - verifies the admin_token JWT (HS256 signature, expiry, iss=admin-console,
 *   aud=tutor-advantage-admin, role ADMIN|FINANCE_CHECKER). A tutor/student
 *   token signed with the shared secret fails the issuer/audience check.
 * - checks the role against the shared route map (lib/routes.ts) → /unauthorized.
 * - dev-only routes 404 unless ENABLE_DEV_ROUTES=true in a non-production build.
 * Invalid/expired tokens clear all admin cookies and go to /login.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const devRoutes = devRoutesEnabled();
  const token = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value;
  const session = await verifyAdminToken(token);

  // Dev API routes: same opt-in gate + ADMIN only, before the handler runs.
  if (pathname.startsWith("/api/dev")) {
    if (!devRoutes) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
    if (!session) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Admin session required" } }, { status: 401 });
    if (session.role !== "ADMIN") {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Admin role required" } }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const decision = decideAccess(pathname, session?.role ?? null, { devRoutes });

  if (decision === "allow") {
    const response = NextResponse.next();
    // A stale/forged token on a public page: drop it so the login page works.
    if (token && !session && isPublicPath(pathname)) clearAdminCookies(response);
    return response;
  }

  if (decision === "not-found") {
    // Render the app's 404 page for disabled dev routes.
    return NextResponse.rewrite(new URL("/_dev-routes-disabled", request.url), { status: 404 });
  }

  if (decision === "forbidden" && session) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  const loginUrl = new URL("/login", request.url);
  // Keep the query string so filtered views survive the login round-trip
  // (e.g. /coupons?status=VOID). Relative path only — never the origin.
  const next = `${pathname}${request.nextUrl.search}`;
  if (next !== "/") loginUrl.searchParams.set("next", next);
  const response = NextResponse.redirect(loginUrl);
  if (token) clearAdminCookies(response);
  return response;
}

export const config = {
  matcher: [
    "/api/dev/:path*",
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|woff2?)$).*)",
  ],
};
