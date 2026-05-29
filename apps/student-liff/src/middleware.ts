import { NextResponse, NextRequest } from "next/server";
import { jwtVerify } from "jose/jwt/verify";

const jwtSecretRaw = process.env.JWT_SECRET || "secret-for-dev-only-change-me";
if (jwtSecretRaw === "secret-for-dev-only-change-me" && process.env.NODE_ENV === "production") {
  console.error("[SECURITY] JWT_SECRET is using the default dev fallback in production! Set a strong secret via environment variables.");
}
const JWT_SECRET = new TextEncoder().encode(jwtSecretRaw);

const PRIVATE_ROUTES = [
  "/dashboard",
  "/classes",
  "/payment",
  "/profile",
  "/progress",
  "/student",
  "/chat",
  "/consent",
  "/guardian",
  "/enroll",
  "/study",
  "/lesson",
];

const LIFF_BOOTSTRAP_PARAMS = [
  "liff.state",
  "liff.referrer",
  "lineAppVersion",
  "access_token",
];

function withSecurityHeaders(response: NextResponse) {
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.line-scdn.net https://liffsdk.line-scdn.net https://*.line-scdn.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' blob: data: https://profile.line-scdn.net https://*.line-scdn.net https://*.line.me https://api.dicebear.com https://lh3.googleusercontent.com https://*.googleusercontent.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://api.line.me https://access.line.me https://liff.line.me https://liff-shortcut.line.me https://uts-front.line-apps.com https://*.line.me https://liffsdk.line-scdn.net https://*.line-scdn.net http://localhost:3001 http://localhost:3002 ws://localhost:3001 ws://localhost:3002 https://*.ngrok-free.app wss://*.ngrok-free.app https://*.ngrok-free.dev wss://*.ngrok-free.dev",
    "frame-src 'self' https://liff.line.me https://*.line.me",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self' https://*.line.me",
    "upgrade-insecure-requests",
  ].join("; ");

  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    'camera=(self "https://liff.line.me"), microphone=(), geolocation=(), interest-cohort=()'
  );

  return response;
}

function isLiffBootstrapRequest(request: NextRequest) {
  return LIFF_BOOTSTRAP_PARAMS.some((param) =>
    request.nextUrl.searchParams.has(param)
  );
}

function isLineInAppBrowserRequest(request: NextRequest) {
  const userAgent = request.headers.get("user-agent")?.toLowerCase() ?? "";
  return userAgent.includes(" line/") || userAgent.includes("liff");
}

function createLoginRedirect(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  const target = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set("redirect", target);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPrivateRoute = PRIVATE_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (isPrivateRoute) {
    const token = request.cookies.get("student-session")?.value;

    if (!token) {
      if (isLiffBootstrapRequest(request) || isLineInAppBrowserRequest(request)) {
        return withSecurityHeaders(NextResponse.next());
      }

      return withSecurityHeaders(createLoginRedirect(request));
    }

    try {
      await jwtVerify(token, JWT_SECRET);
    } catch {
      const response = createLoginRedirect(request);
      response.cookies.delete("student-session");
      return withSecurityHeaders(response);
    }
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json).*)",
  ],
};
