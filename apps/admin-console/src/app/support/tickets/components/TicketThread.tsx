"use client";

import { ArrowRightLeft, Lock, MessagesSquare } from "lucide-react";
import { EmptyState, UserAvatar } from "@/components/app";
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
    <li className="flex justify-center px-2">
      <span className="inline-flex max-w-full items-start gap-2 rounded-(--radius-chip) bg-surface-muted px-3 py-1.5 text-left text-[0.8125rem] leading-normal text-fg-muted">
        <ArrowRightLeft aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span className="min-w-0">
          {text} · <time dateTime={item.createdAt} className="whitespace-nowrap tabular">{formatThaiDateTime(item.createdAt)}</time>
        </span>
      </span>
    </li>
  );
}

/**
 * S13 bubbles at admin sizes: the requester on the left (card + rim, with an
 * avatar), support on the right (--brand-soft / --brand-soft-fg, never white
 * on a brand fill), internal notes on the right with a dashed warning rim and
 * a lock + "ผู้แจ้งไม่เห็น". The tail corner is the one nearest the author.
 */
function Bubble({ item, requesterName, requesterId }: { item: ThreadItem; requesterName: string; requesterId?: string }) {
  const isRequester = item.kind === "requester";
  const isInternal = item.kind === "internal";
  const author = isRequester ? requesterName : (item.authorName ?? t("tickets.author.support"));
  return (
    <li className={cn("flex items-end gap-2.5", isRequester ? "justify-start" : "justify-end")}>
      {isRequester ? (
        <UserAvatar name={requesterName} seed={requesterId} size="sm" decorative className="mb-0.5 hidden sm:inline-flex" />
      ) : null}
      <article className={cn("flex max-w-[min(38rem,92%)] min-w-0 flex-col gap-1 sm:max-w-[min(38rem,80%)]", !isRequester && "items-end")}>
        <header
          className={cn(
            "flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-[0.8125rem] leading-normal",
            !isRequester && "justify-end text-right",
          )}
        >
          <span className="font-semibold text-fg">{author}</span>
          {isInternal ? (
            <span className="inline-flex items-center gap-1 font-medium text-warning-fg">
              <Lock aria-hidden="true" className="size-3.5" />
              {t("tickets.author.internal")}
            </span>
          ) : (
            <span className="text-fg-muted">{isRequester ? t("tickets.author.requester") : t("tickets.author.support")}</span>
          )}
          <time dateTime={item.createdAt} className="whitespace-nowrap text-fg-subtle tabular">
            {formatThaiDateTime(item.createdAt)}
          </time>
        </header>
        <div
          className={cn(
            "max-w-full rounded-[14px] border px-3.5 py-2.5",
            isRequester && "rounded-bl-[4px] border-clay-rim bg-surface text-fg shadow-card",
            item.kind === "support" && "rounded-br-[4px] border-brand-soft-border bg-brand-soft text-brand-soft-fg",
            isInternal && "rounded-br-[4px] border-dashed border-warning-border bg-warning-bg text-fg",
          )}
        >
          <p className="text-sm break-words whitespace-pre-wrap">{item.body}</p>
        </div>
      </article>
    </li>
  );
}

/** The ticket conversation, oldest first: requester left, support right, internal notes dashed amber, status changes inline. */
export function TicketThread({
  messages,
  requesterName,
  requesterId,
}: {
  messages: readonly AdminMessage[];
  requesterName: string;
  /** Stable avatar tone for the requester. */
  requesterId?: string;
}) {
  const items = buildThread(messages);
  if (items.length === 0) return <EmptyState as="h3" icon={MessagesSquare} title={t("tickets.detail.threadEmpty")} />;
  return (
    <ol className="flex flex-col gap-4" aria-label={t("tickets.detail.thread")}>
      {items.map((item) =>
        item.kind === "event" ? (
          <StatusEvent key={item.id} item={item} />
        ) : (
          <Bubble key={item.id} item={item} requesterName={requesterName} requesterId={requesterId} />
        ),
      )}
    </ol>
  );
}
