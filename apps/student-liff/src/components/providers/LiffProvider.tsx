"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import liff from "@line/liff";
import type { Liff } from "@line/liff";
// Relative (like AssessmentPanel) so vitest, whose "@" alias points at another app, can load this file.
import { clearResourceCache } from "../../lib/cachedResource";
import { markSessionReady, resetSessionProbe } from "../../lib/cookieUtils";

/**
 * Coarse category of a start-up failure, so screens can show friendly Thai
 * copy and the right action instead of the raw technical `error` message:
 * - "config": the app is misconfigured (missing/invalid LIFF id) — contact support
 * - "network": LINE or our servers could not be reached — check internet, retry
 * - "auth": LINE login or the session exchange was rejected — log in again
 * - "unknown": anything else — retry
 */
export type LiffErrorCode = "config" | "network" | "auth" | "unknown";

export interface LiffProfile {
  displayName: string;
  userId: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface LiffContextType {
  liff: Liff | null;
  /** Start-up finished (successfully or not). Pages gate their first API call on this. */
  isReady: boolean;
  /** Technical error message (for logs/debug, not for kids). */
  error: string | null;
  /** Error category for user-facing copy; null while there is no error. */
  errorCode: LiffErrorCode | null;
  profile: LiffProfile | null;
  /** Full logout (session probe, data cache, cookie, LINE login) and a hard navigation to /login. */
  logout: () => void;
  /** Re-run start-up after a failure. Reloads the page: liff.init() may only run once per page. */
  retry: () => void;
}

const LiffContext = createContext<LiffContextType>({
  liff: null,
  isReady: false,
  error: null,
  errorCode: null,
  profile: null,
  logout: () => {},
  retry: () => {},
});

export const useLiff = () => useContext(LiffContext);

const ID_TOKEN_REFRESH_BUFFER_MS = 60_000;

function getIdTokenExpiresAt(idToken: string): number | null {
  const [, payload] = idToken.split(".");
  if (!payload) return null;

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );
    const decoded = JSON.parse(window.atob(paddedPayload)) as { exp?: number };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function clearStudentSessionCookie() {
  fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}

// ── Telemetry ──────────────────────────────────────────────────────────────

const TELEMETRY_ENDPOINT = "/api/debug/client-error";

/** Happy-path breadcrumbs. Sent only while debugging; every other stage is a failure and always sent. */
const BREADCRUMB_STAGES = new Set([
  "liff_init_start",
  "liff_init_success",
  "auth_exchange_start",
  "auth_exchange_success",
]);

/** NEXT_PUBLIC_LIFF_DEBUG=1, or a debug session URL (?li.origin=… / ?li.debug). */
function isLiffDebugEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_LIFF_DEBUG === "1") return true;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.has("li.origin") || params.has("li.debug");
  } catch {
    return false;
  }
}

