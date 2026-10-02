"use client";

import { clearResourceCache } from "@/lib/cachedResource";

/** Service-worker runtime caches that can hold per-tutor pages/data (see sw.ts / defaultCache). */
const PER_USER_CACHES = ["pages", "pages-rsc", "pages-rsc-prefetch", "apis", "next-data", "others"];

/**
 * Sign out: clear the in-memory data cache and the service worker's page
 * caches (so the next person on this device never sees this tutor's pages
 * offline), drop the httpOnly cookie, then go to the login page.
 */
export async function logout(): Promise<void> {
  clearResourceCache(undefined, { revalidate: false });
  try {
    if (typeof caches !== "undefined") {
      await Promise.all(PER_USER_CACHES.map((name) => caches.delete(name)));
    }
  } catch {
    // Cache Storage unavailable (private mode): nothing to clear.
  }
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Navigate anyway; middleware re-validates the session.
  }
  window.location.href = "/";
}
