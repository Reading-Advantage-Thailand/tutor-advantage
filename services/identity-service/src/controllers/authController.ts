import { Request, Response } from "express";
import { verifyGoogleToken } from "../services/oauth/googleAuth";
import { verifyFacebookToken } from "../services/oauth/facebookAuth";
import { processOAuthLogin } from "../services/authService";

export async function handleOAuthCallback(req: Request, res: Response) {
  try {
    // The request body matches the OpenAPI definition: { provider, code }
    const { provider, code } = req.body;

    // Hardcoded redirect URI for local dev for now
    const redirectUri =
      process.env.OAUTH_REDIRECT_URI || "http://localhost:3000/auth/callback";

    if (!provider || !code) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "Missing provider or authorization code",
          requestId: req.id,
        },
      });
    }

    let providerSubject = "";
    let email = "";
    let name = "";

    // Route to appropriate OAuth handler
    if (provider === "google") {
      const profile = await verifyGoogleToken(code, redirectUri);
      providerSubject = profile.id;
      email = profile.email;
      name = profile.name;
    } else if (provider === "facebook") {
      const profile = await verifyFacebookToken(code, redirectUri);
      providerSubject = profile.id;
      email = profile.email;
      name = profile.name;
    } else {
      // LINE provider not yet implemented, return 400
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
