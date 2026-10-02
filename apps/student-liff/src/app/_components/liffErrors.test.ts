import { describe, expect, it } from "vitest";
import { SESSION_ERROR_DETAIL, decideRetryAction, getLiffErrorKind, safeIsLoggedIn } from "./liffErrors";

describe("safeIsLoggedIn", () => {
  it("returns LIFF's answer", () => {
    expect(safeIsLoggedIn({ isLoggedIn: () => true })).toBe(true);
    expect(safeIsLoggedIn({ isLoggedIn: () => false })).toBe(false);
  });

  it("is false when LIFF is missing or throws (init failed)", () => {
    expect(safeIsLoggedIn(null)).toBe(false);
    expect(safeIsLoggedIn(undefined)).toBe(false);
    expect(
      safeIsLoggedIn({
        isLoggedIn: () => {
          throw new Error("liff not initialised");
        },
      }),
    ).toBe(false);
  });
});

describe("SESSION_ERROR_DETAIL", () => {
  it("is classified as a session error", () => {
    expect(getLiffErrorKind(null, SESSION_ERROR_DETAIL)).toBe("session");
  });
});

describe("getLiffErrorKind", () => {
  it("uses LiffProvider's error code first", () => {
    expect(getLiffErrorKind("network", null)).toBe("network");
    expect(getLiffErrorKind("config", "session failed")).toBe("config");
    expect(getLiffErrorKind("auth")).toBe("auth");
    expect(getLiffErrorKind("unknown")).toBe("unknown");
  });

  it("falls back to the session-probe failure", () => {
    expect(getLiffErrorKind(null, "LINE login ok but no session")).toBe("session");
  });

  it("is unknown when there is an error without a category", () => {
    expect(getLiffErrorKind(null, null)).toBe("unknown");
    expect(getLiffErrorKind(undefined, "")).toBe("unknown");
  });
});

describe("decideRetryAction", () => {
  it("logs out of LINE and reloads for auth/session errors while logged in (original behaviour)", () => {
    expect(decideRetryAction({ kind: "auth", isLoggedIn: true })).toBe("logoutReload");
    expect(decideRetryAction({ kind: "session", isLoggedIn: true })).toBe("logoutReload");
  });

  it("starts the LINE login for auth errors while logged out", () => {
    expect(decideRetryAction({ kind: "auth", isLoggedIn: false })).toBe("login");
    expect(decideRetryAction({ kind: "session", isLoggedIn: false })).toBe("login");
  });

  it("just re-runs start-up for network, config and unknown errors", () => {
    for (const kind of ["network", "config", "unknown"] as const) {
      expect(decideRetryAction({ kind, isLoggedIn: true })).toBe("reload");
      expect(decideRetryAction({ kind, isLoggedIn: false })).toBe("reload");
    }
  });
});
