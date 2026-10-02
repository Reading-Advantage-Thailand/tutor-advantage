/**
 * Pure navigation helpers for the mobile shell (no React, no Next imports, so
 * they are unit-testable and safe to import from server or client code).
 *
 * - Tab-root matching for the persistent <TabBar>.
 * - In-app history depth tracking used by `useBackNavigation`: every history
 *   entry created while the app is open is stamped with its depth (how many
 *   in-app entries sit behind it). Back navigation is only allowed when the
 *   depth is > 0, so a LIFF deep link (depth 0) never calls `history.back()`
 *   and therefore never exits the app or does nothing.
 */

/** The four bottom-tab destinations, in display order. */
export const TAB_ROOTS = ["/dashboard", "/classes", "/progress", "/profile"] as const;

export type TabRoot = (typeof TAB_ROOTS)[number];

/** Strips query/hash and trailing slashes: "/classes/?q=1" → "/classes". */
export function normalizePath(pathname: string | null | undefined): string {
  if (!pathname) return "/";
  const path = pathname.split(/[?#]/)[0] || "/";
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** True only for the exact tab roots (e.g. "/classes" but not "/classes/123"). */
export function isTabRootPath(pathname: string | null | undefined): boolean {
  return getActiveTab(pathname) !== null;
}

/** The tab root that `pathname` is exactly on, or null on any other screen. */
export function getActiveTab(pathname: string | null | undefined): TabRoot | null {
  const path = normalizePath(pathname);
  return (TAB_ROOTS as readonly string[]).includes(path) ? (path as TabRoot) : null;
}

/** Key stored in `history.state` holding the entry's in-app depth. */
export const NAV_DEPTH_KEY = "__taDepth";

/** Reads the stamped depth from a history state object (null when absent). */
export function readNavDepth(state: unknown): number | null {
  if (!state || typeof state !== "object") return null;
  const value = (state as Record<string, unknown>)[NAV_DEPTH_KEY];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Decides what a back button should do for a given depth. */
export function decideBackAction(depth: number | null | undefined): "back" | "replace" {
  return typeof depth === "number" && depth > 0 ? "back" : "replace";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Returns `data` with the depth stamped in (non-object states pass through). */
export function withNavDepth(data: unknown, depth: number): unknown {
  if (data === null || data === undefined) return { [NAV_DEPTH_KEY]: depth };
  if (isPlainObject(data)) return { ...data, [NAV_DEPTH_KEY]: depth };
  return data;
}

type HistoryMethod = (data: unknown, unused: string, url?: string | URL | null) => void;

/** The subset of `window` the tracker needs (keeps it testable without a DOM). */
export interface NavigationTrackerWindow {
  history: {
    state: unknown;
    pushState: HistoryMethod;
    replaceState: HistoryMethod;
  };
}

const INSTALLED_FLAG = "__taNavTrackerInstalled";

/**
 * Wraps `history.pushState` / `history.replaceState` once per document so each
 * entry carries its in-app depth: push = current depth + 1, replace = current
 * depth. It works whichever of this wrapper or Next.js's own history patch is
 * installed first, survives `router.refresh()` (which replaces the state), and
 * reloads (browsers keep `history.state`). A full-page navigation starts a new
 * document at depth 0, which errs on the safe side (fallback instead of back).
 *
 * Idempotent: calling it again is a no-op. Returns true when it installed.
 */
export function installNavigationTracker(win: NavigationTrackerWindow): boolean {
  const flagHost = win as unknown as Record<string, unknown>;
  if (flagHost[INSTALLED_FLAG]) return false;
  flagHost[INSTALLED_FLAG] = true;

  const history = win.history;
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;

  history.pushState = function pushState(this: unknown, data, unused, url) {
    const depth = (readNavDepth(history.state) ?? 0) + 1;
    return originalPush.call(this ?? history, withNavDepth(data, depth), unused, url);
  };
  history.replaceState = function replaceState(this: unknown, data, unused, url) {
    const depth = readNavDepth(history.state) ?? 0;
    return originalReplace.call(this ?? history, withNavDepth(data, depth), unused, url);
  };
  return true;
}

/** Whether `history.back()` would land on an in-app screen. */
export function canGoBackInApp(win: { history: { state: unknown } } | undefined): boolean {
  if (!win) return false;
  return decideBackAction(readNavDepth(win.history.state)) === "back";
}
