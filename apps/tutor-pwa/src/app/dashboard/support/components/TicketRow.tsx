import { MessageCircle } from "lucide-react";
import { Chip, HELP_URL, IconTile, ListRow, StatusChip, Surface } from "@/components/app";
import { Button } from "@/components/ui/button";
import { formatListTimestamp } from "@/lib/format";
import { t } from "@/lib/i18n";
import { categoryLabel, formatTicketNumber, statusLabel, statusToneFor, type TicketSummary } from "../lib/support";
import { categoryTile } from "./categoryTile";

/** Flat ticket row (patterns.md S13/T9 list): category tile, subject, number + category, status chip and last update. */
export function TicketRow({ ticket }: { ticket: TicketSummary }) {
  const unread = ticket.hasUnreadReply;
  const tile = categoryTile(ticket.category);
  return (
    <ListRow
      href={`/dashboard/support/${ticket.ticketId}`}
      leading={<IconTile icon={tile.icon} tone={tile.tone} />}
      title={
        <span className={unread ? "font-semibold" : undefined}>
          {ticket.subject}
          {unread ? <span className="sr-only"> ({t("dashboardSupport.unreadReply")})</span> : null}
        </span>
      }
      subtitle={[formatTicketNumber(ticket.ticketNumber), categoryLabel(ticket.category), ticket.classTitle]
        .filter(Boolean)
        .join(" · ")}
      meta={
        <>
          <StatusChip status={ticket.status} label={statusLabel(ticket.status)} tone={statusToneFor(ticket.status)} size="sm" />
          {unread ? (
            <span aria-hidden="true">
              <Chip tone="danger" dot size="sm">
                {t("dashboardSupport.unreadReply")}
              </Chip>
            </span>
          ) : null}
          <span className="text-xs text-fg-muted tabular">
            {t("dashboardSupport.lastUpdated").replaceAll("{time}", formatListTimestamp(ticket.lastMessageAt))}
          </span>
        </>
      }
    />
  );
}

/** LINE OA help: a side card on desktop, the last card on phones. */
export function LineHelpCard() {
  return (
    <Surface padding="md" as="section" aria-labelledby="support-line-help">
      <div className="flex items-start gap-3">
        <IconTile icon={MessageCircle} tone="teal" />
        <div className="min-w-0 flex-1">
          <h2 id="support-line-help" className="type-card text-fg">
            {t("dashboardSupport.lineHelpTitle")}
          </h2>
          <p className="type-body-s text-fg-muted">{t("dashboardSupport.lineHelpDescription")}</p>
        </div>
      </div>
      <Button
        variant="outline"
        className="mt-4 w-full"
        render={<a href={HELP_URL} target="_blank" rel="noreferrer" />}
        nativeButton={false}
      >
        {t("dashboardSupport.lineHelpAction")}
      </Button>
    </Surface>
  );
}
