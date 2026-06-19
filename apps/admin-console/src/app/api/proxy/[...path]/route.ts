import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const FINANCE_API_URL = process.env.FINANCE_API_URL || "http://localhost:3003";
const IDENTITY_API_URL = process.env.IDENTITY_API_URL || "http://localhost:3001";
const LEARNING_API_URL = process.env.LEARNING_API_URL || "http://localhost:3002";

function resolveTargetUrl(pathParts: string[], search: string) {
  const targetPath = "/" + pathParts.join("/");
  let baseUrl = FINANCE_API_URL.replace("localhost", "127.0.0.1");

  // Identity Service routes
  if (
    pathParts[0] === "v1" &&
    ((pathParts[1] === "admin" && pathParts[2] === "roles") ||
      pathParts[1] === "auth" ||
      pathParts[1] === "session" ||
      pathParts[1] === "upload" ||
      pathParts[1] === "guardian" ||
      (pathParts[1] === "users" && pathParts[2] === "me"))
  ) {
    baseUrl = IDENTITY_API_URL.replace("localhost", "127.0.0.1");
  }
  // Learning Service routes
  else if (
    pathParts[0] === "v1" &&
    (pathParts[1] === "books" ||
      pathParts[1] === "demo" ||
      pathParts[1] === "classes" ||
      pathParts[1] === "enroll" ||
      pathParts[1] === "dashboard" ||
      pathParts[1] === "student" ||
      pathParts[1] === "lessons" ||
      pathParts[1] === "chat" ||
      pathParts[1] === "tutors" ||
      pathParts[1] === "notifications")
  ) {
    baseUrl = LEARNING_API_URL.replace("localhost", "127.0.0.1");
  }

  return `${baseUrl}${targetPath}${search}`;
}

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const search = request.nextUrl.search;
  const targetUrl = resolveTargetUrl(path, search);

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);

  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });
  } catch (err: any) {
    // Service unreachable (e.g. not started locally)
    return NextResponse.json(
      { error: `Service unreachable: ${err.message}`, target: targetUrl },
      { status: 503 }
    );
  }

  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) responseHeaders.set("Content-Type", upstreamType);
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) responseHeaders.set("Content-Disposition", disposition);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
