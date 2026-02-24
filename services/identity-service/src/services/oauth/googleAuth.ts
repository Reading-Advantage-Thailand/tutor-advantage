import axios from "axios";

export interface GoogleProfile {
  id: string;
  email: string;
  name: string;
}

export async function verifyGoogleToken(
  code: string,
  redirectUri: string,
): Promise<GoogleProfile> {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  // 1. Exchange code for access token and id token
  const tokenResponse = await axios.post(
    "https://oauth2.googleapis.com/token",
    {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    },
  );

  const { id_token, access_token } = tokenResponse.data;

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
    name: profile.name,
  };
}
