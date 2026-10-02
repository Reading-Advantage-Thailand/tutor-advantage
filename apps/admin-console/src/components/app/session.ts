"use client";

import { clearResourceCache } from "@/lib/cachedResource";

/**
 * Sign out: drop the in-memory data cache, clear every admin cookie on the
 * server, then go to the login page.
 */
export async function logout(): Promise<void> {
  clearResourceCache(undefined, { revalidate: false });
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Navigate anyway; middleware re-validates the session.
  }
  window.location.href = "/login";
}
