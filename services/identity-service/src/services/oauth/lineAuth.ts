import jwt from "jsonwebtoken";

export interface LineProfile {
  id: string;
  name: string;
  email?: string;
  picture?: string;
}

/**
 * Verifies a LINE ID Token (JWT)
 * In a production app, we would verify the signature using LINE's public keys
 * or use the LINE API token verification endpoint.
 */
export async function verifyLineToken(idToken: string): Promise<LineProfile> {
  try {
    // In production, we MUST verify the signature to prevent token forgery
    const secret = process.env.LINE_CHANNEL_SECRET || "fallback_dev_secret";
    const decoded = jwt.verify(idToken, secret, {
      algorithms: ["HS256"], // Assuming HS256 for symmetric, or adjust based on LINE's spec
    }) as any;
    
    if (!decoded) {
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
