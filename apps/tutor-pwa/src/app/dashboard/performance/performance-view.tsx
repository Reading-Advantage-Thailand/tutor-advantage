import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  BookOpen,
  CheckCircle2,
  MessageCircle,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import {
  Chip,
  EmptyState,
  Grid,
  IconTile,
  ListGroup,
  ListRow,
  Notice,
  Page,
  PageHeader,
  ProgressBar,
  Section,
  StatStrip,
  Surface,
  clampPercent,
  type Tone,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { formatNumber, formatTHB, formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { thaiCopy, thaiLabel } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import {
  badgeTone,
  computeTierProgress,
  hasPerformanceSignal,
  metricValue,
  numberOrZero,
  sourceTone,
  type MetricSource,
  type PerformanceData,
} from "./performance-data";
import { fillTemplate, formatRatePercent } from "../_shared/text";

export type EarningsSummary = { grossVolumeTHB?: number; nextTierTargetTHB?: number; currentRate?: number };

const IconMap: Record<string, LucideIcon> = { Star, Zap, TrendingUp, Award, Target, Users, Trophy };

const sourceLabel: Record<MetricSource, string> = {
  actual: t("dashboardPerformance.sourceActual"),
  historical: t("dashboardPerformance.sourceHistorical"),
  unavailable: t("dashboardPerformance.sourceUnavailable"),
};

function SourceChip({ source }: { source: MetricSource }) {
  return (
    <Chip tone={sourceTone[source] as Tone} size="sm" dot>
      {sourceLabel[source]}
    </Chip>
  );
}

/** Page title block, shared with the signed-out state in page.tsx. */
export function PerformanceHeader() {
  return (
    <PageHeader
      title={t("dashboardPerformance.title")}
      description={t("dashboardPerformance.pageDescription")}
    />
  );
}

/**
 * Plot area of one horizontal bar (patterns.md T7 "simple bar charts"):
 * quarter gridlines in --hairline behind a 10px bar in a chart colour, an
 * optional target marker. The accessible text is on the element itself
 * (`role` + label); the visible value and hint sit next to it.
 */
function BarPlot({
  percent,
  fillClass,
  target,
  ...aria
}: {
  percent: number;
  fillClass: string;
  target?: number;
  role: "progressbar" | "img";
  "aria-label": string;
  "aria-valuenow"?: number;
  "aria-valuemin"?: number;
  "aria-valuemax"?: number;
}) {
  const pct = clampPercent(percent);
  return (
    <div {...aria} className="relative h-7">
      {[25, 50, 75].map((line) => (
        <span key={line} aria-hidden="true" className="absolute inset-y-0 w-px bg-hairline" style={{ left: `${line}%` }} />
      ))}
      <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full bg-track">
        <div
          className={cn("ds-progress-fill h-full w-full rounded-full", fillClass)}
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
      {target !== undefined ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-fg"
          style={{ left: `${clampPercent(target)}%` }}
        />
      ) : null}
    </div>
  );
}

/** One metric of the quality chart: icon + title + source chip, the value, the bar and a one-line explanation. */
function MetricRow({
  icon,
  title,
  source,
  value,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  source: MetricSource;
  value: ReactNode;
  hint: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-1.5 px-4 py-4 md:px-5">
      <div className="flex items-center gap-3">
        <IconTile icon={icon} tone="brand" size="sm" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="type-card text-fg">{title}</h3>
          <SourceChip source={source} />
        </div>
        <p className="shrink-0 text-[1.375rem] leading-[1.3] font-semibold text-fg tabular">{value}</p>
      </div>
      {children}
      <p className="text-[0.8125rem] leading-[1.6] text-fg-muted">{hint}</p>
    </li>
  );
}

function NotAvailable() {
  return <span className="text-base font-semibold text-fg-subtle">{t("dashboardPerformance.notAvailable")}</span>;
}

/**
 * Performance (patterns.md T7): stat strip → the teaching-quality bar chart
 * beside the activity numbers → commission tier and next goal → the badge
 * rows. No Reedy. Data comes from page.tsx.
 */
export function PerformanceView({
  performanceData,
  earningsData,
}: {
  performanceData: PerformanceData | null;
  earningsData: EarningsSummary | null;
}) {
  const badges = performanceData?.badges?.unlocked || [];
  const nextGoal = performanceData?.badges?.nextGoal;
  const metrics = performanceData?.metrics;
  const activity = metrics?.activity;
  const studentBenchmark = metrics?.studentBenchmark;
  const rating = metrics?.engagement?.rating;
  const responseTime = metrics?.engagement?.responseTimeMinutes;
  const ratingValue = metricValue(rating);
  const responseTimeValue = metricValue(responseTime);
  const studentSuccess = typeof studentBenchmark?.current === "number" ? studentBenchmark.current : null;
  const NextGoalIcon = nextGoal ? IconMap[nextGoal.icon] || Award : Award;

  const grossVolume = earningsData?.grossVolumeTHB || 0;
  const nextTier = earningsData?.nextTierTargetTHB || 0;
  const currentRate = earningsData?.currentRate || 0;
  const tier = computeTierProgress(grossVolume, nextTier);
  const showDetails = hasPerformanceSignal(performanceData);
  const successTarget = typeof studentBenchmark?.target === "number" ? studentBenchmark.target : undefined;

  return (
    <Page>
      <PerformanceHeader />

      {!performanceData ? (
        <Notice tone="danger" title={t("dashboardPerformance.loadErrorTitle")}>
          {t("dashboardPerformance.loadErrorBody")}
        </Notice>
      ) : null}

      <StatStrip
        aria-label={t("dashboardPerformance.title")}
        items={[
          { label: t("dashboardPerformance.currentCommissionRate"), value: formatRatePercent(currentRate) },
          {
            label: t("dashboardPerformance.grossVolume"),
            value: formatTHB(grossVolume, { fractionDigits: 0 }),
            href: "/dashboard/earnings",
          },
          {
            label: t("dashboardPerformance.completedClasses"),
            value: formatNumber(numberOrZero(activity?.completedClasses)),
          },
          {
            label: t("dashboardPerformance.interactiveSessions"),
            value: formatNumber(numberOrZero(activity?.interactiveSessions)),
          },
        ]}
      />

      {performanceData && !showDetails ? (
        <EmptyState
          icon={Award}
          tone="amber"
          title={t("dashboardPerformance.noSignalTitle")}
          description={t("dashboardPerformance.noSignalBody")}
        />
      ) : null}

      {showDetails ? (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:gap-6">
          <Section title={t("dashboardPerformance.qualityTitle")}>
            <Surface padding="none" className="overflow-hidden">
              <ul className="divide-y divide-hairline">
                <MetricRow
                  icon={Target}
                  title={t("dashboardPerformance.studentSuccess")}
                  source={studentBenchmark?.source || "unavailable"}
                  value={studentSuccess === null ? <NotAvailable /> : `${formatNumber(studentSuccess, 0)}%`}
                  hint={
                    studentBenchmark?.source === "actual" && studentBenchmark.totalAnswers !== null
                      ? fillTemplate(t("dashboardPerformance.qualityAnswers"), {
                          correct: formatNumber(studentBenchmark.correctAnswers ?? 0),
                          total: formatNumber(studentBenchmark.totalAnswers),
                        })
                      : studentBenchmark?.source === "historical"
                        ? t("dashboardPerformance.qualityHistorical")
                        : t("dashboardPerformance.qualityNone")
                  }
                >
                  <BarPlot
                    role="progressbar"
                    aria-label={t("dashboardPerformance.studentSuccess")}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(clampPercent(studentSuccess ?? 0))}
                    percent={studentSuccess ?? 0}
                    fillClass="bg-chart-1"
                    target={studentSuccess !== null ? successTarget : undefined}
                  />
                  {successTarget !== undefined && studentSuccess !== null ? (
                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs leading-normal text-fg-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden="true" className="h-2 w-3.5 rounded-full bg-chart-1" />
                        {t("dashboardPerformance.studentSuccess")}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden="true" className="h-3 w-0.5 rounded-full bg-fg" />
                        {t("dashboardPerformance.target")} <span className="tabular">{formatNumber(successTarget, 0)}%</span>
                      </span>
                    </p>
                  ) : null}
                </MetricRow>

                <MetricRow
                  icon={Star}
                  title={t("dashboardPerformance.averageRating")}
                  source={rating?.source || "unavailable"}
                  value={ratingValue === null ? <NotAvailable /> : `${formatNumber(ratingValue, 1)} / 5`}
                  hint={
                    ratingValue === null
                      ? t("dashboardPerformance.ratingNone")
                      : rating?.source === "actual"
                        ? fillTemplate(t("dashboardPerformance.ratingFromReviews"), { count: formatNumber(rating.sampleSize) })
                        : t("dashboardPerformance.ratingHistorical")
                  }
                >
                  {ratingValue !== null ? (
                    <BarPlot
                      role="img"
                      aria-label={`${t("dashboardPerformance.averageRating")} ${formatNumber(ratingValue, 1)} / 5`}
                      percent={(ratingValue / 5) * 100}
                      fillClass="bg-chart-2"
                    />
                  ) : null}
                </MetricRow>

                <MetricRow
                  icon={MessageCircle}
                  title={t("dashboardPerformance.fastResponse")}
                  source={responseTime?.source || "unavailable"}
                  value={
                    responseTimeValue === null ? (
                      <NotAvailable />
                    ) : (
                      <>
                        {formatNumber(responseTimeValue, 0)}
                        <span className="ml-1 text-sm font-medium text-fg-muted">{t("dashboardPerformance.minuteUnit")}</span>
                      </>
                    )
                  }
                  hint={
                    responseTimeValue === null
                      ? t("dashboardPerformance.responseNone")
                      : responseTime?.source === "actual"
                        ? fillTemplate(t("dashboardPerformance.responseFromChats"), {
                            count: formatNumber(responseTime.sampleSize),
                          })
                        : t("dashboardPerformance.responseHistorical")
                  }
                />
              </ul>
            </Surface>
          </Section>

          <Section title={t("dashboardPerformance.activityTitle")}>
            <Surface padding="md">
              <dl className="grid grid-cols-2 gap-3">
                {[
                  [t("dashboardPerformance.teachingHours"), activity?.completedHours],
                  [t("dashboardPerformance.referrals"), activity?.referralCount],
                  [t("dashboardPerformance.totalAnswers"), activity?.answers?.total],
                  [t("dashboardPerformance.correctAnswers"), activity?.answers?.correct],
                ].map(([label, value]) => (
                  <div key={label as string} className="ds-well min-w-0 px-3.5 py-3">
                    <dt className="text-[0.8125rem] leading-[1.6] font-medium text-fg-muted">{label as string}</dt>
                    <dd className="mt-0.5 text-[1.375rem] leading-[1.3] font-semibold text-fg tabular">
                      {formatNumber(numberOrZero(value as number | undefined))}
                    </dd>
                  </div>
                ))}
              </dl>
            </Surface>
          </Section>
        </div>
      ) : null}

      {showDetails ? (
        <Grid cols={2} className="items-stretch">
          <Surface as="section" padding="md" aria-labelledby="perf-tier-title" className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="perf-tier-title" className="type-section text-fg">
                  {t("dashboardPerformance.tierTitle")}
                </h2>
                <p className="mt-0.5 text-sm leading-[1.6] text-fg-muted">{t("dashboardPerformance.networkCommission")}</p>
              </div>
              <Chip tone="brand">{formatRatePercent(currentRate)}</Chip>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.8125rem] leading-[1.6] font-medium text-fg-muted">{t("dashboardPerformance.grossVolume")}</p>
                <p className="text-[1.375rem] leading-[1.3] font-semibold text-fg tabular">
                  {formatTHB(grossVolume, { fractionDigits: 0 })}
                </p>
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[0.8125rem] leading-[1.6] font-medium text-fg-muted">
                  {tier.isMaxTier ? t("dashboardPerformance.maxTier") : t("dashboardPerformance.tierNextTarget")}
                </p>
                {!tier.isMaxTier ? (
                  <p className="text-[1.0625rem] leading-[1.3] font-semibold text-fg tabular">
                    {formatTHB(nextTier, { fractionDigits: 0 })}
                  </p>
                ) : null}
              </div>
            </div>
            <ProgressBar value={tier.progress} label={t("dashboardPerformance.tierProgressLabel")} className="mt-3" />
            <p className="mt-3 text-sm leading-[1.6] text-fg-muted">
              {tier.isMaxTier ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-success-fg">
                  <CheckCircle2 aria-hidden="true" className="size-4" />
                  {t("dashboardPerformance.maxTierCongrats")}
                </span>
              ) : (
                <>
                  {t("dashboardPerformance.remainingPrefix")}{" "}
                  <span className="font-semibold whitespace-nowrap text-fg tabular">
                    {formatTHB(tier.remaining, { fractionDigits: 0 })}
                  </span>{" "}
                  {thaiCopy(t("dashboardPerformance.remainingSuffix"))}
                </>
              )}
            </p>
          </Surface>

          <Surface as="section" padding="md" aria-labelledby="perf-goal-title" className="flex flex-col">
            <h2 id="perf-goal-title" className="type-section text-fg">
              {t("dashboardPerformance.nextGoalTitle")}
            </h2>
            {nextGoal ? (
              <>
                <div className="mt-4 flex items-start gap-3">
                  <IconTile icon={NextGoalIcon} tone="amber" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="type-card text-fg">{nextGoal.label}</h3>
                      <Chip tone="warning" size="sm">
                        {formatNumber(nextGoal.progress, 0)}%
                      </Chip>
                    </div>
                    <p className="mt-0.5 text-sm leading-[1.6] text-fg-muted">{nextGoal.description}</p>
                  </div>
                </div>
                <ProgressBar value={nextGoal.progress} tone="warning" label={nextGoal.label} className="mt-4" />
                <p className="mt-3 text-[0.8125rem] leading-[1.6] text-fg-muted">
                  {t("dashboardPerformance.nextGoalDescription")}
                </p>
                <div className="mt-auto pt-4">
                  <Button variant="tonal" render={<Link href="/dashboard/classes" prefetch={false} />} nativeButton={false}>
                    <BookOpen aria-hidden="true" />
                    {t("dashboardPerformance.goalLinks.classes")}
                  </Button>
                </div>
              </>
            ) : (
              <EmptyState
                compact
                icon={Target}
                tone="amber"
                title={t("dashboardPerformance.noNextGoal")}
                description={t("dashboardPerformance.noNextGoalHint")}
              />
            )}
          </Surface>
        </Grid>
      ) : null}

      {showDetails ? (
        <Section
          title={t("dashboardPerformance.badgesSectionTitle")}
          description={t("dashboardPerformance.badgesSectionDescription")}
        >
          {badges.length === 0 ? (
            <EmptyState
              icon={Trophy}
              tone="amber"
              title={t("dashboardPerformance.noBadges")}
              description={t("dashboardPerformance.noBadgesHint")}
            />
          ) : (
            <ListGroup aria-label={t("dashboardPerformance.badgesSectionTitle")}>
              {badges.map((badge) => (
                <ListRow
                  key={badge.id}
                  leading={<IconTile icon={IconMap[badge.icon] || Award} tone={badgeTone(badge.color)} />}
                  title={thaiLabel(badge.label)}
                  subtitle={badge.description}
                  // No clamp: a narrow phone cell (116px at 320) needs three lines, and the figure at the end must never be cut off.
                  lines="none"
                  trailing={
                    <span className="text-[0.8125rem] whitespace-nowrap text-fg-muted tabular">
                      <span className="sr-only">{t("dashboardPerformance.badgeUnlockedOn")} </span>
                      {formatThaiDate(badge.unlockedAt, "medium")}
                    </span>
                  }
                />
              ))}
            </ListGroup>
          )}
        </Section>
      ) : null}
    </Page>
  );
}
