import type { CSSProperties } from "react";
import { GitBranch, Star } from "lucide-react";
import {
  Chip,
  EmptyState,
  ListGroup,
  ListRow,
  Notice,
  Page,
  PageHeader,
  Section,
  StatStrip,
  Surface,
  UserAvatar,
  tileToneClass,
  type TileTone,
} from "@/components/app";
import { formatNumber, formatThaiDate, formatThaiMonthYear, formatTHB } from "@/lib/format";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { InviteLinkCard } from "./invite-link-card";
import { NetworkStructureSection } from "./network-structure";
import {
  EMPTY_NETWORK_SUMMARY,
  estimatePayoutBreakdown,
  hasDownline,
  periodMonthToDate,
  treeRows,
  type NetworkResponse,
  type TreeRow,
  type TutorSummary,
} from "./network-data";
import { fillTemplate, formatRatePercent } from "../_shared/text";

function money(value: number | null | undefined) {
  return formatTHB(value ?? 0, { fractionDigits: 0 });
}

/** Middle-dot separated phrases that never break inside a phrase ("· 1 คนในสาย"). */
function Phrases({ parts }: { parts: string[] }) {
  return parts.map((part, index) => (
    <span key={index}>
      {index > 0 ? " " : null}
      <span className="whitespace-nowrap">
        {index > 0 ? "· " : null}
        {part}
      </span>
    </span>
  ));
}

