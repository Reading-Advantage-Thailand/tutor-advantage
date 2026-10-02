import Link from "next/link";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  BookOpen,
  CheckCircle2,
  MessageCircle,
  Percent,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
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
  StatCard,
  Surface,
  type Tone,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { formatNumber, formatTHB, formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
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

async function getPerformanceData(token: string): Promise<PerformanceData | null> {
  try {
    const baseUrl = process.env.LEARNING_API_BASE_URL || "http://localhost:3002";
    const res = await fetch(`${baseUrl}/v1/tutors/performance`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch performance data:", error);
    return null;
  }
}

async function getEarningsSummary(
  token: string,
): Promise<{ grossVolumeTHB?: number; nextTierTargetTHB?: number; currentRate?: number } | null> {
  try {
    const baseUrl = process.env.FINANCE_API_BASE_URL || "http://localhost:3003";
    const res = await fetch(`${baseUrl}/v1/tutors/earnings/summary`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch earnings summary:", error);
    return null;
  }
}

const IconMap: Record<string, LucideIcon> = { Star, Zap, TrendingUp, Award, Target, Users, Trophy };

const sourceLabel: Record<MetricSource, string> = {
  actual: t("dashboardPerformance.sourceActual"),
  historical: t("dashboardPerformance.sourceHistorical"),
  unavailable: t("dashboardPerformance.sourceUnavailable"),
};

function SourceChip({ source }: { source: MetricSource }) {
  return (
    <Chip tone={sourceTone[source] as Tone} size="sm">
      {sourceLabel[source]}
    </Chip>
  );
}

/** One quality metric: title + source chip, big value, one-line explanation. */
function MetricPanel({
  icon,
  title,
  source,
  value,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  source?: MetricSource;
  value?: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Surface padding="md" className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <IconTile icon={icon} tone="brand" size="sm" />
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
        </div>
        {source ? <SourceChip source={source} /> : null}
      </div>
      {value !== undefined ? <p className="tabular mt-3 text-2xl leading-tight font-bold text-fg">{value}</p> : null}
      {hint ? <p className="mt-1 text-[0.8125rem] text-fg-muted">{hint}</p> : null}
      {children}
    </Surface>
  );
}

function NotAvailable() {
  return <span className="text-lg font-semibold text-fg-subtle">{t("dashboardPerformance.notAvailable")}</span>;
}

export default async function PerformancePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;

  const header = (
    <PageHeader title={t("dashboardPerformance.title")} description={t("dashboardPerformance.pageDescription")} />
  );

  if (!token) {
    return (
      <Page>
        {header}
        <Notice tone="warning">{t("dashboardPerformance.loginRequired")}</Notice>
      </Page>
    );
  }

  const [performanceData, earningsData] = await Promise.all([getPerformanceData(token), getEarningsSummary(token)]);

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

  return (
    <Page>
      {header}

      {!performanceData ? (
        <Notice tone="danger" title={t("dashboardPerformance.loadErrorTitle")}>
          {t("dashboardPerformance.loadErrorBody")}
        </Notice>
      ) : null}

      <Grid cols={4} className="grid-cols-2">
        <StatCard
          label={t("dashboardPerformance.currentCommissionRate")}
          value={formatRatePercent(currentRate)}
          icon={Percent}
          tone="brand"
        />
        <StatCard
          label={t("dashboardPerformance.grossVolume")}
          value={formatTHB(grossVolume, { fractionDigits: 0 })}
          icon={Wallet}
          tone="brand"
          href="/dashboard/earnings"
        />
        <StatCard
          label={t("dashboardPerformance.completedClasses")}
          value={formatNumber(numberOrZero(activity?.completedClasses))}
          icon={BookOpen}
          tone="blue"
        />
        <StatCard
          label={t("dashboardPerformance.interactiveSessions")}
          value={formatNumber(numberOrZero(activity?.interactiveSessions))}
          icon={Sparkles}
          tone="purple"
        />
      </Grid>

      {performanceData && !showDetails ? (
        <EmptyState
          icon={Award}
          tone="amber"
          title={t("dashboardPerformance.noSignalTitle")}
          description={t("dashboardPerformance.noSignalBody")}
        />
      ) : null}

      {showDetails ? (
        <Section title={t("dashboardPerformance.qualityTitle")}>
          <Grid cols={4}>
            <MetricPanel
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
              <ProgressBar
                value={studentSuccess ?? 0}
                size="sm"
                label={t("dashboardPerformance.studentSuccess")}
                className="mt-auto pt-0"
              />
            </MetricPanel>

            <MetricPanel
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
            />

            <MetricPanel
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

            <MetricPanel icon={CheckCircle2} title={t("dashboardPerformance.activityTitle")}>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
                {[
                  [t("dashboardPerformance.teachingHours"), activity?.completedHours],
                  [t("dashboardPerformance.referrals"), activity?.referralCount],
                  [t("dashboardPerformance.totalAnswers"), activity?.answers?.total],
                  [t("dashboardPerformance.correctAnswers"), activity?.answers?.correct],
                ].map(([label, value]) => (
                  <div key={label as string} className="min-w-0">
                    <dt className="truncate text-xs text-fg-muted">{label}</dt>
                    <dd className="tabular text-base font-semibold text-fg">
                      {formatNumber(numberOrZero(value as number | undefined))}
                    </dd>
                  </div>
                ))}
              </dl>
            </MetricPanel>
          </Grid>
        </Section>
      ) : null}

      {showDetails ? (
        <Grid cols={2}>
          <Surface padding="md" className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[0.9375rem] font-semibold text-fg">{t("dashboardPerformance.tierTitle")}</h2>
                <p className="mt-0.5 text-sm text-fg-muted">{t("dashboardPerformance.networkCommission")}</p>
              </div>
              <Chip tone="brand" size="sm">
                {formatRatePercent(currentRate)}
              </Chip>
            </div>
            <div className="mt-5 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.8125rem] text-fg-muted">{t("dashboardPerformance.grossVolume")}</p>
                <p className="tabular text-xl font-bold text-fg">{formatTHB(grossVolume, { fractionDigits: 0 })}</p>
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[0.8125rem] text-fg-muted">
                  {tier.isMaxTier ? t("dashboardPerformance.maxTier") : t("dashboardPerformance.tierNextTarget")}
                </p>
                {!tier.isMaxTier ? (
                  <p className="tabular text-sm font-semibold text-fg">{formatTHB(nextTier, { fractionDigits: 0 })}</p>
                ) : null}
              </div>
            </div>
            <ProgressBar value={tier.progress} label={t("dashboardPerformance.tierProgressLabel")} className="mt-3" />
            <p className="mt-3 text-sm text-fg-muted">
              {tier.isMaxTier ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-success-fg">
                  <CheckCircle2 aria-hidden="true" className="size-4" />
                  {t("dashboardPerformance.maxTierCongrats")}
                </span>
              ) : (
                <>
                  {t("dashboardPerformance.remainingPrefix")}{" "}
                  <span className="tabular font-semibold text-fg">
                    {formatTHB(tier.remaining, { fractionDigits: 0 })}
                  </span>{" "}
                  {t("dashboardPerformance.remainingSuffix")}
                </>
              )}
            </p>
          </Surface>

          <Surface padding="md" className="flex flex-col">
            <h2 className="text-[0.9375rem] font-semibold text-fg">{t("dashboardPerformance.nextGoalTitle")}</h2>
            {nextGoal ? (
              <>
                <div className="mt-4 flex items-start gap-3">
                  <IconTile icon={NextGoalIcon} tone="amber" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-fg">{nextGoal.label}</h3>
                      <Chip tone="warning" size="sm">
                        {formatNumber(nextGoal.progress, 0)}%
                      </Chip>
                    </div>
                    <p className="mt-1 text-sm text-fg-muted">{nextGoal.description}</p>
                  </div>
                </div>
                <ProgressBar value={nextGoal.progress} tone="warning" label={nextGoal.label} className="mt-4" />
                <p className="mt-3 text-[0.8125rem] text-fg-muted">{t("dashboardPerformance.nextGoalDescription")}</p>
                <div className="mt-auto pt-4">
                  <Button variant="soft" render={<Link href="/dashboard/classes" prefetch={false} />} nativeButton={false}>
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
                  leading={<IconTile icon={IconMap[badge.icon] || Award} tone={badgeTone(badge.color)} size="sm" />}
                  title={badge.label}
                  subtitle={badge.description}
                  trailing={
                    <span className="text-xs whitespace-nowrap text-fg-muted">
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
