"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePolling } from "@/hooks/usePolling";

export interface NotificationsSummary {
  unreadChat: number;
  availableAuctions: number;
}

interface NotificationsContextValue extends NotificationsSummary {
  /** Total of all counters (bell badge). */
  total: number;
  /** Re-poll now (e.g. after opening a chat room marks messages read). */
  refresh: () => Promise<void>;
  muted: boolean;
  setMuted: (muted: boolean) => void;
}

const EMPTY: NotificationsSummary = { unreadChat: 0, availableAuctions: 0 };
const MUTE_KEY = "app-notif-muted";
/** Poll interval for the notification summary (visibility-aware). */
export const NOTIFICATIONS_POLL_MS = 30_000;

const NotificationsContext = createContext<NotificationsContextValue>({
  ...EMPTY,
  total: 0,
  refresh: async () => {},
  muted: false,
  setMuted: () => {},
});

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function normalizeSummary(value: unknown): NotificationsSummary {
  if (!value || typeof value !== "object") return EMPTY;
  const record = value as Record<string, unknown>;
  return { unreadChat: toCount(record.unreadChat), availableAuctions: toCount(record.availableAuctions) };
}

type AudioWindow = Window & { __globalAudioCtx?: AudioContext };

/** Short two-tone ping. Uses the AudioContext unlocked by ThemeProvider on first gesture. */
function playPing() {
  try {
    const ctx = (window as AudioWindow).__globalAudioCtx;
    if (!ctx || ctx.state !== "running") return;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc2.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime + 0.1);
    osc1.stop(ctx.currentTime + 0.6);
    osc2.stop(ctx.currentTime + 0.6);
  } catch {
    // Audio is best-effort.
  }
}

/**
 * The ONE notification-summary poller of the app (mounted by AppShell).
 * Polls GET /api/notifications/summary every 30 s while the tab is visible,
 * immediately when it becomes visible again, and plays a ping when unread
 * chats increase (unless muted). Read it with useNotifications().
 */
export function NotificationsProvider({
  initial,
  children,
}: {
  initial?: Partial<NotificationsSummary> | null;
  children: ReactNode;
}) {
  const [summary, setSummary] = useState<NotificationsSummary>(() => normalizeSummary(initial));
  const [muted, setMutedState] = useState(false);
  const mutedRef = useRef(false);
  const lastUnreadRef = useRef(summary.unreadChat);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(MUTE_KEY) === "true";
      mutedRef.current = stored;
      setMutedState(stored);
    } catch {
      // storage unavailable
    }
  }, []);

  const setMuted = useCallback((next: boolean) => {
    mutedRef.current = next;
    setMutedState(next);
    try {
      localStorage.setItem(MUTE_KEY, String(next));
    } catch {
      // storage unavailable
    }
  }, []);

  const poll = useCallback(async () => {
    const response = await fetch("/api/notifications/summary", { cache: "no-store" });
    if (!response.ok) return;
    const next = normalizeSummary(await response.json());
    if (next.unreadChat > lastUnreadRef.current && !mutedRef.current) playPing();
    lastUnreadRef.current = next.unreadChat;
    setSummary((current) =>
      current.unreadChat === next.unreadChat && current.availableAuctions === next.availableAuctions
        ? current
        : next,
    );
  }, []);

  // The server already rendered fresh counts, so wait one interval first.
  const { runNow } = usePolling(poll, { interval: NOTIFICATIONS_POLL_MS, immediate: false });

  const value = useMemo<NotificationsContextValue>(
    () => ({
      ...summary,
      total: summary.unreadChat + summary.availableAuctions,
      refresh: runNow,
      muted,
      setMuted,
    }),
    [summary, runNow, muted, setMuted],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

/** Live notification counts (0 outside the app shell). */
export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
