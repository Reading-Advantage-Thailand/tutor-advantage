import axios from "axios";

export interface FacebookProfile {
  id: string;
  email: string;
  name: string;
}

export async function verifyFacebookToken(
  code: string,
  redirectUri: string,
): Promise<FacebookProfile> {
  const clientId = process.env.AUTH_FACEBOOK_ID;
  const clientSecret = process.env.AUTH_FACEBOOK_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Facebook OAuth credentials not configured");
  }

  // 1. Exchange code for access token
  const tokenResponse = await axios.get(
    "https://graph.facebook.com/v19.0/oauth/access_token",
    {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      },
    },
  );

  const { access_token } = tokenResponse.data;

  // 2. Fetch user profile
  const profileResponse = await axios.get("https://graph.facebook.com/me", {
    params: {
      fields: "id,name,email",
      access_token,
    },
  });

  const profile = profileResponse.data;

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
  };
}
