import Link from "next/link";
import { redirect } from "next/navigation";
import { SearchX } from "lucide-react";
import { EmptyState, Page, PageHeader } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { fetchTicket, getTutorToken } from "../lib/support-server";
import { TicketThread } from "./TicketThread";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const token = await getTutorToken();
  if (!token) redirect("/");

  const result = await fetchTicket(token, ticketId);
  if (!result.ok) {
    if (result.status === 401) redirect("/");
    if (result.status >= 500) throw new Error(`Failed to load ticket (${result.status})`);
    // Unknown, foreign or malformed id: same screen for all (never reveal existence).
    return (
      <Page width="narrow">
        <PageHeader
          title={t("dashboardSupport.notFoundTitle")}
          backHref="/dashboard/support"
          backLabel={t("dashboardSupport.backToList")}
        />
        <EmptyState
          icon={SearchX}
          title={t("dashboardSupport.notFoundTitle")}
          description={t("dashboardSupport.notFoundDescription")}
          action={
            <Button variant="outline" render={<Link href="/dashboard/support" />} nativeButton={false}>
              {t("dashboardSupport.backToList")}
            </Button>
          }
        />
      </Page>
    );
  }

  return <TicketThread key={ticketId} initial={result.data} />;
}
