"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyGoogleToken = verifyGoogleToken;
const axios_1 = __importDefault(require("axios"));
async function verifyGoogleToken(code, redirectUri, codeVerifier) {
    const clientId = process.env.AUTH_GOOGLE_ID;
    const clientSecret = process.env.AUTH_GOOGLE_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error("Google OAuth credentials not configured");
    }
    // 1. Exchange code for access token and id token (include code_verifier for PKCE)
    const tokenPayload = {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
    };
    if (codeVerifier) {
        tokenPayload.code_verifier = codeVerifier;
    }
    const tokenResponse = await axios_1.default.post("https://oauth2.googleapis.com/token", tokenPayload);
    const { access_token } = tokenResponse.data;
    // 2. Fetch user profile
    const profileResponse = await axios_1.default.get("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: {
            Authorization: `Bearer ${access_token}`,
        },
    });
    const profile = profileResponse.data;
    return {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
    };
}
