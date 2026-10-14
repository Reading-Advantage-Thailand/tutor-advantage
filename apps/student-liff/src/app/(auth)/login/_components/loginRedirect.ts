/**
 * Where to go after login: `?redirect=` when it is a same-origin path,
 * otherwise /dashboard. Prevents open redirects ("//evil.com", "https://…",
 * and "/\t/evil.com", which URL parsing turns into "//evil.com").
 * Pure (no "@/…" imports) so vitest can load it.
 */
export const DEFAULT_LOGIN_REDIRECT = "/dashboard";

/** Placeholder origin used only to check where a path would resolve. */
const PROBE_ORIGIN = "https://same-origin.invalid";

function isSameOriginPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  try {
    // router.replace() resolves the path like this: tabs/newlines are dropped
    // and "\" counts as "/", so "/\t/evil.com" would leave the app.
    return new URL(path, PROBE_ORIGIN).origin === PROBE_ORIGIN;
  } catch {
    return false;
  }
}

export function getSafeRedirect(search: string | null | undefined): string {
  let raw: string | null = null;
  try {
    raw = search ? new URLSearchParams(search).get("redirect") : null;
  } catch {
    raw = null;
  }
  const candidate = raw || DEFAULT_LOGIN_REDIRECT;
  return isSameOriginPath(candidate) ? candidate : DEFAULT_LOGIN_REDIRECT;
}
