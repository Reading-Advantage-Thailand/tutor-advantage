"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Info, Play, ReceiptText, RefreshCw } from "lucide-react";
import {
  AdminStatusChip,
  Chip,
  ColumnToggle,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FilterBar,
  IconTile,
  IdentityCell,
  Notice,
  Page,
  PageHeader,
  Pagination,
  SegmentedControl,
  SelectField,
  useAdminSession,
  useColumnVisibility,
  type DataTableColumn,
} from "@/components/app";
import { toast } from "@/components/app/toastStore";
import { useRefreshAdminSummary } from "@/components/app/adminSummaryContext";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { useTableState } from "@/hooks/useTableState";
import {
  currentBangkokMonth,
  formatNumber,
  formatPeriodMonth,
  previousBangkokMonth,
  shiftPeriodMonth,
} from "@/lib/format";
import { statusOptions } from "@/lib/status";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { Money } from "@/components/app/Money";
import { DateTimeParts, focusToolbar, LoadError } from "./financeUi";
import type { SettlementListResponse, SettlementPreviewResult, SettlementRunRow } from "./types";
import "@/locales/th/settlements";

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
  const toolbarRef = useRef<HTMLDivElement>(null);

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

  // ── Status counts for the tabs and the checker's notice (all runs, not just this page) ──
  const counts = useMemo(() => {
    const map = new Map((data?.statusCounts ?? []).map((row) => [row.status, row.count]));
    const total = (data?.statusCounts ?? []).reduce((sum, row) => sum + row.count, 0);
    return {
      byStatus: map,
      submitted: map.get("SUBMITTED") ?? 0,
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
      // The run list is wider than the card at 1024: the period stays in view while it scrolls.
      sticky: true,
      cell: (row) => (
        <IdentityCell
          leading={<IconTile icon={ReceiptText} tone="neutral" size="sm" />}
          name={formatPeriodMonth(row.periodMonth)}
        />
      ),
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
      cell: (row) => <Money satang={row.totalPayoutSatang} fractionDigits={2} muted />,
    },
    {
      key: "net",
      header: t("settlements.colNet"),
      label: t("settlements.colNet"),
      align: "right",
      mobile: "trailing",
      cell: (row) => <Money satang={row.totalNetPayoutSatang} fractionDigits={2} className="font-semibold text-fg" />,
    },
    {
      key: "pendingAdjustments",
      header: t("settlements.colPendingAdjustments"),
      label: t("settlements.colPendingAdjustments"),
      align: "right",
      mobile: "field",
      cell: (row) =>
        row.pendingAdjustmentCount > 0 ? (
          <Chip tone="warning" size="sm" className="tabular">
            {formatNumber(row.pendingAdjustmentCount)}
          </Chip>
        ) : (
          <span className="text-fg-subtle">–</span>
        ),
    },
    {
      key: "people",
      header: t("settlements.colPeople"),
      label: t("settlements.colPeople"),
      // Phones show the run as a list row (period, status, net); who did what is on the run's timeline.
      mobile: "hidden",
      cell: (row) => (
        <span className="flex min-w-32 flex-col text-[0.8125rem] leading-[1.6] text-balance">
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
      mobile: "hidden",
      defaultHidden: false,
      cell: (row) => (
        <span className="text-[0.8125rem] text-fg-muted tabular">
          <DateTimeParts at={row.approvedAt ?? row.previewedAt ?? row.createdAt} style="short" />
        </span>
      ),
    },
  ];
  const visibility = useColumnVisibility("settlement-runs", columns);

  const statusFilterOptions = statusOptions("settlementRun", { all: t("settlements.filterAllStatus") }).filter(
    (option) => !["APPROVING", "REFRESHING", "PAID"].includes(option.value),
  );
  // Count tabs over the same status filter (the counts cover every run, not just this page).
  const statusTabs = statusFilterOptions.map((option) => ({
    value: option.value,
    label: option.label,
    count: data ? (option.value === "" ? counts.total : (counts.byStatus.get(option.value) ?? 0)) : undefined,
  }));
  // The empty state's "ล้างตัวกรอง" removes itself: focus goes back to the toolbar.
  // (FilterBar's own button moves focus by itself.)
  const resetFilters = () => {
    table.reset();
    focusToolbar(toolbarRef.current);
  };

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

      {/* The count tabs below replace the four count tiles (patterns.md A2); the A5 money strip waits for run totals.
          What only the tiles said, the checker's "waiting for you" line, stays as a link to the same filter. */}
      {me?.role === "FINANCE_CHECKER" && counts.submitted > 0 && table.filters.status !== "SUBMITTED" ? (
        <Notice
          tone="warning"
          icon={ClipboardCheck}
          title={`${t("settlements.statSubmitted")} ${formatNumber(counts.submitted)}`}
          href="/settlements?status=SUBMITTED"
        >
          {t("settlements.statSubmittedHintChecker")}
        </Notice>
      ) : null}

      <div ref={toolbarRef}>
        <FilterBar
          tabs={
            <SegmentedControl
              aria-label={t("settlements.colStatus")}
              value={table.filters.status ?? ""}
              onValueChange={(next) => table.setFilter("status", next)}
              items={statusTabs}
            />
          }
          isFiltered={table.isFiltered}
          onReset={table.reset}
          actions={<ColumnToggle id="settlements-columns" columns={columns} hidden={visibility.hidden} onToggle={visibility.toggle} />}
        />
      </div>

      {error && !data ? (
        <LoadError error={error} onRetry={() => void refetch()} />
      ) : (
        <DataTable
          caption={t("settlements.tableCaption")}
          columns={columns}
          rows={data?.settlements ?? []}
          getRowKey={(row) => row.snapshotId}
          rowHref={(row) => `/settlements/${row.snapshotId}`}
          hiddenColumns={visibility.hidden}
          loading={isLoading || (isValidating && !data)}
          empty={
            <EmptyState
              icon={ReceiptText}
              title={t("settlements.emptyTitle")}
              description={isAdmin ? t("settlements.emptyHintAdmin") : t("settlements.emptyHintChecker")}
              action={
                table.isFiltered ? (
                  <Button variant="outline" onClick={resetFilters}>
                    {t("shell.clearFilters")}
                  </Button>
                ) : undefined
              }
            />
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

      <p className="flex items-start gap-2 text-[0.8125rem] text-fg-muted">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{thaiCopy(t("settlements.cronNote"))}</span>
      </p>

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
