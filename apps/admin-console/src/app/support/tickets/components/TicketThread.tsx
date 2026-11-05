"use client";

import { ArrowRightLeft, Lock } from "lucide-react";
import { EmptyState } from "@/components/app";
import { formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import { cn } from "@/lib/utils";
import { buildThread, type AdminMessage, type ThreadItem } from "../ticketModel";
import "@/locales/th/tickets";

function StatusEvent({ item }: { item: ThreadItem }) {
  const who = item.byRequester ? t("tickets.event.whoRequester") : (item.authorName ?? t("tickets.event.whoSupport"));
  const text = item.fromStatus
    ? t("tickets.event.changed", { who, from: statusLabel("ticket", item.fromStatus), to: statusLabel("ticket", item.toStatus) })
    : t("tickets.event.set", { who, to: statusLabel("ticket", item.toStatus) });
  return (
    <li className="flex items-center justify-center gap-2 px-2 text-center text-[0.8125rem] text-fg-muted">
      <ArrowRightLeft aria-hidden="true" className="size-3.5 shrink-0" />
      <span>
        {text} · <time dateTime={item.createdAt}>{formatThaiDateTime(item.createdAt)}</time>
      </span>
    </li>
  );
}

function Bubble({ item, requesterName }: { item: ThreadItem; requesterName: string }) {
  const isRequester = item.kind === "requester";
  const isInternal = item.kind === "internal";
  const author = isRequester
    ? requesterName
    : (item.authorName ?? t("tickets.author.support"));
  return (
    <li className={cn("flex", isRequester ? "justify-start" : "justify-end")}>
      <article
        className={cn(
          "max-w-[min(36rem,92%)] rounded-xl border px-4 py-3",
          isRequester && "border-hairline bg-surface-muted",
          item.kind === "support" && "border-brand-soft-border bg-brand-soft",
          isInternal && "border-dashed border-warning-border bg-warning-bg",
        )}
      >
        <header className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem]">
          <span className="font-semibold text-fg">{author}</span>
          <span className="text-fg-muted">
            {isRequester ? t("tickets.author.requester") : isInternal ? null : t("tickets.author.support")}
          </span>
          {isInternal ? (
            <span className="inline-flex items-center gap-1 font-medium text-warning-fg">
              <Lock aria-hidden="true" className="size-3.5" />
              {t("tickets.author.internal")}
            </span>
          ) : null}
          <time dateTime={item.createdAt} className="text-fg-subtle">
            {formatThaiDateTime(item.createdAt)}
          </time>
        </header>
        <p className="text-sm break-words whitespace-pre-wrap text-fg">{item.body}</p>
      </article>
    </li>
  );
}

/** The ticket conversation, oldest first: requester left, support right, internal notes dashed amber, status changes inline. */
export function TicketThread({ messages, requesterName }: { messages: readonly AdminMessage[]; requesterName: string }) {
  const items = buildThread(messages);
  if (items.length === 0) return <EmptyState compact title={t("tickets.detail.threadEmpty")} />;
  return (
    <ol className="flex flex-col gap-3" aria-label={t("tickets.detail.thread")}>
      {items.map((item) =>
        item.kind === "event" ? (
          <StatusEvent key={item.id} item={item} />
        ) : (
          <Bubble key={item.id} item={item} requesterName={requesterName} />
        ),
      )}
    </ol>
  );
}
