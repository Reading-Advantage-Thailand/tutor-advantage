"use client";

import { useCallback } from "react";
import { useLiff } from "@/components/providers/LiffProvider";
import { decideRetryAction, safeIsLoggedIn, type LiffErrorKind } from "./liffErrors";

/**
 * Returns the "ลองอีกครั้ง" handler for a LIFF start-up error.
 * `redirectPath` is where LINE login returns to (a same-origin path).
 * Every branch ends in a navigation (LINE login or a reload).
 */
export function useLiffRecovery(redirectPath: string) {
  const { liff, retry } = useLiff();

  return useCallback(
    (kind: LiffErrorKind) => {
      const action = decideRetryAction({ kind, isLoggedIn: safeIsLoggedIn(liff) });
      if (action === "logoutReload" && liff) {
        try {
          liff.logout();
        } catch (err) {
          console.error("LIFF logout before retry failed:", err);
        }
        window.location.reload();
        return;
      }
      if (action === "login" && liff) {
        try {
          liff.login({ redirectUri: window.location.origin + redirectPath });
          return;
        } catch (err) {
          // LIFF never initialised (init failed): fall back to re-running start-up.
          console.error("LIFF login retry failed:", err);
        }
      }
      retry();
    },
    [liff, retry, redirectPath],
  );
}
