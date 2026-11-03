import { createHmac } from "crypto";

/*
 * Server-to-server calls to identity-service come from this app's IP, shared
 * by every student. Forward the student's own IP, signed, so identity can rate
 * limit logins per student. Same scheme as packages/shared-config/src/clientIp.ts
 * (identity verifies it there); keep the two in step.
 */
export const CLIENT_IP_HEADER = "x-ta-client-ip";
export const CLIENT_IP_SIGNATURE_HEADER = "x-ta-client-ip-signature";

export function signClientIp(ip: string, jwtSecret: string) {
  const key = createHmac("sha256", jwtSecret).update("tutor-advantage/client-ip/v1").digest();
  return createHmac("sha256", key).update(ip).digest("base64url");
}

/** The caller's IP: Cloud Run's front end appends it as the last X-Forwarded-For entry. */
export function requestClientIp(headers: Headers): string | null {
  const entries = headers.get("x-forwarded-for")?.split(",").map((entry) => entry.trim()).filter(Boolean);
  return entries?.length ? entries[entries.length - 1] : null;
}

export function signedClientIpHeaders(headers: Headers, jwtSecret = process.env.JWT_SECRET?.trim()): Record<string, string> {
  const ip = requestClientIp(headers);
  if (!ip || !jwtSecret) return {};
  return { [CLIENT_IP_HEADER]: ip, [CLIENT_IP_SIGNATURE_HEADER]: signClientIp(ip, jwtSecret) };
}
