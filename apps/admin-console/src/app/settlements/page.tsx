"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, ClipboardCheck, FileClock, Play, RefreshCw } from "lucide-react";
import {
  AdminStatusChip,
  Chip,
  ConfirmDialog,
  DataTable,
  ErrorState,
  FilterBar,
  Grid,
  Notice,
  Page,
  PageHeader,
  Pagination,
  SelectField,
  StatCard,
  useAdminSession,
  type DataTableColumn,
} from "@/components/app";
import { toast } from "@/components/app/Toast";
import { useRefreshAdminSummary } from "@/components/app/AdminSummary";
import { Button } from "@/components/ui/button";
import { api, ApiError, errorMessage } from "@/lib/api";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { useTableState } from "@/hooks/useTableState";
import {
  currentBangkokMonth,
  formatNumber,
  formatPeriodMonth,
  formatThaiDateTime,
  previousBangkokMonth,
  shiftPeriodMonth,
} from "@/lib/format";
import { statusOptions } from "@/lib/status";
import { t } from "@/lib/i18n";
import { Money } from "@/components/app/Money";
import type { SettlementListResponse, SettlementPreviewResult, SettlementRunRow } from "./types";

/** Manual preview is only allowed on the 1st (Bangkok) in production; the backend enforces it too. */
function isSettlementDay(now: Date = new Date()): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", day: "numeric" }).format(now);
  return day === "1";
}

/** The last 12 Bangkok months, newest first (the period picker). */
function recentPeriods(count = 12): string[] {
  const current = currentBangkokMonth();
  return Array.from({ length: count }, (_, index) => shiftPeriodMonth(current, -index));
}

function StaleChip({ run }: { run: Pick<SettlementRunRow, "stale" | "payoutLineCount" | "status"> }) {
  if (run.status === "DRAFT" && run.payoutLineCount === 0) {
    return <Chip tone="warning" size="sm">{t("settlements.chipEmpty")}</Chip>;
  }
  if (run.stale) return <Chip tone="danger" size="sm">{t("settlements.chipStale")}</Chip>;
  return null;
}

export default function SettlementsPage() {
  return (
    <Suspense>
      <SettlementsList />
    </Suspense>
  );
}

