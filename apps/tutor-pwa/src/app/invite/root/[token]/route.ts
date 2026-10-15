import { NextResponse } from "next/server";

function getPublicBaseUrl(request: Request) {
  const reqUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost || request.headers.get("host") || reqUrl.host).split(",")[0].trim();
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto = (forwardedProto || reqUrl.protocol.replace(":", "")).split(",")[0].trim();
  return `${proto}://${host}`;
}

/**
 * One-time top-level tutor invite issued by an admin. The token is kept in an
 * httpOnly cookie and checked (and consumed) by the identity service at login.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const redirectUrl = new URL("/", getPublicBaseUrl(request));
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    redirectUrl.searchParams.set("error", "invite_invalid");
    return NextResponse.redirect(redirectUrl);
  }
  redirectUrl.searchParams.set("invite", "top");

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set("tutor_top_invite", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  // A top-level invite replaces any sponsor invite opened earlier.
  response.cookies.delete("tutor_invite_sponsor");
  return response;
}
