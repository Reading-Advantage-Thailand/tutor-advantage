"use client";

import { formatListTimestamp, formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { dueState, type AdminTicketSummary } from "../ticketModel";
import "@/locales/th/tickets";

/**
 * First-response deadline: the date (tabular) plus, when it matters, a dot +
 * word ("เกินกำหนด" danger, "ใกล้ครบกำหนด" warning). Once answered or closed it is
 * plain secondary text, never a coloured status.
 */
export function DueCell({ ticket }: { ticket: AdminTicketSummary }) {
  const state = dueState(ticket);
  if (state === "resolved") return <span className="text-fg-subtle">{t("tickets.due.resolved")}</span>;
  if (state === "answered") {
    return (
      <span className="whitespace-nowrap text-fg-muted tabular">
        {t("tickets.due.answered", { date: formatListTimestamp(ticket.firstResponseAt) })}
      </span>
    );
  }
  const urgent = state === "overdue" || state === "soon";
  return (
    <span className="flex min-w-0 flex-col">
      <span className={cn("whitespace-nowrap tabular", state === "overdue" ? "font-semibold text-danger-fg" : "text-fg")}>
        {formatThaiDateTime(ticket.dueAt)}
      </span>
      {urgent ? (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[0.8125rem] leading-normal whitespace-nowrap",
            state === "overdue" ? "font-medium text-danger-fg" : "text-warning-fg",
          )}
        >
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
          {t(state === "overdue" ? "tickets.due.overdue" : "tickets.due.soon")}
        </span>
      ) : null}
    </span>
  );
}
