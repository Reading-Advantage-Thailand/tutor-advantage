"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, History, Info, SearchX } from "lucide-react";
import {
  Chip,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  FilterBar,
  IdCell,
  Page,
  PageHeader,
  Pagination,
  SelectField,
  Sheet,
  useAdminSession,
  type DataTableColumn,
} from "@/components/app";
import { toast } from "@/components/app/toastStore";
import { Button } from "@/components/ui/button";
import { useTableState } from "@/hooks/useTableState";
import { api, errorMessage } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import {
  currentBangkokMonth,
  formatNumber,
  formatPeriodMonth,
  formatThaiDate,
  formatThaiDateTime,
  formatThaiTime,
  shiftPeriodMonth,
  toDateKey,
} from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import {
  AUDIT_CATEGORIES,
  AUDIT_ENTITY_TYPES,
  actionFilterOptions,
  auditActionLabel,
  auditActionTone,
  auditEntityHref,
  auditEntityLabel,
  auditStatusDomain,
} from "./auditLabels";
import "@/locales/th/audit";
import "@/locales/th/dashboard";

interface AuditLog {
  auditId: string;
  actionType: string;
  actorUserId: string;
  displayName: string;
  actorEmail?: string | null;
  actorRole?: string | null;
  entityType: string;
  targetId: string;
  periodMonth?: string;
  previousStatus?: string;
  newStatus?: string;
  reason?: string;
  createdAt: string;
  metadata?: unknown;
}

interface AuditPage {
  logs: AuditLog[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

const FILTER_KEYS = ["action", "entityType", "entityId", "range"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_DAYS: Record<string, number> = { today: 1, "7d": 7, "30d": 30, "90d": 90 };

/** URL `range` → API date params (Bangkok calendar). */
function rangeToQuery(range: string | undefined, now = Date.now()): Record<string, string> {
  if (!range) return {};
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(range)) return { periodMonth: range };
  const days = RANGE_DAYS[range];
  if (!days) return {};
  return { from: toDateKey(new Date(now - (days - 1) * DAY_MS)), to: toDateKey(new Date(now)) };
}

function statusText(log: AuditLog, value: string | undefined) {
  if (!value) return null;
  const domain = auditStatusDomain(log.entityType, log.actionType);
  return domain ? statusLabel(domain, value) : value;
}

function ActorCell({ log }: { log: AuditLog }) {
  if (log.actorUserId === "SYSTEM") return <span className="text-fg-muted">{t("audit.systemActor")}</span>;
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-fg">{log.displayName || t("audit.unknownActor")}</span>
      {log.actorRole ? <span className="text-xs text-fg-muted">{statusLabel("userRole", log.actorRole)}</span> : null}
    </span>
  );
}

function StatusChange({ log }: { log: AuditLog }) {
  const before = statusText(log, log.previousStatus);
  const after = statusText(log, log.newStatus);
  if (!before && !after) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[0.8125rem]">
      {before ? <span className="text-fg-muted">{before}</span> : null}
      {before && after ? <span aria-hidden="true" className="text-fg-subtle">→</span> : null}
      {after ? <span className="font-medium text-fg">{after}</span> : null}
    </span>
  );
}

function PayloadValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return <span className="text-fg-subtle">–</span>;
  if (typeof value === "object") {
    return (
      <pre className="max-h-48 overflow-auto rounded-lg bg-surface-muted p-2 font-mono text-xs whitespace-pre-wrap break-all text-fg-muted">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span className="break-all">{String(value)}</span>;
}

function AuditDetail({ log }: { log: AuditLog }) {
  const href = auditEntityHref(log.entityType, log.targetId);
  const payload = log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata) ? (log.metadata as Record<string, unknown>) : null;
  return (
    <div className="flex flex-col gap-6">
      <DescriptionList
        items={[
          { label: t("audit.detailTime"), value: formatThaiDateTime(log.createdAt, "long") },
          {
            label: t("audit.detailAction"),
            value: (
              <Chip tone={auditActionTone(log.actionType)} size="sm">
                {auditActionLabel(log.actionType)}
              </Chip>
            ),
          },
          {
            label: t("audit.detailActor"),
            value: (
              <span className="flex flex-col gap-0.5">
                <ActorCell log={log} />
                {log.actorEmail ? <span className="text-xs text-fg-muted">{log.actorEmail}</span> : null}
                {log.actorUserId !== "SYSTEM" ? <IdCell id={log.actorUserId} /> : null}
              </span>
            ),
          },
          {
            label: t("audit.detailEntityType"),
            value: (
              <span className="flex flex-col gap-0.5">
                <span>{auditEntityLabel(log.entityType)}</span>
                <IdCell id={log.targetId} />
                {href ? (
                  <Link href={href} className="text-sm font-medium text-brand-fg hover:underline">
                    {t("dashboard.reviewItems")}
                  </Link>
                ) : null}
              </span>
            ),
          },
          ...(log.periodMonth ? [{ label: t("audit.detailPeriod"), value: formatPeriodMonth(log.periodMonth) }] : []),
          ...(log.previousStatus || log.newStatus ? [{ label: t("audit.detailStatusChange"), value: <StatusChange log={log} /> }] : []),
          ...(log.reason ? [{ label: t("audit.detailReason"), value: log.reason, wide: true }] : []),
          { label: t("audit.detailActionCode"), value: <code className="font-mono text-xs text-fg-muted">{log.actionType}</code> },
          { label: t("audit.detailAuditId"), value: <IdCell id={log.auditId} /> },
        ]}
      />
      {payload && Object.keys(payload).length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-fg">{t("audit.detailPayload")}</h3>
          <DescriptionList
            columns={1}
            items={Object.entries(payload).map(([key, value]) => ({
              label: <code className="font-mono text-xs">{key}</code>,
              value: <PayloadValue value={value} />,
            }))}
          />
        </section>
      ) : null}
      <Link
        href={`/audit?entityType=${encodeURIComponent(log.entityType)}&entityId=${encodeURIComponent(log.targetId)}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-fg hover:underline"
      >
        <History aria-hidden="true" className="size-4" />
        {t("audit.detailOpenHistory")}
      </Link>
    </div>
  );
}

export default function AuditPage() {
  const me = useAdminSession();
  const table = useTableState({
    filterKeys: FILTER_KEYS,
    defaultPageSize: 50,
    defaultSort: { key: "createdAt", dir: "desc" },
    sortKeys: ["createdAt"],
  });
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filterQuery = useMemo(() => {
    const f = table.filters;
    return {
      sort: "createdAt",
      order: table.sort?.dir ?? "desc",
      actor: table.q.trim() || undefined,
      actionType: f.action || undefined,
      entityType: f.entityType || undefined,
      entityId: f.entityId || undefined,
      ...rangeToQuery(f.range),
    };
  }, [table.filters, table.q, table.sort]);

  const { data, error, isLoading, isValidating, refetch } = useCachedResource(
    me ? `${me.userId}:audit:${table.queryKey}` : null,
    () => api.get<AuditPage>("/v1/audit-logs", { query: { ...filterQuery, page: table.page, pageSize: table.pageSize } }),
    { keepPreviousData: true },
  );

  const months = useMemo(() => {
    const current = currentBangkokMonth();
    return Array.from({ length: 12 }, (_, i) => shiftPeriodMonth(current, -i));
  }, []);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await api.download("/v1/audit-logs/export", "audit-log.csv", { query: filterQuery });
      toast.success(t("audit.exportDone"));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const openDetail = (log: AuditLog) => {
    setSelected(log);
    setDetailOpen(true);
  };

  const columns: DataTableColumn<AuditLog>[] = [
    {
      key: "createdAt",
      header: t("audit.colTime"),
      sortable: true,
      width: "150px",
      mobile: "secondary",
      cell: (log) => (
        <span className="flex flex-col leading-tight">
          <span className="text-fg tabular">{formatThaiDate(log.createdAt, "short")}</span>
          <span className="text-xs text-fg-muted tabular">{formatThaiTime(log.createdAt, { suffix: true })}</span>
        </span>
      ),
    },
    {
      key: "action",
      header: t("audit.colAction"),
      mobile: "primary",
      alwaysVisible: true,
      cell: (log) => (
        <button
          type="button"
          onClick={() => openDetail(log)}
          className="text-left font-medium text-fg hover:text-brand-fg hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {auditActionLabel(log.actionType)}
        </button>
      ),
    },
    {
      key: "entity",
      header: t("audit.colEntity"),
      cell: (log) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-fg">{auditEntityLabel(log.entityType)}</span>
            {log.periodMonth ? (
              <Chip size="sm" tone="neutral">
                {t("audit.periodChip", { period: formatPeriodMonth(log.periodMonth, { short: true }) })}
              </Chip>
            ) : null}
          </span>
          <IdCell id={log.targetId} />
        </span>
      ),
    },
    { key: "actor", header: t("audit.colActor"), cell: (log) => <ActorCell log={log} /> },
    {
      key: "detail",
      header: t("audit.colDetail"),
      cell: (log) => {
        const change = <StatusChange log={log} />;
        return (
          <span className="flex min-w-0 flex-col gap-0.5">
            {change}
            {log.reason ? <span className="line-clamp-2 text-[0.8125rem] text-fg-muted">{log.reason}</span> : null}
            {!log.previousStatus && !log.newStatus && !log.reason ? <span className="text-fg-subtle">–</span> : null}
          </span>
        );
      },
    },
    {
      key: "open",
      header: <span className="sr-only">{t("audit.viewDetail")}</span>,
      label: t("audit.viewDetail"),
      align: "right",
      width: "56px",
      mobile: "trailing",
      cell: (log) => (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("audit.viewDetail")}
          title={t("audit.viewDetail")}
          onClick={() => openDetail(log)}
        >
          <Info aria-hidden="true" />
        </Button>
      ),
    },
  ];

  const rows = data?.logs ?? [];
  const total = data?.pagination.total ?? 0;
  const rangeValue = table.filters.range ?? "";

  return (
    <Page>
      <PageHeader
        title={t("audit.pageTitle")}
        description={t("audit.pageDescription")}
        meta={data ? <span className="text-sm text-fg-muted">{t("audit.totalCount", { count: formatNumber(total) })}</span> : null}
        actions={
          <Button variant="outline" onClick={exportCsv} loading={exporting} disabled={!data || total === 0}>
            {exporting ? null : <Download aria-hidden="true" />}
            {t("audit.exportCsv")}
          </Button>
        }
      />

      <FilterBar
        search={{ value: table.searchValue, onValueChange: table.setSearchValue, placeholder: t("audit.actorSearch"), label: t("audit.actorSearch") }}
        isFiltered={table.isFiltered}
        onReset={table.reset}
      >
        <SelectField
          aria-label={t("audit.filterRange")}
          containerClassName="w-full sm:w-44"
          value={rangeValue}
          onChange={(e) => table.setFilter("range", e.target.value)}
        >
          <option value="">{t("audit.allTime")}</option>
          <optgroup label={t("audit.rangeGroup")}>
            <option value="today">{t("audit.rangeToday")}</option>
            <option value="7d">{t("audit.range7d")}</option>
            <option value="30d">{t("audit.range30d")}</option>
            <option value="90d">{t("audit.range90d")}</option>
          </optgroup>
          <optgroup label={t("audit.monthsGroup")}>
            {months.map((month) => (
              <option key={month} value={month}>
                {formatPeriodMonth(month)}
              </option>
            ))}
          </optgroup>
        </SelectField>
        <SelectField
          aria-label={t("audit.filterAction")}
          containerClassName="w-full sm:w-56"
          value={table.filters.action ?? ""}
          onChange={(e) => table.setFilter("action", e.target.value)}
        >
          <option value="">{t("audit.allActions")}</option>
          {AUDIT_CATEGORIES.map((category) => (
            <optgroup key={category.id} label={category.label}>
              {category.actions.length > 1 ? (
                <option value={category.actions.join(",")}>{t("audit.categoryAll", { name: category.label })}</option>
              ) : null}
              {actionFilterOptions(category).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>
        <SelectField
          aria-label={t("audit.filterEntity")}
          containerClassName="w-full sm:w-40"
          value={table.filters.entityType ?? ""}
          onChange={(e) => table.setFilter("entityType", e.target.value)}
          options={[
            { value: "", label: t("audit.allEntities") },
            ...AUDIT_ENTITY_TYPES.map((type) => ({ value: type, label: auditEntityLabel(type) })),
          ]}
        />
      </FilterBar>

      {table.filters.entityId ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
          <span>{t("audit.scopedTo")}</span>
          <span className="text-fg">{auditEntityLabel(table.filters.entityType)}</span>
          <IdCell id={table.filters.entityId} />
          <Button variant="link" size="sm" onClick={() => table.setFilter("entityId", "")}>
            {t("audit.clearScope")}
          </Button>
        </div>
      ) : null}

      {error && !data ? (
        <ErrorState description={errorMessage(error)} onRetry={refetch} />
      ) : (
        <DataTable
          caption={t("audit.caption")}
          columns={columns}
          rows={rows}
          getRowKey={(log) => log.auditId}
          loading={isLoading || isValidating}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={
            table.isFiltered ? (
              <EmptyState
                icon={SearchX}
                title={t("audit.emptyFiltered")}
                description={t("audit.emptyFilteredHint")}
                action={
                  <Button variant="outline" onClick={table.reset}>
                    {t("shell.clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={History} title={t("audit.emptyAll")} description={t("audit.emptyAllHint")} />
            )
          }
          footer={
            total > 0 ? (
              <Pagination
                page={table.page}
                pageSize={table.pageSize}
                total={total}
                onPageChange={table.setPage}
                onPageSizeChange={table.setPageSize}
                pageSizes={[20, 50, 100]}
              />
            ) : null
          }
        />
      )}

      <Sheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={selected ? auditActionLabel(selected.actionType) : t("audit.detailTitle")}
        description={selected ? formatThaiDateTime(selected.createdAt) : undefined}
        width={600}
      >
        {selected ? <AuditDetail log={selected} /> : null}
      </Sheet>
    </Page>
  );
}
