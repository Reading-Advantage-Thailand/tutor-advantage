import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Count, EmptyState, ListGroup, Page, PageHeader, Section } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { LineHelpCard, TicketRow } from "./components/TicketRow";
import { splitTickets } from "./lib/support";
import { fetchTickets, getTutorToken } from "./lib/support-server";

export const dynamic = "force-dynamic";

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
  const empty = result.data.length === 0;

  // The page's one primary: in the header, or in the empty state when there is nothing yet.
  const newButton = (
    <Button id="btn-new-ticket" size="lg" render={<Link href="/dashboard/support/new" />} nativeButton={false}>
      <Plus aria-hidden="true" />
      {t("dashboardSupport.newTicket")}
    </Button>
  );

  return (
    <Page width="medium">
      <PageHeader title={t("dashboardSupport.title")} description={t("dashboardSupport.subtitle")} actions={empty ? undefined : newButton} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">
        {empty ? (
          <EmptyState
            mascot
            title={t("dashboardSupport.emptyTitle")}
            description={t("dashboardSupport.emptyDescription")}
            action={newButton}
          />
        ) : (
          <div className="flex min-w-0 flex-col gap-5">
            {active.length > 0 ? (
              <Section title={t("dashboardSupport.activeSection")} action={<Count value={active.length} />}>
                <ListGroup aria-label={t("dashboardSupport.listLabel")}>
                  {active.map((ticket) => (
                    <TicketRow key={ticket.ticketId} ticket={ticket} />
                  ))}
                </ListGroup>
              </Section>
            ) : null}
            {resolved.length > 0 ? (
              <Section title={t("dashboardSupport.resolvedSection")} action={<Count value={resolved.length} />}>
                <ListGroup aria-label={t("dashboardSupport.resolvedSection")}>
                  {resolved.map((ticket) => (
                    <TicketRow key={ticket.ticketId} ticket={ticket} />
                  ))}
                </ListGroup>
              </Section>
            ) : null}
          </div>
        )}
        <div className="lg:sticky lg:top-6">
          <LineHelpCard />
        </div>
      </div>
    </Page>
  );
}
