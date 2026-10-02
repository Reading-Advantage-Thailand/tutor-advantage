/**
 * Post-login redirect target (`next`) helpers, shared by /login (server page),
 * the middleware and the Google OAuth routes. Edge-safe, relative imports only
 * (also loaded by vitest).
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

/**
 * Short-lived cookie that carries `next` across the Google OAuth round-trip
 * (/api/auth/google → Google → /api/auth/callback/google). httpOnly + Lax so
 * it survives the top-level redirect back from Google; re-validated with
 * safeNextPath on read and cleared after use.
 */
export const OAUTH_NEXT_COOKIE = "admin_oauth_next";
const OAUTH_NEXT_TTL = 60 * 10;

function oauthNextCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

type CookieWriter = {
  cookies: { set: (name: string, value: string, options: ReturnType<typeof oauthNextCookieOptions>) => unknown };
};

/** Remember a validated `next` for the OAuth callback (or clear a stale one). */
export function setOAuthNextCookie(response: CookieWriter, raw: string | null | undefined) {
  const next = safeNextPath(raw);
  if (next === FALLBACK) clearOAuthNextCookie(response);
  else response.cookies.set(OAUTH_NEXT_COOKIE, next, oauthNextCookieOptions(OAUTH_NEXT_TTL));
}

export function clearOAuthNextCookie(response: CookieWriter) {
  response.cookies.set(OAUTH_NEXT_COOKIE, "", oauthNextCookieOptions(0));
}
