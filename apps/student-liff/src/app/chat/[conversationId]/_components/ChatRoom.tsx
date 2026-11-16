"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Lock, MessageCircle, Users, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { AppBar, EmptyState, ErrorState, UserAvatar, useBackNavigation } from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { Button } from "@/components/ui/button";
import { LiffErrorState } from "@/app/dashboard/_components/LiffErrorState";
import { studentApi } from "@/lib/api";
import { mutateResource, peekResource } from "@/lib/cachedResource";
import { t } from "@/lib/i18n";
import {
  conversationsResourceKey,
  markConversationRead,
  type Conversation,
  type ConversationsResponse,
} from "../../_lib/conversations";
import {
  buildMessageItems,
  isFatalLoadError,
  type ConversationPayload,
  type DisplayMessage,
} from "../../_lib/messages";
import { decideAutoScroll, isNearBottom } from "../../_lib/scroll";
import { useConversationMessages, type ConversationClient } from "../../_lib/useConversationMessages";
import { useVisualViewportVars } from "../../_lib/useVisualViewport";
import { ChatRoomSkeleton } from "./ChatRoomSkeleton";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { RoomFrame } from "./RoomFrame";

const CLIENT: ConversationClient = {
  getMessages: (conversationId) =>
    studentApi.getConversationMessages(conversationId) as Promise<ConversationPayload | null | undefined>,
  sendMessage: (conversationId, content) => studentApi.sendMessage(conversationId, content),
};

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Chat room for one conversation. Mount with `key={conversationId}`. */
export function ChatRoom({ conversationId }: { conversationId: string }) {
  const { isReady, profile, error: liffError } = useLiff();
  const userId = profile?.userId;
  const room = useConversationMessages(conversationId, {
    client: CLIENT,
    enabled: isReady && Boolean(userId) && !liffError,
    ownName: t("chat.you"),
  });
  const goBackToList = useBackNavigation("/chat");

  // Header info from the cached chat list (the room endpoint has no type and
  // calls every group "กลุ่มสนทนา"); falls back to the room metadata.
  const listEntry: Conversation | undefined = userId
    ? peekResource<ConversationsResponse>(conversationsResourceKey(userId))?.conversations?.find(
        (conversation) => conversation.id === conversationId,
      )
    : undefined;

  // The server marks the room read when it returns the messages: clear the
  // cached badge so the list is right the moment we go back.
  const loaded = !room.isLoading && !room.error;
  useEffect(() => {
    if (!loaded || !userId) return;
    const key = conversationsResourceKey(userId);
    const current = peekResource<ConversationsResponse>(key);
    const next = markConversationRead(current, conversationId);
    if (next && next !== current) mutateResource(key, next);
  }, [loaded, userId, conversationId]);

  if (!isReady) return <ChatRoomSkeleton />;

  if (liffError || !profile) {
    return (
      <RoomFrame>
        <AppBar title={t("chat.title")} back fallbackHref="/chat" className="shrink-0 border-b-[1.5px] border-clay-rim" />
        <div className="my-auto px-4 py-6">
          <LiffErrorState card />
        </div>
      </RoomFrame>
    );
  }

  if (room.isLoading) return <ChatRoomSkeleton />;

  if (room.error) {
    const notFound = isFatalLoadError(room.error);
    return (
      <RoomFrame>
        <AppBar title={t("chat.title")} back fallbackHref="/chat" className="shrink-0 border-b-[1.5px] border-clay-rim" />
        <div className="my-auto overflow-y-auto px-4 py-6">
          <ErrorState
            card
            title={notFound ? t("chat.notFoundTitle") : undefined}
            description={notFound ? t("chat.notFoundDescription") : t("chat.loadMessagesFailed")}
            onRetry={notFound ? undefined : () => void room.refresh()}
            secondaryAction={
              <Button variant={notFound ? "brand" : "ghost"} size="touch" onClick={goBackToList}>
                {t("chat.backToList")}
              </Button>
            }
          />
        </div>
      </RoomFrame>
    );
  }

  const title = listEntry?.title || room.metadata?.title || t("chat.title");
  const subtitle =
    listEntry?.type === "GROUP"
      ? t("chat.groupSubtitle")
      : listEntry?.type === "DIRECT"
        ? t("chat.directSubtitle")
        : undefined;

  return (
    <ChatRoomView
      title={title}
      subtitle={subtitle}
      image={listEntry?.image ?? room.metadata?.image ?? null}
      isGroup={listEntry?.type === "GROUP"}
      showSenderNames={listEntry?.type !== "DIRECT"}
      messages={room.messages}
      isStale={room.isStale}
      isSending={room.isSending}
      send={room.send}
    />
  );
}

interface ChatRoomViewProps {
  title: string;
  subtitle?: string;
  /** Header avatar (the tutor's photo, or initials). */
  image: string | null;
  /** Group chats get the group badge on the header avatar. */
  isGroup: boolean;
  showSenderNames: boolean;
  messages: DisplayMessage[];
  isStale: boolean;
  isSending: boolean;
  send: ReturnType<typeof useConversationMessages>["send"];
}

