import { NextRequest, NextResponse } from "next/server";
import { matchProxyRequest, sanitizeIdempotencyKey, type ProxyService } from "@/lib/proxyAllowlist";
import { ADMIN_TOKEN_COOKIE, devRoutesEnabled, verifyAdminToken } from "@/lib/security";

/**
 * Same-origin proxy from the browser to the backend services. Reads the
 * httpOnly admin_token, verifies it is an admin-console session and forwards
 * ONLY allowlisted (method, path) pairs (lib/proxyAllowlist.ts) with the
 * bearer token, the request id and the idempotency key.
 */
const isProd = process.env.NODE_ENV === "production";
const SERVICE_URLS: Record<ProxyService, string> = {
  finance:
    process.env.FINANCE_API_URL ||
    (isProd ? "https://finance-mlm-service-1090865515742.asia-southeast1.run.app" : "http://localhost:3003"),
  identity:
    process.env.IDENTITY_API_URL ||
    (isProd ? "https://identity-service-1090865515742.asia-southeast1.run.app" : "http://localhost:3001"),
  learning:
    process.env.LEARNING_API_URL ||
    (isProd ? "https://learning-service-1090865515742.asia-southeast1.run.app" : "http://localhost:3002"),
};

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function isCrossSite(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

async function handler(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await verifyAdminToken(request.cookies.get(ADMIN_TOKEN_COOKIE)?.value);
  if (!session) return errorResponse(401, "UNAUTHORIZED", "Admin session required");

  const method = request.method.toUpperCase();
  if (method !== "GET" && isCrossSite(request)) {
    return errorResponse(403, "CROSS_SITE_REQUEST", "Cross-site request blocked");
  }

  const { path } = await params;
  const match = matchProxyRequest(path, method, { role: session.role, devRoutes: devRoutesEnabled() });
  if (!match.ok) return errorResponse(match.status, match.code, "This endpoint is not available through the admin console");

  const base = SERVICE_URLS[match.rule.service].replace("localhost", "127.0.0.1");
  const targetUrl = `${base}${match.path}${request.nextUrl.search}`;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${request.cookies.get(ADMIN_TOKEN_COOKIE)?.value}`);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  headers.set("Accept", request.headers.get("accept") || "application/json");
  const requestId = request.headers.get("x-request-id");
  headers.set("x-request-id", requestId && /^[A-Za-z0-9_-]{8,128}$/.test(requestId) ? requestId : crypto.randomUUID());
  const idempotencyKey = sanitizeIdempotencyKey(request.headers.get("idempotency-key"));
  if (idempotencyKey && method !== "GET") headers.set("Idempotency-Key", idempotencyKey);

  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, { method, headers, body, cache: "no-store", redirect: "manual" });
  } catch {
    return errorResponse(503, "SERVICE_UNREACHABLE", `${match.rule.service} service is unreachable`);
  }

  const responseHeaders = new Headers();
  for (const name of ["content-type", "content-disposition", "x-request-id"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set("Cache-Control", "no-store");

  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
