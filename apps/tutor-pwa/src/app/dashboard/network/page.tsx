import { cookies } from "next/headers";
import { GitBranch, Star, TrendingUp, UserRoundCheck, Users } from "lucide-react";
import {
  Chip,
  EmptyState,
  Grid,
  ListGroup,
  ListRow,
  Notice,
  Page,
  PageHeader,
  Section,
  SplitLayout,
  StatCard,
  Surface,
  UserAvatar,
} from "@/components/app";
import { formatNumber, formatThaiDate, formatThaiMonthYear, formatTHB } from "@/lib/format";
import { t } from "@/lib/i18n";
import { InviteLinkCard } from "./invite-link-card";
import { NetworkGraph } from "./network-graph-lazy";
import {
  EMPTY_NETWORK_SUMMARY,
  estimatePayoutBreakdown,
  hasDownline,
  periodMonthToDate,
  type NetworkResponse,
  type TutorSummary,
} from "./network-data";
import { fillTemplate, formatRatePercent } from "../_shared/text";

async function getNetworkData(token: string): Promise<NetworkResponse | null> {
  if (!token) return null;
  try {
    const baseUrl = process.env.FINANCE_API_BASE_URL || "http://localhost:3003";
    const res = await fetch(`${baseUrl}/v1/tutors/network`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch network data:", error);
    return null;
  }
}

function money(value: number | null | undefined) {
  return formatTHB(value ?? 0, { fractionDigits: 0 });
}

function TutorRow({ tutor, badge }: { tutor: TutorSummary; badge?: string }) {
  const locked = tutor.sponsorLockedAt ? formatThaiDate(tutor.sponsorLockedAt, "medium") : "";
  return (
    <ListRow
      leading={<UserAvatar name={tutor.displayName} size="sm" />}
      title={tutor.displayName}
      subtitle={
        [tutor.email, locked ? fillTemplate(t("dashboardNetwork.lockedSince"), { date: locked }) : null]
          .filter(Boolean)
          .join(" · ") || undefined
      }
      trailing={
        badge ? (
          <Chip tone="neutral" size="sm">
            {badge}
          </Chip>
        ) : undefined
      }
    />
  );
}

function AmountTile({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.8125rem] text-fg-muted">{label}</p>
      <p className={`tabular mt-0.5 text-xl leading-tight font-bold ${emphasis ? "text-brand-fg" : "text-fg"}`}>
        {value}
      </p>
    </div>
  );
}

export default async function NetworkPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";
  const response = await getNetworkData(token);
  const summary = response?.summary || EMPTY_NETWORK_SUMMARY;
  const payout = estimatePayoutBreakdown(summary.estimatedPayoutTHB);
  const badgeBonus = summary.badgeBonusTHB ?? 0;
  const period = formatThaiMonthYear(periodMonthToDate(response?.periodMonth));
  const upline = response?.upline ?? [];

  return (
    <Page>
      <PageHeader
        title={t("dashboardNetwork.title")}
        description={t("dashboardNetwork.pageDescription")}
        meta={
          period ? (
            <Chip tone="neutral" size="sm">
              {t("dashboardNetwork.periodLabel")} {period}
            </Chip>
          ) : undefined
        }
      />

      {!response ? <Notice tone="danger">{t("shell.errorBody")}</Notice> : null}

      {response?.inviteUrl ? <InviteLinkCard inviteUrl={response.inviteUrl} /> : null}

      <Grid cols={4} className="grid-cols-2">
        <StatCard
          label={t("dashboardNetwork.direct")}
          value={formatNumber(summary.directDownlines)}
          icon={Users}
          tone="teal"
        />
        <StatCard
          label={t("dashboardNetwork.totalNetwork")}
          value={formatNumber(summary.totalDownlines)}
          icon={GitBranch}
          tone="blue"
        />
        <StatCard
          label={t("dashboardNetwork.activeThisMonthLabel")}
          value={formatNumber(summary.activeDownlines)}
          icon={UserRoundCheck}
          tone="orange"
        />
        <StatCard
          label={t("dashboardNetwork.currentRate")}
          value={formatRatePercent(summary.currentRate)}
          icon={TrendingUp}
          tone="brand"
        />
      </Grid>

      <SplitLayout
        main={
          <Section title={t("dashboardNetwork.volumeTitle")} description={t("dashboardNetwork.volumeDescription")}>
            <Surface padding="none">
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3 md:p-5">
                <AmountTile label={t("dashboardNetwork.personalVolumeLabel")} value={money(summary.personalVolumeTHB)} />
                <AmountTile label={t("dashboardNetwork.groupVolumeLabel")} value={money(summary.groupVolumeTHB)} />
                <AmountTile
                  label={t("dashboardNetwork.estimatedPayoutLabel")}
                  value={money(summary.estimatedPayoutTHB)}
                  emphasis
                />
              </div>
              <dl className="divide-y divide-hairline border-t border-hairline text-sm">
                {badgeBonus > 0 ? (
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 md:px-5">
                    <dt className="inline-flex items-center gap-1.5 text-fg-muted">
                      <Star aria-hidden="true" className="size-4 text-icon-amber" />
                      {t("dashboardNetwork.badgeBonusLabel")}
                    </dt>
                    <dd className="tabular font-medium text-fg">{formatTHB(badgeBonus, { signed: true })}</dd>
                  </div>
                ) : null}
                {payout.wht > 0 ? (
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 md:px-5">
                    <dt className="text-fg-muted">{t("dashboardNetwork.estimatedWHT")}</dt>
                    <dd className="tabular font-medium text-fg">−{money(payout.wht)}</dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3 bg-surface-muted px-4 py-3 md:px-5">
                  <dt className="font-semibold text-fg">{t("dashboardNetwork.estimatedNetPayout")}</dt>
                  <dd className="tabular text-base font-bold text-brand-fg">{money(payout.net)}</dd>
                </div>
              </dl>
            </Surface>
          </Section>
        }
        side={
          <Section title={t("dashboardNetwork.sponsorUplineTitle")}>
            <ListGroup aria-label={t("dashboardNetwork.sponsorUplineTitle")}>
              {response?.sponsor ? (
                <TutorRow tutor={response.sponsor} badge={t("dashboardNetwork.sponsor")} />
              ) : (
                <ListRow title={t("dashboardNetwork.noSponsor")} />
              )}
              {upline
                .filter((tutor) => tutor.userId !== response?.sponsor?.userId)
                .map((tutor) => (
                  <TutorRow
                    key={tutor.userId}
                    tutor={tutor}
                    badge={fillTemplate(t("dashboardNetwork.uplineLevel"), {
                      level: upline.findIndex((u) => u.userId === tutor.userId) + 1,
                    })}
                  />
                ))}
            </ListGroup>
          </Section>
        }
      />

      <Section
        title={t("dashboardNetwork.networkStructure")}
        description={hasDownline(response?.networkTree) ? t("dashboardNetwork.graphHint") : undefined}
      >
        {hasDownline(response?.networkTree) ? (
          <Surface padding="none" className="overflow-hidden">
            <NetworkGraph tree={response.networkTree} />
          </Surface>
        ) : (
          <EmptyState
            icon={GitBranch}
            tone="brand"
            title={t("dashboardNetwork.emptyNetworkTitle")}
            description={t("dashboardNetwork.emptyNetworkBody")}
          />
        )}
      </Section>
    </Page>
  );
}
