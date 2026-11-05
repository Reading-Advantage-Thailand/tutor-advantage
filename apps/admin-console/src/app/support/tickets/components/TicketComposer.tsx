"use client";

import { useState, type FormEvent } from "react";
import { Lock, Send } from "lucide-react";
import { Card, Notice, SegmentedControl, SelectField, TextAreaField } from "@/components/app";
import { toast } from "@/components/app/toastStore";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import {
  buildMessagePayload,
  clientMessageIdFor,
  draftAttemptKey,
  REPLY_MAX,
  TICKET_STATUSES,
  validateComposer,
  type AdminTicketDetail,
  type AdminTicketResponse,
  type ComposerError,
  type PendingAttempt,
} from "../ticketModel";
import "@/locales/th/tickets";

type Mode = "reply" | "internal";

function composerErrorText(error: ComposerError): string {
  if (error === "EMPTY") return t("tickets.composer.errorEmpty");
  if (error === "TOO_LONG") return t("tickets.composer.errorTooLong", { max: formatNumber(REPLY_MAX) });
  return t("tickets.composer.errorStatus");
}

/** Public reply / internal note composer with an optional "status after sending". */
export function TicketComposer({
  ticket,
  onSent,
}: {
  ticket: AdminTicketDetail;
  onSent: (ticket: AdminTicketDetail) => void;
}) {
  const [mode, setMode] = useState<Mode>("reply");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // The last send whose outcome is unknown. Its id is reused only when the
  // exact same draft is sent again (the backend then replays it).
  const [pending, setPending] = useState<PendingAttempt | null>(null);

  const internal = mode === "internal";
  const length = body.trim().length;
  const statusOptions = [
    {
      value: "",
      label: !internal && ticket.status === "OPEN" ? t("tickets.composer.statusAutoProgress") : t("tickets.composer.statusKeep"),
    },
    ...TICKET_STATUSES.filter((value) => value !== ticket.status).map((value) => ({ value, label: statusLabel("ticket", value) })),
  ];

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending) return;
    const draft = { body, internal, status };
    const invalid = validateComposer(draft);
    if (invalid) {
      setError(composerErrorText(invalid));
      return;
    }
    setError(null);
    setSending(true);
    const key = draftAttemptKey(draft, ticket.status);
    const clientMessageId = clientMessageIdFor(pending, key);
    try {
      const result = await api.post<AdminTicketResponse>(
        `/v1/admin/tickets/${encodeURIComponent(ticket.ticketId)}/messages`,
        buildMessagePayload(draft, ticket.status, clientMessageId),
        { idempotencyKey: clientMessageId },
      );
      toast.success(internal ? t("tickets.toast.noted") : t("tickets.toast.replied"));
      setBody("");
      setStatus("");
      setPending(null);
      onSent(result.ticket);
    } catch (err) {
      // A 4xx means the server rejected (and did not store) this draft: the next try is a new message.
      // Otherwise it may have been stored, so an identical retry must reuse the id.
      const rejected = err instanceof ApiError && err.status >= 400 && err.status < 500;
      setPending(rejected ? null : { key, clientMessageId });
      setError(err instanceof ApiError || err instanceof Error ? err.message : t("shell.errorTitle"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card as="section" aria-label={t("tickets.composer.title")}>
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[0.9375rem] font-semibold text-fg">{t("tickets.composer.title")}</h2>
          <SegmentedControl
            aria-label={t("tickets.composer.mode")}
            size="sm"
            value={mode}
            onValueChange={(next) => {
              setMode(next);
              setError(null);
            }}
            items={[
              { value: "reply", label: t("tickets.composer.modeReply"), icon: Send },
              { value: "internal", label: t("tickets.composer.modeInternal"), icon: Lock },
            ]}
          />
        </div>

        <TextAreaField
          label={internal ? t("tickets.composer.internalLabel") : t("tickets.composer.replyLabel")}
          placeholder={internal ? t("tickets.composer.internalPlaceholder") : t("tickets.composer.replyPlaceholder")}
          hint={
            <span className="flex flex-wrap justify-between gap-2">
              <span>{internal ? t("tickets.composer.internalHint") : null}</span>
              <span className={length > REPLY_MAX ? "text-danger-fg" : undefined}>
                {t("tickets.composer.counter", { count: formatNumber(length), max: formatNumber(REPLY_MAX) })}
              </span>
            </span>
          }
          error={error ?? undefined}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          className={internal ? "border-dashed border-warning-border bg-warning-bg" : undefined}
        />

        {!internal && ticket.status === "RESOLVED" && !status ? (
          <Notice tone="info">{t("tickets.composer.closedNotice")}</Notice>
        ) : null}
        {!internal ? <Notice tone="warning">{t("tickets.composer.safetyNotice")}</Notice> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SelectField
            label={t("tickets.composer.statusLabel")}
            containerClassName="w-full sm:w-80"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={statusOptions}
          />
          <Button type="submit" variant={internal ? "outline" : "default"} loading={sending}>
            {internal ? <Lock aria-hidden="true" /> : <Send aria-hidden="true" />}
            {internal ? t("tickets.composer.saveNote") : t("tickets.composer.send")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
