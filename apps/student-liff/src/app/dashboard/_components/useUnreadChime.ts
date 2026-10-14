"use client";

import { useEffect, useRef } from "react";
// Relative imports: this hook is unit-tested and the root vitest config maps "@" to another app.
import { playNotificationSound } from "../../../lib/sounds";
import { shouldPlayUnreadChime } from "./dashboardModel";

/**
 * Plays the new-message chime when the unread count grows while Home is on
 * screen (e.g. a background revalidation brings 3 → 4).
 *
 * The baseline is the first value this mount sees, so returning to the tab
 * (data served from the cache) never chimes. A different cache key (another
 * student) resets the baseline.
 */
export function useUnreadChime(key: string | null, unread: number | undefined): void {
  const previousRef = useRef<{ key: string | null; unread: number | undefined }>({ key, unread: undefined });

  useEffect(() => {
    if (unread === undefined) return;
    const previous = previousRef.current.key === key ? previousRef.current.unread : undefined;
    if (shouldPlayUnreadChime(previous, unread)) playNotificationSound();
    previousRef.current = { key, unread };
  }, [key, unread]);
}
