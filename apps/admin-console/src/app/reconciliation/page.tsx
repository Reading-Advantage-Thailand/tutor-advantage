"use client";

import { AlertTriangle, Banknote, Clock, ReceiptText, RefreshCw } from "lucide-react";
import {
  Grid,
  Page,
  PageHeader,
  SegmentedControl,
  SelectField,
  StatCard,
  useAdminSession,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { useTableState } from "@/hooks/useTableState";
import { api } from "@/lib/api";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatSatang } from "@/lib/format";
import { t } from "@/lib/i18n";
import { ActiveWithoutPaymentView } from "./components/ActiveWithoutPaymentView";
import { OrphanEventsView } from "./components/OrphanEventsView";
import { PaymentsView } from "./components/PaymentsView";
import { DAY_OPTIONS, type PaymentsResponse, type ReconView } from "./types";

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

  return (
    <Page>
      <PageHeader
        title={t("reconciliation.page.title")}
        description={t("reconciliation.page.description")}
        actions={
          <Button variant="outline" onClick={refreshAll} loading={summary.isValidating}>
            <RefreshCw aria-hidden="true" />
            {t("reconciliation.page.refresh")}
          </Button>
        }
      />

      <Grid cols={4} className="grid-cols-2">
        <StatCard
          icon={Banknote}
          tone="brand"
          label={t("reconciliation.stats.successVolume")}
          value={loadingValue ?? formatSatang(s?.successVolumeMinor ?? 0)}
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
      </Grid>

      <SegmentedControl
        aria-label={t("reconciliation.views.label")}
        className="hidden sm:inline-flex sm:w-auto"
        value={view}
        onValueChange={(next) => table.setFilter("view", next)}
        items={viewItems}
      />
      <SelectField
        aria-label={t("reconciliation.views.label")}
        containerClassName="w-full sm:hidden"
        value={view}
        onChange={(event) => table.setFilter("view", event.target.value)}
        options={viewItems.map((item) => ({ value: item.value, label: `${item.label} (${formatNumber(item.count ?? 0)})` }))}
      />

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
