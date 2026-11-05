import { FileQuestion } from "lucide-react";
import { Chip, IconTile, ListRow } from "@/components/mobile";
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

/** Ticket status pill ("รอทีมงาน", "รอข้อมูลจากคุณ"…). */
export function StatusChip({ status, size = "sm" }: { status: TicketStatus; size?: "sm" | "md" }) {
  const display = getStatusDisplay(status);
  return (
    <Chip tone={display.tone} size={size} dot>
      {t(display.labelKey)}
    </Chip>
  );
}

/** One ticket in "คำร้องของฉัน": subject, #number · category, time, status and the unread dot. */
export function TicketRow({ ticket, now }: { ticket: TicketSummary; now: Date }) {
  const unread = ticket.hasUnreadReply;
  return (
    <ListRow
      href={`/support/${ticket.ticketId}`}
      chevron={false}
      lines={1}
      className="min-h-[72px]"
      leading={
        <span className="relative">
          <IconTile icon={FileQuestion} tone={unread ? "blue" : "neutral"} />
          {unread ? (
            <>
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-danger-solid ring-2 ring-surface"
              />
              <span className="sr-only">{t("support.unreadReply")}</span>
            </>
          ) : null}
        </span>
      }
      title={<span className={cn(unread && "font-bold")}>{ticket.subject}</span>}
      subtitle={
        <span className={cn(unread && "font-semibold text-fg")}>
          {formatTicketNumber(ticket.ticketNumber)} · {t(getCategoryLabelKey(ticket.category))}
        </span>
      }
      trailing={
        <span className="flex flex-col items-end gap-1.5 self-stretch py-0.5">
          <span className={cn("text-xs leading-[1.5] tabular-nums", unread ? "font-semibold text-brand-fg" : "text-fg-muted")}>
            {formatListTimestamp(ticket.lastMessageAt, now)}
          </span>
          <StatusChip status={ticket.status} />
        </span>
      }
    />
  );
}
