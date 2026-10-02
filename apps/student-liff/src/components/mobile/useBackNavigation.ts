"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { canGoBackInApp } from "./navigation";

/**
 * Returns a stable `goBack()` callback for back buttons.
 *
 * - When the user reached this screen through in-app navigation, it calls
 *   `router.back()` (keeps scroll position and the previous screen's state).
 * - Otherwise (LIFF deep link, first entry, full-page load) it calls
 *   `router.replace(fallbackHref)`, so back never exits the app or does nothing.
 *
 * Requires <NavigationTracker /> (mounted once in the root layout).
 *
 * @example
 * const goBack = useBackNavigation("/classes");
 * <IconButton icon={ChevronLeft} label={t("common.back")} onClick={goBack} />
 */
export function useBackNavigation(fallbackHref: string = "/dashboard"): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (canGoBackInApp(typeof window === "undefined" ? undefined : window)) {
      router.back();
    } else {
      router.replace(fallbackHref);
    }
  }, [router, fallbackHref]);
}
