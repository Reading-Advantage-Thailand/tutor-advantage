"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// Relative imports on purpose: the root vitest config maps "@" to tutor-pwa.
import { usePolling } from "../../../hooks/usePolling";
import { playNotificationSound } from "../../../lib/sounds";
import {
  buildDisplayMessages,
  canApplyPollResult,
  createTempId,
  hasNewIncomingMessage,
  isFatalLoadError,
  pruneOutbox,
  reconcileServerMessages,
  sameMetadata,
  type ChatMessage,
  type ConversationMetadata,
  type ConversationPayload,
  type DisplayMessage,
  type OutboxEntry,
} from "./messages";

export type SendResult = "sent" | "failed" | "skipped";

/** Room poll interval (unchanged from the original page). */
export const CHAT_ROOM_POLL_MS = 4000;

/** The two chat endpoints, injected so the hook stays testable without the LIFF SDK. */
export interface ConversationClient {
  getMessages: (conversationId: string) => Promise<ConversationPayload | null | undefined>;
  sendMessage: (conversationId: string, content: string) => Promise<{ id?: string; time?: string } | null | undefined>;
}

export interface UseConversationMessagesOptions {
  client: ConversationClient;
  /** Start polling (e.g. LIFF ready and logged in). */
  enabled: boolean;
  /** Name used for our optimistic bubbles (t("chat.you")). */
  ownName: string;
  /** Poll interval in ms (default 4000). */
  interval?: number;
}

export interface UseConversationMessages {
  messages: DisplayMessage[];
  metadata: ConversationMetadata | null;
  /** No history yet and no error (show the skeleton). */
  isLoading: boolean;
  /** The first load failed (nothing to show). */
  error: unknown;
  /** History is on screen but the last poll failed. */
  isStale: boolean;
  isSending: boolean;
  /**
   * Optimistically append, POST, then confirm. Resolves "sent", "failed" (the
   * bubble was removed) or "skipped" (another send is still in flight, or no room).
   */
  send: (text: string) => Promise<SendResult>;
  /** Poll right now (retry button). */
  refresh: () => Promise<void>;
}

interface RoomState {
  server: ChatMessage[] | null;
  metadata: ConversationMetadata | null;
  outbox: OutboxEntry[];
  error: unknown;
  isStale: boolean;
}

const INITIAL_STATE: RoomState = { server: null, metadata: null, outbox: [], error: null, isStale: false };

/**
 * Chat room data: polls the full history every 4s (paused while hidden, never
 * overlapping), keeps the message array identity when nothing changed, and
 * merges optimistic sends by id so bubbles are never duplicated or dropped.
 * Plays the notification sound when a new message from someone else arrives.
 *
 * Mount it under `key={conversationId}` so switching rooms starts fresh.
 */
export function useConversationMessages(
  conversationId: string,
  { client, enabled, ownName, interval = CHAT_ROOM_POLL_MS }: UseConversationMessagesOptions,
): UseConversationMessages {
  const [state, setState] = useState<RoomState>(INITIAL_STATE);
  const [isSending, setIsSending] = useState(false);

  const clientRef = useRef(client);
  useEffect(() => {
    clientRef.current = client;
  });

  // A send bumps the epoch when it starts and when it settles; polls that
  // started in a different epoch (or while a send is in flight) are ignored.
  const epochRef = useRef(0);
  const sendsInFlightRef = useRef(0);
  const sequenceRef = useRef(0);
  const sendingRef = useRef(false);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!conversationId) return;
    const startedEpoch = epochRef.current;
    try {
      const response = await clientRef.current.getMessages(conversationId);
      if (!aliveRef.current) return;
      if (!canApplyPollResult(startedEpoch, epochRef.current, sendsInFlightRef.current)) return;
      if (!response) {
        // Same as before: an empty body keeps what is on screen (first load → empty room).
        setState((prev) => (prev.server === null ? { ...prev, server: [], error: null } : prev));
        return;
      }
      setState((prev) => {
        const server = reconcileServerMessages(prev.server, response.messages);
        const metadata = sameMetadata(prev.metadata, response.metadata ?? null) ? prev.metadata : response.metadata ?? null;
        const outbox = pruneOutbox(prev.outbox, server);
        if (
          server === prev.server &&
          metadata === prev.metadata &&
          outbox === prev.outbox &&
          prev.error === null &&
          !prev.isStale
        ) {
          return prev;
        }
        return { server, metadata, outbox, error: null, isStale: false };
      });
    } catch (error) {
      if (!aliveRef.current) return;
      setState((prev) =>
        prev.server
          ? prev.isStale
            ? prev
            : { ...prev, isStale: true }
          : { ...prev, error: error ?? new Error("load failed") },
      );
    }
  }, [conversationId]);

  // A 403/404 on the first load stops the 4s polling (the retry button still runs once).
  const fatal = state.server === null && isFatalLoadError(state.error);
  const { runNow } = usePolling(load, { interval, enabled: enabled && Boolean(conversationId) && !fatal });

  // New message from someone else → chime (respects the mute setting).
  const previousServerRef = useRef<ChatMessage[] | null>(null);
  useEffect(() => {
    if (!state.server) return;
    if (hasNewIncomingMessage(previousServerRef.current, state.server)) playNotificationSound();
    previousServerRef.current = state.server;
  }, [state.server]);

  const send = useCallback(
    async (text: string): Promise<SendResult> => {
      if (!conversationId || sendingRef.current) return "skipped";
      sendingRef.current = true;
      setIsSending(true);
      sequenceRef.current += 1;
      const entry: OutboxEntry = {
        tempId: createTempId(Date.now(), sequenceRef.current),
        text,
        time: new Date().toISOString(),
      };
      epochRef.current += 1;
      sendsInFlightRef.current += 1;
      setState((prev) => ({ ...prev, outbox: [...prev.outbox, entry] }));

      let ok = false;
      let refetch = false;
      try {
        const response = await clientRef.current.sendMessage(conversationId, text);
        ok = true;
        if (response?.id) {
          const serverId = String(response.id);
          setState((prev) => ({
            ...prev,
            outbox: prev.outbox.map((item) =>
              item.tempId === entry.tempId ? { ...item, serverId, serverTime: response.time ?? item.time } : item,
            ),
          }));
        } else {
          // No id to match the server copy with: drop the local bubble and fetch the history.
          setState((prev) => ({ ...prev, outbox: prev.outbox.filter((item) => item.tempId !== entry.tempId) }));
          refetch = true;
        }
      } catch {
        setState((prev) => ({ ...prev, outbox: prev.outbox.filter((item) => item.tempId !== entry.tempId) }));
      } finally {
        sendsInFlightRef.current -= 1;
        epochRef.current += 1;
        sendingRef.current = false;
        if (aliveRef.current) setIsSending(false);
      }
      if (refetch) void runNow();
      return ok ? "sent" : "failed";
    },
    [conversationId, runNow],
  );

  const messages = useMemo(
    () => buildDisplayMessages(state.server ?? [], state.outbox, ownName),
    [state.server, state.outbox, ownName],
  );

  return {
    messages,
    metadata: state.metadata,
    isLoading: state.server === null && !state.error,
    error: state.server === null ? state.error : null,
    isStale: state.isStale,
    isSending,
    send,
    refresh: runNow,
  };
}
