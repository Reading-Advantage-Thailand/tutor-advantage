import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const reqUrl = new URL(request.url);
  const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;
  const redirectUri = `${baseUrl}/api/auth/callback/${provider}`;

  // Generate a random CSRF state token — sponsor info stays in its own cookie
  const csrfState = crypto.randomBytes(32).toString("hex");

  if (provider === "google") {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "Google Client ID not configured" },
        { status: 500 }
      );
    }

    const googleAuthUrl = new URL(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );
    googleAuthUrl.searchParams.set("client_id", clientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid email profile");
    googleAuthUrl.searchParams.set("state", csrfState);

    const response = NextResponse.redirect(googleAuthUrl.toString());
    response.cookies.set("oauth_state", csrfState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    });
    return response;
  }

  if (provider === "facebook") {
    const clientId = process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "Facebook Client ID not configured" },
        { status: 500 }
      );
    }

    const facebookAuthUrl = new URL(
      "https://www.facebook.com/v11.0/dialog/oauth"
    );
    facebookAuthUrl.searchParams.set("client_id", clientId);
    facebookAuthUrl.searchParams.set("redirect_uri", redirectUri);
    facebookAuthUrl.searchParams.set("scope", "public_profile,email");
    facebookAuthUrl.searchParams.set("state", csrfState);

    const response = NextResponse.redirect(facebookAuthUrl.toString());
    response.cookies.set("oauth_state", csrfState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    });
    return response;
  }

  return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
}
