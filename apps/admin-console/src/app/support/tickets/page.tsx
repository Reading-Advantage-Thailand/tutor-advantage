"use client";

import { useMemo } from "react";
import { AlarmClock, CheckCircle2 } from "lucide-react";
import {
  AdminStatusChip,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  Page,
  PageHeader,
  Pagination,
  SegmentedControl,
  SelectField,
  useAdminSession,
  type DataTableColumn,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { useTableState } from "@/hooks/useTableState";
import { api } from "@/lib/api";
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
        key: "number",
        header: t("tickets.columns.number"),
        label: t("tickets.columns.number"),
        alwaysVisible: true,
        mobile: "secondary",
        cell: (row) => <span className="font-semibold whitespace-nowrap text-fg tabular-nums">{formatTicketNumber(row.ticketNumber)}</span>,
      },
      {
        key: "subject",
        header: t("tickets.columns.subject"),
        label: t("tickets.columns.subject"),
        alwaysVisible: true,
        mobile: "primary",
        cell: (row) => (
          <div className="flex min-w-0 flex-col items-start gap-1">
            <span className="line-clamp-2 font-medium text-fg" title={row.subject}>
              {row.subject}
            </span>
            {row.awaitingSupport && row.status !== "RESOLVED" ? (
              <span className="inline-flex items-center gap-1 text-[0.8125rem] text-warning-fg">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                {t("tickets.awaitingSupport")}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: "category",
        header: t("tickets.columns.category"),
        label: t("tickets.columns.category"),
        cell: (row) => <AdminStatusChip domain="ticketCategory" status={row.category} />,
      },
      {
        key: "requester",
        header: t("tickets.columns.requester"),
        label: t("tickets.columns.requester"),
        cell: (row) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-fg">{row.requester.displayName || t("tickets.noName")}</span>
            <span className="truncate text-[0.8125rem] text-fg-muted">{statusLabel("userRole", row.requester.role)}</span>
          </div>
        ),
      },
      {
        key: "status",
        header: t("tickets.columns.status"),
        label: t("tickets.columns.status"),
        mobile: "trailing",
        cell: (row) => <AdminStatusChip domain="ticket" status={row.status} />,
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
            <span className="truncate text-fg">{row.assignee.displayName || t("tickets.noName")}</span>
          ) : (
            <span className="text-fg-subtle">{t("tickets.unassigned")}</span>
          ),
      },
      {
        key: "lastActivity",
        header: t("tickets.columns.lastActivity"),
        label: t("tickets.columns.lastActivity"),
        align: "right",
        cell: (row) => (
          <span className="whitespace-nowrap text-fg-muted" title={formatThaiDateTime(row.lastMessageAt)}>
            {formatListTimestamp(row.lastMessageAt)}
          </span>
        ),
      },
    ],
    [],
  );

  const filtered = isQueueFiltered(query);
  const overdueOn = query.overdue === "true";
  const overdueCount = data?.counts.overdue;
  const categoryOptions = statusOptions("ticketCategory", { all: t("tickets.filters.categoryAll") });
  const assigneeOptions = [
    { value: "", label: t("tickets.filters.assigneeAll") },
    { value: "me", label: t("tickets.filters.assigneeMe") },
    { value: "unassigned", label: t("tickets.filters.assigneeUnassigned") },
  ];

  return (
    <Page>
      <PageHeader title={t("tickets.page.title")} description={t("tickets.page.description")} />

      <SegmentedControl
        aria-label={t("tickets.statusTabs.label")}
        className="hidden sm:inline-flex sm:w-auto"
        value={query.status}
        onValueChange={(next) => table.setFilter("status", next)}
        items={statusItems}
      />
      <SelectField
        aria-label={t("tickets.statusTabs.label")}
        containerClassName="w-full sm:hidden"
        value={query.status}
        onChange={(event) => table.setFilter("status", event.target.value)}
        options={statusItems.map((item) => ({
          value: item.value,
          label: item.count === undefined ? item.label : `${item.label} (${item.count})`,
        }))}
      />

      <FilterBar
        search={{ value: table.searchValue, onValueChange: table.setSearchValue, placeholder: t("tickets.filters.search") }}
        isFiltered={filtered}
        onReset={table.reset}
      >
        <SelectField
          aria-label={t("tickets.filters.category")}
          containerClassName="w-full sm:w-56"
          value={query.category ?? ""}
          onChange={(event) => table.setFilter("category", event.target.value)}
          options={categoryOptions}
        />
        <SelectField
          aria-label={t("tickets.filters.assignee")}
          containerClassName="w-full sm:w-52"
          value={query.assignee ?? ""}
          onChange={(event) => table.setFilter("assignee", event.target.value)}
          options={assigneeOptions}
        />
        <Button
          variant={overdueOn ? "destructive" : "outline"}
          aria-pressed={overdueOn}
          onClick={() => table.setFilter("overdue", overdueOn ? "" : "true")}
        >
          <AlarmClock aria-hidden="true" />
          {overdueCount === undefined
            ? t("tickets.filters.overdue")
            : t("tickets.filters.overdueCount", { count: overdueCount })}
        </Button>
      </FilterBar>

      {error && !data ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          caption={t("tickets.page.title")}
          rows={data?.tickets ?? []}
          columns={columns}
          getRowKey={(row) => row.ticketId}
          rowHref={(row) => `/support/tickets/${encodeURIComponent(row.ticketId)}`}
          loading={isLoading || (isValidating && isPreviousData)}
          empty={
            <EmptyState
              compact
              icon={CheckCircle2}
              tone="teal"
              title={filtered ? t("tickets.empty.filteredTitle") : t("tickets.empty.activeTitle")}
              description={filtered ? t("tickets.empty.filteredDescription") : t("tickets.empty.activeDescription")}
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
