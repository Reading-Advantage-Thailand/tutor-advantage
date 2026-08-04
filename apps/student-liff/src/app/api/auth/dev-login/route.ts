import { NextRequest, NextResponse } from "next/server";
import { IDENTITY_URL } from "@/lib/service-urls";

function devRoutesEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_ROUTES === "true";
}

function safeRedirect(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/classes";
}

export async function GET(request: NextRequest) {
  if (!devRoutesEnabled()) {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const response = await fetch(`${IDENTITY_URL}/v1/auth/dev`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "STUDENT" }),
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Dev student login failed", details: await response.text() },
      { status: 502 },
    );
  }

  const data = (await response.json()) as { sessionToken?: string };
  if (!data.sessionToken) {
    return NextResponse.json({ error: "Identity service returned no session token" }, { status: 502 });
  }

  const redirect = NextResponse.redirect(new URL(safeRedirect(request.nextUrl.searchParams.get("redirect")), request.url));
  redirect.cookies.set("student-session", data.sessionToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
  return redirect;
}
