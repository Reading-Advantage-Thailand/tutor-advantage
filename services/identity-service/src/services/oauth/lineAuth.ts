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
    // Decode without full verification for now in development
    // In production, use line-id-token or verify with channel secret
    const decoded = jwt.decode(idToken) as any;
    
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
