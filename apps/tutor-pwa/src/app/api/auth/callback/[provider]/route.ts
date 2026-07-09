import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const url = new URL(request.url);
  // Use forwarded headers for the real public host (Cloud Run terminates TLS at load balancer)
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    url.host;
  const proto =
    request.headers.get("x-forwarded-proto") ||
    url.protocol.replace(":", "");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Validate CSRF state before processing the OAuth code
  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_state")?.value;

  const publicBase = process.env.NEXT_PUBLIC_BASE_URL || `${proto}://${host}`;

  if (provider === "facebook") {
    return NextResponse.redirect(
      new URL("/?error=facebook_login_disabled", publicBase)
    );
  }

  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/?error=invalid_state", publicBase));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", publicBase));
  }

  // Sponsor comes from the invite cookie, not the state param
  const sponsorTutorId = cookieStore.get("tutor_invite_sponsor")?.value || null;

  // PKCE: read stored verifier (only used for google)
  const codeVerifier = cookieStore.get("pkce_verifier")?.value || null;

  try {
    const identityServiceUrl =
      process.env.IDENTITY_SERVICE_URL || "http://localhost:3001";

    const callbackBody: Record<string, string> = {
      provider,
      code,
      defaultRole: "TUTOR",
      redirectUri: `${publicBase}/api/auth/callback/${provider}`,
    };
    if (sponsorTutorId) callbackBody.sponsorTutorId = sponsorTutorId;
    if (codeVerifier) callbackBody.codeVerifier = codeVerifier;

    const response = await fetch(`${identityServiceUrl}/v1/auth/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(callbackBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Identity Service Error:", errorData);
      return NextResponse.redirect(
        new URL("/?error=identity_service_error", publicBase)
      );
    }

    const data = await response.json();
    const sessionToken = data.sessionToken;

    if (!sessionToken) {
      return NextResponse.redirect(
        new URL("/?error=missing_session_token", publicBase)
      );
    }

    const dashboardUrl = new URL("/dashboard", publicBase);
    if (data.roleUpgraded) dashboardUrl.searchParams.set("role_upgraded", "true");
    const redirect = NextResponse.redirect(dashboardUrl);

    redirect.cookies.set("tutor_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    // Consume one-time cookies
    redirect.cookies.delete("oauth_state");
    redirect.cookies.delete("pkce_verifier");
    redirect.cookies.delete("tutor_invite_sponsor");

    return redirect;
  } catch (error) {
    console.error("OAuth Callback Handling Error:", error);
    return NextResponse.redirect(new URL("/?error=server_error", publicBase));
  }
}
