"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import {
  Card,
  ConfirmDialog,
  Notice,
  Page,
  PageHeader,
  StatusChip,
  TextAreaField,
  toast,
  useNotifications,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { usePolling } from "@/hooks/usePolling";
import { formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { replyToTicket, resolveTicket } from "../actions";
import {
  REPLY_MAX,
  TICKET_POLL_MS,
  categoryLabel,
  createClientId,
  formatTicketNumber,
  getSupportErrorMessage,
  statusChangeText,
  statusLabel,
  statusToneFor,
  ticketStateNotice,
  validateReply,
  type TicketDetail,
  type TicketMessage,
} from "../lib/support";

function MessageItem({ message }: { message: TicketMessage }) {
  if (message.kind === "STATUS_CHANGE") {
    return (
      <li className="flex justify-center">
        <p className="rounded-full bg-surface-muted px-3 py-1 text-center text-xs text-fg-muted">
          {statusChangeText(message)} · {formatThaiDateTime(message.createdAt)}
        </p>
      </li>
    );
  }
  const own = message.author === "REQUESTER";
  return (
    <li className={cn("flex flex-col gap-1", own ? "items-end" : "items-start")}>
      <span className="px-1 text-xs font-medium text-fg-muted">
        {own ? t("dashboardSupport.authorYou") : t("dashboardSupport.authorSupport")}
      </span>
      <div
        className={cn(
          "max-w-[min(85%,36rem)] rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-fg",
          own ? "border-brand-soft-border bg-brand-soft" : "border-hairline bg-surface",
        )}
      >
        {message.body}
      </div>
      <time dateTime={message.createdAt} className="px-1 text-[0.6875rem] text-fg-subtle">
        {formatThaiDateTime(message.createdAt)}
      </time>
    </li>
  );
}

/**
 * Ticket thread: messages oldest first, reply box and "ปิดคำร้อง". Polls
 * /api/support/tickets/:id while the tab is visible so support replies show
 * up. Each draft keeps one clientMessageId until it is sent, so a retry after
 * a timeout is a server-side no-op instead of a duplicate message.
 */
export function TicketThread({ initial }: { initial: TicketDetail }) {
  const [ticket, setTicket] = useState(initial);
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  // The last send whose outcome is unknown: its id is reused only when the
  // same text is sent again (the backend then replays it instead of storing
  // it twice). Edited text is a new message with a new id.
  const pendingAttemptRef = useRef<{ text: string; id: string } | null>(null);
  const { refresh: refreshNotifications } = useNotifications();
  const ticketId = initial.ticketId;

  // Opening the ticket marked it read: update the nav badge now.
  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  const poll = useCallback(async () => {
    const res = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json().catch(() => null)) as { ticket?: TicketDetail } | null;
    if (data?.ticket) setTicket({ ...data.ticket, messages: data.ticket.messages ?? [] });
  }, [ticketId]);

  const { runNow } = usePolling(poll, { interval: TICKET_POLL_MS, immediate: false });

  const handleReply = async (event: FormEvent) => {
    event.preventDefault();
    if (sending) return;
    const error = validateReply(reply);
    if (error) {
      setReplyError(error);
      return;
    }
    const text = reply.trim();
    const pending = pendingAttemptRef.current;
    const clientMessageId = pending && pending.text === text ? pending.id : createClientId();
    pendingAttemptRef.current = { text, id: clientMessageId };
    setSending(true);
    setReplyError("");
    try {
      const result = await replyToTicket(ticketId, text, clientMessageId);
      if (result.ok) {
        setTicket(result.ticket);
        setReply("");
        pendingAttemptRef.current = null;
        toast.success(t("dashboardSupport.replySent"));
      } else {
        setReplyError(getSupportErrorMessage(result.code));
        // The ticket may have been closed for good meanwhile: reload so the composer hides.
        if (result.code === "TICKET_CLOSED") void runNow();
      }
    } catch {
      setReplyError(getSupportErrorMessage(null));
    }
    setSending(false);
  };

  const handleClose = async () => {
    setClosing(true);
    try {
      const result = await resolveTicket(ticketId);
      if (result.ok) {
        setTicket(result.ticket);
        setConfirmOpen(false);
        toast.success(t("dashboardSupport.closed"));
      } else {
        toast.error(getSupportErrorMessage(result.code));
      }
    } catch {
      toast.error(getSupportErrorMessage(null));
    }
    setClosing(false);
  };

  const notice = ticketStateNotice(ticket);
  const meta = [
    formatTicketNumber(ticket.ticketNumber),
    categoryLabel(ticket.category),
    ticket.classTitle ? t("dashboardSupport.relatedClass").replaceAll("{name}", ticket.classTitle) : null,
    t("dashboardSupport.createdAt").replaceAll("{time}", formatThaiDateTime(ticket.createdAt)),
  ].filter(Boolean);

  return (
    <Page width="narrow">
      <PageHeader
        title={ticket.subject}
        appBarTitle={t("dashboardSupport.title")}
        mobileTitle="inline"
        description={meta.join(" · ")}
        meta={<StatusChip status={ticket.status} label={statusLabel(ticket.status)} tone={statusToneFor(ticket.status)} />}
        backHref="/dashboard/support"
        backLabel={t("dashboardSupport.backToList")}
        actions={
          ticket.status !== "RESOLVED" ? (
            <Button id="btn-close-ticket" variant="outline" onClick={() => setConfirmOpen(true)}>
              <CheckCircle2 aria-hidden="true" />
              {t("dashboardSupport.close")}
            </Button>
          ) : null
        }
      />

      {notice ? (
        <Notice tone={notice.tone} role="status">
          {notice.text}
          {!ticket.canReply ? (
            <>
              {" "}
              <Link href="/dashboard/support/new" className="font-semibold underline underline-offset-2">
                {t("dashboardSupport.newTicket")}
              </Link>
            </>
          ) : null}
        </Notice>
      ) : null}

      <ol aria-label={t("dashboardSupport.threadLabel")} aria-live="polite" className="flex flex-col gap-4">
        {ticket.messages.map((message) => (
          <MessageItem key={message.messageId} message={message} />
        ))}
      </ol>

      {ticket.canReply ? (
        <Card as="section" aria-label={t("dashboardSupport.replyLabel")}>
          <form onSubmit={handleReply} noValidate className="flex flex-col gap-3">
            <TextAreaField
              id="ticket-reply"
              label={t("dashboardSupport.replyLabel")}
              placeholder={t("dashboardSupport.replyPlaceholder")}
              rows={4}
              maxLength={REPLY_MAX}
              value={reply}
              error={replyError || undefined}
              hint={t("dashboardSupport.privacyBody")}
              onChange={(event) => {
                setReply(event.target.value);
                if (replyError) setReplyError("");
              }}
            />
            <div className="flex justify-end">
              <Button id="btn-send-reply" type="submit" loading={sending}>
                {sending ? t("dashboardSupport.replySending") : t("dashboardSupport.replySend")}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("dashboardSupport.closeConfirmTitle")}
        description={t("dashboardSupport.closeConfirmDescription")}
        confirmLabel={t("dashboardSupport.closeConfirm")}
        onConfirm={handleClose}
        loading={closing}
      />
    </Page>
  );
}