function SettlementsList() {
  const me = useAdminSession();
  const router = useRouter();
  const refreshSummary = useRefreshAdminSummary();
  const isAdmin = me?.role === "ADMIN";
  const table = useTableState({ filterKeys: ["status"], defaultPageSize: 20 });

  const listKey = me ? `${me.userId}:settlements:list:${table.queryKey}` : null;
  const { data, error, isLoading, isValidating, refetch } = useCachedResource(
    listKey,
    () =>
      api.get<SettlementListResponse>("/v1/settlements", {
        query: { page: table.page, pageSize: table.pageSize, status: table.filters.status || undefined },
      }),
    { keepPreviousData: true },
  );

  // ── Preview (calculate a period) ──
  const [previewOpen, setPreviewOpen] = useState(false);
  const [period, setPeriod] = useState(previousBangkokMonth);
  const periods = useMemo(() => recentPeriods(), []);
  const existingKey = me && previewOpen ? `${me.userId}:settlements:period:${period}` : null;
  const existing = useCachedResource(
    existingKey,
    () => api.get<SettlementListResponse>("/v1/settlements", { query: { periodMonth: period, pageSize: 1 } }),
    { staleTime: 0 },
  );
  const existingRun = existing.data?.settlements[0] ?? null;
  // Holders, rejected runs and never-calculated drafts are recalculated in place by the backend.
  const existingBlocksPreview =
    existingRun &&
    !["ADJUSTMENT_PENDING", "REJECTED"].includes(existingRun.status) &&
    !(existingRun.status === "DRAFT" && existingRun.payoutLineCount === 0);
  const canPreview = isSettlementDay();

  const runPreview = async () => {
    try {
      const result = await api.post<{ preview: SettlementPreviewResult }>("/v1/settlements/preview", {
        periodMonth: period,
      });
      toast.success(
        t("settlements.previewDone", {
          period: formatPeriodMonth(result.preview.periodMonth),
          count: formatNumber(result.preview.payoutLineCount),
        }),
      );
      if (me) invalidateResource(`${me.userId}:settlements:`);
      void refreshSummary();
      router.push(`/settlements/${result.preview.snapshotId}`);
    } catch (err) {
      const details = err instanceof ApiError ? (err.details as { snapshotId?: string } | undefined) : undefined;
      if (err instanceof ApiError && err.code === "DRAFT_EXISTS" && details?.snapshotId) {
        toast.error(t("settlements.previewExists"), {
          description: t("settlements.previewExistsHint"),
        });
        router.push(`/settlements/${details.snapshotId}`);
        return;
      }
      throw err;
    }
  };

  // ── Stat cards (all runs, not just this page) ──
  const counts = useMemo(() => {
    const map = new Map((data?.statusCounts ?? []).map((row) => [row.status, row.count]));
    const total = (data?.statusCounts ?? []).reduce((sum, row) => sum + row.count, 0);
    return {
      draft: (map.get("DRAFT") ?? 0) + (map.get("REJECTED") ?? 0) + (map.get("ADJUSTMENT_PENDING") ?? 0),
      submitted: map.get("SUBMITTED") ?? 0,
      approved: map.get("APPROVED") ?? 0,
      total,
    };
  }, [data?.statusCounts]);

  const columns: DataTableColumn<SettlementRunRow>[] = [
    {
      key: "period",
      header: t("settlements.colPeriod"),
      label: t("settlements.colPeriod"),
      mobile: "primary",
      alwaysVisible: true,
      cell: (row) => <span className="font-medium text-fg">{formatPeriodMonth(row.periodMonth)}</span>,
    },
    {
      key: "status",
      header: t("settlements.colStatus"),
      label: t("settlements.colStatus"),
      mobile: "secondary",
      cell: (row) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <AdminStatusChip domain="settlementRun" status={row.status} />
          <StaleChip run={row} />
        </span>
      ),
    },
    {
      key: "lines",
      header: t("settlements.colLines"),
      label: t("settlements.colLines"),
      align: "right",
      mobile: "field",
      cell: (row) => formatNumber(row.payoutLineCount),
    },
    {
      key: "gross",
      header: t("settlements.colGross"),
      label: t("settlements.colGross"),
      align: "right",
      mobile: "hidden",
      cell: (row) => <Money satang={row.totalPayoutSatang} muted />,
    },
    {
      key: "net",
      header: t("settlements.colNet"),
      label: t("settlements.colNet"),
      align: "right",
      mobile: "trailing",
      cell: (row) => <Money satang={row.totalNetPayoutSatang} className="font-semibold text-fg" />,
    },
    {
      key: "pendingAdjustments",
      header: t("settlements.colPendingAdjustments"),
      label: t("settlements.colPendingAdjustments"),
      align: "right",
      mobile: "field",
      cell: (row) =>
        row.pendingAdjustmentCount > 0 ? (
          <Chip tone="warning" size="sm">{formatNumber(row.pendingAdjustmentCount)}</Chip>
        ) : (
          <span className="text-fg-subtle">–</span>
        ),
    },
    {
      key: "people",
      header: t("settlements.colPeople"),
      label: t("settlements.colPeople"),
      mobile: "field",
      cell: (row) => (
        <span className="flex flex-col text-[0.8125rem] leading-snug">
          <span>{t("settlements.createdByShort", { name: row.createdByName ?? t("settlements.unknownActor") })}</span>
          {row.approvedAt ? (
            <span className="text-fg-muted">
              {t("settlements.approvedByShort", { name: row.approvedByName ?? t("settlements.unknownActor") })}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "updated",
      header: t("settlements.colUpdated"),
      label: t("settlements.colUpdated"),
      mobile: "field",
      defaultHidden: false,
      cell: (row) => (
        <span className="text-[0.8125rem] text-fg-muted">
          {formatThaiDateTime(row.approvedAt ?? row.previewedAt ?? row.createdAt, "short")}
        </span>
      ),
    },
  ];

  const statusFilterOptions = statusOptions("settlementRun", { all: t("settlements.filterAllStatus") }).filter(
    (option) => !["APPROVING", "REFRESHING", "PAID"].includes(option.value),
  );

  return (
    <Page>
      <PageHeader
        title={t("settlements.pageTitle")}
        description={t("settlements.pageDescription")}
        actions={
          <>
            <Button variant="outline" onClick={() => void refetch()} loading={isValidating && !isLoading}>
              <RefreshCw aria-hidden="true" />
              {t("settlements.refresh")}
            </Button>
            {isAdmin ? (
              <Button onClick={() => setPreviewOpen(true)}>
                <Play aria-hidden="true" />
                {t("settlements.calculatePeriod")}
              </Button>
            ) : null}
          </>
        }
      />

      {data?.devMakerCheckerOverride ? (
        <Notice tone="warning" title={t("settlements.devOverrideTitle")}>
          {t("settlements.devOverrideBody")}
        </Notice>
      ) : null}

      <Grid cols={4} className="grid-cols-2">
        <StatCard
          label={t("settlements.statSubmitted")}
          value={formatNumber(counts.submitted)}
          icon={ClipboardCheck}
          tone="amber"
          hint={me?.role === "FINANCE_CHECKER" ? t("settlements.statSubmittedHintChecker") : t("settlements.statSubmittedHint")}
          href="/settlements?status=SUBMITTED"
        />
        <StatCard
          label={t("settlements.statDraft")}
          value={formatNumber(counts.draft)}
          icon={FileClock}
          tone="neutral"
          hint={t("settlements.statDraftHint")}
          href="/settlements?status=DRAFT"
        />
        <StatCard
          label={t("settlements.statApproved")}
          value={formatNumber(counts.approved)}
          icon={CheckCircle2}
          tone="teal"
          href="/settlements?status=APPROVED"
        />
        <StatCard
          label={t("settlements.statTotal")}
          value={formatNumber(counts.total)}
          icon={CalendarClock}
          tone="blue"
          hint={t("settlements.statTotalHint")}
        />
      </Grid>

      <FilterBar isFiltered={table.isFiltered} onReset={table.reset}>
        <SelectField
          aria-label={t("settlements.colStatus")}
          containerClassName="w-full sm:w-52"
          value={table.filters.status ?? ""}
          onChange={(event) => table.setFilter("status", event.target.value)}
          options={statusFilterOptions}
        />
      </FilterBar>

      {error && !data ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <DataTable
          caption={t("settlements.tableCaption")}
          columns={columns}
          rows={data?.settlements ?? []}
          getRowKey={(row) => row.snapshotId}
          rowHref={(row) => `/settlements/${row.snapshotId}`}
          loading={isLoading || (isValidating && !data)}
          empty={
            <div className="flex flex-col items-center gap-1 py-10 text-center">
              <p className="font-medium text-fg">{t("settlements.emptyTitle")}</p>
              <p className="text-sm text-fg-muted">
                {isAdmin ? t("settlements.emptyHintAdmin") : t("settlements.emptyHintChecker")}
              </p>
            </div>
          }
          footer={
            <Pagination
              page={table.page}
              pageSize={table.pageSize}
              total={data?.pagination.total ?? 0}
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
          }
        />
      )}

      <p className="text-[0.8125rem] text-fg-muted">{t("settlements.cronNote")}</p>

      <ConfirmDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={t("settlements.previewDialogTitle")}
        description={t("settlements.previewDialogDescription")}
        confirmLabel={t("settlements.previewConfirm", { period: formatPeriodMonth(period) })}
        onConfirm={async () => {
          if (!canPreview) throw new Error(t("settlements.notSettlementDay"));
          if (existingBlocksPreview) throw new Error(t("settlements.previewExists"));
          await runPreview();
        }}
      >
        <div className="flex flex-col gap-3">
          <SelectField
            label={t("settlements.periodLabel")}
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            options={periods.map((value) => ({ value, label: formatPeriodMonth(value) }))}
            hint={t("settlements.periodHint", { period: formatPeriodMonth(previousBangkokMonth()) })}
          />
          {!canPreview ? <Notice tone="warning">{t("settlements.notSettlementDay")}</Notice> : null}
          {existingRun ? (
            existingBlocksPreview ? (
              <Notice
                tone="warning"
                title={t("settlements.previewExists")}
                href={`/settlements/${existingRun.snapshotId}`}
              >
                {t("settlements.previewExistsOpen")}
              </Notice>
            ) : (
              <Notice tone="info">
                {existingRun.status === "ADJUSTMENT_PENDING"
                  ? t("settlements.previewWillFillHolder")
                  : t("settlements.previewWillRecalculate")}
              </Notice>
            )
          ) : null}
        </div>
      </ConfirmDialog>
    </Page>
  );
}
