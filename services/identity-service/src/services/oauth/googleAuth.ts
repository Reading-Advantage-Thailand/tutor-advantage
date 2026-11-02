import axios from "axios";

export interface GoogleProfile {
  id: string;
  email: string;
  /** Whether Google has verified that this account owns `email`. */
  emailVerified: boolean;
  name: string;
  picture?: string;
}

export async function verifyGoogleToken(
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<GoogleProfile> {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  // 1. Exchange code for access token and id token (include code_verifier for PKCE)
  const tokenPayload: Record<string, string> = {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  };
  if (codeVerifier) {
    tokenPayload.code_verifier = codeVerifier;
  }

  const tokenResponse = await axios.post(
    "https://oauth2.googleapis.com/token",
    tokenPayload,
  );

  const { access_token } = tokenResponse.data;

  // 2. Fetch user profile
  const profileResponse = await axios.get(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    },
  );

  const profile = profileResponse.data;

  return {
    id: profile.id,
    email: profile.email,
    // Same rule as the admin console callback: only an explicit true counts.
    emailVerified: profile.verified_email === true || profile.email_verified === true,
    name: profile.name,
    picture: profile.picture,
  };
}
