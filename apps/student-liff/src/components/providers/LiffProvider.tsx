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
                  setError(message);
                } else {
                  console.log("[LIFF] Backend session established");
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
        console.warn("[LIFF] Init failed:", errorObject.message);
        setError(errorObject.message || "Failed to initialize LIFF");
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
