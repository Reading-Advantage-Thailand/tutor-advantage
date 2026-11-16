"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import { CheckCircle2, UserRound } from "lucide-react";
import {
  AdminStatusChip,
  DataTable,
  EmptyState,
  FilterBar,
  IdCell,
  IdentityCell,
  Notice,
  Pagination,
  useAdminSession,
  useHasRole,
  type DataTableColumn,
} from "@/components/app";
import { Button, buttonVariants } from "@/components/ui/button";
import type { UseTableStateResult } from "@/hooks/useTableState";
import { api } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { focusToolbar, LoadError } from "../../settlements/financeUi";
import type { ActiveWithoutPayment, Paged } from "../types";
import "@/locales/th/reconciliation";

export function ActiveWithoutPaymentView({ table, days }: { table: UseTableStateResult; days: string }) {
  const me = useAdminSession();
  const isAdmin = useHasRole("ADMIN");
  const toolbarRef = useRef<HTMLDivElement>(null);
  const query = { days, page: table.page, pageSize: table.pageSize, q: table.q || undefined, order: table.sort?.dir };
  const { data, error, isLoading, isValidating, isPreviousData, refetch } = useCachedResource(
    me ? `${me.userId}:recon:gaps:${JSON.stringify(query)}` : null,
    () => api.get<Paged<ActiveWithoutPayment>>("/v1/reconciliation/active-without-payment", { query }),
    { keepPreviousData: true },
  );

  const columns: DataTableColumn<ActiveWithoutPayment>[] = useMemo(
    () => [
      {
        key: "student",
        header: t("reconciliation.columns.student"),
        alwaysVisible: true,
        mobile: "primary",
        sticky: true,
        cell: (row) => (
          <IdentityCell
            name={row.studentName ?? t("reconciliation.unknownStudent")}
            seed={row.studentUserId}
            secondary={row.classTitle ?? "–"}
          />
        ),
      },
      {
        key: "createdAt",
        header: t("reconciliation.columns.enrolledAt"),
        sortable: true,
        mobile: "secondary",
        cell: (row) => <span className="whitespace-nowrap tabular">{formatThaiDateTime(row.createdAt)}</span>,
      },
      {
        key: "status",
        header: t("reconciliation.columns.enrollmentStatus"),
        label: t("reconciliation.columns.enrollmentStatus"),
        mobile: "trailing",
        cell: (row) => <AdminStatusChip domain="enrollment" status={row.status} />,
      },
      {
        key: "latestPayment",
        header: t("reconciliation.columns.latestPayment"),
        label: t("reconciliation.columns.latestPayment"),
        cell: (row) =>
          row.latestPaymentStatus ? (
            <AdminStatusChip domain="payment" status={row.latestPaymentStatus} />
          ) : (
            <span className="text-[0.8125rem] whitespace-nowrap text-fg-muted">{t("reconciliation.noPaymentAttempt")}</span>
          ),
      },
      {
        key: "ref",
        header: t("reconciliation.columns.providerRef"),
        label: t("reconciliation.columns.providerRef"),
        cell: (row) => <IdCell id={row.paymentTransactionId} />,
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("reconciliation.columns.actions")}</span>,
        label: t("reconciliation.columns.actions"),
        alwaysVisible: true,
        align: "right",
        mobile: isAdmin ? "field" : "hidden",
        cell: (row) =>
          isAdmin ? (
            <Link
              href={`/users/${row.studentUserId}`}
              className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
              aria-label={`${t("reconciliation.actions.openUser")} ${row.studentName ?? ""}`}
              title={t("reconciliation.actions.openUser")}
            >
              <UserRound aria-hidden="true" />
            </Link>
          ) : null,
      },
    ],
    [isAdmin],
  );

  const isFiltered = table.q !== "" || days !== "30";
  // The empty state's "ล้างตัวกรอง" removes itself: focus goes back to the toolbar.
  // (FilterBar's own button moves focus by itself.)
  const resetFilters = () => {
    table.reset();
    focusToolbar(toolbarRef.current);
  };

  return (
    <div className="flex flex-col gap-3">
      <Notice tone="warning">{t("reconciliation.gapsNotice")}</Notice>
      {/* The period ("days") selector lives in the page header: it also drives the KPI strip. */}
      <div ref={toolbarRef}>
        <FilterBar
          search={{ value: table.searchValue, onValueChange: table.setSearchValue, placeholder: t("reconciliation.filters.searchGaps") }}
          isFiltered={isFiltered}
          onReset={table.reset}
        />
      </div>
      {error && !data ? (
        <LoadError error={error} onRetry={refetch} />
      ) : (
        <DataTable
          caption={t("reconciliation.views.gaps")}
          rows={data?.items ?? []}
          columns={columns}
          getRowKey={(row) => row.enrollmentId}
          loading={isLoading || (isValidating && isPreviousData)}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={
            <EmptyState
              icon={CheckCircle2}
              tone="teal"
              title={t("reconciliation.empty.gapsTitle")}
              description={t("reconciliation.empty.gapsDescription")}
              action={
                isFiltered ? (
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
    </div>
  );
}