function TutorRow({ tutor, badge }: { tutor: TutorSummary; badge?: string }) {
  const locked = tutor.sponsorLockedAt ? formatThaiDate(tutor.sponsorLockedAt, "medium") : "";
  const lockedText = locked ? fillTemplate(t("dashboardNetwork.lockedSince"), { date: locked }) : null;
  return (
    <ListRow
      leading={<UserAvatar name={tutor.displayName} toneKey={tutor.userId} />}
      title={tutor.displayName}
      subtitle={
        tutor.email || lockedText ? (
          <>
            {tutor.email ? <span className="block truncate" title={tutor.email}>{tutor.email}</span> : null}
            {lockedText ? <span className="block whitespace-nowrap">{lockedText}</span> : null}
          </>
        ) : undefined
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

/** One figure of the volume card: label 13, value Noto 600 20 tabular. */
function AmountCell({
  label,
  value,
  emphasis,
  className,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 border-hairline px-4 py-3.5 md:px-5", className)}>
      <p className="text-[0.8125rem] leading-[1.6] font-medium text-fg-muted">{label}</p>
      <p className={cn("mt-0.5 text-xl leading-[1.3] font-semibold tabular", emphasis ? "text-brand-fg" : "text-fg")}>
        {value}
      </p>
    </div>
  );
}

/** Tier chip tone per depth below you (one tone per level, from the tile pairs). */
const LEVEL_TONES: TileTone[] = ["brand", "teal", "blue", "purple", "orange"];
const MAX_INDENT = 4;

function RateChip({ rate, tone, className }: { rate: number; tone: TileTone; className?: string }) {
  return (
    <span
      className={cn(
        "h-6 shrink-0 items-center rounded-(--radius-chip) px-2 text-xs leading-none font-semibold tabular @2xl:h-7 @2xl:px-2.5 @2xl:text-[0.8125rem]",
        tileToneClass[tone],
        className,
      )}
    >
      {formatRatePercent(rate)}
    </span>
  );
}

/**
 * The tree as indented rows (patterns.md T7): avatar, name, the tier (rate)
 * chip in the level's tile tone, level + joined date + team size, and the
 * volumes (a line when the list is narrow, three columns once it is ≥ 42rem
 * wide: container query, so the 1024px two-column layout stays readable).
 * Indent 16px per level when narrow, 24px when wide, with a hairline guide
 * back to the sponsor.
 */
function TreeList({ rows }: { rows: TreeRow[] }) {
  return (
    <ul aria-label={t("dashboardNetwork.networkStructure")} className="ds-card @container overflow-hidden">
      {rows.map(({ tutor, depth }) => {
        const indent = Math.min(depth, MAX_INDENT);
        const isRoot = depth === 0;
        const tone = LEVEL_TONES[Math.min(depth, LEVEL_TONES.length - 1)];
        const meta = [
          isRoot ? null : fillTemplate(t("dashboardNetwork.treeLevel"), { level: depth }),
          fillTemplate(t("dashboardNetwork.downlineCount"), { count: tutor.totalDownlines ?? 0 }),
        ].filter((part): part is string => Boolean(part));
        const joined = tutor.joinedAt
          ? fillTemplate(t("dashboardNetwork.joinedOn"), { date: formatThaiDate(tutor.joinedAt, "medium") })
          : null;
        const volumes = [
          [t("dashboardNetwork.personalVolShort"), money(tutor.personalVolumeTHB)],
          [t("dashboardNetwork.groupVolShort"), money(tutor.groupVolumeTHB)],
          [t("dashboardNetwork.payoutShort"), money(tutor.estimatedPayoutTHB)],
        ] as const;
        return (
          <li
            key={tutor.userId}
            className={cn(
              "relative flex min-h-16 items-center gap-3 py-3 ps-[calc(16px+var(--indent)*16px)] pe-4 @2xl:ps-[calc(16px+var(--indent)*24px)] @2xl:pe-5",
              !isRoot && "border-t border-hairline",
              isRoot && "bg-brand-soft/60",
            )}
            style={{ "--indent": indent } as CSSProperties}
          >
            {indent > 0 ? (
              <span
                aria-hidden="true"
                className="absolute inset-y-0 start-[calc(31px+(var(--indent)-1)*16px)] w-px bg-hairline-strong @2xl:start-[calc(31px+(var(--indent)-1)*24px)]"
              >
                <span className="absolute top-1/2 left-0 h-px w-2 bg-hairline-strong @2xl:w-2.5" />
              </span>
            ) : null}
            <UserAvatar name={tutor.displayName} toneKey={tutor.userId} size="sm" self={isRoot} className="relative" />
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-center gap-2">
                <span className="truncate type-card text-fg" title={tutor.displayName}>
                  {tutor.displayName}
                </span>
                {isRoot ? (
                  <Chip tone="brand" size="sm">
                    {t("dashboardNetwork.youLabel")}
                  </Chip>
                ) : null}
                <RateChip rate={tutor.currentRate} tone={tone} className="inline-flex @2xl:hidden" />
              </p>
              <p className="text-sm leading-[1.6] text-fg-muted">
                <Phrases parts={meta} />
                {joined ? (
                  <span className="block whitespace-nowrap @2xl:inline">
                    <span className="hidden @2xl:inline"> · </span>
                    {joined}
                  </span>
                ) : null}
              </p>
              <p className="text-[0.8125rem] leading-[1.6] text-fg-muted tabular @2xl:hidden">
                <Phrases parts={volumes.map(([label, value]) => `${label} ${value}`)} />
              </p>
            </div>
            <dl className="hidden shrink-0 grid-cols-3 gap-5 text-right @2xl:grid">
              {volumes.map(([label, value]) => (
                <div key={label} className="min-w-[4.5rem]">
                  <dt className="text-xs leading-normal text-fg-muted">{label}</dt>
                  <dd className="text-sm leading-normal font-semibold text-fg tabular">{value}</dd>
                </div>
              ))}
            </dl>
            <RateChip rate={tutor.currentRate} tone={tone} className="hidden @2xl:inline-flex" />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Referral network (patterns.md T7): summary strip, the volume statement and
 * the tree as indented rows on the left; the share card (the page's one
 * primary, "คัดลอกลิงก์") and the sponsor/upline list on the right. Phones
 * stack: strip, share, volume, tree, upline. Data comes from page.tsx.
 */
export function NetworkView({ response }: { response: NetworkResponse | null }) {
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

      <StatStrip
        aria-label={t("dashboardNetwork.title")}
        items={[
          { label: t("dashboardNetwork.direct"), value: formatNumber(summary.directDownlines) },
          { label: t("dashboardNetwork.totalNetwork"), value: formatNumber(summary.totalDownlines) },
          { label: t("dashboardNetwork.activeThisMonthLabel"), value: formatNumber(summary.activeDownlines) },
          { label: t("dashboardNetwork.currentRate"), value: formatRatePercent(summary.currentRate) },
        ]}
      />

      {/* DOM order = phone order (share, volume, tree, upline), so focus and reading order follow
          the screen. From lg the grid places the cells: volume + tree span both rows on the left,
          share (row 1) and upline (row 2, the 1fr row that absorbs the left column's extra height)
          on the right. */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr] lg:gap-6">
        {response?.inviteUrl ? (
          <div className="min-w-0 lg:col-start-2 lg:row-start-1">
            <InviteLinkCard inviteUrl={response.inviteUrl} />
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:gap-6">
          <Surface as="section" padding="none" aria-labelledby="network-volume-title" className="overflow-hidden">
            <div className="px-4 pt-4 pb-1 md:px-5 md:pt-5">
              <h2 id="network-volume-title" className="type-section text-fg">
                {t("dashboardNetwork.volumeTitle")}
              </h2>
              <p className="mt-0.5 text-sm leading-[1.6] text-pretty text-fg-muted">{thaiCopy(t("dashboardNetwork.volumeDescription"))}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3">
              <AmountCell label={t("dashboardNetwork.personalVolumeLabel")} value={money(summary.personalVolumeTHB)} />
              <AmountCell
                label={t("dashboardNetwork.groupVolumeLabel")}
                value={money(summary.groupVolumeTHB)}
                className="border-l"
              />
              <AmountCell
                label={t("dashboardNetwork.estimatedPayoutLabel")}
                value={money(summary.estimatedPayoutTHB)}
                emphasis
                className="max-sm:col-span-2 max-sm:border-t sm:border-l"
              />
            </div>
            <dl className="divide-y divide-hairline border-t border-hairline text-sm">
              {badgeBonus > 0 ? (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 md:px-5">
                  <dt className="inline-flex items-center gap-1.5 text-fg-muted">
                    <Star aria-hidden="true" className="size-4 text-icon-amber" />
                    {t("dashboardNetwork.badgeBonusLabel")}
                  </dt>
                  <dd className="font-medium text-fg tabular">{formatTHB(badgeBonus, { signed: true })}</dd>
                </div>
              ) : null}
              {payout.wht > 0 ? (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 md:px-5">
                  <dt className="text-fg-muted">{t("dashboardNetwork.estimatedWHT")}</dt>
                  <dd className="font-medium text-danger-fg tabular">−{money(payout.wht)}</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 bg-surface-muted px-4 py-3.5 md:px-5">
                <dt className="text-[0.9375rem] font-semibold text-fg">{t("dashboardNetwork.estimatedNetPayout")}</dt>
                <dd className="text-[1.0625rem] leading-[1.3] font-semibold text-fg tabular">{money(payout.net)}</dd>
              </div>
            </dl>
          </Surface>

          {hasDownline(response?.networkTree) ? (
            <NetworkStructureSection tree={response.networkTree}>
              <TreeList rows={treeRows(response.networkTree)} />
            </NetworkStructureSection>
          ) : (
            <Section title={t("dashboardNetwork.networkStructure")}>
              <EmptyState
                mascot
                icon={GitBranch}
                tone="brand"
                title={t("dashboardNetwork.emptyNetworkTitle")}
                description={t("dashboardNetwork.emptyNetworkBody")}
              />
            </Section>
          )}
        </div>

        <Section
          title={t("dashboardNetwork.sponsorUplineTitle")}
          className={cn(
            "min-w-0 lg:col-start-2 lg:self-start",
            response?.inviteUrl ? "lg:row-start-2" : "lg:row-start-1",
          )}
        >
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
      </div>
    </Page>
  );
}
