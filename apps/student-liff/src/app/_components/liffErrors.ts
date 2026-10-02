/**
 * Pure helpers for the LIFF start-up error screen shown on "/" and "/login".
 * No imports from "@/…": vitest maps "@" to another app.
 */

/** LiffProvider's error category (mirrors LiffErrorCode) plus our own session-probe failure. */
export type LiffErrorKind = "config" | "network" | "auth" | "session" | "unknown";

type LiffErrorCodeLike = "config" | "network" | "auth" | "unknown" | null | undefined;

/**
 * Technical detail for a failed session probe after a successful LINE login.
 * Shown only inside the collapsed "รายละเอียด" disclosure (the screen itself
 * shows friendly Thai copy), so it is not translated.
 */
export const SESSION_ERROR_DETAIL =
  "SESSION_NOT_READY: LINE login succeeded but /api/auth/session did not confirm the student session";

/**
 * Which friendly error to show. A LiffProvider failure wins (its `errorCode`);
 * otherwise a failed waitForSession() after a successful LINE login is "session".
 */
export function getLiffErrorKind(errorCode: LiffErrorCodeLike, sessionError?: string | null): LiffErrorKind {
  if (errorCode) return errorCode;
  if (sessionError) return "session";
  return "unknown";
}

/**
 * What the "ลองอีกครั้ง" button does:
 * - "logoutReload": LINE login looked fine but our session was rejected — end the
 *   LINE login and reload so LIFF fetches a fresh ID token (the original login-page
 *   behaviour for a logged-in user with an error).
 * - "login": not logged in to LINE yet — start the LINE login (original behaviour).
 * - "reload": network / config / unknown — the token is not the problem, so just
 *   re-run start-up (useLiff().retry()). Logging out would only add a LINE round trip.
 */
export type LiffRetryAction = "logoutReload" | "login" | "reload";

export function decideRetryAction({ kind, isLoggedIn }: { kind: LiffErrorKind; isLoggedIn: boolean }): LiffRetryAction {
  if (kind === "auth" || kind === "session") {
    return isLoggedIn ? "logoutReload" : "login";
  }
  return "reload";
}

/** `liff.isLoggedIn()` that never throws (LIFF throws/returns junk when init failed). */
export function safeIsLoggedIn(liff: { isLoggedIn: () => boolean } | null | undefined): boolean {
  if (!liff) return false;
  try {
    return Boolean(liff.isLoggedIn());
  } catch {
    return false;
  }
}
