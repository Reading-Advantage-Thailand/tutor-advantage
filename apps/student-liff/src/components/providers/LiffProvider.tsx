"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
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
                  console.error("[LIFF] Backend login failed:", await authRes.json());
                } else {
                  console.log("[LIFF] Backend session established");
                }
              } catch (authErr) {
                console.error("[LIFF] Backend login failed:", authErr);
              }
            } else {
              console.warn("[LIFF] No ID Token found even though logged in");
            }
          }
        }

        setIsReady(true);
      } catch (err) {
        const errorObject = err instanceof Error ? err : new Error(String(err));
        console.error("LIFF Provider: Init failed:", err);
        setError(errorObject.message || "Failed to initialize LIFF");
        setIsReady(true);
      }
    };

    init();
  }, []);

  const logout = () => {
    if (liff?.isLoggedIn()) {
      liff.logout();
      setProfile(null);
      fetch("/api/auth/logout", { method: "POST" }).catch(console.error);
      window.location.href = "/login";
    }
  };

  return (
    <LiffContext.Provider value={{ liff, isReady, error, profile, logout }}>
      {children}
    </LiffContext.Provider>
  );
};