function ChatRoomView({ title, subtitle, image, isGroup, showSenderNames, messages, isStale, isSending, send }: ChatRoomViewProps) {
  const roomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [hasUnseen, setHasUnseen] = useState(false);

  const nearBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
  const lastIdRef = useRef<string | null>(null);

  useVisualViewportVars(roomRef);

  const items = useMemo(() => buildMessageItems(messages), [messages]);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (smooth && !prefersReducedMotion()) scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    else scroller.scrollTop = scroller.scrollHeight;
    nearBottomRef.current = true;
    setHasUnseen(false);
  }, []);

  // Scroll only when the newest message changed, and only if the student is at
  // the bottom or sent it; otherwise show the "new messages" pill.
  useLayoutEffect(() => {
    const last = messages[messages.length - 1];
    const nextLastId = last ? String(last.id) : null;
    const decision = decideAutoScroll({
      previousLastId: lastIdRef.current,
      nextLastId,
      nextLastIsOwn: Boolean(last?.isOwn),
      nearBottom: nearBottomRef.current,
      hasInitialScroll: initialScrollDoneRef.current,
    });
    lastIdRef.current = nextLastId;
    if (decision === "jump") {
      initialScrollDoneRef.current = true;
      scrollToBottom(false);
    } else if (decision === "smooth") {
      scrollToBottom(true);
    } else if (decision === "indicate") {
      setHasUnseen(true);
    }
  }, [messages, scrollToBottom]);

  // Keyboard opening / composer growing shrinks the list: stay pinned to the bottom.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (nearBottomRef.current) scroller.scrollTop = scroller.scrollHeight;
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  const onScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const near = isNearBottom(scroller);
    nearBottomRef.current = near;
    if (near) setHasUnseen(false);
  };

  const handleSend = () => {
    const text = draft;
    if (!text.trim() || isSending) return;
    setDraft("");
    void send(text).then((result) => {
      if (result !== "failed") return;
      // Give the text back (unless a new message was started meanwhile).
      setDraft((current) => (current.trim() ? current : text));
      toast.error(t("chat.sendFailed"));
    });
  };

  return (
    <RoomFrame ref={roomRef}>
      <AppBar
        title={
          // Avatar + name (patterns.md S14); the avatar is decorative, the h1 reads the name.
          <span className="inline-flex max-w-full items-center gap-2 align-middle">
            <span className="relative shrink-0">
              <UserAvatar src={image} name={title} size="sm" decorative />
              {isGroup ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -bottom-1 flex size-[18px] items-center justify-center rounded-full bg-tile-purple text-icon-purple ring-2 ring-surface"
                >
                  <Users className="size-3" strokeWidth={2.6} />
                </span>
              ) : null}
            </span>
            <span className="min-w-0 truncate">{title}</span>
          </span>
        }
        subtitle={subtitle}
        back
        fallbackHref="/chat"
        className="shrink-0 border-b-[1.5px] border-clay-rim"
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        {isStale ? (
          <p
            role="status"
            className="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-1.5 border-b-[1.5px] border-warning-border bg-warning-bg px-4 py-1.5 text-center text-[13px] leading-[1.5] font-semibold text-warning-fg"
          >
            <WifiOff aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.4} />
            {t("chat.reconnecting")}
          </p>
        ) : null}

        <div
          ref={scrollerRef}
          onScroll={onScroll}
          role="log"
          aria-label={t("chat.messagesAria")}
          // Overflowing, it is a Tab stop of its own: draw the ring inside its box (the frame clips anything outside).
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 focus-visible:outline-offset-[-3px]"
        >
          <div className="flex min-h-full flex-col justify-end">
            <div className="flex justify-center pt-4 pb-1">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-[14px] border-[1.5px] border-clay-rim bg-surface-muted px-3 py-1 text-xs leading-[1.6] text-fg-muted">
                <Lock aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.4} />
                {t("chat.secureConversation")}
              </span>
            </div>

            {items.length === 0 ? (
              <EmptyState
                card
                className="my-auto"
                icon={MessageCircle}
                tone="blue"
                title={t("chat.emptyRoomTitle")}
                description={t("chat.emptyRoomDescription")}
              />
            ) : (
              items.map((item) =>
                item.kind === "date" ? (
                  <div key={item.key} className="flex justify-center pt-5 pb-1">
                    <span className="rounded-full border-[1.5px] border-clay-rim bg-surface-muted px-3 py-0.5 text-xs leading-[1.5] font-semibold text-fg-muted">
                      {item.label}
                    </span>
                  </div>
                ) : (
                  <MessageBubble
                    key={item.key}
                    message={item.message}
                    isFirstInGroup={item.isFirstInGroup}
                    isLastInGroup={item.isLastInGroup}
                    showSenderName={showSenderNames}
                  />
                ),
              )
            )}
          </div>
        </div>

        {hasUnseen ? (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-3 left-1/2 flex h-11 -translate-x-1/2 items-center gap-1.5 rounded-full bg-brand-solid px-4 font-heading text-[15px] leading-[1.3] font-semibold text-on-brand shadow-[0_var(--ledge-sm)_0_var(--brand-solid-edge),var(--shadow-popover)] [-webkit-tap-highlight-color:transparent] active:bg-brand-solid-pressed"
          >
            <ArrowDown aria-hidden="true" className="size-5" />
            {t("chat.newMessages")}
          </button>
        ) : null}
      </div>

      <Composer value={draft} onChange={setDraft} onSend={handleSend} sending={isSending} />
    </RoomFrame>
  );
}
