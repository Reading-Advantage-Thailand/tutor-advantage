import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { prisma } from "@tutor-advantage/database";

const JWT_SECRET = process.env.JWT_SECRET || "secret-for-dev-only-change-me";

export async function GET(request: Request) {
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

    if (!email) {
      return NextResponse.redirect(
        new URL("/login?error=no_email_returned", publicBase)
      );
    }

    // 3. Verify user exists in DB with an admin role
    const dbUser = await prisma.user.findUnique({
      where: { email },
      select: { userId: true, role: true, isActive: true },
    });

    const ALLOWED_ROLES = ["ADMIN", "FINANCE_CHECKER"];
    if (!dbUser || !dbUser.isActive || !ALLOWED_ROLES.includes(dbUser.role)) {
      console.warn(
        `Unauthorized access attempt from: ${email} with role: ${dbUser?.role}`
      );
      return NextResponse.redirect(new URL("/unauthorized", publicBase));
    }

    const { role, userId } = dbUser;

    // 4. Issue JWT stored only in an httpOnly cookie
    const token = jwt.sign(
      { userId, email, name, role, iss: "admin-console" },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    const response = NextResponse.redirect(new URL("/", publicBase));

    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    });

    response.cookies.set("admin_role", role, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    });

    response.cookies.set("admin_email", email, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
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
