"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FilePenLine,
  History,
  ReceiptText,
  SearchCheck,
  ShieldAlert,
  UserCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  Chip,
  ErrorState,
  Grid,
  IconTile,
  ListGroup,
  ListRow,
  Page,
  PageHeader,
  Section,
  StatCard,
  StatGridSkeleton,
  ListSkeleton,
  useAdminSession,
  type AdminOverview,
  type TileTone,
} from "@/components/app";
import { useAdminOverview } from "@/components/app/AdminSummary";
import { errorMessage } from "@/lib/api";
import { formatListTimestamp, formatMinor, formatNumber, formatPeriodMonth, formatRelativeDay, formatThaiTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { NavBadgeKey } from "@/lib/routes";
import { auditActionLabel, auditActionTone, auditEntityLabel } from "./audit/auditLabels";

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
    href: "/users?role=TUTOR&verification=PENDING",
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
    tone: "orange",
  },
  {
    key: "fraudFlags",
    title: t("shell.navFraud"),
    hint: t("dashboard.queueFraudHint"),
    href: "/fraud?status=ACTIVE",
    icon: ShieldAlert,
    tone: "red",
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

function waitingSince(iso: string | null | undefined) {
  if (!iso) return null;
  return t("dashboard.waitingSince", { when: formatRelativeDay(iso) });
}

function OverviewSkeleton() {
  return (
    <>
      <StatGridSkeleton count={4} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ListSkeleton rows={5} />
        <ListSkeleton rows={6} />
      </div>
    </>
  );
}

export default function OverviewPage() {
  const me = useAdminSession();
  const isAdmin = me?.role === "ADMIN";
  // One shared, visibility-aware poller lives in the shell; this only reads it.
  const overview = useAdminOverview();
  const data = overview.data as (Pick<AdminOverview, "stats" | "workQueues"> & OverviewExtras) | undefined;

  const queues = QUEUES.filter((q) => isAdmin || !q.adminOnly).map((q) => ({
    ...q,
    count: data?.workQueues?.[q.key] ?? 0,
    oldest: data?.queueOldest?.[q.key] ?? null,
  }));
  const openQueues = queues.filter((q) => q.count > 0);
  const kpis = data?.kpis;
  const awaiting = kpis?.awaitingApproval;

  return (
    <Page>
      <PageHeader
        title={t("dashboard.pageTitle")}
        description={isAdmin ? t("dashboard.pageDescriptionAdmin") : t("dashboard.pageDescriptionChecker")}
        meta={
          data?.generatedAt ? (
            <span className="text-[0.8125rem] text-fg-muted">
              {t("dashboard.updatedAt", { time: formatThaiTime(data.generatedAt, { suffix: true }) })}
            </span>
          ) : null
        }
      />

      {overview.error && !data ? (
        <ErrorState title={t("dashboard.loadError")} description={errorMessage(overview.error)} onRetry={overview.refetch} />
      ) : !data ? (
        <OverviewSkeleton />
      ) : (
        <>
          <Section title={t("dashboard.kpiTitle")}>
            <Grid cols={4} className="grid-cols-2">
              <StatCard
                label={t("dashboard.kpiAwaiting")}
                value={awaiting ? formatMinor(awaiting.netPayoutSatang) : "–"}
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
                value={kpis ? formatMinor(kpis.paymentsLast30Days.amountSatang) : "–"}
                icon={CheckCircle2}
                tone="teal"
                href="/reconciliation"
                hint={kpis ? t("dashboard.kpiPaymentsHint", { count: formatNumber(kpis.paymentsLast30Days.count) }) : undefined}
              />
              <StatCard
                label={t("dashboard.kpiFraudHigh")}
                value={formatNumber(kpis?.highSeverityFraudFlags ?? 0)}
                icon={ShieldAlert}
                tone={kpis && kpis.highSeverityFraudFlags > 0 ? "red" : "neutral"}
                href="/fraud?status=ACTIVE"
                hint={t("dashboard.kpiFraudHint", { count: formatNumber(data.workQueues.fraudFlags ?? 0) })}
              />
              <StatCard
                label={t("dashboard.kpiRuns")}
                value={formatNumber(kpis?.settlementsLast30Days ?? data.stats.totalSettlementsLast30Days)}
                icon={ReceiptText}
                tone="blue"
                href="/settlements"
                hint={t("dashboard.kpiRunsHint")}
              />
            </Grid>
          </Section>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-8">
            <ListGroup
              header={t("dashboard.queuesTitle")}
              footer={openQueues.length > 0 ? t("dashboard.queuesDescription") : undefined}
            >
              {queues.map((q) => (
                <ListRow
                  key={q.key}
                  href={q.href}
                  leading={<IconTile icon={q.icon} tone={q.count > 0 ? q.tone : "neutral"} size="sm" />}
                  title={q.title}
                  subtitle={q.count > 0 ? (waitingSince(q.oldest) ?? q.hint) : q.hint}
                  lines={1}
                  trailing={
                    q.count > 0 ? (
                      <Chip tone="warning" size="md">
                        {t("dashboard.countUnit", { count: formatNumber(q.count) })}
                      </Chip>
                    ) : (
                      <Chip tone="success" size="md" icon={CheckCircle2}>
                        {t("dashboard.queuesClear")}
                      </Chip>
                    )
                  }
                />
              ))}
            </ListGroup>

            <ListGroup
              header={t("dashboard.activityTitleShort")}
              headerAction={
                <Link href="/audit" className="text-sm font-medium text-brand-fg hover:underline">
                  {t("dashboard.viewAll")}
                </Link>
              }
            >
              {data.recentActivity.length === 0 ? (
                <ListRow leading={<IconTile icon={History} tone="neutral" size="sm" />} title={t("dashboard.activityEmpty")} />
              ) : (
                data.recentActivity.map((event) => {
                  const actor =
                    event.actorUserId === "SYSTEM" ? t("audit.systemActor") : (event.actorName ?? t("audit.unknownActor"));
                  const period = event.periodMonth ? ` · ${formatPeriodMonth(event.periodMonth, { short: true })}` : "";
                  const href =
                    event.entityType && event.targetId
                      ? `/audit?entityType=${encodeURIComponent(event.entityType)}&entityId=${encodeURIComponent(event.targetId)}`
                      : "/audit";
                  return (
                    <ListRow
                      key={event.auditId}
                      href={href}
                      chevron={false}
                      lines={1}
                      leading={
                        <span
                          aria-hidden="true"
                          className={`size-2 rounded-full ${
                            {
                              success: "bg-success-solid",
                              danger: "bg-danger-solid",
                              warning: "bg-warning-solid",
                              info: "bg-info-solid",
                              brand: "bg-brand-solid",
                              neutral: "bg-fg-subtle",
                            }[auditActionTone(event.actionType)]
                          }`}
                        />
                      }
                      title={auditActionLabel(event.actionType)}
                      subtitle={`${auditEntityLabel(event.entityType)}${period} · ${actor}`}
                      trailing={<span className="text-xs whitespace-nowrap text-fg-muted tabular">{formatListTimestamp(event.createdAt)}</span>}
                    />
                  );
                })
              )}
            </ListGroup>
          </div>

          <Section title={t("dashboard.linksTitle")}>
            <div className="flex flex-wrap gap-2">
              <QuickLink href="/reconciliation" icon={SearchCheck} label={t("dashboard.linkReconciliation")} />
              <QuickLink href="/audit" icon={History} label={t("dashboard.linkAudit")} />
              <QuickLink href="/docs" icon={BookOpen} label={t("dashboard.linkDocs")} />
            </div>
          </Section>
        </>
      )}
    </Page>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      href={href}
      className="pressable inline-flex h-9 items-center gap-2 rounded-lg border border-hairline bg-surface px-3 text-sm font-medium text-fg shadow-card hover:border-hairline-strong"
    >
      <Icon aria-hidden="true" className="size-4 text-fg-muted" />
      {label}
    </Link>
  );
}
