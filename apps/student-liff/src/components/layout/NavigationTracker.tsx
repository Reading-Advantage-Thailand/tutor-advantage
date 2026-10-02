"use client";

import { useEffect } from "react";
import { installNavigationTracker } from "@/components/mobile/navigation";

/**
 * Mount ONCE in the root layout. Stamps every in-app history entry with its
 * depth so `useBackNavigation()` can tell an in-app back (router.back()) from a
 * deep-link entry (router.replace(fallback)). Renders nothing.
 */
export function NavigationTracker() {
  useEffect(() => {
    installNavigationTracker(window);
  }, []);
  return null;
}
