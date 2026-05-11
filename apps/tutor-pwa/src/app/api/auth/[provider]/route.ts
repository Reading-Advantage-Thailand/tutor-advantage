import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const reqUrl = new URL(request.url);
  const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;
  const redirectUri = `${baseUrl}/api/auth/callback/${provider}`;
  const cookieStore = await cookies();
  const sponsor =
    reqUrl.searchParams.get("sponsor") ||
    cookieStore.get("tutor_invite_sponsor")?.value;
  const state = sponsor ? `sponsor:${sponsor}` : undefined;

  if (provider === "google") {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "1090865515742-2va7ui46kpb426bqvssi7jfb40oe9eol.apps.googleusercontent.com";
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=openid%20email%20profile${state ? `&state=${encodeURIComponent(state)}` : ""}`;
    return NextResponse.redirect(googleAuthUrl);
  }

  if (provider === "facebook") {
    const clientId = process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID || "123456789"; // Mock FB ID
    const facebookAuthUrl = `https://www.facebook.com/v11.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=public_profile,email${state ? `&state=${encodeURIComponent(state)}` : ""}`;
    return NextResponse.redirect(facebookAuthUrl);
  }

  return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
}
