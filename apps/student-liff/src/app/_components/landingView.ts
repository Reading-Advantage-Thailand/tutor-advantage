/**
 * Pure routing decision for the "/" entry (LIFF endpoint + marketing page).
 * No imports from "@/…": vitest maps "@" to another app.
 */

/**
 * - "splash": LIFF is still starting — branded splash, never the marketing page.
 * - "redirect": logged in — splash while router.replace("/dashboard") runs.
 * - "error": opened from LINE and start-up failed — friendly error with retry.
 * - "lineLogin": opened from LINE but not logged in — splash with a login button.
 * - "marketing": a regular browser that is not logged in.
 */
export type LandingView = "splash" | "redirect" | "error" | "lineLogin" | "marketing";

export interface LandingState {
  isReady: boolean;
  hasError: boolean;
  isLoggedIn: boolean;
  hasProfile: boolean;
  /** The LINE in-app browser / LIFF client (see isLineInAppBrowser). */
  inLine: boolean;
  /** The URL carries LIFF's `liff.state` bootstrap param. */
  hasLiffState: boolean;
}

export function decideLandingView(state: LandingState): LandingView {
  if (!state.isReady) return "splash";
  // Same condition as before the redesign: ready + LINE login + profile → dashboard.
  if (state.isLoggedIn && state.hasProfile) return "redirect";
  if (!state.inLine && !state.hasLiffState) return "marketing";
  return state.hasError ? "error" : "lineLogin";
}

/** LINE's in-app browser user agent contains " Line/<version>" (same check as LiffProvider telemetry). */
export function isLineInAppBrowser(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent) && String(userAgent).toLowerCase().includes(" line/");
}

/** True when the query string contains LIFF's `liff.state` (secondary redirect) param. */
export function hasLiffStateParam(search: string | null | undefined): boolean {
  if (!search) return false;
  try {
    return new URLSearchParams(search).has("liff.state");
  } catch {
    return false;
  }
}
