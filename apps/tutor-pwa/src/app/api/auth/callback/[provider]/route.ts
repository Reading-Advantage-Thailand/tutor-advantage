import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", request.url));
  }

  try {
    // 1. Send the code to identity-service
    const identityServiceUrl = process.env.IDENTITY_SERVICE_URL || "http://localhost:3001";
    const response = await fetch(`${identityServiceUrl}/v1/auth/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider,
        code,
        redirectUri: `${url.protocol}//${url.host}/api/auth/callback/${provider}`
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Identity Service Error:", errorData);
      return NextResponse.redirect(new URL("/?error=identity_service_error", request.url));
    }

    const data = await response.json();
    const sessionToken = data.sessionToken;

    if (!sessionToken) {
      return NextResponse.redirect(new URL("/?error=missing_session_token", request.url));
    }

    // 2. Set cookie securely in browser
    const cookieStore = await cookies();
    cookieStore.set("tutor_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    // 3. Redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("OAuth Callback Handling Error:", error);
    return NextResponse.redirect(new URL("/?error=server_error", request.url));
  }
}
