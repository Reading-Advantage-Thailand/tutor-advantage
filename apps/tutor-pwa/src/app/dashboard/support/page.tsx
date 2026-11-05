import Link from "next/link";
import { redirect } from "next/navigation";
import { LifeBuoy, MessageCircle, Plus } from "lucide-react";
import { EmptyState, HELP_URL, IconTile, ListGroup, ListRow, Notice, Page, PageHeader, StatusChip } from "@/components/app";
import { Button } from "@/components/ui/button";
import { formatListTimestamp } from "@/lib/format";
import { t } from "@/lib/i18n";
import { categoryLabel, formatTicketNumber, splitTickets, statusLabel, statusToneFor, type TicketSummary } from "./lib/support";
import { fetchTickets, getTutorToken } from "./lib/support-server";

export const dynamic = "force-dynamic";

function TicketRow({ ticket }: { ticket: TicketSummary }) {
  const unread = ticket.hasUnreadReply;
  return (
    <ListRow
      href={`/dashboard/support/${ticket.ticketId}`}
      leading={<IconTile icon={LifeBuoy} tone={unread ? "brand" : "neutral"} size="sm" />}
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
          <span className="text-xs text-fg-subtle">
            {t("dashboardSupport.lastUpdated").replaceAll("{time}", formatListTimestamp(ticket.lastMessageAt))}
          </span>
        </>
      }
      trailing={
        unread ? <span aria-hidden="true" title={t("dashboardSupport.unreadReply")} className="size-2.5 rounded-full bg-danger-solid" /> : null
      }
    />
  );
}

export default async function SupportPage() {
  const token = await getTutorToken();
  if (!token) redirect("/");

  const result = await fetchTickets(token);
  if (!result.ok) {
    if (result.status === 401) redirect("/");
    // error.tsx shows the retry state.
    throw new Error(`Failed to load tickets (${result.status})`);
  }
  const { active, resolved } = splitTickets(result.data);

  const newButton = (
    <Button id="btn-new-ticket" render={<Link href="/dashboard/support/new" />} nativeButton={false}>
      <Plus aria-hidden="true" />
      {t("dashboardSupport.newTicket")}
    </Button>
  );

  return (
    <Page width="narrow">
      <PageHeader title={t("dashboardSupport.title")} description={t("dashboardSupport.subtitle")} actions={newButton} />

      {result.data.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          tone="brand"
          title={t("dashboardSupport.emptyTitle")}
          description={t("dashboardSupport.emptyDescription")}
          action={newButton}
        />
      ) : (
        <>
          {active.length > 0 ? (
            <ListGroup header={t("dashboardSupport.activeSection")} aria-label={t("dashboardSupport.listLabel")}>
              {active.map((ticket) => (
                <TicketRow key={ticket.ticketId} ticket={ticket} />
              ))}
            </ListGroup>
          ) : null}
          {resolved.length > 0 ? (
            <ListGroup header={t("dashboardSupport.resolvedSection")}>
              {resolved.map((ticket) => (
                <TicketRow key={ticket.ticketId} ticket={ticket} />
              ))}
            </ListGroup>
          ) : null}
        </>
      )}

      <Notice
        tone="neutral"
        icon={MessageCircle}
        title={t("dashboardSupport.lineHelpTitle")}
        action={
          <Button variant="outline" size="sm" render={<a href={HELP_URL} target="_blank" rel="noreferrer" />} nativeButton={false}>
            {t("dashboardSupport.lineHelpAction")}
          </Button>
        }
      >
        {t("dashboardSupport.lineHelpDescription")}
      </Notice>
    </Page>
  );
}
