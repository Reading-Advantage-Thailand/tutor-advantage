"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FilePenLine,
  History,
  ReceiptText,
  RefreshCw,
  SearchCheck,
  ShieldAlert,
  UserCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import {
  Chip,
  EmptyState,
  ErrorState,
  IconTile,
  KpiStrip,
  ListRow,
  ListSkeleton,
  LoadingAnnouncement,
  Money,
  Page,
  PageHeader,
  SectionHeader,
  Skeleton,
  StatCard,
  StatGridSkeleton,
  useAdminSession,
  type AdminOverview,
  type TileTone,
  type Tone,
} from "@/components/app";
import { useAdminOverview } from "@/components/app/AdminSummary";
import { useRefreshAdminSummary } from "@/components/app/adminSummaryContext";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError, errorMessage } from "@/lib/api";
import { formatListTimestamp, formatNumber, formatPeriodMonth, formatRelativeDay, formatThaiTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { NavBadgeKey } from "@/lib/routes";
import { keepThaiWords } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import {
  AUDIT_CATEGORIES,
  AUDIT_CATEGORY_DOT,
  auditActionLabel,
  auditCategory,
  auditCategoryLabel,
  auditEntityLabel,
} from "./audit/auditLabels";
import "@/locales/th/audit";
import "@/locales/th/dashboard";

/** Fields added to /v1/admin/overview by G1 (older responses simply lack them). */
interface OverviewExtras {
  queueOldest?: Partial<Record<NavBadgeKey, string | null>>;
  kpis?: {
    paymentsLast30Days: { count: number; amountSatang: number };
    awaitingApproval: { runs: number; oldestPeriodMonth: string | null; payoutLines: number; netPayoutSatang: number };
    settlementsLast30Days: number;
    highSeverityFraudFlags: number;
  };
  generatedAt?: string;
  recentActivity: (AdminOverview["recentActivity"][number] & { actorName?: string | null })[];
}

interface QueueDef {
  key: NavBadgeKey;
  title: string;
  hint: string;
  /** Pre-filtered list (the owning page reads these URL params). */
  href: string;
  icon: LucideIcon;
  tone: TileTone;
  /** Count chip tone while items wait (risk reads as danger, the rest as warning). */
  chipTone?: Tone;
  adminOnly?: boolean;
}

const QUEUES: QueueDef[] = [
  {
    key: "settlements",
    title: t("dashboard.queueApprovalsTitle"),
    hint: t("dashboard.queueApprovalsHint"),
    href: "/settlements?status=SUBMITTED",
    icon: ReceiptText,
    tone: "brand",
  },
  {
    key: "verifications",
    title: t("dashboard.queueVerificationsTitle"),
    hint: t("dashboard.queueVerificationsHint"),
    href: "/users?role=TUTOR&verification=REVIEW",
    icon: UserCheck,
    tone: "teal",
    adminOnly: true,
  },
  {
    key: "exceptions",
    title: t("shell.navExceptions"),
    hint: t("dashboard.queueExceptionsHint"),
    href: "/operations/exceptions?status=UNRESOLVED",
    icon: AlertTriangle,
    tone: "amber",
  },
  {
    key: "fraudFlags",
    title: t("shell.navFraud"),
    hint: t("dashboard.queueFraudHint"),
    href: "/fraud?status=ACTIVE",
    icon: ShieldAlert,
    tone: "red",
    chipTone: "danger",
  },
  {
    key: "adjustments",
    title: t("dashboard.queueAdjustmentsTitle"),
    hint: t("dashboard.queueAdjustmentsHint"),
    href: "/adjustments?status=PENDING",
    icon: FilePenLine,
    tone: "blue",
  },
];

/*
 * Activity category dots (bold graft: "category dot + event + context · actor
 * + date" with a legend) read the audit log's map (AUDIT_CATEGORY_DOT /
 * auditCategoryLabel), so both screens show one colour per category. The
 * legend under the feed names the categories shown, and each row also carries
 * the category as text for screen readers, so colour is never the only signal.
 */

function waitingSince(iso: string | null | undefined) {
  if (!iso) return null;
  return t("dashboard.waitingSince", { when: formatRelativeDay(iso) });
}

/** Two columns from 1280px (queue 1.25fr : activity 1fr), stacked below. */
const COLUMNS = "grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]";

function OverviewSkeleton() {
  return (
    <>
      <LoadingAnnouncement />
      <StatGridSkeleton count={4} />
      <div aria-hidden="true" className={COLUMNS}>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <ListSkeleton rows={5} leading />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-32" />
          <ListSkeleton rows={6} leading={false} />
        </div>
      </div>
    </>
  );
}

export default function OverviewPage() {
  const me = useAdminSession();
  const isAdmin = me?.role === "ADMIN";
  // One shared, visibility-aware poller lives in the shell; this only reads it.
  const overview = useAdminOverview();
  const refreshSummary = useRefreshAdminSummary();
  const [refreshing, setRefreshing] = useState(false);
  const data = overview.data as (Pick<AdminOverview, "stats" | "workQueues"> & OverviewExtras) | undefined;

  const queues = QUEUES.filter((q) => isAdmin || !q.adminOnly).map((q) => ({
    ...q,
    count: data?.workQueues?.[q.key] ?? 0,
    oldest: data?.queueOldest?.[q.key] ?? null,
  }));
  const openQueues = queues.filter((q) => q.count > 0);
  const openItems = openQueues.reduce((sum, q) => sum + q.count, 0);
  const kpis = data?.kpis;
  const awaiting = kpis?.awaitingApproval;
  const highRisk = kpis?.highSeverityFraudFlags ?? 0;
  const openRisk = data?.workQueues?.fraudFlags ?? 0;

  // Runs the shell's poller now (and restarts its interval). The button stays
  // enabled while it runs (aria-disabled + aria-busy) so keyboard focus stays on it.
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshSummary();
    } finally {
      setRefreshing(false);
    }
  };

  const activity = data?.recentActivity ?? [];
  const legend = AUDIT_CATEGORIES.map((c) => c.id).filter((id) => activity.some((event) => auditCategory(event.actionType) === id));

  return (
    <Page>
      <PageHeader
        title={t("dashboard.pageTitle")}
        description={isAdmin ? t("dashboard.pageDescriptionAdmin") : t("dashboard.pageDescriptionChecker")}
        actions={
          <div className="flex items-center gap-2">
            {data?.generatedAt ? (
              <span className="text-[0.8125rem] whitespace-nowrap text-fg-muted tabular">
                {t("dashboard.updatedAt", { time: formatThaiTime(data.generatedAt, { suffix: true }) })}
              </span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("dashboard.refreshAria")}
              title={t("dashboard.refreshAria")}
              aria-busy={refreshing || undefined}
              aria-disabled={refreshing || undefined}
              onClick={() => void refresh()}
            >
              <RefreshCw aria-hidden="true" className={cn(refreshing && "motion-safe:animate-spin")} />
            </Button>
          </div>
        }
      />

      {overview.error && !data ? (
        <ErrorState
          title={t("dashboard.loadError")}
          description={errorMessage(overview.error)}
          onRetry={overview.refetch}
          digest={overview.error instanceof ApiError ? (overview.error.requestId ?? undefined) : undefined}
        />
      ) : !data ? (
        <OverviewSkeleton />
      ) : (
        <>
          <KpiStrip aria-label={t("dashboard.kpiTitle")}>
            <StatCard
              label={t("dashboard.kpiAwaiting")}
              value={awaiting ? <Money satang={awaiting.netPayoutSatang} /> : "–"}
              icon={Wallet}
              tone="brand"
              href="/settlements?status=SUBMITTED"
              hint={
                awaiting && awaiting.runs > 0
                  ? t("dashboard.kpiAwaitingHint", { runs: formatNumber(awaiting.runs), lines: formatNumber(awaiting.payoutLines) })
                  : t("dashboard.kpiAwaitingNone")
              }
            />
            <StatCard
              label={t("dashboard.kpiPayments")}
              value={kpis ? <Money satang={kpis.paymentsLast30Days.amountSatang} /> : "–"}
              icon={CheckCircle2}
              tone="teal"
              href="/reconciliation"
              hint={kpis ? t("dashboard.kpiPaymentsHint", { count: formatNumber(kpis.paymentsLast30Days.count) }) : undefined}
            />
            <StatCard
              label={t("dashboard.kpiFraudHigh")}
              value={formatNumber(highRisk)}
              icon={ShieldAlert}
              tone={kpis && highRisk > 0 ? "red" : "neutral"}
              href="/fraud?status=ACTIVE"
              risk={highRisk > 0}
              hint={t("dashboard.kpiFraudHint", { count: formatNumber(openRisk) })}
              bar={openRisk > 0 ? [{ value: (Math.min(highRisk, openRisk) / openRisk) * 100, tone: "danger" }] : undefined}
              barLabel={
                openRisk > 0 ? t("dashboard.kpiFraudBar", { high: formatNumber(highRisk), total: formatNumber(openRisk) }) : undefined
              }
            />
            <StatCard
              label={t("dashboard.kpiRuns")}
              value={formatNumber(kpis?.settlementsLast30Days ?? data.stats.totalSettlementsLast30Days)}
              icon={ReceiptText}
              tone="blue"
              href="/settlements"
              hint={t("dashboard.kpiRunsHint")}
            />
          </KpiStrip>

          <div className={COLUMNS}>
            {/* Left column: the work queue, then (from 1280px) shortcuts; the daily-payments chart will sit below them. */}
            <div className="flex min-w-0 flex-col gap-5">
              <section aria-labelledby="overview-queues" className="flex min-w-0 flex-col gap-2">
                <SectionHeader
                  id="overview-queues"
                  title={t("dashboard.queuesTitle")}
                  className="min-h-9 items-center"
                  action={
                    <span className="text-[0.8125rem] text-fg-muted tabular">
                      {openQueues.length > 0
                        ? t("dashboard.queuesSummary", { count: formatNumber(openItems), queues: formatNumber(openQueues.length) })
                        : t("dashboard.queuesClear")}
                    </span>
                  }
                />
                <div className="card overflow-hidden">
                  {queues.map((q) => (
                    <ListRow
                      key={q.key}
                      href={q.href}
                      leading={<IconTile icon={q.icon} tone={q.count > 0 ? q.tone : "neutral"} size="sm" />}
                      title={keepThaiWords(q.title)}
                      subtitle={q.count > 0 ? (waitingSince(q.oldest) ?? q.hint) : q.hint}
                      subtitleClassName="text-balance"
                      trailing={
                        q.count > 0 ? (
                          <Chip tone={q.chipTone ?? "warning"} className="tabular">
                            {t("dashboard.countUnit", { count: formatNumber(q.count) })}
                          </Chip>
                        ) : (
                          <Chip tone="success" icon={CheckCircle2}>
                            {t("dashboard.queuesClear")}
                          </Chip>
                        )
                      }
                    />
                  ))}
                </div>
                {openQueues.length > 0 ? <p className="px-0.5 text-xs text-fg-muted">{t("dashboard.queuesDescription")}</p> : null}
              </section>

              <Shortcuts id="overview-links" className="hidden xl:flex" />
            </div>

            <section aria-labelledby="overview-activity" className="flex min-w-0 flex-col gap-2">
              <SectionHeader
                id="overview-activity"
                title={t("dashboard.activityTitleShort")}
                className="min-h-9 items-center"
                action={
                  <Link href="/audit" className={buttonVariants({ variant: "ghost", size: "sm", className: "-mr-2" })}>
                    {t("dashboard.viewAll")}
                    <ChevronRight aria-hidden="true" />
                  </Link>
                }
              />
              <div className="card overflow-hidden">
                {activity.length === 0 ? (
                  <EmptyState compact as="h3" icon={History} title={t("dashboard.activityEmpty")} />
                ) : (
                  <>
                    {activity.map((event) => {
                      const actor =
                        event.actorUserId === "SYSTEM" ? t("audit.systemActor") : (event.actorName ?? t("audit.unknownActor"));
                      const period = event.periodMonth ? ` · ${formatPeriodMonth(event.periodMonth, { short: true })}` : "";
                      const href =
                        event.entityType && event.targetId
                          ? `/audit?entityType=${encodeURIComponent(event.entityType)}&entityId=${encodeURIComponent(event.targetId)}`
                          : "/audit";
                      const category = auditCategory(event.actionType);
                      const title = auditActionLabel(event.actionType);
                      const context = `${auditEntityLabel(event.entityType)}${period} · ${actor}`;
                      return (
                        <ListRow
                          key={event.auditId}
                          href={href}
                          chevron={false}
                          className="items-start [--row-divider-inset:36px]"
                          leading={
                            <span className="flex h-5 w-2 items-center">
                              <span aria-hidden="true" className={cn("size-2 rounded-full", AUDIT_CATEGORY_DOT[category])} />
                              <span className="sr-only">{`${auditCategoryLabel(category)}: `}</span>
                            </span>
                          }
                          title={title}
                          subtitle={context}
                          trailing={
                            <span className="pt-px text-[0.8125rem] whitespace-nowrap text-fg-subtle tabular">
                              {formatListTimestamp(event.createdAt)}
                            </span>
                          }
                        />
                      );
                    })}
                    <ul
                      aria-label={t("dashboard.legendLabel")}
                      className="flex flex-wrap gap-x-3.5 gap-y-1.5 border-t border-hairline px-4 py-2.5 text-xs text-fg-muted"
                    >
                      {legend.map((id) => (
                        <li key={id} className="inline-flex items-center gap-1.5">
                          <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", AUDIT_CATEGORY_DOT[id])} />
                          {auditCategoryLabel(id)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </section>

            {/* Single column (below 1280px): queue, activity, then shortcuts, in reading order. */}
            <Shortcuts id="overview-links-stacked" className="flex xl:hidden" />
          </div>
        </>
      )}
    </Page>
  );
}

/**
 * Shortcuts (secondary buttons). Rendered twice, one copy hidden with
 * display:none, so the DOM order follows the layout: under the queue in the
 * left column from 1280px, after recent activity when the columns stack.
 */
function Shortcuts({ id, className }: { id: string; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn("flex-wrap items-center gap-2", className)}>
      <h2 id={id} className="mr-1 text-[0.8125rem] leading-normal font-normal text-fg-muted">
        {t("dashboard.linksTitle")}
      </h2>
      <QuickLink href="/reconciliation" icon={SearchCheck} label={t("dashboard.linkReconciliation")} />
      <QuickLink href="/audit" icon={History} label={t("dashboard.linkAudit")} />
      <QuickLink href="/docs" icon={BookOpen} label={t("dashboard.linkDocs")} />
    </section>
  );
}

/** Shortcut: a secondary (outline) button link. */
function QuickLink({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className={buttonVariants({ variant: "outline" })}>
      <Icon aria-hidden="true" />
      {label}
    </Link>
  );
}
