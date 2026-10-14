"use client";

import { useCallback, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { useTutor } from "@/components/app";
import { usePolling } from "@/hooks/usePolling";
import { fetchJson, mutateResource, peekResource, useCachedResource } from "@/lib/cachedResource";
import type { ChatConversation, ChatRoomData, ConversationsResponse } from "./chat-types";
import { chatKeys, mergeServerMessages } from "./chat-utils";

/** Conversation list refresh while a list is on screen (the shell's 30 s summary poll covers badges elsewhere). */
export const CHAT_LIST_POLL_MS = 15_000;
/** Open room refresh while visible. */
export const CHAT_ROOM_POLL_MS = 4_000;

/**
 * Seed the client cache with server-rendered data once, before
 * useCachedResource's mount effect runs (layout effects run first), so the
 * first paint needs no extra request. Existing cached data wins.
 */
function useSeedResource<T>(key: string | null, initial: T | undefined) {
  const seeded = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!key || initial === undefined || seeded.current === key) return;
    seeded.current = key;
    if (peekResource(key) === undefined) mutateResource(key, initial);
  }, [key, initial]);
}

export function useConversations({ initial, poll }: { initial?: ChatConversation[]; poll: boolean }) {
  const tutor = useTutor();
  const key = tutor ? chatKeys.conversations(tutor.tutorId) : null;
  useSeedResource(key, initial);
  const resource = useCachedResource<ChatConversation[]>(
    key,
    () => fetchJson<ConversationsResponse>("/api/chat/conversations").then((d) => d.conversations ?? []),
    { staleTime: 10_000 },
  );
  usePolling(resource.refetch, { interval: CHAT_LIST_POLL_MS, enabled: poll && key !== null, immediate: false });
  return { ...resource, data: resource.data ?? initial };
}

export function useChatRoom(conversationId: string, initial: ChatRoomData | undefined) {
  const tutor = useTutor();
  const key = tutor ? chatKeys.room(tutor.tutorId, conversationId) : null;
  useSeedResource(key, initial);

  const fetchRoom = useCallback(async () => {
    const data = await fetchJson<ChatRoomData>(`/api/chat/${encodeURIComponent(conversationId)}/messages`);
    // Keep optimistic (pending) messages that the server does not know yet.
    const current = key ? peekResource<ChatRoomData>(key) : undefined;
    return { ...data, messages: mergeServerMessages(data.messages ?? [], current?.messages) };
  }, [conversationId, key]);

  const resource = useCachedResource<ChatRoomData>(key, fetchRoom, { staleTime: 3_000 });
  const { runNow } = usePolling(resource.refetch, {
    interval: CHAT_ROOM_POLL_MS,
    enabled: key !== null,
    immediate: false,
  });
  return { ...resource, data: resource.data ?? initial, key, runNow };
}

/** `matchMedia` as a hook (false during SSR / hydration). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Two-pane chat (list + room) from this width. Keep in sync with the `lg:` classes. */
export const TWO_PANE_QUERY = "(min-width: 1024px)";
