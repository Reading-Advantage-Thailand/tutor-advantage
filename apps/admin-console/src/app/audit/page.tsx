"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ChevronRight, Download, History, SearchX } from "lucide-react";
import {
  Chip,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  FilterBar,
  IdCell,
  Notice,
  Page,
  PageHeader,
  Pagination,
  SelectField,
  Sheet,
  useAdminSession,
  type ActiveFilter,
  type DataTableColumn,
} from "@/components/app";
import { toast } from "@/components/app/toastStore";
import { Button } from "@/components/ui/button";
import { useTableState } from "@/hooks/useTableState";
import { api, ApiError, errorMessage } from "@/lib/api";
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
import { keepThaiWords } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import {
  AUDIT_CATEGORIES,
  AUDIT_CATEGORY_DOT,
  AUDIT_ENTITY_TYPES,
  actionFilterOptions,
  auditActionLabel,
  auditActionTone,
  auditCategory,
  auditCategoryLabel,
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

/** Words for the phone filter chips (the same labels the selects show). */
function rangeLabel(range: string): string {
  if (range === "today") return t("audit.rangeToday");
  if (range === "7d") return t("audit.range7d");
  if (range === "30d") return t("audit.range30d");
  if (range === "90d") return t("audit.range90d");
  return /^\d{4}-\d{2}$/.test(range) ? formatPeriodMonth(range) : range;
}

function actionFilterLabel(value: string): string {
  for (const category of AUDIT_CATEGORIES) {
    if (category.actions.length > 1 && value === category.actions.join(",")) return t("audit.categoryAll", { name: category.label });
    const option = actionFilterOptions(category).find((item) => item.value === value);
    if (option) return option.label;
  }
  return auditActionLabel(value.split(",")[0]);
}

function statusText(log: AuditLog, value: string | undefined) {
  if (!value) return null;
  const domain = auditStatusDomain(log.entityType, log.actionType);
  return domain ? statusLabel(domain, value) : value;
}

/** Category = an 8px dot in the category colour + the category word (never colour alone). */
function CategoryCell({ action }: { action: string }) {
  const category = auditCategory(action);
  return (
    <span className="inline-flex max-w-full items-center gap-2 whitespace-nowrap text-fg-muted">
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", AUDIT_CATEGORY_DOT[category])} />
      <span className="truncate">{auditCategoryLabel(category)}</span>
    </span>
  );
}

function ActorCell({ log, inline }: { log: AuditLog; inline?: boolean }) {
  if (log.actorUserId === "SYSTEM") return <span className="text-fg-muted">{t("audit.systemActor")}</span>;
  const name = log.displayName || t("audit.unknownActor");
  const role = log.actorRole ? statusLabel("userRole", log.actorRole) : null;
  if (inline) {
    // Compact table: one line, cut with an ellipsis (the full name is in the title and the detail sheet).
    // Between 768 and 1535px the table has no room for the role beside a full name, so there it is
    // kept for screen readers only (everyone gets it in the detail sheet). From 1536px the cap is
    // wider, so the role shows without being cut.
    return (
      <span className="block max-w-40 truncate 2xl:max-w-56" title={role ? `${name} · ${role}` : name}>
        <span className="text-fg">{name}</span>
        {role ? <span className="text-fg-muted max-2xl:md:sr-only"> · {role}</span> : null}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-fg">{name}</span>
      {role ? <span className="text-xs text-fg-muted">{role}</span> : null}
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
  return <span className="[overflow-wrap:anywhere]">{String(value)}</span>;
}

function AuditDetail({ log }: { log: AuditLog }) {
  const href = auditEntityHref(log.entityType, log.targetId);
  const payload = log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata) ? (log.metadata as Record<string, unknown>) : null;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Chip tone={auditActionTone(log.actionType)} size="sm">
          {auditActionLabel(log.actionType)}
        </Chip>
        <CategoryCell action={log.actionType} />
      </div>
      <DescriptionList
        items={[
          { label: t("audit.detailTime"), value: <span className="tabular">{formatThaiDateTime(log.createdAt, "long")}</span> },
          {
            label: t("audit.detailAction"),
            value: auditActionLabel(log.actionType),
          },
          {
            label: t("audit.detailActor"),
            value: (
              <span className="flex flex-col gap-0.5">
                <ActorCell log={log} />
                {log.actorEmail ? <span className="text-xs [overflow-wrap:anywhere] text-fg-muted">{log.actorEmail}</span> : null}
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
          { label: t("audit.detailActionCode"), value: <code className="font-mono text-xs [overflow-wrap:anywhere] text-fg-muted">{log.actionType}</code> },
          { label: t("audit.detailAuditId"), value: <IdCell id={log.auditId} /> },
        ]}
      />
      {payload && Object.keys(payload).length > 0 ? (
        <section className="flex flex-col gap-3 border-t border-hairline pt-5">
          <h3 className="text-sm font-semibold text-fg">{t("audit.detailPayload")}</h3>
          <div className="rounded-lg bg-surface-muted p-3">
            <DescriptionList
              columns={1}
              items={Object.entries(payload).map(([key, value]) => ({
                label: <code className="font-mono text-xs">{key}</code>,
                value: <PayloadValue value={value} />,
              }))}
            />
          </div>
        </section>
      ) : null}
      <Link
        href={`/audit?entityType=${encodeURIComponent(log.entityType)}&entityId=${encodeURIComponent(log.targetId)}`}
        className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-(--radius-ctl-sm) text-sm font-medium text-brand-fg hover:underline pointer-coarse:min-h-11"
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
  const toolbarRef = useRef<HTMLDivElement>(null);

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

  /**
   * Controls that remove themselves once used (the empty state's "ล้างตัวกรอง", "ดูทั้งหมด") hand
   * focus to the search box. (FilterBar's own "ล้างตัวกรอง" moves focus by itself.)
   */
  const focusSearch = () =>
    window.requestAnimationFrame(() => toolbarRef.current?.querySelector<HTMLElement>('input[type="search"]')?.focus());
  const resetFilters = () => {
    table.reset();
    focusSearch();
  };

  const columns: DataTableColumn<AuditLog>[] = [
    {
      key: "createdAt",
      header: t("audit.colTime"),
      sortable: true,
      mobile: "secondary",
      // Stays in view while the wide log scrolls sideways (a click on it opens the row's detail too).
      sticky: true,
      cell: (log) => (
        <span className="whitespace-nowrap tabular">
          <span className="text-fg">{formatThaiDate(log.createdAt, "short")}</span>{" "}
          <span className="text-fg-muted">{formatThaiTime(log.createdAt, { suffix: true })}</span>
        </span>
      ),
    },
    {
      key: "category",
      header: t("audit.colCategory"),
      label: t("audit.colCategory"),
      mobile: "trailing",
      cell: (log) => <CategoryCell action={log.actionType} />,
    },
    {
      key: "action",
      header: t("audit.colAction"),
      mobile: "primary",
      alwaysVisible: true,
      cell: (log) => (
        // The whole row opens the detail sheet: the button's ::after covers the row (the
        // copy buttons in other cells sit above it), so there is one tab stop per row.
        // data-row-link: DataTable draws the focus ring around the whole row and hands
        // clicks on the sticky time cell to this button.
        <button
          type="button"
          data-row-link=""
          onClick={() => openDetail(log)}
          className="block max-w-full text-left font-medium text-fg outline-none after:absolute after:inset-0 hover:text-brand-fg focus-visible:underline md:max-w-56 md:truncate pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:items-center"
          title={auditActionLabel(log.actionType)}
        >
          {/* One child: on a touch screen the button is a flex box, and the kept words must stay one run of text. */}
          <span className="min-w-0">{keepThaiWords(auditActionLabel(log.actionType))}</span>
        </button>
      ),
    },
    {
      key: "entity",
      header: t("audit.colEntity"),
      cell: (log) => (
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 md:flex-nowrap">
          <span className="whitespace-nowrap text-fg">{auditEntityLabel(log.entityType)}</span>
          {log.periodMonth ? (
            <Chip size="sm" tone="neutral">
              {t("audit.periodChip", { period: formatPeriodMonth(log.periodMonth, { short: true }) })}
            </Chip>
          ) : null}
          <IdCell id={log.targetId} />
        </span>
      ),
    },
    { key: "actor", header: t("audit.colActor"), cell: (log) => <ActorCell log={log} inline /> },
    {
      key: "detail",
      header: t("audit.colDetail"),
      // Phone cards leave the field out instead of showing "–".
      isEmpty: (log) => !log.previousStatus && !log.newStatus && !log.reason,
      cell: (log) => {
        const change = <StatusChange log={log} />;
        return (
          <span className="flex min-w-0 flex-col gap-0.5 md:flex-row md:items-center md:gap-2">
            {change}
            {log.reason ? (
              <span className="line-clamp-2 text-[0.8125rem] text-fg-muted md:block md:max-w-44 md:truncate" title={log.reason}>
                {log.reason}
              </span>
            ) : null}
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
      width: "44px",
      mobile: "hidden",
      className: "!px-0 text-center",
      cell: () => <ChevronRight aria-hidden="true" className="mx-auto size-4 text-fg-subtle" />,
    },
  ];

  const rows = data?.logs ?? [];
  const total = data?.pagination.total ?? 0;
  const rangeValue = table.filters.range ?? "";

  // The three filters render inline from 768px and inside the phone sheet. Stable ids (not
  // useId): the inline selects are server-rendered, see sharedRequests on hydration ids.
  const rangeSelect = (props: { id: string; label?: string; containerClassName: string }) => (
    <SelectField
      id={props.id}
      aria-label={props.label ? undefined : t("audit.filterRange")}
      label={props.label}
      containerClassName={props.containerClassName}
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
  );
  const actionSelect = (props: { id: string; label?: string; containerClassName: string }) => (
    <SelectField
      id={props.id}
      aria-label={props.label ? undefined : t("audit.filterAction")}
      label={props.label}
      containerClassName={props.containerClassName}
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
  );
  const entitySelect = (props: { id: string; label?: string; containerClassName: string }) => (
    <SelectField
      id={props.id}
      aria-label={props.label ? undefined : t("audit.filterEntity")}
      label={props.label}
      containerClassName={props.containerClassName}
      value={table.filters.entityType ?? ""}
      onChange={(e) => table.setFilter("entityType", e.target.value)}
      options={[
        { value: "", label: t("audit.allEntities") },
        ...AUDIT_ENTITY_TYPES.map((type) => ({ value: type, label: auditEntityLabel(type) })),
      ]}
    />
  );

  const sheetFilters: ActiveFilter[] = [
    ...(rangeValue
      ? [{ key: "range", label: `${t("audit.filterRange")}: ${rangeLabel(rangeValue)}`, onRemove: () => table.setFilter("range", "") }]
      : []),
    ...(table.filters.action
      ? [
          {
            key: "action",
            label: `${t("audit.filterAction")}: ${actionFilterLabel(table.filters.action)}`,
            onRemove: () => table.setFilter("action", ""),
          },
        ]
      : []),
    ...(table.filters.entityType
      ? [
          {
            key: "entityType",
            label: `${t("audit.filterEntity")}: ${auditEntityLabel(table.filters.entityType)}`,
            onRemove: () => table.setFilter("entityType", ""),
          },
        ]
      : []),
  ];

  return (
    <Page>
      <PageHeader
        title={t("audit.pageTitle")}
        description={t("audit.pageDescription")}
        meta={data ? <span className="text-sm text-fg-muted tabular">{t("audit.totalCount", { count: formatNumber(total) })}</span> : null}
        actions={
          <Button variant="outline" onClick={exportCsv} loading={exporting} disabled={!data || total === 0}>
            {exporting ? null : <Download aria-hidden="true" />}
            {t("audit.exportCsv")}
          </Button>
        }
      />

      {/* Toolbar: search by actor (flex) → time range → activity (by category) → record type.
          768–1279: search on its own row, the selects below; phones: search + a "ตัวกรอง" sheet. */}
      <div ref={toolbarRef}>
        <FilterBar
          search={{ value: table.searchValue, onValueChange: table.setSearchValue, placeholder: t("audit.actorSearch"), label: t("audit.actorSearch") }}
          isFiltered={table.isFiltered}
          onReset={table.reset}
          moreFilters={{
            active: sheetFilters,
            onReset: () => table.setFilters({ range: "", action: "", entityType: "" }),
            children: (
              <>
                {rangeSelect({ id: "audit-range-sheet", label: t("audit.filterRange"), containerClassName: "w-full" })}
                {actionSelect({ id: "audit-action-sheet", label: t("audit.filterAction"), containerClassName: "w-full" })}
                {entitySelect({ id: "audit-entity-sheet", label: t("audit.filterEntity"), containerClassName: "w-full" })}
              </>
            ),
          }}
        >
          {rangeSelect({ id: "audit-range", containerClassName: "hidden w-44 md:flex" })}
          {actionSelect({ id: "audit-action", containerClassName: "hidden w-56 md:flex" })}
          {entitySelect({ id: "audit-entity", containerClassName: "hidden w-44 md:flex" })}
        </FilterBar>
      </div>

      {table.filters.entityId ? (
        <Notice
          tone="brand"
          icon={History}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                table.setFilter("entityId", "");
                focusSearch();
              }}
            >
              {t("audit.clearScope")}
            </Button>
          }
        >
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{t("audit.scopedTo")}</span>
            <span className="font-semibold">{auditEntityLabel(table.filters.entityType)}</span>
            <IdCell id={table.filters.entityId} />
          </span>
        </Notice>
      ) : null}

      {error && !data ? (
        <ErrorState
          description={errorMessage(error)}
          onRetry={refetch}
          digest={error instanceof ApiError ? (error.requestId ?? undefined) : undefined}
        />
      ) : (
        <DataTable
          caption={t("audit.caption")}
          columns={columns}
          rows={rows}
          density="compact"
          getRowKey={(log) => log.auditId}
          activeRowKey={detailOpen ? (selected?.auditId ?? null) : null}
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
                  <Button variant="outline" onClick={resetFilters}>
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
        side="right"
        title={selected ? auditActionLabel(selected.actionType) : t("audit.detailTitle")}
        description={selected ? formatThaiDateTime(selected.createdAt) : undefined}
      >
        {selected ? <AuditDetail log={selected} /> : null}
      </Sheet>
    </Page>
  );
}
