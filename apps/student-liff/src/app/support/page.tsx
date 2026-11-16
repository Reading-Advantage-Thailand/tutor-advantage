"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Inbox, LifeBuoy, Plus } from "lucide-react";
import {
  AppBar,
  BottomActionBar,
  EmptyState,
  ErrorState,
  IconTile,
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
import { thaiCopy } from "@/lib/thaiText";
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
        <div className="px-4 pt-2 pb-6">
          <LiffErrorState card />
        </div>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <AppBar title={t("support.title")} back fallbackHref="/profile" />
        <div className="px-4 pt-2 pb-6">
          <ErrorState card description={t("support.loadFailed")} onRetry={() => void refetch()} retrying={isValidating} />
        </div>
      </Screen>
    );
  }

  const visible = tab === "open" ? groups.open : groups.closed;
  const newRequestButton = (
    <Button variant="brand" size="cta-lg" className="flex-1" nativeButton={false} render={<Link href="/support/new" />}>
      <Plus aria-hidden="true" />
      {t("support.newRequest")}
    </Button>
  );

  return (
    <Screen>
      <AppBar title={t("support.title")} back fallbackHref="/profile" />

      <div className="flex flex-col gap-5 px-4 pt-2 pb-6">
        {/* What this screen is for: one help line beside the support tile. */}
        <div className="flex items-start gap-3.5">
          <IconTile icon={LifeBuoy} tone="blue" />
          <p className="min-w-0 flex-1 pt-0.5 text-[15px] leading-[1.65] text-fg-muted">{thaiCopy(t("support.intro"))}</p>
        </div>

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
                card
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
                card
                icon={CheckCircle2}
                tone="neutral"
                title={t("support.emptyClosedTitle")}
                description={t("support.emptyClosedDescription")}
                mascot="sleepy"
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
