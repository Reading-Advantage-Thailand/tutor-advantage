import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@tutor-advantage/database";
import { isAdminRole } from "../../../../../lib/routes";
import { setAdminSessionCookies } from "../../../../../lib/security";
import { clearOAuthNextCookie, OAUTH_NEXT_COOKIE, safeNextPath } from "../../../../../lib/nextPath";


export async function GET(request: Request) {
  const response = await handleCallback(request);
  // The `next` cookie is single-use: drop it whatever the outcome.
  clearOAuthNextCookie(response);
  return response;
}

async function handleCallback(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    url.host;
  const proto =
    request.headers.get("x-forwarded-proto") ||
    url.protocol.replace(":", "");
  const publicBase = `${proto}://${host}`;
  const redirectUri = `${publicBase}/api/auth/callback/google`;

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Validate CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_state")?.value;

  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", publicBase));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", publicBase));
  }

  const codeVerifier = cookieStore.get("pkce_verifier")?.value || null;

  const clientId =
    process.env.AUTH_GOOGLE_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Google OAuth credentials not fully configured on server" },
      { status: 500 }
    );
  }

  try {
    // 1. Exchange code for tokens
    const tokenParams: Record<string, string> = {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    };
    if (codeVerifier) {
      tokenParams.code_verifier = codeVerifier;
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Google token exchange failed:", errorText);
      return NextResponse.redirect(
        new URL("/login?error=google_token_failed", publicBase)
      );
    }

    const { access_token } = await tokenResponse.json();

    // 2. Fetch user profile
    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    if (!profileResponse.ok) {
      return NextResponse.redirect(
        new URL("/login?error=google_profile_failed", publicBase)
      );
    }

    const profile = await profileResponse.json();
    const { email, name } = profile;

    // S-4: only accept Google accounts whose email address Google has verified.
    const emailVerified = profile.verified_email === true || profile.email_verified === true;
    if (!email || !emailVerified) {
      console.warn(`Rejected Google login without a verified email: ${email ?? "(none)"}`);
      return NextResponse.redirect(new URL("/login?error=email_not_verified", publicBase));
    }

    // 3. Verify user exists in DB with an admin role
    const dbUser = await prisma.user.findUnique({
      where: { email },
      select: { userId: true, role: true, isActive: true, displayName: true, profilePictureUrl: true },
    });

    if (!dbUser || !dbUser.isActive || !isAdminRole(dbUser.role)) {
      console.warn(
        `Unauthorized access attempt from: ${email} with role: ${dbUser?.role}`
      );
      return NextResponse.redirect(new URL("/unauthorized", publicBase));
    }

    // Update placeholder displayName and profile picture
    const updateData: Record<string, unknown> = {};
    if (name && dbUser.displayName?.toLowerCase() === email.toLowerCase()) {
      updateData.displayName = name;
    }
    if (profile.picture && !dbUser.profilePictureUrl) {
      updateData.profilePictureUrl = profile.picture;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { userId: dbUser.userId },
        data: updateData,
      });
    }

    const { role, userId } = dbUser;

    // 4. Issue the admin-console session (httpOnly token + display cookies).
    // Re-validate: the cookie is only a hint, never trusted as a redirect target.
    const next = safeNextPath(cookieStore.get(OAUTH_NEXT_COOKIE)?.value);
    const response = NextResponse.redirect(new URL(next, publicBase));
    await setAdminSessionCookies(response, {
      userId,
      role,
      email,
      name: dbUser.displayName || name || email,
      picture: dbUser.profilePictureUrl || profile.picture || "",
    });

    // Consume one-time cookies
    response.cookies.delete("oauth_state");
    response.cookies.delete("pkce_verifier");

    return response;
  } catch (error) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(
      new URL("/login?error=internal_server_error", publicBase)
    );
  }
}
