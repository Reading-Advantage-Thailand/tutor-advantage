"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppBar, ConfirmSheet, ErrorState, Notice, Surface, useBackNavigation } from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { Button } from "@/components/ui/button";
import { LiffErrorState } from "@/app/dashboard/_components/LiffErrorState";
import { Composer } from "@/app/chat/[conversationId]/_components/Composer";
import { RoomFrame } from "@/app/chat/[conversationId]/_components/RoomFrame";
import { decideAutoScroll, isNearBottom } from "@/app/chat/_lib/scroll";
import { useVisualViewportVars } from "@/app/chat/_lib/useVisualViewport";
import { usePolling } from "@/hooks/usePolling";
import { studentApi } from "@/lib/api";
import { mutateResource, peekResource, useCachedResource } from "@/lib/cachedResource";
import { formatThaiDate, formatThaiTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { supportTicketResourceKey, supportTicketsResourceKey } from "@/lib/resourceKeys";
import {
  REPLY_MAX,
  getSupportErrorKey,
  isTicketClosedError,
  isTicketNotFound,
  isUuid,
  nextReplyAttempt,
  type ReplyAttempt,
} from "../_lib/form";
import {
  buildThreadItems,
  formatTicketNumber,
  getCategoryLabelKey,
  getLastMessageId,
  markTicketRead,
  upsertTicketSummary,
  type TicketDetail,
  type TicketResponse,
  type TicketsResponse,
} from "../_lib/tickets";
import { TicketDetailSkeleton } from "./SupportSkeletons";
import { StatusChip } from "./TicketParts";
import { TicketBubble, TicketThread } from "./TicketThread";

/** New team replies show up within this long while the screen is visible. */
const POLL_INTERVAL_MS = 20_000;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Keep the cached "คำร้องของฉัน" list in step with what this screen just learned. */
function syncList(userId: string, ticket: TicketDetail) {
  const key = supportTicketsResourceKey(userId);
  const current = peekResource<TicketsResponse>(key);
  const next = upsertTicketSummary(current, ticket);
  if (next && next !== current) mutateResource(key, next);
}

/** One support ticket: summary, thread, reply composer and "ปิดคำร้อง". Mount with `key={ticketId}`. */
export function TicketRoom({ ticketId }: { ticketId: string }) {
  const { isReady, profile, error: liffError } = useLiff();
  const userId = profile?.userId;
  const validId = isUuid(ticketId);
  const goBackToList = useBackNavigation("/support");

  const resource = useCachedResource<TicketResponse>(
    userId && validId ? supportTicketResourceKey(userId, ticketId) : null,
    () => studentApi.getSupportTicket(ticketId),
    { enabled: isReady && validId, staleTime: 5_000 },
  );
  const ticket = resource.data?.ticket;

  usePolling(resource.refetch, {
    interval: POLL_INTERVAL_MS,
    enabled: isReady && validId && Boolean(ticket),
    immediate: false,
  });

  // GET marks the ticket read on the server: clear the list's unread dot now.
  useEffect(() => {
    if (!userId || !ticket) return;
    const key = supportTicketsResourceKey(userId);
    const current = peekResource<TicketsResponse>(key);
    const next = markTicketRead(current, ticket.ticketId);
    if (next && next !== current) mutateResource(key, next);
  }, [userId, ticket]);

  if (!isReady) return <TicketDetailSkeleton />;

  if (liffError || !profile) {
    return (
      <RoomFrame>
        <AppBar title={t("support.title")} back fallbackHref="/support" className="shrink-0 border-b border-hairline" />
        <LiffErrorState className="my-auto" />
      </RoomFrame>
    );
  }

  const notFound = !validId || (resource.error !== undefined && resource.error !== null && isTicketNotFound(resource.error));
  if (notFound || (resource.error && !ticket)) {
    return (
      <RoomFrame>
        <AppBar title={t("support.title")} back fallbackHref="/support" className="shrink-0 border-b border-hairline" />
        <ErrorState
          className="my-auto"
          title={notFound ? t("support.notFoundTitle") : undefined}
          description={notFound ? t("support.notFoundDescription") : t("support.detailFailed")}
          onRetry={notFound ? undefined : () => void resource.refetch()}
          retrying={resource.isValidating}
          secondaryAction={
            <Button variant={notFound ? "brand" : "ghost"} size="touch" onClick={goBackToList}>
              {t("support.backToList")}
            </Button>
          }
        />
      </RoomFrame>
    );
  }

  if (resource.isLoading || !ticket) return <TicketDetailSkeleton />;

  return (
    <TicketRoomView
      ticket={ticket}
      onTicket={(next) => {
        resource.mutate({ ticket: next });
        syncList(profile.userId, next);
      }}
      refetch={resource.refetch}
    />
  );
}

interface TicketRoomViewProps {
  ticket: TicketDetail;
  /** A fresh copy of the ticket from a reply/resolve response. */
  onTicket: (ticket: TicketDetail) => void;
  refetch: () => Promise<unknown>;
}

function TicketRoomView({ ticket, onTicket, refetch }: TicketRoomViewProps) {
  const roomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<ReplyAttempt | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  // The last failed reply: resending the same text reuses its clientMessageId.
  const lastAttemptRef = useRef<ReplyAttempt | null>(null);
  const [now] = useState(() => new Date());

  const nearBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
  const lastIdRef = useRef<string | null>(null);

  useVisualViewportVars(roomRef);

  const items = useMemo(() => buildThreadItems(ticket.messages, now), [ticket.messages, now]);
  const lastItem = items[items.length - 1];
  const lastIsOwnBubble = lastItem?.kind === "message" && lastItem.own;
  const lastId = pending ? `pending:${pending.clientMessageId}` : getLastMessageId(ticket.messages);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (smooth && !prefersReducedMotion()) scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    else scroller.scrollTop = scroller.scrollHeight;
    nearBottomRef.current = true;
  }, []);

  // Open at the newest message; later follow new ones only if the student is at the bottom or sent it.
  useLayoutEffect(() => {
    const decision = decideAutoScroll({
      previousLastId: lastIdRef.current,
      nextLastId: lastId ?? "empty",
      nextLastIsOwn: Boolean(pending),
      nearBottom: nearBottomRef.current,
      hasInitialScroll: initialScrollDoneRef.current,
    });
    lastIdRef.current = lastId ?? "empty";
    if (decision === "jump") {
      initialScrollDoneRef.current = true;
      scrollToBottom(false);
    } else if (decision === "smooth") {
      scrollToBottom(true);
    }
  }, [lastId, pending, scrollToBottom]);

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
    if (scroller) nearBottomRef.current = isNearBottom(scroller);
  };

  const handleSend = () => {
    const text = draft;
    if (!text.trim() || pending) return;
    if (text.trim().length > REPLY_MAX) {
      toast.error(t("support.replyTooLong"), { id: "support-reply-error" });
      return;
    }
    const attempt = nextReplyAttempt(lastAttemptRef.current, text);
    lastAttemptRef.current = attempt;
    setPending(attempt);
    setDraft("");
    void (async () => {
      try {
        const response = (await studentApi.replySupportTicket(ticket.ticketId, {
          body: attempt.text,
          clientMessageId: attempt.clientMessageId,
        })) as TicketResponse;
        lastAttemptRef.current = null;
        if (response?.ticket) onTicket(response.ticket);
        else void refetch();
      } catch (err) {
        console.warn("Failed to reply to support ticket:", err);
        // Give the text back (unless a new message was started meanwhile).
        setDraft((current) => (current.trim() ? current : text));
        toast.error(t(getSupportErrorKey(err)), { id: "support-reply-error" });
        // Closed for good: reload so the composer turns into the closed notice.
        if (isTicketClosedError(err)) void refetch();
      } finally {
        setPending(null);
      }
    })();
  };

  const handleResolve = async () => {
    if (closing) return;
    setClosing(true);
    try {
      const response = (await studentApi.resolveSupportTicket(ticket.ticketId)) as TicketResponse;
      if (response?.ticket) onTicket(response.ticket);
      else void refetch();
      setConfirmClose(false);
      toast.success(t("support.closed"), { id: "support-closed" });
    } catch (err) {
      console.warn("Failed to resolve support ticket:", err);
      const key = getSupportErrorKey(err);
      toast.error(t(key === "support.sendFailed" ? "support.closeFailed" : key), { id: "support-close-error" });
    } finally {
      setClosing(false);
    }
  };

  const resolved = ticket.status === "RESOLVED";
  const meta = [
    `${t("support.sentAt")} ${formatThaiDate(ticket.createdAt, "medium")} ${formatThaiTime(ticket.createdAt)}`.trim(),
    ticket.classTitle ? `${t("support.detailClass")}: ${ticket.classTitle}` : null,
  ].filter(Boolean) as string[];

  return (
    <RoomFrame ref={roomRef}>
      <AppBar
        title={`${t("support.detailTitlePrefix")} ${formatTicketNumber(ticket.ticketNumber)}`}
        subtitle={t(getCategoryLabelKey(ticket.category))}
        back
        fallbackHref="/support"
        className="shrink-0 border-b border-hairline"
      />

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        role="log"
        aria-label={t("support.messagesAria")}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3"
      >
        <Surface as="section" className="mt-3 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <h1 className="min-w-0 text-[17px] leading-[1.5] font-bold break-words text-fg">{ticket.subject}</h1>
            <StatusChip status={ticket.status} size="md" />
          </div>
          {meta.map((line) => (
            <p key={line} className="text-[13px] leading-[1.5] text-fg-muted">
              {line}
            </p>
          ))}
          {ticket.paymentReference ? (
            <p className="text-[13px] leading-[1.5] text-fg-muted">
              {t("support.detailRef")}: <span className="font-mono break-all text-fg">{ticket.paymentReference}</span>
            </p>
          ) : null}
          {resolved ? null : (
            <Button
              variant="brandSoft"
              size="touch"
              className="mt-1 self-start"
              onClick={() => setConfirmClose(true)}
            >
              <CheckCircle2 aria-hidden="true" />
              {t("support.close")}
            </Button>
          )}
        </Surface>

        <TicketThread items={items} />
        {pending ? (
          <TicketBubble own body={pending.text} createdAt={new Date().toISOString()} isFirstInGroup={!lastIsOwnBubble} pending />
        ) : null}
      </div>

      {ticket.canReply ? (
        <>
          {ticket.status === "WAITING_ON_REQUESTER" || resolved ? (
            <div className="shrink-0 px-3 pb-2">
              <Notice
                tone={resolved ? "info" : "warning"}
                title={resolved ? t("support.reopenNoticeTitle") : t("support.waitingNoticeTitle")}
                description={resolved ? t("support.reopenNoticeDescription") : t("support.waitingNoticeDescription")}
              />
            </div>
          ) : null}
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={handleSend}
            sending={Boolean(pending)}
            placeholder={t("support.replyPlaceholder")}
          />
        </>
      ) : (
        <div className="shrink-0 border-t border-hairline bg-surface px-3 pt-3 pb-[max(12px,var(--safe-bottom))]">
          <Notice
            tone="info"
            title={t("support.closedNoticeTitle")}
            description={t("support.closedNoticeDescription")}
            action={
              <Button variant="brandSoft" size="touch" nativeButton={false} render={<Link href="/support/new" />}>
                <Plus aria-hidden="true" />
                {t("support.newRequest")}
              </Button>
            }
          />
        </div>
      )}

      <ConfirmSheet
        open={confirmClose}
        onOpenChange={(open) => {
          if (!closing) setConfirmClose(open);
        }}
        title={t("support.closeConfirmTitle")}
        description={t("support.closeConfirmDescription")}
        confirmLabel={t("support.close")}
        onConfirm={() => void handleResolve()}
        loading={closing}
      />
    </RoomFrame>
  );
}
