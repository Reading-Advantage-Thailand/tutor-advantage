import { describe, expect, it } from "vitest";
import { decideLandingView, hasLiffStateParam, isLineInAppBrowser, type LandingState } from "./landingView";

const base: LandingState = {
  isReady: true,
  hasError: false,
  isLoggedIn: false,
  hasProfile: false,
  inLine: false,
  hasLiffState: false,
};

describe("decideLandingView", () => {
  it("shows the splash until LIFF is ready, in every context", () => {
    expect(decideLandingView({ ...base, isReady: false })).toBe("splash");
    expect(decideLandingView({ ...base, isReady: false, inLine: true })).toBe("splash");
    expect(decideLandingView({ ...base, isReady: false, hasLiffState: true })).toBe("splash");
  });

  it("redirects a logged-in user with a profile (even if a later step reported an error)", () => {
    expect(decideLandingView({ ...base, isLoggedIn: true, hasProfile: true })).toBe("redirect");
    expect(decideLandingView({ ...base, isLoggedIn: true, hasProfile: true, inLine: true })).toBe("redirect");
    expect(decideLandingView({ ...base, isLoggedIn: true, hasProfile: true, hasError: true })).toBe("redirect");
  });

  it("keeps the marketing page for regular browsers that are not logged in", () => {
    expect(decideLandingView(base)).toBe("marketing");
    expect(decideLandingView({ ...base, hasError: true })).toBe("marketing");
    expect(decideLandingView({ ...base, isLoggedIn: true, hasProfile: false })).toBe("marketing");
  });

  it("never shows marketing inside LINE: error screen or a login splash instead", () => {
    expect(decideLandingView({ ...base, inLine: true, hasError: true })).toBe("error");
    expect(decideLandingView({ ...base, hasLiffState: true, hasError: true })).toBe("error");
    expect(decideLandingView({ ...base, inLine: true })).toBe("lineLogin");
    expect(decideLandingView({ ...base, hasLiffState: true })).toBe("lineLogin");
  });
});

describe("isLineInAppBrowser", () => {
  it("detects the LINE in-app browser case-insensitively", () => {
    expect(
      isLineInAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.2.0",
      ),
    ).toBe(true);
    expect(isLineInAppBrowser("Mozilla/5.0 (Linux; Android 13) Chrome/124.0 Mobile Safari/537.36 LINE/14.1.2/IAB")).toBe(true);
  });

  it("ignores regular browsers and words that merely contain 'line'", () => {
    expect(isLineInAppBrowser("Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/124.0.0.0 Mobile Safari/537.36")).toBe(false);
    expect(isLineInAppBrowser("Mozilla/5.0 Offline/1.0")).toBe(false);
    expect(isLineInAppBrowser("")).toBe(false);
    expect(isLineInAppBrowser(null)).toBe(false);
    expect(isLineInAppBrowser(undefined)).toBe(false);
  });
});

describe("hasLiffStateParam", () => {
  it("finds liff.state in the query string", () => {
    expect(hasLiffStateParam("?liff.state=%2Fclasses%2F1")).toBe(true);
    expect(hasLiffStateParam("?foo=1&liff.state=")).toBe(true);
  });

  it("is false without it", () => {
    expect(hasLiffStateParam("?redirect=/dashboard")).toBe(false);
    expect(hasLiffStateParam("")).toBe(false);
    expect(hasLiffStateParam(null)).toBe(false);
  });
});
