import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;
  const redirectUri = `${baseUrl}/api/auth/callback/google`;

  const clientId = process.env.AUTH_GOOGLE_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json({ error: "Google Client ID not configured" }, { status: 500 });
  }

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=openid%20email%20profile&prompt=select_account`;

  return NextResponse.redirect(googleAuthUrl);
}
