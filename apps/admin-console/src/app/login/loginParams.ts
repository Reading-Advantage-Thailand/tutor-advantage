/**
 * Pure helpers for /login (tested; relative imports only).
 */

export { safeNextPath } from "../../lib/nextPath";

/** Login error codes set by /api/auth/callback/google (and dev-login). */
export const LOGIN_ERROR_CODES = [
  "email_not_verified",
  "invalid_state",
  "missing_code",
  "google_token_failed",
  "google_profile_failed",
  "internal_server_error",
  "access_denied",
  "session_expired",
] as const;

export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number] | "unknown";

export function loginErrorCode(raw: string | string[] | null | undefined): LoginErrorCode | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  return (LOGIN_ERROR_CODES as readonly string[]).includes(value) ? (value as LoginErrorCode) : "unknown";
}
