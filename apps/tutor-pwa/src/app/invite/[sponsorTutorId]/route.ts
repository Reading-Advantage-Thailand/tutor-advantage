import { NextResponse } from "next/server";

function getPublicBaseUrl(request: Request) {
  const reqUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost || request.headers.get("host") || reqUrl.host)
    .split(",")[0]
    .trim();
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto = (forwardedProto || reqUrl.protocol.replace(":", ""))
    .split(",")[0]
    .trim();

  return `${proto}://${host}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sponsorTutorId: string }> },
) {
  const { sponsorTutorId } = await params;
  const redirectUrl = new URL("/", getPublicBaseUrl(request));
  redirectUrl.searchParams.set("sponsor", sponsorTutorId);

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set("tutor_invite_sponsor", sponsorTutorId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
