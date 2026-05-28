"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import liff from "@line/liff";
import { LiffMockPlugin } from "@line/liff-mock";
import type { Liff } from "@line/liff";

interface LiffContextType {
  liff: Liff | null;
  isReady: boolean;
  error: string | null;
  profile: {
    displayName: string;
    userId: string;
    pictureUrl?: string;
    statusMessage?: string;
  } | null;
  logout: () => void;
}

const LiffContext = createContext<LiffContextType>({
  liff: null,
  isReady: false,
  error: null,
  profile: null,
  logout: () => {},
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
  document.cookie = "student-session=; path=/; max-age=0; SameSite=Lax";
}

export const LiffProvider = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<LiffContextType["profile"]>(null);

  useEffect(() => {
    const init = async () => {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

      if (!liffId) {
        const errorMsg = "LIFF_ID is missing in environment variables (.env.local)";
        console.error(errorMsg);
        setError(errorMsg);
        setIsReady(true);
        return;
      }

      try {
        const isLocalhost = window.location.hostname === "localhost";
        const useMock = process.env.NODE_ENV === "development" && isLocalhost;

        if (useMock) {
          liff.use(new LiffMockPlugin());
        }

        // LIFF Inspector — only load when ?li.origin= is present in the URL (debug sessions only)
        // To activate: add ?li.origin=wss%3A%2F%2FNGROK_HOST to LIFF Endpoint URL in LINE Developers Console
        // e.g. https://student-liff-1090865515742.asia-southeast1.run.app?li.origin=wss%3A%2F%2Fresource-pushpin-tabby.ngrok-free.dev
        const liOrigin = new URLSearchParams(window.location.search).get("li.origin");
        if (liOrigin) {
          const { LIFFInspectorPlugin } = await import("@line/liff-inspector");
          liff.use(new LIFFInspectorPlugin());
          console.log("[LIFF] Inspector enabled, origin:", liOrigin);
        }

        await liff.init({
          liffId,
          // @ts-expect-error: mock is a custom property from the @line/liff-mock plugin
          mock: useMock,
        });

        if (liff.isLoggedIn()) {
          const userProfile = await liff.getProfile();
          setProfile(userProfile);

          if (useMock) {
            // Mock mode (localhost dev) — no real LINE token to exchange
            console.log("[LIFF] Mock mode: skipping backend token exchange");
          } else {
            // Real LIFF (ngrok or production) — exchange token for session cookie
            const idToken = liff.getIDToken();
            if (idToken) {
              const expiresAt = getIdTokenExpiresAt(idToken);
              if (expiresAt && Date.now() + ID_TOKEN_REFRESH_BUFFER_MS >= expiresAt) {
                clearStudentSessionCookie();
                liff.logout();
                liff.login({ redirectUri: window.location.href });
                return;
              }

              try {
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
                  console.error("[LIFF] Backend login failed:", errorPayload);
                  if ((errorPayload as { code?: string }).code === "LINE_ID_TOKEN_EXPIRED") {
                    clearStudentSessionCookie();
                    liff.logout();
                    liff.login({ redirectUri: window.location.href });
                    return;
                  }
                  setError(message);
                } else {
                  // Parse response to get sessionToken for manual cookie fallback.
                  // LINE WebView (WKWebView on iOS) may not apply Set-Cookie from fetch()
                  // responses — setting document.cookie explicitly ensures the cookie lands.
                  const authData = await authRes.json().catch(() => null) as { sessionToken?: string } | null;
                  if (authData?.sessionToken) {
                    const maxAge = 7 * 24 * 60 * 60;
                    const secure = window.location.protocol === "https:" ? "; Secure" : "";
                    document.cookie = `student-session=${authData.sessionToken}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
                  }
                  if (process.env.NODE_ENV !== "production") console.log("[LIFF] Backend session established");
                }
              } catch (authErr) {
                console.error("[LIFF] Backend login failed:", authErr);
                setError(authErr instanceof Error ? authErr.message : "Backend login failed");
              }
            } else {
              console.warn("[LIFF] No ID Token found even though logged in");
              setError("LINE did not return an ID token");
            }
          }
        }

        setIsReady(true);
      } catch (err) {
        const errorObject = err instanceof Error ? err : new Error(String(err));
        const rawMsg = errorObject.message || "Failed to initialize LIFF";
        console.warn("[LIFF] Init failed:", rawMsg);

        // Help diagnose ngrok URL-mismatch: "Failed to fetch" during init means
        // LINE WebView can't validate the LIFF endpoint — update LINE Developers
        // Console to match the current URL.
        const isFetchError =
          rawMsg.toLowerCase().includes("failed to fetch") ||
          rawMsg.toLowerCase().includes("fail to fetch") ||
          rawMsg.toLowerCase().includes("networkerror");

        const displayMsg =
          isFetchError && process.env.NODE_ENV === "development"
            ? `LIFF init network error — ตรวจสอบว่า ${window.location.origin} ถูก register ใน LINE Developers Console แล้ว (LIFF endpoint URL)`
            : rawMsg;

        setError(displayMsg);
        setIsReady(true);
      }
    };

    init();
  }, []);

  const logout = useCallback(() => {
    if (liff?.isLoggedIn()) {
      liff.logout();
      setProfile(null);
      fetch("/api/auth/logout", { method: "POST" }).catch(console.error);
      window.location.href = "/login";
    }
  }, []);

  const value = useMemo(
    () => ({ liff, isReady, error, profile, logout }),
    [isReady, error, profile, logout],
  );

  return (
    <LiffContext.Provider value={value}>
      {children}
    </LiffContext.Provider>
  );
};
