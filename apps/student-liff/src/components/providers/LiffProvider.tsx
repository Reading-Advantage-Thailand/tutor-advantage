"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import liff from "@line/liff";
import { LiffMockPlugin } from "@line/liff-mock";
import type { Liff } from "@line/liff";
import { Cookies } from "@/lib/cookieUtils";
import { studentApi } from "@/lib/api";

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
        const errorMsg =
          "LIFF_ID is missing in environment variables (.env.local)";
        console.error(errorMsg);
        setError(errorMsg);
        setIsReady(true); // Set ready so UI can show error
        return;
      }

      try {
        const isLocalhost = window.location.hostname === "localhost";
        const useMock = process.env.NODE_ENV === "development" && isLocalhost;

        // Use Mock plugin only on localhost
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

          // Exchange LINE ID Token for Backend JWT
          const idToken = liff.getIDToken();
          console.log("[LIFF] ID Token available:", !!idToken);
          
          if (idToken) {
            try {
              console.log("[LIFF] Attempting backend login exchange...");
              const authData = await studentApi.loginWithLine(idToken);
              console.log("[LIFF] Backend session established successfully:", authData.user?.role);
            } catch (authErr) {
              console.error("[LIFF] Backend login failed:", authErr);
            }
          } else {
            console.warn("[LIFF] No ID Token found even though logged in");
          }

          // Sync session cookie for server-side middleware
          Cookies.set("liff-session", "active", { expires: 7 });
        } else {
          // Ensure cookie is removed if not logged in
          Cookies.remove("liff-session");
        }

        setIsReady(true);
      } catch (err) {
        const errorObject = err instanceof Error ? err : new Error(String(err));
        const errorMessage = errorObject.message || "Failed to initialize LIFF";
        console.error("LIFF Provider: Init failed:", err);
        setError(errorMessage);
        setIsReady(true); // Still set ready to allow UI to show the error
      }
    };

    init();
  }, []);

  const logout = () => {
    if (liff?.isLoggedIn()) {
      liff.logout();
      setProfile(null);
      localStorage.removeItem('student_session_token');
      Cookies.remove("liff-session");
      window.location.href = "/login";
    }
  };

  return (
    <LiffContext.Provider value={{ liff, isReady, error, profile, logout }}>
      {children}
    </LiffContext.Provider>
  );
};
