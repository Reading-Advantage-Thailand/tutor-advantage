"use client";

import { AlertTriangle, Banknote, Clock, ReceiptText, RefreshCw } from "lucide-react";
import {
  KpiStrip,
  Money,
  Page,
  PageHeader,
  SegmentedControl,
  StatCard,
  StatGridSkeleton,
  useAdminSession,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { useTableState } from "@/hooks/useTableState";
import { api } from "@/lib/api";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { ActiveWithoutPaymentView } from "./components/ActiveWithoutPaymentView";
import { OrphanEventsView } from "./components/OrphanEventsView";
import { PaymentsView } from "./components/PaymentsView";
import { DAY_OPTIONS, type PaymentsResponse, type ReconView } from "./types";
import "@/locales/th/reconciliation";

export default function ReconciliationPage() {
  const me = useAdminSession();
  const table = useTableState({
    defaultSort: { key: "createdAt", dir: "desc" },
    sortKeys: ["createdAt", "amount"],
    filterKeys: ["view", "issue", "status", "days", "state"],
    defaultFilters: { view: "payments", issue: "ISSUES", days: "30", state: "OPEN" },
  });
  const view = (["payments", "orphans", "gaps"].includes(table.filters.view) ? table.filters.view : "payments") as ReconView;
  const days = DAY_OPTIONS.includes(table.filters.days as (typeof DAY_OPTIONS)[number]) ? table.filters.days : "30";

  const summaryKey = me ? `${me.userId}:recon:summary:${days}` : null;
  const summary = useCachedResource(
    summaryKey,
    () => api.get<PaymentsResponse>("/v1/reconciliation/payments", { query: { days, pageSize: 1, issue: "ISSUES" } }),
    { keepPreviousData: true },
  );
  const s = summary.data?.summary;

  const refreshAll = () => {
    if (me) invalidateResource(`${me.userId}:recon:`);
  };

  const loadingValue = summary.isLoading ? "…" : null;
  const viewItems: { value: ReconView; label: string; count?: number }[] = [
    { value: "payments", label: t("reconciliation.views.payments"), count: s?.paymentIssueCount },
    { value: "orphans", label: t("reconciliation.views.orphans"), count: s?.orphanEventCount },
    { value: "gaps", label: t("reconciliation.views.gaps"), count: s?.activeWithoutPaymentCount },
  ];
  const issues = s?.issueCount ?? 0;

  return (
    <Page>
      <PageHeader
        title={t("reconciliation.page.title")}
        description={t("reconciliation.page.description")}
        actions={
          <>
            {/* Period selector (patterns.md A5): the same `days` filter the tables and the KPIs use. */}
            <SegmentedControl
              aria-label={t("reconciliation.filters.days")}
              value={days}
              onValueChange={(next) => table.setFilter("days", next)}
              items={DAY_OPTIONS.map((d) => ({
                value: d,
                // "30 วันล่าสุด" wherever it fits; phones show "30 วัน" so the four options are not cut off, and keep
                // the full label as the accessible name (the short text must stay contained in the full one).
                label: (
                  <>
                    <span aria-hidden="true" className="sm:hidden">{t("reconciliation.daysShort", { days: d })}</span>
                    <span className="max-sm:sr-only">{t("reconciliation.filters.daysOption", { days: d })}</span>
                  </>
                ),
              }))}
            />
            <Button variant="outline" onClick={refreshAll} loading={summary.isValidating}>
              <RefreshCw aria-hidden="true" />
              {t("reconciliation.page.refresh")}
            </Button>
          </>
        }
      />

      {/* No strip when the summary fails: zeros would read as "nothing to check". */}
      {summary.isLoading && !summary.data ? (
        <StatGridSkeleton />
      ) : summary.error && !summary.data ? null : (
        <KpiStrip aria-label={t("reconciliation.kpiTitle")}>
          <StatCard
            icon={Banknote}
            tone="brand"
            label={t("reconciliation.stats.successVolume")}
            value={loadingValue ?? <Money satang={s?.successVolumeMinor ?? 0} />}
            hint={t("reconciliation.stats.successVolumeHint", { count: formatNumber(s?.successfulPayments ?? 0), days })}
          />
          <StatCard
            icon={ReceiptText}
            tone="blue"
            label={t("reconciliation.stats.totalPayments")}
            value={loadingValue ?? formatNumber(s?.totalPayments ?? 0)}
            hint={t("reconciliation.stats.totalPaymentsHint", { days })}
          />
          <StatCard
            icon={AlertTriangle}
            tone={s && s.issueCount > 0 ? "red" : "teal"}
            risk={issues > 0}
            label={t("reconciliation.stats.needsReview")}
            value={loadingValue ?? formatNumber(s?.issueCount ?? 0)}
            hint={t("reconciliation.stats.needsReviewHint", {
              payments: formatNumber(s?.paymentIssueCount ?? 0),
              orphans: formatNumber(s?.orphanEventCount ?? 0),
              gaps: formatNumber(s?.activeWithoutPaymentCount ?? 0),
            })}
          />
          <StatCard
            icon={Clock}
            tone="amber"
            label={t("reconciliation.stats.pending")}
            value={loadingValue ?? formatNumber(s?.pendingPayments ?? 0)}
            hint={t("reconciliation.stats.pendingHint", { failed: formatNumber(s?.failedPayments ?? 0) })}
          />
        </KpiStrip>
      )}

      {/* Three views of the same check, as count tabs (they scroll sideways on phones; the padding keeps the focus ring visible). */}
      <div className="-m-1.5 flex max-w-[calc(100%+12px)] overflow-x-auto p-1.5 scrollbar-hide [&>.seg]:w-max [&>.seg]:max-w-none [&_.seg-item]:shrink-0">
        <SegmentedControl
          aria-label={t("reconciliation.views.label")}
          value={view}
          onValueChange={(next) => table.setFilter("view", next)}
          items={viewItems}
        />
      </div>

      {view === "payments" ? (
        <PaymentsView table={table} days={days} onMutated={refreshAll} />
      ) : view === "orphans" ? (
        <OrphanEventsView table={table} onMutated={refreshAll} />
      ) : (
        <ActiveWithoutPaymentView table={table} days={days} />
      )}
    </Page>
  );
}
