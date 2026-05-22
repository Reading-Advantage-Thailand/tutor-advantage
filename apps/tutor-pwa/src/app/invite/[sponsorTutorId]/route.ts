import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sponsorTutorId: string }> },
) {
  const { sponsorTutorId } = await params;
  const redirectUrl = new URL("/", request.url);
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
