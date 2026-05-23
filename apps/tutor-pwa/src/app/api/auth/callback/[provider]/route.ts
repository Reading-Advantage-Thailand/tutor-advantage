import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Validate CSRF state before processing the OAuth code
  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_state")?.value;

  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", request.url));
  }

  // Sponsor comes from the invite cookie, not the state param
  const sponsorTutorId = cookieStore.get("tutor_invite_sponsor")?.value || null;

  try {
    const identityServiceUrl =
      process.env.IDENTITY_SERVICE_URL || "http://localhost:3001";

    const response = await fetch(`${identityServiceUrl}/v1/auth/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        code,
        sponsorTutorId,
        redirectUri: `${url.protocol}//${url.host}/api/auth/callback/${provider}`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Identity Service Error:", errorData);
      return NextResponse.redirect(
        new URL("/?error=identity_service_error", request.url)
      );
    }

    const data = await response.json();
    const sessionToken = data.sessionToken;

    if (!sessionToken) {
      return NextResponse.redirect(
        new URL("/?error=missing_session_token", request.url)
      );
    }

    const redirect = NextResponse.redirect(new URL("/dashboard", request.url));

    redirect.cookies.set("tutor_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    // Consume one-time cookies
    redirect.cookies.delete("oauth_state");
    redirect.cookies.delete("tutor_invite_sponsor");

    return redirect;
  } catch (error) {
    console.error("OAuth Callback Handling Error:", error);
    return NextResponse.redirect(new URL("/?error=server_error", request.url));
  }
}