/** sendBeacon survives the liff.login() redirect; fetch keepalive is the fallback. */
function sendTelemetry(payload: Record<string, unknown>) {
  let body: string;
  try {
    body = JSON.stringify(payload);
  } catch {
    return;
  }
  try {
    if (
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(TELEMETRY_ENDPOINT, new Blob([body], { type: "application/json" }))
    ) {
      return;
    }
  } catch {
    // Fall through to fetch.
  }
  fetch(TELEMETRY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

// ── Error classification ───────────────────────────────────────────────────

const NETWORK_MESSAGE = /failed to fetch|fail to fetch|networkerror|network request failed|load failed|timed? ?out/i;

function classifyInitError(err: unknown, message: string): LiffErrorCode {
  if (NETWORK_MESSAGE.test(message)) return "network";
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  switch (code) {
    case "INVALID_CONFIG":
    case "INVALID_ARGUMENT":
      return "config";
    case "UNAUTHORIZED":
    case "FORBIDDEN":
    case "INVALID_ID_TOKEN":
      return "auth";
    case "TIMEOUT":
    case "RATE_LIMIT_EXCEEDED":
      return "network";
    default:
      return "unknown";
  }
}

type ExchangeOutcome =
  | { kind: "ok" }
  | { kind: "relogin" }
  | { kind: "error"; message: string; code: LiffErrorCode };

type Reporter = (stage: string, err: unknown, extra?: Record<string, unknown>) => void;

/** POST the LINE ID token to /api/auth/line, which sets the HttpOnly student-session cookie. */
async function exchangeIdToken(idToken: string, report: Reporter): Promise<ExchangeOutcome> {
  try {
    report("auth_exchange_start", "starting");
    const authRes = await fetch("/api/auth/line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!authRes.ok) {
      const errorPayload = await authRes.json().catch(() => ({}));
      const message =
        (errorPayload as { error?: string }).error ||
        "Backend login failed";
      report("auth_exchange_failed", message, { status: authRes.status, errorPayload });
      if ((errorPayload as { code?: string }).code === "LINE_ID_TOKEN_EXPIRED") {
        return { kind: "relogin" };
      }
      const status = authRes.status;
      return {
        kind: "error",
        message,
        code: status >= 500 || status === 408 || status === 429 ? "network" : "auth",
      };
    }
    report("auth_exchange_success", "ok");
    return { kind: "ok" };
  } catch (authErr) {
    report("auth_exchange_error", authErr);
    return {
      kind: "error",
      message: authErr instanceof Error ? authErr.message : "Backend login failed",
      code: "network",
    };
  }
}

export const LiffProvider = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<LiffErrorCode | null>(null);
  const [profile, setProfile] = useState<LiffContextType["profile"]>(null);
  // liff.init() must run once per page. Strict Mode (dev) runs effects twice on
  // the same instance (refs survive), so the second run must not start a parallel init.
  const initStartedRef = useRef(false);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    const debugTelemetry = isLiffDebugEnabled();
    const reportError: Reporter = (stage, err, extra) => {
      const isBreadcrumb = BREADCRUMB_STAGES.has(stage);
      if (isBreadcrumb && !debugTelemetry) return;
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack?.slice(0, 500) : undefined;
      sendTelemetry({
        stage,
        level: isBreadcrumb ? "info" : "error",
        message: msg,
        stack,
        url: window.location.href,
        origin: window.location.origin,
        userAgent: navigator.userAgent,
        isInLine: navigator.userAgent.toLowerCase().includes(" line/"),
        timestamp: new Date().toISOString(),
        ...extra,
      });
    };

    const fail = (message: string, code: LiffErrorCode) => {
      setError(message);
      setErrorCode(code);
    };

    const relogin = () => {
      clearStudentSessionCookie();
      liff.logout();
      liff.login({ redirectUri: window.location.href });
    };

    const init = async () => {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

      if (!liffId) {
        const errorMsg = "LIFF_ID is missing in environment variables (.env.local)";
        console.error(errorMsg);
        fail(errorMsg, "config");
        setIsReady(true);
        return;
      }

      try {
        const isLocalhost = window.location.hostname === "localhost";
        const useMock = process.env.NODE_ENV === "development" && isLocalhost;

        // The NODE_ENV literal makes this branch dead code in production builds,
        // so the mock is never part of the production bundle.
        if (process.env.NODE_ENV === "development" && useMock) {
          const { LiffMockPlugin } = await import("@line/liff-mock");
          liff.use(new LiffMockPlugin());
        }

        // LIFF Inspector — only load when ?li.origin= is present in the URL (debug sessions only)
        // To activate: add ?li.origin=wss%3A%2F%2FNGROK_HOST to LIFF Endpoint URL in LINE Developers Console
        // e.g. https://student-liff-1090865515742.asia-southeast1.run.app?li.origin=wss%3A%2F%2Fresource-pushpin-tabby.ngrok-free.dev
        const liOrigin = new URLSearchParams(window.location.search).get("li.origin");
        if (liOrigin) {
          const { LIFFInspectorPlugin } = await import("@line/liff-inspector");
          liff.use(new LIFFInspectorPlugin());
        }

        reportError("liff_init_start", "starting", { liffId, useMock });

        // LIFF SDK fetches liffsdk.line-scdn.net/xlt/* for extensions and i18n
        // during init. This fails in LINE WebView on some devices. Proxy these
        // requests through our Next.js server to avoid the issue.
        const originalFetch = window.fetch;
        window.fetch = async (input: RequestInfo | URL, initOpts?: RequestInit) => {
          const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
          if (url.includes("liffsdk.line-scdn.net/xlt/")) {
            const proxyPath = url.split("liffsdk.line-scdn.net/xlt/")[1];
            const proxyUrl = `/api/liff-proxy/${proxyPath}`;
            return originalFetch(proxyUrl, initOpts);
          }
          return originalFetch(input, initOpts);
        };

        try {
          await liff.init({
            liffId,
            // @ts-expect-error: mock is a custom property from the @line/liff-mock plugin
            mock: useMock,
          });
        } finally {
          window.fetch = originalFetch;
        }

        reportError("liff_init_success", "ok", {
          isLoggedIn: liff.isLoggedIn(),
          isInClient: liff.isInClient(),
        });

        let devSessionProfileLoaded = false;
        if (useMock) {
          try {
            const devStateRes = await fetch("/api/dev/state", { cache: "no-store" });
            if (devStateRes.ok) {
              const devState = await devStateRes.json() as {
                user?: {
                  userId?: string;
                  displayName?: string;
                  profilePictureUrl?: string | null;
                };
              };
              const devUser = devState.user;
              if (devUser?.userId) {
                setProfile({
                  userId: devUser.userId,
                  displayName: devUser.displayName || "Dev Student",
                  pictureUrl: devUser.profilePictureUrl || undefined,
                });
                devSessionProfileLoaded = true;
              }
            }
          } catch (devAuthErr) {
            reportError("dev_auth_profile_error", devAuthErr);
          }
        }

        if (!devSessionProfileLoaded && liff.isLoggedIn()) {
          // Mock mode (localhost dev) has no real LINE token to exchange.
          const idToken = useMock ? null : liff.getIDToken();

          // An ID token about to expire would be rejected by the backend:
          // refresh it through a LINE re-login before doing any network work.
          if (idToken) {
            const expiresAt = getIdTokenExpiresAt(idToken);
            if (expiresAt && Date.now() + ID_TOKEN_REFRESH_BUFFER_MS >= expiresAt) {
              relogin();
              return;
            }
          }

          // getProfile() (api.line.me) and the session exchange (our server)
          // are independent: run them in parallel instead of back to back.
          const profileRequest = liff.getProfile().then(
            (userProfile) => {
              setProfile(userProfile);
              return { ok: true as const };
            },
            (profileErr: unknown) => ({ ok: false as const, error: profileErr }),
          );
          const exchangeRequest: Promise<ExchangeOutcome | null> = useMock
            ? Promise.resolve(null)
            : idToken
              ? exchangeIdToken(idToken, reportError)
              : Promise.resolve(null);

          const [profileResult, exchange] = await Promise.all([profileRequest, exchangeRequest]);

          if (!useMock) {
            if (!idToken) {
              reportError("no_id_token", "LINE did not return an ID token");
              fail("LINE did not return an ID token", "auth");
            } else if (exchange?.kind === "relogin") {
              relogin();
              return;
            } else if (exchange?.kind === "error") {
              fail(exchange.message, exchange.code);
            } else if (exchange?.kind === "ok") {
              // The HttpOnly cookie is set: skip the /api/auth/session probe on
              // the next screens, and never show data cached for a previous session.
              markSessionReady();
              clearResourceCache();
            }
          }

          // A getProfile() failure is handled exactly like an init failure.
          if (!profileResult.ok) throw profileResult.error;
        }

        setIsReady(true);
      } catch (err) {
        const errorObject = err instanceof Error ? err : new Error(String(err));
        const rawMsg = errorObject.message || "Failed to initialize LIFF";

        reportError("liff_init_error", err);

        // Help diagnose ngrok URL-mismatch: "Failed to fetch" during init means
        // LINE WebView can't validate the LIFF endpoint — update LINE Developers
        // Console to match the current URL.
        const isFetchError =
          rawMsg.toLowerCase().includes("failed to fetch") ||
          rawMsg.toLowerCase().includes("fail to fetch") ||
          rawMsg.toLowerCase().includes("networkerror");

        const displayMsg =
          isFetchError
            ? `LIFF network error — origin: ${window.location.origin}, UA: ${navigator.userAgent.slice(0, 80)}`
            : rawMsg;

        fail(displayMsg, isFetchError ? "network" : classifyInitError(err, rawMsg));
        setIsReady(true);
      }
    };

    init();
  }, []);

  /**
   * Log the student out: forget the confirmed session and every cached
   * response, clear the student-session cookie, end the LINE login when there
   * is one, and leave for /login (a full load, so no in-memory state survives).
   * Always completes, even when LIFF reports "not logged in" (expired LINE token
   * while the student-session cookie is still valid).
   */
  const logout = useCallback(() => {
    resetSessionProbe();
    clearResourceCache(undefined, { revalidate: false });
    setProfile(null);
    if (liff?.isLoggedIn()) {
      liff.logout();
    }
    // keepalive: the request must survive the navigation below.
    fetch("/api/auth/logout", { method: "POST", keepalive: true }).catch(console.error);
    window.location.href = "/login";
  }, []);

  const retry = useCallback(() => {
    window.location.reload();
  }, []);

  const value = useMemo(
    () => ({ liff, isReady, error, errorCode, profile, logout, retry }),
    [isReady, error, errorCode, profile, logout, retry],
  );

  return (
    <LiffContext.Provider value={value}>
      {children}
    </LiffContext.Provider>
  );
};
