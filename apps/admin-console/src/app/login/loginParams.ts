/**
 * Pure helpers for /login (tested; relative imports only).
 */

const FALLBACK = "/";

/**
 * Where to go after login: the `?next=` the middleware set, but ONLY a
 * same-origin relative path. Rejects absolute/protocol-relative URLs
 * ("https://evil", "//evil", "/\\evil"), control characters, and the auth
 * pages themselves, so `next` can never become an open redirect or a loop.
 */
export function safeNextPath(raw: string | string[] | null | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || value.length > 512) return FALLBACK;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return FALLBACK;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return FALLBACK;
  let url: URL;
  try {
    url = new URL(value, "http://admin.invalid");
  } catch {
    return FALLBACK;
  }
  if (url.origin !== "http://admin.invalid") return FALLBACK;
  const path = url.pathname;
  if (path === "/login" || path.startsWith("/login/") || path === "/unauthorized" || path.startsWith("/api/")) {
    return FALLBACK;
  }
  return `${path}${url.search}${url.hash}`;
}

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
