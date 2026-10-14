"use client";

import "./chat-room.css";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowDown, Check, ChevronLeft, Clock3, Lock, MessageSquareText, SendHorizontal, Users } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  IconTile,
  Skeleton,
  UserAvatar,
  toast,
  useNotifications,
  useShellTitle,
  useTutor,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { mutateResource, peekResource } from "@/lib/cachedResource";
import { formatThaiTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { sendMessage } from "../actions";
import type { ChatConversation, ChatMessage, ChatRoomData } from "../lib/chat-types";
import { buildTimeline, chatKeys, newIncomingMessages } from "../lib/chat-utils";
import { useChatRoom, useConversations } from "../lib/use-chat";
import { useInitialConversations } from "../components/ChatInitialData";

/** Distance from the bottom (px) that still counts as "reading the latest". */
const NEAR_BOTTOM_PX = 120;

const playNotificationSound = () => {
  try {
    if (typeof window !== "undefined" && localStorage.getItem("app-notif-muted") === "true") return;
    const ctx = (window as unknown as { __globalAudioCtx?: AudioContext }).__globalAudioCtx;
    if (!ctx || ctx.state !== "running") {
      if (ctx) ctx.resume().catch(() => {});
      if (!ctx || ctx.state !== "running") return;
    }
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc2.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime + 0.1);
    osc1.stop(ctx.currentTime + 0.6);
    osc2.stop(ctx.currentTime + 0.6);
  } catch {
    // Silent
  }
};

/**
 * The element that actually scrolls the messages: the message pane on
 * tablet/desktop (fixed-height card), the document on phones.
 */
