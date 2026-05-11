"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleOAuthCallback = handleOAuthCallback;
const googleAuth_1 = require("../services/oauth/googleAuth");
const facebookAuth_1 = require("../services/oauth/facebookAuth");
const lineAuth_1 = require("../services/oauth/lineAuth");
const authService_1 = require("../services/authService");
async function handleOAuthCallback(req, res) {
    try {
        // The request body matches the OpenAPI definition: { provider, code }
        const { provider, code, sponsorTutorId } = req.body;
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
        let providerSubject = "";
        let email = "";
        let name = "";
        let picture = "";
        // Route to appropriate OAuth handler
        if (provider === "google") {
            const profile = await (0, googleAuth_1.verifyGoogleToken)(code, redirectUri);
            providerSubject = profile.id;
            email = profile.email;
            name = profile.name;
            picture = profile.picture || "";
        }
        else if (provider === "facebook") {
            const profile = await (0, facebookAuth_1.verifyFacebookToken)(code, redirectUri);
            providerSubject = profile.id;
            email = profile.email;
            name = profile.name;
            picture = profile.picture || "";
            picture = profile.picture || "";
        }
        else if (provider === "line") {
            const profile = await (0, lineAuth_1.verifyLineToken)(code); // For LINE, code is the ID token
            providerSubject = profile.id;
            email = profile.email || "";
            name = profile.name;
            picture = profile.picture || "";
        }
        else {
            // Unsupported provider
            return res.status(400).json({
                error: {
                    code: "UNSUPPORTED_PROVIDER",
                    message: `Provider '${provider}' is not supported yet`,
                    requestId: req.id,
                },
            });
        }
        const authResult = await (0, authService_1.processOAuthLogin)(provider, providerSubject, email, name, picture, typeof sponsorTutorId === "string" ? sponsorTutorId : null);
        return res.status(200).json(authResult);
    }
    catch (error) {
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
