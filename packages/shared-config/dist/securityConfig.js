"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJwtSecret = getJwtSecret;
exports.getAllowedOrigins = getAllowedOrigins;
exports.isOriginAllowed = isOriginAllowed;
exports.areDevRoutesEnabled = areDevRoutesEnabled;
exports.assertProductionSecurityConfig = assertProductionSecurityConfig;
const DEVELOPMENT_JWT_SECRET = "secret-for-dev-only-change-me";
function getJwtSecret(env = process.env) {
    const value = env.JWT_SECRET?.trim();
    if (env.NODE_ENV === "production") {
        if (!value || value === DEVELOPMENT_JWT_SECRET || value.length < 32) {
            throw new Error("JWT_SECRET must be set to at least 32 characters in production");
        }
    }
    return value || DEVELOPMENT_JWT_SECRET;
}
function getAllowedOrigins(env = process.env) {
    const configured = env.ALLOWED_ORIGINS
        ?.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    if (configured?.length)
        return configured;
    if (env.NODE_ENV === "production") {
        throw new Error("ALLOWED_ORIGINS must be set in production");
    }
    return [
        "http://localhost:3000",
        "http://localhost:3004",
        "http://localhost:3005",
        "http://localhost:3006",
    ];
}
function isOriginAllowed(origin, allowedOrigins, env = process.env) {
    if (!origin)
        return true;
    if (allowedOrigins.includes(origin))
        return true;
    if (env.NODE_ENV !== "production" &&
        env.ALLOW_NGROK_ORIGINS === "true") {
        return /^https:\/\/[a-z0-9-]+\.(ngrok-free\.app|ngrok-free\.dev|ngrok\.io)$/i.test(origin);
    }
    return false;
}
function areDevRoutesEnabled(env = process.env) {
    return (env.NODE_ENV !== "production" && env.ENABLE_DEV_ROUTES === "true");
}
function assertProductionSecurityConfig(env = process.env) {
    if (env.NODE_ENV !== "production")
        return;
    getJwtSecret(env);
    getAllowedOrigins(env);
}
