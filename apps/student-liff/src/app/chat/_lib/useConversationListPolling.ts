"use client";

import { useCallback, useRef } from "react";
// Relative imports on purpose: the root vitest config maps "@" to tutor-pwa.
import { usePolling } from "../../../hooks/usePolling";
import { playNotificationSound } from "../../../lib/sounds";
import {
  CHAT_LIST_POLL_MS,
  shouldPlayUnreadSound,
  totalUnread,
  type ConversationsResponse,
} from "./conversations";

/**
 * Polls the chat list (first run right away, then every 15s; paused while
 * LINE is in the background) and chimes when the unread total goes up.
 *
 * Each fetched list is compared with the previous fetched one. The baseline is
 * the first list fetched after the screen opened (as before the cache existed),
 * never a cached list from an earlier visit, so opening the screen never chimes.
 */
export function useConversationListPolling(
  refetch: () => Promise<ConversationsResponse | undefined>,
  { enabled, interval = CHAT_LIST_POLL_MS }: { enabled: boolean; interval?: number },
): void {
  const previousUnreadRef = useRef<number | undefined>(undefined);
  const poll = useCallback(async () => {
    const response = await refetch();
    if (!response) return;
    const total = totalUnread(response.conversations ?? []);
    if (shouldPlayUnreadSound(previousUnreadRef.current, total)) playNotificationSound();
    previousUnreadRef.current = total;
  }, [refetch]);
  usePolling(poll, { interval, enabled });
}
