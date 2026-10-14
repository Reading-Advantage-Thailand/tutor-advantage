import { describe, expect, it } from "vitest";
import {
  NAV_DEPTH_KEY,
  canGoBackInApp,
  decideBackAction,
  getActiveTab,
  installNavigationTracker,
  isTabRootPath,
  normalizePath,
  readNavDepth,
  withNavDepth,
  type NavigationTrackerWindow,
} from "./navigation";

/** Minimal in-memory History implementation (push/replace/back like a browser). */
function createFakeWindow(initialState: unknown = null) {
  const entries: { state: unknown; url: string }[] = [{ state: initialState, url: "/" }];
  let index = 0;
  const history = {
    get state() {
      return entries[index].state;
    },
    pushState(data: unknown, _unused: string, url?: string | URL | null) {
      entries.splice(index + 1);
      entries.push({ state: data, url: String(url ?? entries[index].url) });
      index += 1;
    },
    replaceState(data: unknown, _unused: string, url?: string | URL | null) {
      entries[index] = { state: data, url: String(url ?? entries[index].url) };
    },
    back() {
      if (index > 0) index -= 1;
    },
  };
  const win = { history } as NavigationTrackerWindow & { history: typeof history };
  return { win, entries, getIndex: () => index };
}

/** Mimics Next.js app-router's own history patch (copies __NA into external calls). */
function installNextLikePatch(win: NavigationTrackerWindow) {
  const push = win.history.pushState.bind(win.history);
  const replace = win.history.replaceState.bind(win.history);
  const copy = (data: unknown) => {
    const next = (data ?? {}) as Record<string, unknown>;
    const current = win.history.state as Record<string, unknown> | null;
    if (current?.__NA) next.__NA = current.__NA;
    return next;
  };
  win.history.pushState = (data, unused, url) =>
    (data as Record<string, unknown> | null)?.__NA ? push(data, unused, url) : push(copy(data), unused, url);
  win.history.replaceState = (data, unused, url) =>
    (data as Record<string, unknown> | null)?.__NA ? replace(data, unused, url) : replace(copy(data), unused, url);
}

describe("tab root matching", () => {
  it("normalizes paths", () => {
    expect(normalizePath("/classes/")).toBe("/classes");
    expect(normalizePath("/classes?q=a#x")).toBe("/classes");
    expect(normalizePath("")).toBe("/");
    expect(normalizePath(null)).toBe("/");
    expect(normalizePath("/")).toBe("/");
  });

  it("matches only exact tab roots", () => {
    expect(isTabRootPath("/dashboard")).toBe(true);
    expect(isTabRootPath("/classes")).toBe(true);
    expect(isTabRootPath("/classes/")).toBe(true);
    expect(isTabRootPath("/progress")).toBe(true);
    expect(isTabRootPath("/profile")).toBe(true);
    expect(isTabRootPath("/classes/abc")).toBe(false);
    expect(isTabRootPath("/chat")).toBe(false);
    expect(isTabRootPath("/dashboards")).toBe(false);
    expect(isTabRootPath("/")).toBe(false);
    expect(getActiveTab("/progress")).toBe("/progress");
    expect(getActiveTab("/payment")).toBeNull();
  });
});

describe("back navigation decision", () => {
  it("only goes back when there is in-app history", () => {
    expect(decideBackAction(null)).toBe("replace");
    expect(decideBackAction(0)).toBe("replace");
    expect(decideBackAction(2)).toBe("back");
  });

  it("reads and stamps depth safely", () => {
    expect(readNavDepth(null)).toBeNull();
    expect(readNavDepth({ [NAV_DEPTH_KEY]: "1" })).toBeNull();
    expect(readNavDepth({ [NAV_DEPTH_KEY]: -1 })).toBeNull();
    expect(readNavDepth({ [NAV_DEPTH_KEY]: 3 })).toBe(3);
    expect(withNavDepth(null, 1)).toEqual({ [NAV_DEPTH_KEY]: 1 });
    expect(withNavDepth({ __NA: true }, 2)).toEqual({ __NA: true, [NAV_DEPTH_KEY]: 2 });
    const custom = new Map();
    expect(withNavDepth(custom, 2)).toBe(custom);
  });
});

describe("installNavigationTracker", () => {
  it("treats a deep-linked first entry as depth 0", () => {
    const { win } = createFakeWindow({ __NA: true });
    installNavigationTracker(win);
    expect(canGoBackInApp(win)).toBe(false);
  });

  it("counts pushes, keeps depth on replace and follows back", () => {
    const { win } = createFakeWindow({ __NA: true });
    installNavigationTracker(win);
    win.history.pushState({ __NA: true }, "", "/classes/1");
    expect(readNavDepth(win.history.state)).toBe(1);
    expect(canGoBackInApp(win)).toBe(true);

    // router.refresh() / router.replace() keep the entry's depth
    win.history.replaceState({ __NA: true }, "", "/classes/1?tab=2");
    expect(readNavDepth(win.history.state)).toBe(1);

    win.history.pushState({ __NA: true }, "", "/lesson/1");
    expect(readNavDepth(win.history.state)).toBe(2);

    win.history.back();
    expect(readNavDepth(win.history.state)).toBe(1);
    win.history.back();
    expect(canGoBackInApp(win)).toBe(false);
  });

  it("does not count a login redirect done with replace", () => {
    const { win } = createFakeWindow({ __NA: true });
    installNavigationTracker(win);
    win.history.replaceState({ __NA: true }, "", "/classes/1");
    expect(canGoBackInApp(win)).toBe(false);
  });

  it("works when Next.js patches history after the tracker", () => {
    const { win } = createFakeWindow({ __NA: true });
    installNavigationTracker(win);
    installNextLikePatch(win);
    win.history.pushState(null, "", "/a");
    expect(win.history.state).toMatchObject({ __NA: true, [NAV_DEPTH_KEY]: 1 });
    win.history.replaceState({ __NA: true, tree: 1 }, "", "/a");
    expect(readNavDepth(win.history.state)).toBe(1);
  });

  it("works when Next.js patches history before the tracker", () => {
    const { win } = createFakeWindow({ __NA: true });
    installNextLikePatch(win);
    installNavigationTracker(win);
    win.history.pushState(null, "", "/a");
    expect(win.history.state).toMatchObject({ __NA: true, [NAV_DEPTH_KEY]: 1 });
  });

  it("restores depth from history.state after a reload", () => {
    const { win } = createFakeWindow({ __NA: true, [NAV_DEPTH_KEY]: 2 });
    installNavigationTracker(win);
    expect(canGoBackInApp(win)).toBe(true);
    win.history.pushState({ __NA: true }, "", "/b");
    expect(readNavDepth(win.history.state)).toBe(3);
  });

  it("is idempotent", () => {
    const { win } = createFakeWindow({ __NA: true });
    expect(installNavigationTracker(win)).toBe(true);
    expect(installNavigationTracker(win)).toBe(false);
    win.history.pushState({ __NA: true }, "", "/a");
    expect(readNavDepth(win.history.state)).toBe(1);
  });

  it("reports no in-app history without a window", () => {
    expect(canGoBackInApp(undefined)).toBe(false);
  });
});
