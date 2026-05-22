import { NextResponse, NextRequest } from "next/server";

// Define private routes that require authentication
const PRIVATE_ROUTES = [
  "/dashboard",
  "/classes",
  "/payment",
  "/profile",
  "/progress",
  "/student",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 1. Route Protection
  const isPrivateRoute = PRIVATE_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  const session = request.cookies.get("liff-session")?.value;

  if (isPrivateRoute && !session) {
    const url = new URL("/login", request.url);
    // Optional: save the intended destination to redirect back after login
    // url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // 2. Security Headers
  const response = NextResponse.next();

  // Content Security Policy
  // Note: We allow LINE domains for LIFF functionality
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.line-scdn.net;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://profile.line-scdn.net https://*.line-scdn.net https://api.dicebear.com https://lh3.googleusercontent.com https://*.googleusercontent.com;
    font-src 'self' data: https://fonts.gstatic.com;
    connect-src 'self' https://*.line.me https://*.line-scdn.net http://localhost:3001 http://localhost:3002 ws://localhost:3001 ws://localhost:3002 https://*.ngrok-free.app wss://*.ngrok-free.app;
    frame-src 'self' https://*.line.me;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'self' https://*.line.me;
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, " ").trim();

  response.headers.set("Content-Security-Policy", cspHeader);
  
  // HSTS - 1 year
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  
  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  
  // X-Frame-Options - Note: CSP frame-ancestors is more modern and preferred,
  // but we keep this for legacy browser support. We use SAMEORIGIN or allow LINE.
  // Since X-Frame-Options doesn't support multiple domains well, 
  // we rely on CSP's frame-ancestors for LINE embedding.
  // response.headers.set("X-Frame-Options", "DENY"); 
  
  // Referrer Policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions Policy
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  return response;
}

// Ensure middleware only runs on relevant paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json (PWA manifest)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json).*)",
  ],
};
