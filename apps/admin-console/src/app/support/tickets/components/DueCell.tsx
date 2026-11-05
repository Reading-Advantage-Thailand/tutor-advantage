"use client";

import { formatListTimestamp, formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { dueState, type AdminTicketSummary } from "../ticketModel";
import "@/locales/th/tickets";

/** First-response deadline: red when overdue, amber within 24h, muted once answered. */
export function DueCell({ ticket }: { ticket: AdminTicketSummary }) {
  const state = dueState(ticket);
  if (state === "resolved") return <span className="text-fg-subtle">{t("tickets.due.resolved")}</span>;
  if (state === "answered") {
    return (
      <span className="whitespace-nowrap text-fg-muted">
        {t("tickets.due.answered", { date: formatListTimestamp(ticket.firstResponseAt) })}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-col">
      <span
        className={cn(
          "whitespace-nowrap",
          state === "overdue" ? "font-semibold text-danger-fg" : state === "soon" ? "text-warning-fg" : "text-fg",
        )}
      >
        {formatThaiDateTime(ticket.dueAt)}
      </span>
      {state === "overdue" || state === "soon" ? (
        <span className={cn("text-[0.8125rem]", state === "overdue" ? "text-danger-fg" : "text-warning-fg")}>
          {t(state === "overdue" ? "tickets.due.overdue" : "tickets.due.soon")}
        </span>
      ) : null}
    </span>
  );
}
