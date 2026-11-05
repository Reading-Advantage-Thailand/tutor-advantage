"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Inbox, Plus } from "lucide-react";
import {
  AppBar,
  BottomActionBar,
  EmptyState,
  ErrorState,
  ListGroup,
  Screen,
  SegmentedControl,
} from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { Button } from "@/components/ui/button";
import { LiffErrorState } from "@/app/dashboard/_components/LiffErrorState";
import { studentApi } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { t } from "@/lib/i18n";
import { supportTicketsResourceKey } from "@/lib/resourceKeys";
import { SupportListSkeleton } from "./_components/SupportSkeletons";
import { TicketRow } from "./_components/TicketParts";
import { countUnread, getInitialTab, splitTickets, type TicketTab, type TicketsResponse } from "./_lib/tickets";

const PANEL_ID = "support-ticket-panel";

export default function SupportListPage() {
  const { isReady, profile, error: liffError } = useLiff();
  const userId = profile?.userId;
  const { data, error, isLoading, isValidating, refetch } = useCachedResource<TicketsResponse>(
    userId ? supportTicketsResourceKey(userId) : null,
    () => studentApi.getSupportTickets(),
    { enabled: isReady, staleTime: 10_000 },
  );

  // null = not chosen yet: follow the data (open, unless only closed ones are unread).
  const [chosenTab, setChosenTab] = useState<TicketTab | null>(null);
  const [now] = useState(() => new Date());
  const groups = useMemo(() => splitTickets(data?.tickets), [data]);
  const tab = chosenTab ?? getInitialTab(data?.tickets);

  if (!isReady || isLoading) return <SupportListSkeleton />;

  if (liffError || !profile) {
    return (
      <Screen>
        <AppBar title={t("support.title")} back fallbackHref="/profile" />
        <LiffErrorState />
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <AppBar title={t("support.title")} back fallbackHref="/profile" />
        <ErrorState description={t("support.loadFailed")} onRetry={() => void refetch()} retrying={isValidating} />
      </Screen>
    );
  }

  const visible = tab === "open" ? groups.open : groups.closed;
  const newRequestButton = (
    <Button variant="brand" size="cta" className="flex-1" nativeButton={false} render={<Link href="/support/new" />}>
      <Plus aria-hidden="true" />
      {t("support.newRequest")}
    </Button>
  );

  return (
    <Screen>
      <AppBar title={t("support.title")} back fallbackHref="/profile" />

      <div className="flex flex-col gap-4 px-4 pt-2 pb-6">
        <p className="text-sm leading-[1.6] text-fg-muted">{t("support.intro")}</p>

        <SegmentedControl<TicketTab>
          aria-label={t("support.tabsAria")}
          value={tab}
          onChange={setChosenTab}
          items={[
            { value: "open", label: t("support.tabOpen"), badge: countUnread(groups.open), controls: PANEL_ID },
            { value: "closed", label: t("support.tabClosed"), badge: countUnread(groups.closed), controls: PANEL_ID },
          ]}
        />

        <div id={PANEL_ID} role="tabpanel">
          {visible.length === 0 ? (
            tab === "open" ? (
              <EmptyState
                icon={Inbox}
                title={t("support.emptyOpenTitle")}
                description={t("support.emptyOpenDescription")}
                mascot="calm"
                action={
                  <Button variant="brand" size="touch" nativeButton={false} render={<Link href="/support/new" />}>
                    <Plus aria-hidden="true" />
                    {t("support.newRequest")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title={t("support.emptyClosedTitle")}
                description={t("support.emptyClosedDescription")}
                mascot={false}
              />
            )
          ) : (
            <ListGroup>
              {visible.map((ticket) => (
                <TicketRow key={ticket.ticketId} ticket={ticket} now={now} />
              ))}
            </ListGroup>
          )}
        </div>
      </div>

      {/* The empty "open" tab already has its own call to action. */}
      {tab === "open" && visible.length === 0 ? null : <BottomActionBar>{newRequestButton}</BottomActionBar>}
    </Screen>
  );
}
