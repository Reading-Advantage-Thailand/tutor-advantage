import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const reqUrl = new URL(request.url);
  // Cloud Run terminates TLS at the load balancer — use forwarded headers for the real public host
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    reqUrl.host;
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (reqUrl.protocol.replace(":", "") as string);
  const baseUrl = `${proto}://${host}`;
  const redirectUri = `${baseUrl}/api/auth/callback/${provider}`;

  if (provider === "facebook") {
    return NextResponse.json(
      { error: "Facebook login is temporarily disabled" },
      { status: 403 }
    );
  }

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

    // PKCE: code_verifier → SHA-256 → base64url = code_challenge
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    const googleAuthUrl = new URL(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );
    googleAuthUrl.searchParams.set("client_id", clientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid email profile");
    googleAuthUrl.searchParams.set("state", csrfState);
    googleAuthUrl.searchParams.set("code_challenge", codeChallenge);
    googleAuthUrl.searchParams.set("code_challenge_method", "S256");

    const response = NextResponse.redirect(googleAuthUrl.toString());
    response.cookies.set("oauth_state", csrfState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    });
    response.cookies.set("pkce_verifier", codeVerifier, {
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