function getScroller(pane: HTMLElement | null): HTMLElement {
  if (pane) {
    const overflowY = getComputedStyle(pane).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && pane.scrollHeight > pane.clientHeight) return pane;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

function distanceFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

/**
 * Height of the on-screen keyboard covering the layout viewport (iOS Safari
 * and Android Chrome keep the layout viewport and shrink only the visual
 * viewport), so the sticky composer can sit above it.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setInset(covered > 80 ? Math.round(covered) : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

export default function ChatRoomClient({
  conversationId,
  initial,
}: {
  conversationId: string;
  initial: ChatRoomData | undefined;
}) {
  const tutor = useTutor();
  const { refresh: refreshNotifications } = useNotifications();
  const { data, error, isLoading, refetch, mutate, runNow } = useChatRoom(conversationId, initial);
  // Read-only view of the shared list cache (title/type of this room); the list itself polls.
  const { data: conversations } = useConversations({ initial: useInitialConversations(), poll: false });
  const conversation = conversations?.find((c) => c.id === conversationId);

  const meta = data?.metadata ?? null;
  const messages = useMemo(() => data?.messages ?? [], [data?.messages]);
  const title = conversation?.title || meta?.title || t("dashboardChat.title");
  const isGroup =
    conversation?.type === "GROUP" || new Set(messages.filter((m) => !m.isOwn).map((m) => m.senderId)).size > 1;
  useShellTitle(title, "/dashboard/chat");

  const paneRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const keyboardInset = useKeyboardInset();

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const scroller = getScroller(paneRef.current);
    scroller.scrollTo({ top: scroller.scrollHeight, behavior });
    atBottomRef.current = true;
    setShowJump(false);
    setUnseen(0);
  }, []);

  // Track whether the reader is at the latest message (document or pane scroll).
  useEffect(() => {
    const pane = paneRef.current;
    const onScroll = () => {
      const atBottom = distanceFromBottom(getScroller(pane)) < NEAR_BOTTOM_PX;
      atBottomRef.current = atBottom;
      setShowJump(!atBottom);
      if (atBottom) setUnseen(0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    pane?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      pane?.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Open at the latest message (again after route scroll restoration settles).
  const hasMessages = messages.length > 0;
  useLayoutEffect(() => {
    if (!hasMessages) return;
    scrollToBottom("instant");
    const id = window.setTimeout(() => scrollToBottom("instant"), 60);
    return () => window.clearTimeout(id);
  }, [hasMessages, scrollToBottom]);

  // Keep the latest message visible when the keyboard opens.
  useEffect(() => {
    if (keyboardInset > 0 && atBottomRef.current) scrollToBottom("instant");
  }, [keyboardInset, scrollToBottom]);

  // New messages: follow them when at the bottom (or own), otherwise offer a jump button.
  const previousRef = useRef<ChatMessage[] | undefined>(undefined);
  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = messages;
    if (!previous) return;
    const incoming = newIncomingMessages(previous, messages);
    const last = messages[messages.length - 1];
    const lastIsNewOwn = last?.isOwn && !previous.some((m) => m.id === last.id);
    if (incoming.length > 0) {
      playNotificationSound();
      // Polling the room marks it read on the server; update the shell badges.
      void refreshNotifications();
    }
    if (incoming.length === 0 && !lastIsNewOwn) return;
    if (atBottomRef.current || lastIsNewOwn) {
      requestAnimationFrame(() => scrollToBottom("smooth"));
    } else {
      setUnseen((n) => n + incoming.length);
      setShowJump(true);
    }
  }, [messages, refreshNotifications, scrollToBottom]);

  // Opening the room marks it read: refresh the shell badges once.
  useEffect(() => {
    void refreshNotifications();
  }, [conversationId, refreshNotifications]);

  // Mirror this room into the cached conversation list (read state + last message),
  // so the desktop list pane is right without waiting for its next poll.
  const tutorId = tutor?.tutorId;
  const lastMessage = messages[messages.length - 1];
  useEffect(() => {
    if (!tutorId) return;
    const listKey = chatKeys.conversations(tutorId);
    const list = peekResource<ChatConversation[]>(listKey);
    const entry = list?.find((c) => c.id === conversationId);
    if (!list || !entry) return;
    const nextContent = lastMessage?.text ?? entry.lastMessage?.content;
    if (entry.unreadCount === 0 && entry.lastMessage?.content === nextContent) return;
    mutateResource<ChatConversation[]>(listKey, (current) =>
      (current ?? list).map((c) =>
        c.id !== conversationId
          ? c
          : {
              ...c,
              unreadCount: 0,
              lastMessage: lastMessage
                ? {
                    content: lastMessage.text,
                    sender: lastMessage.isOwn ? t("dashboardChat.you") : lastMessage.senderName,
                    createdAt: lastMessage.time,
                  }
                : c.lastMessage,
            },
      ),
    );
  }, [tutorId, conversationId, lastMessage]);

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };
  useLayoutEffect(resizeTextarea, [draft]);

  const handleSend = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || sending || !data) return;

    setSending(true);
    setDraft("");
    const tempId = `pending-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      text,
      senderId: "me",
      senderName: t("dashboardChat.you"),
      time: new Date().toISOString(),
      isOwn: true,
      pending: true,
    };
    mutate((current) => ({
      metadata: current?.metadata ?? meta,
      messages: [...(current?.messages ?? []), optimistic],
    }));

    try {
      const response = await sendMessage(conversationId, text);
      mutate((current) => ({
        metadata: current?.metadata ?? meta,
        messages: (current?.messages ?? []).map((m) =>
          m.id === tempId ? { ...m, ...response, isOwn: true, pending: false } : m,
        ),
      }));
      void runNow();
    } catch (sendError) {
      console.error("Failed to send message", sendError);
      mutate((current) => ({
        metadata: current?.metadata ?? meta,
        messages: (current?.messages ?? []).filter((m) => m.id !== tempId),
      }));
      setDraft((current) => current || text);
      toast.error(t("dashboardChat.sendFailed"), { description: t("dashboardChat.sendFailedDescription") });
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    // Hardware keyboards send with Enter; on touch keyboards Enter adds a new line.
    if (!window.matchMedia("(pointer: fine)").matches) return;
    event.preventDefault();
    void handleSend();
  };

  const timeline = useMemo(() => buildTimeline(messages), [messages]);
  const canSend = draft.trim().length > 0 && !sending && Boolean(data);

  return (
    <section
      data-chat-room=""
      aria-label={title}
      className={cn(
        "relative flex flex-col bg-app",
        // Phones: edge to edge under the app bar, document scrolls, composer sticks to the bottom.
        "max-md:-mx-[max(var(--gutter),var(--safe-left))] max-md:-mt-4 max-md:-mb-6 max-md:min-h-[calc(100dvh-var(--appbar-h)-var(--safe-top))]",
        // Tablet/desktop: a fixed-height card; the message pane scrolls inside it.
        "md:h-[calc(100dvh-64px)] md:overflow-hidden md:rounded-xl md:border md:border-hairline md:bg-surface md:shadow-card xl:h-[calc(100dvh-76px)]",
      )}
    >
      <header className="max-md:sr-only flex shrink-0 items-center gap-3 border-b border-hairline bg-surface px-4 py-3">
        <Link
          href="/dashboard/chat"
          aria-label={t("dashboardChat.backToList")}
          className="-ml-2 inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-fg hover:bg-press lg:hidden"
        >
          <ChevronLeft aria-hidden="true" className="size-6" />
        </Link>
        {isGroup ? (
          <IconTile icon={Users} tone="teal" className="size-10 rounded-full" />
        ) : (
          <UserAvatar name={title} src={meta?.image ?? conversation?.image} />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-fg">{title}</h1>
          <p className="truncate text-[0.8125rem] text-fg-muted">
            {isGroup ? t("dashboardChat.group") : t("dashboardChat.direct")}
          </p>
        </div>
      </header>

      <div
        ref={paneRef}
        role="log"
        aria-live="polite"
        aria-label={t("dashboardChat.messagesLabel").replace("{name}", title)}
        className="flex flex-1 flex-col px-3 pt-4 pb-3 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:bg-app md:px-5"
      >
        <p className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-xs text-fg-muted">
          <Lock aria-hidden="true" className="size-3" />
          {t("dashboardChat.encrypted")}
        </p>

        {isLoading && !data ? (
          <RoomSkeleton />
        ) : error && !data ? (
          <div className="my-auto">
            <ErrorState
              compact
              title={t("dashboardChat.loadErrorTitle")}
              description={t("dashboardChat.roomLoadErrorDescription")}
              onRetry={refetch}
            />
          </div>
        ) : messages.length === 0 ? (
          <div className="my-auto">
            <EmptyState
              icon={MessageSquareText}
              title={t("dashboardChat.roomEmptyTitle")}
              description={t("dashboardChat.roomEmptyDescription").replace("{name}", title)}
              compact
            />
          </div>
        ) : (
          <ol className="mt-auto flex flex-col">
            {timeline.map((item) =>
              item.kind === "day" ? (
                <li key={item.key} className="my-3 flex justify-center first:mt-0">
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-fg-muted">
                    {item.label}
                  </span>
                </li>
              ) : (
                <MessageBubble
                  key={item.key}
                  message={item.message}
                  startsGroup={item.startsGroup}
                  endsGroup={item.endsGroup}
                  showName={isGroup}
                />
              ),
            )}
          </ol>
        )}
      </div>

      <div
        style={keyboardInset > 0 ? { bottom: keyboardInset } : undefined}
        className="sticky bottom-0 z-(--z-sticky) shrink-0 md:relative md:bottom-auto"
      >
        {showJump && hasMessages ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-full flex justify-center pb-3">
            <Button
              size="sm"
              variant={unseen > 0 ? "default" : "outline"}
              className="pointer-events-auto rounded-full shadow-popover"
              onClick={() => scrollToBottom("smooth")}
            >
              <ArrowDown aria-hidden="true" />
              {unseen > 0 ? `${t("dashboardChat.newMessages")} (${unseen})` : t("dashboardChat.jumpToLatest")}
            </Button>
          </div>
        ) : null}
      <form
        onSubmit={handleSend}
        style={keyboardInset > 0 ? { paddingBottom: 8 } : undefined}
        className="flex items-end gap-2 border-t border-hairline bg-surface-nav px-3 pt-2 pb-[calc(8px+var(--safe-bottom))] md:bg-surface md:px-4 md:py-3"
      >
        <label htmlFor={`composer-${conversationId}`} className="sr-only">
          {t("dashboardChat.composerLabel").replace("{name}", title)}
        </label>
        <textarea
          id={`composer-${conversationId}`}
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("dashboardChat.messagePlaceholder")}
          enterKeyHint="send"
          autoComplete="off"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border border-field-border bg-surface px-4 py-2.5 text-base leading-6 text-fg placeholder:text-fg-subtle focus:border-brand-500 focus:ring-2 focus:ring-ring/30 focus:outline-none md:min-h-10 md:py-2 md:text-sm md:leading-6"
        />
        <Button
          type="submit"
          size="icon-lg"
          disabled={!canSend}
          loading={sending}
          aria-label={t("dashboardChat.send")}
          className="size-11 shrink-0 rounded-full md:size-10"
        >
          {sending ? null : <SendHorizontal aria-hidden="true" />}
        </Button>
      </form>
      </div>
    </section>
  );
}

function MessageBubble({
  message,
  startsGroup,
  endsGroup,
  showName,
}: {
  message: ChatMessage;
  startsGroup: boolean;
  endsGroup: boolean;
  showName: boolean;
}) {
  const own = message.isOwn;
  const time = formatThaiTime(message.time);
  return (
    <li className={cn("flex items-end gap-2", own ? "justify-end" : "justify-start", endsGroup ? "mb-3" : "mb-0.5")}>
      {!own ? (
        <span className={cn("w-8 shrink-0", endsGroup && "mb-[1.375rem]")}>
          {endsGroup ? <UserAvatar name={message.senderName} src={message.senderImage} size="sm" /> : null}
        </span>
      ) : null}
      <div className={cn("flex max-w-[78%] min-w-0 flex-col md:max-w-[65%]", own ? "items-end" : "items-start")}>
        {!own && showName && startsGroup ? (
          <span className="mb-1 px-1 text-xs font-medium text-fg-muted">{message.senderName}</span>
        ) : null}
        <div
          className={cn(
            "rounded-[20px] px-3.5 py-2 text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap",
            own ? "bg-brand-solid text-on-brand" : "border border-hairline bg-surface text-fg",
            own && endsGroup && "rounded-br-md",
            !own && endsGroup && "rounded-bl-md",
            message.pending && "opacity-70",
          )}
        >
          {message.text}
        </div>
        {endsGroup ? (
          <span className="mt-1 flex items-center gap-1 px-1 text-xs text-fg-subtle tabular">
            {time}
            {own ? (
              message.pending ? (
                <Clock3 aria-label={t("dashboardChat.sending")} className="size-3" />
              ) : (
                <Check aria-label={t("dashboardChat.sent")} className="size-3.5 text-brand-fg" />
              )
            ) : null}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function RoomSkeleton() {
  return (
    <div aria-hidden="true" className="mt-auto flex flex-col gap-3">
      <Skeleton className="h-10 w-2/3 rounded-[20px]" />
      <Skeleton className="ml-auto h-10 w-1/2 rounded-[20px]" />
      <Skeleton className="h-14 w-3/5 rounded-[20px]" />
      <Skeleton className="ml-auto h-10 w-2/5 rounded-[20px]" />
    </div>
  );
}
