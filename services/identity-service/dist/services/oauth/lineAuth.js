"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyLineToken = verifyLineToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
/**
 * Verifies a LINE ID Token (JWT)
 * In a production app, we would verify the signature using LINE's public keys
 * or use the LINE API token verification endpoint.
 */
async function verifyLineToken(idToken) {
    try {
        // In production, we MUST verify the signature to prevent token forgery
        const secret = process.env.LINE_CHANNEL_SECRET || "fallback_dev_secret";
        const decoded = jsonwebtoken_1.default.verify(idToken, secret, {
            algorithms: ["HS256"], // Assuming HS256 for symmetric, or adjust based on LINE's spec
        });
        if (!decoded) {
            throw new Error("Invalid LINE ID Token");
        }
        return {
            id: decoded.sub,
            name: decoded.name || "LINE User",
            email: decoded.email,
            picture: decoded.picture,
        };
    }
    catch (err) {
        console.error("LINE Token Verification Error:", err);
        throw new Error("Failed to verify LINE token");
    }
}
