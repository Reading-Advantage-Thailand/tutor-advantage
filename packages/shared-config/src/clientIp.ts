import { createHmac, timingSafeEqual } from "crypto";
import { isIP } from "net";

/*
 * Logins reach identity-service server-to-server from the Next apps, so the
 * request IP is the app's own and every user would share one rate-limit
 * bucket. The apps forward the user's IP in CLIENT_IP_HEADER with an HMAC
 * keyed from JWT_SECRET (which they already hold), so a service can count
 * each user's own IP without trusting a header anyone could set.
 * apps/student-liff and apps/tutor-pwa sign it the same way (src/lib/clientIp.ts).
 */
export const CLIENT_IP_HEADER = "x-ta-client-ip";
export const CLIENT_IP_SIGNATURE_HEADER = "x-ta-client-ip-signature";

type HeaderBag = Record<string, string | string[] | undefined>;

function headerValue(headers: HeaderBag, name: string) {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export function signClientIp(ip: string, jwtSecret: string) {
  // A derived key keeps these signatures apart from session token signatures.
  const key = createHmac("sha256", jwtSecret).update("tutor-advantage/client-ip/v1").digest();
  return createHmac("sha256", key).update(ip).digest("base64url");
}

/** The end user's IP forwarded by one of our apps, or null when absent or not signed by us. */
export function forwardedClientIp(headers: HeaderBag, jwtSecret: string): string | null {
  const ip = headerValue(headers, CLIENT_IP_HEADER)?.trim();
  const signature = headerValue(headers, CLIENT_IP_SIGNATURE_HEADER);
  if (!ip || !signature || !isIP(ip)) return null;
  const expected = Buffer.from(signClientIp(ip, jwtSecret));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given) ? ip : null;
}

/** The session token from `Authorization: Bearer` or the app session cookies, as authMiddleware reads it. */
export function sessionTokenFromHeaders(headers: HeaderBag): string | null {
  const authorization = headerValue(headers, "authorization");
  if (authorization !== undefined) {
    return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() || null : null;
  }
  const cookies = headerValue(headers, "cookie")?.split(";").map((part) => part.trim()) || [];
  const session = cookies.find((part) => part.startsWith("student-session=") || part.startsWith("tutor_session="));
  return session ? session.slice(session.indexOf("=") + 1) || null : null;
}
