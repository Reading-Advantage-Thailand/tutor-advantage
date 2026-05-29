import { Request, Response } from "express";
import { verifyGoogleToken } from "../services/oauth/googleAuth";
import { verifyLineToken } from "../services/oauth/lineAuth";
import { processOAuthLogin } from "../services/authService";

export async function handleOAuthCallback(req: Request, res: Response) {
  try {
    // The request body matches the OpenAPI definition: { provider, code }
    const { provider, code, sponsorTutorId, codeVerifier } = req.body;

    // Allow frontend to explicitly pass the exact redirectUri used, or fallback
    const baseUrl = process.env.OAUTH_REDIRECT_URI || "http://localhost:3000/api/auth/callback";
    const redirectUri = req.body.redirectUri || `${baseUrl}/${provider}`;

    if (!provider || !code) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "Missing provider or authorization code",
          requestId: req.id,
        },
      });
    }

    if (provider === "facebook") {
      return res.status(403).json({
        error: {
          code: "PROVIDER_DISABLED",
          message: "Facebook login is temporarily disabled",
          requestId: req.id,
        },
      });
    }

    let providerSubject = "";
    let email = "";
    let name = "";
    let picture = "";

    // Route to appropriate OAuth handler
    if (provider === "google") {
      const profile = await verifyGoogleToken(code, redirectUri, codeVerifier ?? undefined);
      providerSubject = profile.id;
      email = profile.email;
      name = profile.name;
      picture = profile.picture || "";
    } else if (provider === "line") {
      const profile = await verifyLineToken(code); // For LINE, code is the ID token
      providerSubject = profile.id;
      email = profile.email || "";
      name = profile.name;
      picture = profile.picture || "";
    } else {
      // Unsupported provider
      return res.status(400).json({
        error: {
          code: "UNSUPPORTED_PROVIDER",
          message: `Provider '${provider}' is not supported yet`,
          requestId: req.id,
        },
      });
    }

    const authResult = await processOAuthLogin(
      provider,
      providerSubject,
      email,
      name,
      picture,
      typeof sponsorTutorId === "string" ? sponsorTutorId : null,
    );

    return res.status(200).json(authResult);
  } catch (error: any) {
    console.error("OAuth Callback Error:", error);
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid authorization code or provider error",
        details: error.message,
        requestId: req.id,
      },
    });
  }
}
