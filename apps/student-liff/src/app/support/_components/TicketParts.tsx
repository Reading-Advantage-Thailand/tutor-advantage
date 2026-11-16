import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Chip, IconTile } from "@/components/mobile";
import { formatListTimestamp } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  formatTicketNumber,
  getCategoryLabelKey,
  getStatusDisplay,
  type TicketStatus,
  type TicketSummary,
} from "../_lib/tickets";
import { getCategoryVisual } from "./categoryVisuals";

/** Ticket status pill ("รอทีมงาน", "รอข้อมูลจากคุณ"…): colour + dot + word. */
export function StatusChip({ status, size = "sm" }: { status: TicketStatus; size?: "sm" | "md" }) {
  const display = getStatusDisplay(status);
  return (
    <Chip tone={display.tone} size={size} dot>
      {t(display.labelKey)}
    </Chip>
  );
}

/**
 * One ticket in "คำร้องของฉัน" (patterns.md S4/S13): category tile (+ unread
 * dot), subject, last update, "#number · category", status chip, chevron.
 * A flat list row (no ledge): the ListGroup card is the container.
 */
export function TicketRow({ ticket, now }: { ticket: TicketSummary; now: Date }) {
  const unread = ticket.hasUnreadReply;
  const visual = getCategoryVisual(ticket.category);
  return (
    <Link
      href={`/support/${ticket.ticketId}`}
      data-leading=""
      className="list-row flex min-h-[72px] w-full items-start gap-3.5 px-4 py-3.5 text-left transition-colors duration-[var(--duration-fast)] [--row-divider-inset:78px] focus-visible:outline-offset-[-3px] active:bg-press"
    >
      <span className="relative mt-0.5 shrink-0">
        <IconTile icon={visual.icon} tone={visual.tone} />
        {unread ? (
          <>
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 size-3.5 rounded-full bg-danger-solid ring-[2.5px] ring-surface"
            />
            <span className="sr-only">{t("support.unreadReply")}</span>
          </>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-3">
          <span className={cn("t-row line-clamp-2 min-w-0 flex-1 break-words text-fg", unread && "font-bold")}>
            {ticket.subject}
          </span>
          <span
            className={cn(
              "shrink-0 pt-0.5 text-xs leading-[1.5] tabular-nums",
              unread ? "font-semibold text-brand-fg" : "text-fg-muted",
            )}
          >
            {formatListTimestamp(ticket.lastMessageAt, now)}
          </span>
        </span>
        <span className={cn("mt-0.5 block truncate text-sm leading-[1.6]", unread ? "font-semibold text-fg" : "text-fg-muted")}>
          <span className="tabular-nums">{formatTicketNumber(ticket.ticketNumber)}</span> · {t(getCategoryLabelKey(ticket.category))}
        </span>
        <span className="mt-2 flex">
          <StatusChip status={ticket.status} />
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="mt-3 -mr-1 size-5 shrink-0 text-fg-subtle" />
    </Link>
  );
}
