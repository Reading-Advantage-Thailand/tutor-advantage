import type { Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";
import jwt from "jsonwebtoken";
import { forwardedClientIp, getJwtSecret, sessionTokenFromHeaders } from "@tutor-advantage/shared-config";

/**
 * Rate-limit key for /v1. Students reach it through student-liff's proxy, so
 * the request IP is the app's and would put every student in one bucket.
 * Signed-in users are counted by their session instead; anyone else by the
 * IP an app forwarded (signed), or the caller's own IP.
 */
export function learningRateLimitKey(req: Request) {
  const token = sessionTokenFromHeaders(req.headers);
  if (token) {
    try {
      const { userId } = jwt.verify(token, getJwtSecret()) as { userId?: unknown };
      if (typeof userId === "string" && userId) return `user:${userId}`;
    } catch {
      // An invalid token earns no budget of its own; count it by IP.
    }
  }
  return `ip:${ipKeyGenerator(forwardedClientIp(req.headers, getJwtSecret()) || req.ip || "unknown")}`;
}
