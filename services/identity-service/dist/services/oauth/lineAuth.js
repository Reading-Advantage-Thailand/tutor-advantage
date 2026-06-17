"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyLineToken = verifyLineToken;
const shared_config_1 = require("@tutor-advantage/shared-config");
function decodeLineTokenDebug(idToken) {
    const [, payload] = idToken.split(".");
    if (!payload) {
        return null;
    }
    try {
        const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
        const paddedPayload = normalizedPayload.padEnd(normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4), "=");
        const decoded = JSON.parse(Buffer.from(paddedPayload, "base64").toString("utf8"));
        return {
            aud: decoded.aud,
            iss: decoded.iss,
            exp: decoded.exp,
            iat: decoded.iat,
        };
    }
    catch {
        return null;
    }
}
/**
 * Verifies a LINE ID token with LINE's official endpoint.
 */
async function verifyLineToken(idToken) {
    try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        const liffClientId = liffId?.split("-")[0];
        const tutorClientId = process.env.LINE_CHANNEL_ID;
        const tokenDebug = decodeLineTokenDebug(idToken);
        let clientId = tutorClientId;
        if (tokenDebug?.aud) {
            const aud = Array.isArray(tokenDebug.aud) ? tokenDebug.aud[0] : tokenDebug.aud;
            if (aud === liffClientId) {
                clientId = liffClientId;
            }
            else if (aud === tutorClientId) {
                clientId = tutorClientId;
            }
        }
        clientId = clientId || tutorClientId || liffClientId;
        if (!clientId) {
            throw new Error("LINE_CHANNEL_ID or NEXT_PUBLIC_LIFF_ID is not configured");
        }
        if (process.env.NODE_ENV !== "production") {
            shared_config_1.logger.info("[LINE] Verifying ID token", {
                expectedClientId: clientId,
                configuredLiffId: liffId,
                tokenAudience: tokenDebug?.aud,
                tokenIssuer: tokenDebug?.iss,
                tokenExpiresAt: tokenDebug?.exp
                    ? new Date(tokenDebug.exp * 1000).toISOString()
                    : undefined,
            });
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
        const decoded = (await response.json());
        if (!response.ok || !decoded.sub) {
            const reason = decoded.error_description || decoded.error || "Invalid LINE ID Token";
            throw new Error(`${reason} (expected client_id: ${clientId}, token aud: ${JSON.stringify(tokenDebug?.aud ?? null)})`);
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
    }
    catch (error) {
        const err = error;
        shared_config_1.logger.error("LINE Token Verification Error:", err);
        if (process.env.NODE_ENV !== "production") {
            throw new Error(err.message);
        }
        throw new Error("Failed to verify LINE token");
    }
}
