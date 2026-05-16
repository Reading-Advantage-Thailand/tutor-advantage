export interface LineProfile {
  id: string;
  name: string;
  email?: string;
  picture?: string;
}

interface LineVerifyResponse {
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
  error?: string;
  error_description?: string;
}

/**
 * Verifies a LINE ID token with LINE's official endpoint.
 */
export async function verifyLineToken(idToken: string): Promise<LineProfile> {
  try {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    const clientId = process.env.LINE_CHANNEL_ID || liffId?.split("-")[0];

    if (!clientId) {
      throw new Error("LINE_CHANNEL_ID or NEXT_PUBLIC_LIFF_ID is not configured");
    }

    const params = new URLSearchParams({
      id_token: idToken,
      client_id: clientId,
    });

    const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const decoded = (await response.json()) as LineVerifyResponse;

    if (!response.ok || !decoded.sub) {
      const reason = decoded.error_description || decoded.error || "Invalid LINE ID Token";
      throw new Error(reason);
    }

    if (!decoded.sub) {
      throw new Error("Invalid LINE ID Token");
    }

    return {
      id: decoded.sub,
      name: decoded.name || "LINE User",
      email: decoded.email,
      picture: decoded.picture,
    };
  } catch (err) {
    console.error("LINE Token Verification Error:", err);
    throw new Error("Failed to verify LINE token");
  }
}
