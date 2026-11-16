"use client";

import { useMemo, useRef } from "react";
import { AlarmClock, CheckCircle2, SearchX } from "lucide-react";
import {
  AdminStatusChip,
  ColumnToggle,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  Page,
  PageHeader,
  Pagination,
  SegmentedControl,
  SelectField,
  UserAvatar,
  useAdminSession,
  useColumnVisibility,
  type ActiveFilter,
  type DataTableColumn,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { useTableState } from "@/hooks/useTableState";
import { api, ApiError } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatListTimestamp, formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel, statusOptions } from "@/lib/status";
import {
  buildQueueQuery,
  DEFAULT_STATUS_TAB,
  formatTicketNumber,
  isQueueFiltered,
  STATUS_TABS,
  tabCount,
  ticketsListPrefix,
  type AdminTicketSummary,
  type AdminTicketsResponse,
} from "./ticketModel";
import { DueCell } from "./components/DueCell";
import "@/locales/th/tickets";

export default function TicketQueuePage() {
  const me = useAdminSession();
  const table = useTableState({
    filterKeys: ["status", "category", "assignee", "overdue"],
    defaultFilters: { status: DEFAULT_STATUS_TAB },
  });
  const toolbarRef = useRef<HTMLDivElement>(null);
  // The empty state's "ล้างตัวกรอง" goes away once it has worked: put focus on the search box, not <body>.
  // (FilterBar's own button moves focus by itself.)
  const resetFilters = () => {
    table.reset();
    window.requestAnimationFrame(() => toolbarRef.current?.querySelector<HTMLElement>('input[type="search"]')?.focus());
  };

  const query = buildQueueQuery({
    status: table.filters.status,
    category: table.filters.category,
    assignee: table.filters.assignee,
    overdue: table.filters.overdue,
    q: table.q,
    page: table.page,
    pageSize: table.pageSize,
  });
  const { data, error, isLoading, isValidating, isPreviousData, refetch } = useCachedResource(
    me ? `${ticketsListPrefix(me.userId)}${JSON.stringify(query)}` : null,
    () => api.get<AdminTicketsResponse>("/v1/admin/tickets", { query: { ...query } }),
    { keepPreviousData: true },
  );

  const statusItems = STATUS_TABS.map((value) => ({
    value,
    label: t(`tickets.statusTabs.${value}`),
    count: tabCount(data?.counts, value),
  }));

  const columns: DataTableColumn<AdminTicketSummary>[] = useMemo(
    () => [
      {
        key: "subject",
        header: t("tickets.columns.subject"),
        label: t("tickets.columns.subject"),
        alwaysVisible: true,
        mobile: "primary",
        // Stays in view while the queue scrolls sideways; the whole row stays one link.
        sticky: true,
        cell: (row) => {
          const requester = `${row.requester.displayName || t("tickets.noName")} · ${statusLabel("userRole", row.requester.role)}`;
          return (
            // Identity cell (A2): the requester's avatar, the subject, then "#12 · requester · role".
            <span className="flex min-w-0 items-center gap-2.5">
              <UserAvatar name={row.requester.displayName || t("tickets.noName")} seed={row.requester.userId} size="sm" decorative />
              <span className="flex min-w-0 flex-col">
                {/* Phones: up to two lines; table: one line cut with an ellipsis (full subject in the title and on the detail page). */}
                <span
                  className="line-clamp-2 leading-[1.45] font-medium break-words text-fg md:block md:max-w-64 md:truncate 2xl:max-w-80"
                  title={row.subject}
                >
                  {row.subject}
                </span>
                <span
                  className="line-clamp-2 text-[0.8125rem] leading-[1.45] font-normal break-words text-fg-muted md:block md:max-w-64 md:truncate 2xl:max-w-80"
                  title={requester}
                >
                  <span className="tabular">{formatTicketNumber(row.ticketNumber)}</span> · {requester}
                </span>
              </span>
            </span>
          );
        },
      },
      {
        key: "category",
        header: t("tickets.columns.category"),
        label: t("tickets.columns.category"),
        cell: (row) => <AdminStatusChip domain="ticketCategory" status={row.category} className="max-w-40" />,
      },
      {
        key: "status",
        header: t("tickets.columns.status"),
        label: t("tickets.columns.status"),
        mobile: "trailing",
        cell: (row) => (
          <span className="flex flex-col items-end gap-0.5 md:items-start">
            <AdminStatusChip domain="ticket" status={row.status} />
            {row.awaitingSupport && row.status !== "RESOLVED" ? (
              <span className="inline-flex items-center gap-1 text-[0.8125rem] leading-normal font-normal whitespace-nowrap text-warning-fg">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                {t("tickets.awaitingSupport")}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        key: "due",
        header: t("tickets.columns.due"),
        label: t("tickets.columns.due"),
        cell: (row) => <DueCell ticket={row} />,
      },
      {
        key: "assignee",
        header: t("tickets.columns.assignee"),
        label: t("tickets.columns.assignee"),
        cell: (row) =>
          row.assignee ? (
            <span className="block max-w-36 truncate text-fg" title={row.assignee.displayName ?? undefined}>
              {row.assignee.displayName || t("tickets.noName")}
            </span>
          ) : (
            <span className="whitespace-nowrap text-fg-subtle">{t("tickets.unassigned")}</span>
          ),
      },
      {
        key: "lastActivity",
        header: t("tickets.columns.lastActivity"),
        label: t("tickets.columns.lastActivity"),
        align: "right",
        mobile: "trailing",
        cell: (row) => (
          <span className="text-[0.8125rem] font-normal whitespace-nowrap text-fg-muted md:text-sm" title={formatThaiDateTime(row.lastMessageAt)}>
            {formatListTimestamp(row.lastMessageAt)}
          </span>
        ),
      },
    ],
    [],
  );
  const visibility = useColumnVisibility("support-tickets", columns);

  const filtered = isQueueFiltered(query);
  const overdueOn = query.overdue === "true";
  const overdueCount = data?.counts.overdue;
  const categoryOptions = statusOptions("ticketCategory", { all: t("tickets.filters.categoryAll") });
  const assigneeOptions = [
    { value: "", label: t("tickets.filters.assigneeAll") },
    { value: "me", label: t("tickets.filters.assigneeMe") },
    { value: "unassigned", label: t("tickets.filters.assigneeUnassigned") },
  ];
  const overdueLabel =
    overdueCount === undefined ? t("tickets.filters.overdue") : t("tickets.filters.overdueCount", { count: overdueCount });

  // The same three filters render inline from 768px and inside the phone sheet.
  // Stable ids (not useId): these selects are server-rendered, see sharedRequests on hydration ids.
  const categorySelect = (props: { id: string; label?: string; containerClassName: string }) => (
    <SelectField
      id={props.id}
      aria-label={props.label ? undefined : t("tickets.filters.category")}
      label={props.label}
      containerClassName={props.containerClassName}
      value={query.category ?? ""}
      onChange={(event) => table.setFilter("category", event.target.value)}
      options={categoryOptions}
    />
  );
  const assigneeSelect = (props: { id: string; label?: string; containerClassName: string }) => (
    <SelectField
      id={props.id}
      aria-label={props.label ? undefined : t("tickets.filters.assignee")}
      label={props.label}
      containerClassName={props.containerClassName}
      value={query.assignee ?? ""}
      onChange={(event) => table.setFilter("assignee", event.target.value)}
      options={assigneeOptions}
    />
  );
  const overdueToggle = (className?: string) => (
    <Button
      variant={overdueOn ? "destructive" : "outline"}
      aria-pressed={overdueOn}
      className={className}
      onClick={() => table.setFilter("overdue", overdueOn ? "" : "true")}
    >
      <AlarmClock aria-hidden="true" />
      {overdueLabel}
    </Button>
  );

  const sheetFilters: ActiveFilter[] = [
    ...(query.category
      ? [
          {
            key: "category",
            label: `${t("tickets.filters.category")}: ${statusLabel("ticketCategory", query.category)}`,
            onRemove: () => table.setFilter("category", ""),
          },
        ]
      : []),
    ...(query.assignee
      ? [
          {
            key: "assignee",
            label: `${t("tickets.filters.assignee")}: ${assigneeOptions.find((option) => option.value === query.assignee)?.label ?? ""}`,
            onRemove: () => table.setFilter("assignee", ""),
          },
        ]
      : []),
    ...(overdueOn ? [{ key: "overdue", label: t("tickets.filters.overdue"), onRemove: () => table.setFilter("overdue", "") }] : []),
  ];

  return (
    <Page>
      <PageHeader title={t("tickets.page.title")} description={t("tickets.page.description")} />

      {/* Toolbar, row 1: status count tabs, the overdue quick filter (from 768px), and from 1280px "คอลัมน์" at the right.
          Row 2: search + category + assignee (phones: search + a "ตัวกรอง" sheet), "คอลัมน์" below 1280px, then
          "ล้างตัวกรอง" next to the filters it clears. */}
      <div ref={toolbarRef} className="flex flex-col gap-3">
        <FilterBar
          tabs={
            <SegmentedControl
              aria-label={t("tickets.statusTabs.label")}
              value={query.status}
              onValueChange={(next) => table.setFilter("status", next)}
              items={statusItems}
            />
          }
          actions={
            <ColumnToggle
              id="tickets-columns"
              className="md:hidden xl:block"
              columns={columns}
              hidden={visibility.hidden}
              onToggle={visibility.toggle}
            />
          }
        >
          {overdueToggle("hidden md:inline-flex")}
        </FilterBar>
        <FilterBar
          search={{ value: table.searchValue, onValueChange: table.setSearchValue, placeholder: t("tickets.filters.search") }}
          isFiltered={filtered}
          onReset={table.reset}
          moreFilters={{
            active: sheetFilters,
            onReset: () => table.setFilters({ category: "", assignee: "", overdue: "" }),
            children: (
              <>
                {categorySelect({ id: "tickets-category-sheet", label: t("tickets.filters.category"), containerClassName: "w-full" })}
                {assigneeSelect({ id: "tickets-assignee-sheet", label: t("tickets.filters.assignee"), containerClassName: "w-full" })}
                {overdueToggle("w-full")}
              </>
            ),
          }}
        >
          {categorySelect({ id: "tickets-category", containerClassName: "hidden w-40 md:flex xl:w-52" })}
          {assigneeSelect({ id: "tickets-assignee", containerClassName: "hidden w-40 md:flex xl:w-48" })}
          <ColumnToggle
            id="tickets-columns-narrow"
            className="xl:hidden"
            columns={columns}
            hidden={visibility.hidden}
            onToggle={visibility.toggle}
          />
        </FilterBar>
      </div>

      {error && !data ? (
        <ErrorState onRetry={refetch} digest={error instanceof ApiError ? (error.requestId ?? undefined) : undefined} />
      ) : (
        <DataTable
          caption={t("tickets.page.title")}
          rows={data?.tickets ?? []}
          columns={columns}
          hiddenColumns={visibility.hidden}
          getRowKey={(row) => row.ticketId}
          rowHref={(row) => `/support/tickets/${encodeURIComponent(row.ticketId)}`}
          loading={isLoading || (isValidating && isPreviousData)}
          empty={
            <EmptyState
              icon={filtered ? SearchX : CheckCircle2}
              tone={filtered ? "neutral" : "teal"}
              title={filtered ? t("tickets.empty.filteredTitle") : t("tickets.empty.activeTitle")}
              description={filtered ? t("tickets.empty.filteredDescription") : t("tickets.empty.activeDescription")}
              action={
                filtered ? (
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
              total={data?.total ?? 0}
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
          }
        />
      )}
    </Page>
  );
}
