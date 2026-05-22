"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyFacebookToken = verifyFacebookToken;
const axios_1 = __importDefault(require("axios"));
async function verifyFacebookToken(code, redirectUri) {
    const clientId = process.env.AUTH_FACEBOOK_ID;
    const clientSecret = process.env.AUTH_FACEBOOK_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error("Facebook OAuth credentials not configured");
    }
    // 1. Exchange code for access token
    const tokenResponse = await axios_1.default.get("https://graph.facebook.com/v19.0/oauth/access_token", {
        params: {
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code,
        },
    });
    const { access_token } = tokenResponse.data;
    // 2. Fetch user profile
    const profileResponse = await axios_1.default.get("https://graph.facebook.com/me", {
        params: {
            fields: "id,name,email,picture.type(large)",
            access_token,
        },
    });
    const profile = profileResponse.data;
    return {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture?.data?.url,
    };
}
