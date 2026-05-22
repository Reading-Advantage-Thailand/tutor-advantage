import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get("tutor_session")?.value;
  const isAuthPage = request.nextUrl.pathname === "/";

  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/lesson");

  // If no session and trying to access protected tutor routes
  if (!sessionToken && isProtectedRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If session exists and trying to access login page
  if (sessionToken && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/lesson/:path*"],
};
