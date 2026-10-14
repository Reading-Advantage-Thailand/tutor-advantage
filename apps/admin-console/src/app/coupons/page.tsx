"use client";

import { Ban, CheckCircle2, Pencil, Percent, Plus, Ticket, TicketX } from "lucide-react";
import { useMemo, useState } from "react";
import {
  AdminStatusChip,
  ConfirmDialog,
  CopyButton,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  FilterBar,
  Grid,
  Page,
  PageHeader,
  Pagination,
  SelectField,
  StatCard,
  useAdminSession,
  type DataTableColumn,
} from "@/components/app";
import { toast } from "@/components/app/toastStore";
import { Button } from "@/components/ui/button";
import { useTableState } from "@/hooks/useTableState";
import { api, newIdempotencyKey } from "@/lib/api";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatPercent, formatThaiDate, formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusOptions } from "@/lib/status";
import { couponStatus, type Coupon, type CouponPage } from "./couponForm";
import { CouponFormSheet } from "./components/CouponFormSheet";
import "@/locales/th/coupons";

function TutorCell({ name, fallback }: { name: string | null; fallback: string }) {
  return <span className="block max-w-56 truncate">{name || fallback}</span>;
}

export default function CouponsPage() {
  const me = useAdminSession();
  const table = useTableState({
    filterKeys: ["status"],
    defaultSort: { key: "createdAt", dir: "desc" },
    sortKeys: ["createdAt", "hours", "expiresAt", "code"],
  });
  const resourceKey = me ? `${me.userId}:coupons:${table.queryKey}` : null;
  const { data, error, isLoading, isValidating, refetch } = useCachedResource(
    resourceKey,
    () => api.get<CouponPage>("/v1/coupons", { query: table.apiQuery }),
    { keepPreviousData: true },
  );

  const [form, setForm] = useState<{ open: boolean; coupon: Coupon | null; key: number }>({ open: false, coupon: null, key: 0 });
  const [voidTarget, setVoidTarget] = useState<{ coupon: Coupon; idempotencyKey: string } | null>(null);

  const refreshAll = () => {
    if (me) invalidateResource(`${me.userId}:coupons:`);
  };
  const openCreate = () => setForm((current) => ({ open: true, coupon: null, key: current.key + 1 }));
  const openEdit = (coupon: Coupon) => setForm((current) => ({ open: true, coupon, key: current.key + 1 }));

  const columns = useMemo<DataTableColumn<Coupon>[]>(
    () => [
      {
        key: "code",
        header: t("coupons.colCode"),
        sortable: true,
        sticky: true,
        alwaysVisible: true,
        mobile: "primary",
        cell: (row) => (
          <span className="flex min-w-0 flex-col">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <code className="font-mono text-sm font-semibold tracking-wide text-fg">{row.code}</code>
              <CopyButton value={row.code} label={t("coupons.copyCode")} />
            </span>
            {row.note ? (
              <span className="block max-w-56 truncate text-[0.8125rem] text-fg-muted" title={row.note}>
                {row.note}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        key: "status",
        header: t("coupons.colStatus"),
        mobile: "trailing",
        cell: (row) => <AdminStatusChip domain="coupon" status={couponStatus(row)} />,
      },
      {
        key: "hours",
        header: t("coupons.colHours"),
        align: "right",
        sortable: true,
        mobile: "secondary",
        cell: (row) => <span className="whitespace-nowrap">{t("coupons.hoursValue", { hours: formatNumber(row.hours) })}</span>,
      },
      {
        key: "assigned",
        header: t("coupons.colAssigned"),
        cell: (row) =>
          row.assignedTutorId ? (
            <TutorCell name={row.assignedTutorName} fallback={t("coupons.tutorUnnamed")} />
          ) : (
            <span className="text-fg-muted">{t("coupons.anyTutor")}</span>
          ),
      },
      {
        key: "redeemed",
        header: t("coupons.colRedeemed"),
        cell: (row) =>
          row.redeemedAt ? (
            <span className="flex min-w-0 flex-col">
              <TutorCell name={row.redeemedByTutorName} fallback={t("coupons.tutorUnnamed")} />
              <span className="text-[0.8125rem] text-fg-muted">
                {t("coupons.redeemedOn", { date: formatThaiDate(row.redeemedAt) })}
                {row.redemptionMode === "NEW_CLASS"
                  ? ` · ${t("coupons.modeNewClass")}`
                  : row.redemptionMode === "EXTEND_CLASS"
                    ? ` · ${t("coupons.modeExtendClass")}`
                    : ""}
              </span>
            </span>
          ) : (
            <span className="text-fg-muted">{t("coupons.notRedeemed")}</span>
          ),
      },
      {
        key: "expiresAt",
        header: t("coupons.colExpires"),
        sortable: true,
        cell: (row) => (
          <span className={row.expiresAt ? "whitespace-nowrap" : "whitespace-nowrap text-fg-muted"}>
            {row.expiresAt ? formatThaiDate(row.expiresAt) : t("coupons.noExpiry")}
          </span>
        ),
      },
      {
        key: "createdAt",
        header: t("coupons.colCreated"),
        sortable: true,
        cell: (row) => (
          <span className="whitespace-nowrap" title={formatThaiDateTime(row.createdAt)}>
            {formatThaiDate(row.createdAt)}
          </span>
        ),
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("coupons.colActions")}</span>,
        label: t("coupons.colActions"),
        align: "right",
        alwaysVisible: true,
        cell: (row) =>
          couponStatus(row) === "ACTIVE" ? (
            <span role="group" aria-label={t("coupons.rowActions", { code: row.code })} className="flex flex-wrap justify-end gap-1 md:flex-nowrap">
              <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                <Pencil aria-hidden="true" />
                {t("coupons.editAction")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setVoidTarget({ coupon: row, idempotencyKey: newIdempotencyKey() })}
              >
                <Ban aria-hidden="true" />
                {t("coupons.voidAction")}
              </Button>
            </span>
          ) : null,
      },
    ],
    [],
  );

  const summary = data?.summary;
  const pagination = data?.pagination;
  const rows = data?.coupons ?? [];
  const voidCoupon = voidTarget?.coupon;

  return (
    <Page>
      <PageHeader
        title={t("coupons.pageTitle")}
        description={t("coupons.pageDescription")}
        actions={
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" />
            {t("coupons.createAction")}
          </Button>
        }
      />

      <Grid cols={4} className="grid-cols-2">
        <StatCard
          label={t("coupons.statActive")}
          value={summary ? formatNumber(summary.byStatus.ACTIVE.count) : "–"}
          icon={Ticket}
          tone="brand"
          hint={summary ? t("coupons.statActiveHint", { hours: formatNumber(summary.byStatus.ACTIVE.hours) }) : undefined}
        />
        <StatCard
          label={t("coupons.statRedeemed")}
          value={summary ? formatNumber(summary.byStatus.REDEEMED.count) : "–"}
          icon={CheckCircle2}
          tone="blue"
          hint={summary ? t("coupons.statRedeemedHint", { hours: formatNumber(summary.byStatus.REDEEMED.hours) }) : undefined}
        />
        <StatCard
          label={t("coupons.statRate")}
          value={summary ? formatPercent(summary.redemptionRate) : "–"}
          icon={Percent}
          tone="teal"
          hint={
            summary
              ? t("coupons.statRateHint", { count: formatNumber(summary.total - summary.byStatus.VOID.count) })
              : undefined
          }
        />
        <StatCard
          label={t("coupons.statVoidExpired")}
          value={summary ? formatNumber(summary.byStatus.VOID.count + summary.byStatus.EXPIRED.count) : "–"}
          icon={TicketX}
          tone="neutral"
          hint={
            summary
              ? t("coupons.statVoidExpiredHint", {
                  void: formatNumber(summary.byStatus.VOID.count),
                  expired: formatNumber(summary.byStatus.EXPIRED.count),
                })
              : undefined
          }
        />
      </Grid>

      <div className="flex flex-col gap-3">
        <FilterBar
          search={{ value: table.searchValue, onValueChange: table.setSearchValue, placeholder: t("coupons.searchPlaceholder") }}
          isFiltered={table.isFiltered}
          onReset={table.reset}
        >
          <SelectField
            aria-label={t("coupons.statusFilterLabel")}
            containerClassName="w-full sm:w-44"
            value={table.filters.status ?? ""}
            onChange={(event) => table.setFilter("status", event.target.value)}
            options={statusOptions("coupon", { all: t("coupons.allStatus") })}
          />
        </FilterBar>

        {error && !data ? (
          <ErrorState onRetry={refetch} />
        ) : (
          <DataTable
            caption={t("coupons.listTitle")}
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.couponId}
            loading={isLoading || isValidating}
            sort={table.sort}
            onSortChange={table.toggleSort}
            empty={
              table.isFiltered ? (
                <EmptyState
                  compact
                  icon={Ticket}
                  title={t("coupons.emptyFilteredTitle")}
                  description={t("coupons.emptyFilteredDescription")}
                  action={
                    <Button variant="outline" onClick={table.reset}>
                      {t("shell.clearFilters")}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Ticket}
                  title={t("coupons.emptyTitle")}
                  description={t("coupons.emptyFirstDescription")}
                  action={
                    <Button onClick={openCreate}>
                      <Plus aria-hidden="true" />
                      {t("coupons.createAction")}
                    </Button>
                  }
                />
              )
            }
            footer={
              pagination && pagination.total > 0 ? (
                <Pagination
                  page={table.page}
                  pageSize={table.pageSize}
                  total={pagination.total}
                  onPageChange={table.setPage}
                  onPageSizeChange={table.setPageSize}
                />
              ) : null
            }
          />
        )}
      </div>

      <CouponFormSheet
        key={form.key}
        open={form.open}
        coupon={form.coupon}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        onSaved={(saved) => {
          if (form.coupon) toast.success(t("coupons.editSuccess", { code: saved.code }));
          refreshAll();
        }}
      />

      <ConfirmDialog
        open={Boolean(voidTarget)}
        onOpenChange={(open) => {
          if (!open) setVoidTarget(null);
        }}
        tone="danger"
        title={voidCoupon ? t("coupons.voidTitle", { code: voidCoupon.code }) : ""}
        description={t("coupons.voidDescription")}
        irreversible
        details={
          voidCoupon ? (
            <DescriptionList
              columns={2}
              items={[
                { label: t("coupons.detailHours"), value: t("coupons.hoursValue", { hours: formatNumber(voidCoupon.hours) }) },
                {
                  label: t("coupons.detailAssigned"),
                  value: voidCoupon.assignedTutorId
                    ? voidCoupon.assignedTutorName || t("coupons.tutorUnnamed")
                    : t("coupons.anyTutor"),
                },
                {
                  label: t("coupons.detailExpires"),
                  value: voidCoupon.expiresAt ? formatThaiDate(voidCoupon.expiresAt) : t("coupons.noExpiry"),
                },
              ]}
            />
          ) : null
        }
        reason={{ label: t("coupons.voidReasonLabel"), placeholder: t("coupons.voidReasonPlaceholder"), minLength: 5 }}
        confirmLabel={t("coupons.voidConfirm")}
        cancelLabel={t("coupons.voidKeep")}
        onConfirm={async ({ reason }) => {
          if (!voidTarget) return;
          await api.post(
            `/v1/coupons/${voidTarget.coupon.couponId}/void`,
            { reason },
            { idempotencyKey: voidTarget.idempotencyKey },
          );
          toast.success(t("coupons.voidSuccess", { code: voidTarget.coupon.code }));
          refreshAll();
        }}
      />
    </Page>
  );
}
