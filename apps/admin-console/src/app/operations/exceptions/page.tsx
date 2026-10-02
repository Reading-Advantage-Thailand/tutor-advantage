"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, CircleCheck, CircleSlash, ReceiptText, Zap } from "lucide-react";
import {
  AdminStatusChip,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  FilterBar,
  Money,
  Notice,
  Page,
  PageHeader,
  Pagination,
  SegmentedControl,
  SelectField,
  useAdminSession,
  type DataTableColumn,
} from "@/components/app";
import { useRefreshAdminSummary } from "@/components/app/adminSummaryContext";
import { toast } from "@/components/app/toastStore";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { useTableState } from "@/hooks/useTableState";
import { api, newIdempotencyKey } from "@/lib/api";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { formatThaiDateTime } from "@/lib/format";
import { t, type I18nKey } from "@/lib/i18n";
import { statusLabel, statusOptions } from "@/lib/status";
import "@/locales/th/operations";

type Resolution = "ACTIVATE_ENROLLMENT" | "MARK_RESOLVED" | "DISMISS";

interface ExceptionRow {
  id: string;
  type: string;
  studentUserId: string | null;
  studentName: string | null;
  classId: string | null;
  provider: string | null;
  amountMinor: number | null;
  status: "UNRESOLVED" | "RESOLVED" | "VOIDED" | string;
  createdAt: string;
  updatedAt: string;
  errorDetail: string;
  context: {
    enrollmentId: string | null;
    enrollmentStatus: string | null;
    classTitle: string | null;
    successfulPaymentId: string | null;
    payment: { paymentIntentId: string; status: string; amountMinor: number; providerRef: string | null } | null;
  } | null;
  canActivateEnrollment: boolean;
  lastAction: {
    action: string;
    resolution: string | null;
    note: string | null;
    actorId: string;
    actorName: string | null;
    at: string;
  } | null;
}

interface ExceptionsResponse {
  exceptions: ExceptionRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<string, number>;
  typeCounts: Record<string, number>;
}

type StatusTab = "UNRESOLVED" | "RESOLVED" | "VOIDED" | "ALL";

const RESOLUTION_COPY: Record<Resolution, { title: I18nKey; description: I18nKey; confirm: I18nKey; toast: I18nKey }> = {
  ACTIVATE_ENROLLMENT: {
    title: "operations.confirm.activateTitle",
    description: "operations.confirm.activateDescription",
    confirm: "operations.confirm.activateConfirm",
    toast: "operations.toast.activated",
  },
  MARK_RESOLVED: {
    title: "operations.confirm.resolveTitle",
    description: "operations.confirm.resolveDescription",
    confirm: "operations.confirm.resolveConfirm",
    toast: "operations.toast.resolved",
  },
  DISMISS: {
    title: "operations.confirm.dismissTitle",
    description: "operations.confirm.dismissDescription",
    confirm: "operations.confirm.dismissConfirm",
    toast: "operations.toast.dismissed",
  },
};

function resolutionLabel(row: ExceptionRow) {
  const r = row.lastAction?.resolution;
  if (r === "ACTIVATE_ENROLLMENT" || r === "MARK_RESOLVED" || r === "DISMISS") return t(`operations.resolutions.${r}`);
  return t("operations.resolutions.LEGACY");
}

export default function ExceptionsPage() {
  const me = useAdminSession();
  const refreshSummary = useRefreshAdminSummary();
  const table = useTableState({
    defaultSort: { key: "createdAt", dir: "desc" },
    sortKeys: ["createdAt"],
    filterKeys: ["status", "type"],
    defaultFilters: { status: "UNRESOLVED" },
  });
  const [pending, setPending] = useState<{ row: ExceptionRow; resolution: Resolution; key: string } | null>(null);
  const status = (["UNRESOLVED", "RESOLVED", "VOIDED", "ALL"].includes(table.filters.status) ? table.filters.status : "ALL") as StatusTab;

  const query = {
    status,
    type: table.filters.type || undefined,
    q: table.q || undefined,
    page: table.page,
    pageSize: table.pageSize,
    order: table.sort?.dir,
  };
  const { data, error, isLoading, isValidating, isPreviousData, refetch } = useCachedResource(
    me ? `${me.userId}:exceptions:${JSON.stringify(query)}` : null,
    () => api.get<ExceptionsResponse>("/v1/operations/exceptions", { query }),
    { keepPreviousData: true },
  );
  const counts = data?.counts ?? {};
  const totalAll = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const statusItems = (["UNRESOLVED", "RESOLVED", "VOIDED", "ALL"] as const).map((value) => ({
    value,
    label: t(`operations.statusTabs.${value}`),
    count: data ? (value === "ALL" ? totalAll : (counts[value] ?? 0)) : undefined,
  }));

  const columns: DataTableColumn<ExceptionRow>[] = useMemo(
    () => [
      {
        key: "type",
        header: t("operations.columns.type"),
        label: t("operations.columns.type"),
        alwaysVisible: true,
        mobile: "primary",
        cell: (row) => (
          <div className="flex min-w-0 flex-col items-start gap-1">
            <AdminStatusChip domain="exceptionType" status={row.type} />
            <span className="line-clamp-2 text-[0.8125rem] text-fg-muted" title={row.errorDetail}>
              {row.errorDetail || "–"}
            </span>
          </div>
        ),
      },
      {
        key: "createdAt",
        header: t("operations.columns.createdAt"),
        sortable: true,
        mobile: "secondary",
        cell: (row) => <span className="whitespace-nowrap">{formatThaiDateTime(row.createdAt)}</span>,
      },
      {
        key: "student",
        header: t("operations.columns.student"),
        label: t("operations.columns.student"),
        cell: (row) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-fg">{row.studentName ?? t("operations.noStudent")}</span>
            {row.context?.classTitle ? (
              <span className="truncate text-[0.8125rem] text-fg-muted">{row.context.classTitle}</span>
            ) : null}
          </div>
        ),
      },
      {
        key: "amount",
        header: t("operations.columns.amount"),
        align: "right",
        cell: (row) => (row.amountMinor != null ? <Money satang={row.amountMinor} /> : <span className="text-fg-subtle">–</span>),
      },
      {
        key: "payment",
        header: t("operations.columns.payment"),
        label: t("operations.columns.payment"),
        cell: (row) => {
          if (!row.context) return <span className="text-fg-subtle">–</span>;
          return (
            <div className="flex flex-wrap items-center gap-1">
              {row.context.payment ? (
                <AdminStatusChip domain="payment" status={row.context.payment.status} />
              ) : (
                <span className="text-[0.8125rem] text-fg-muted">{t("operations.noPayment")}</span>
              )}
              {row.context.enrollmentStatus ? (
                <AdminStatusChip domain="enrollment" status={row.context.enrollmentStatus} />
              ) : (
                <span className="text-[0.8125rem] text-fg-muted">{t("operations.noEnrollment")}</span>
              )}
            </div>
          );
        },
      },
      {
        key: "status",
        header: t("operations.columns.status"),
        label: t("operations.columns.status"),
        mobile: "trailing",
        cell: (row) => <AdminStatusChip domain="exception" status={row.status} />,
      },
      {
        key: "outcome",
        header: t("operations.columns.outcome"),
        label: t("operations.columns.outcome"),
        cell: (row) =>
          row.status !== "UNRESOLVED" ? (
            <div className="flex min-w-0 flex-col">
              <span className="text-fg">{resolutionLabel(row)}</span>
              {row.lastAction?.note ? (
                <span className="line-clamp-2 text-[0.8125rem] text-fg-muted">{row.lastAction.note}</span>
              ) : null}
              {row.lastAction ? (
                <span className="text-[0.8125rem] text-fg-subtle">
                  {t("operations.closedBy", {
                    name: row.lastAction.actorName ?? t("operations.unknownActor"),
                    date: formatThaiDateTime(row.lastAction.at),
                  })}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-fg-subtle">–</span>
          ),
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("operations.columns.actions")}</span>,
        label: t("operations.columns.actions"),
        alwaysVisible: true,
        align: "right",
        cell: (row) => (
          <div className="flex flex-wrap justify-start gap-1.5 md:justify-end lg:flex-nowrap">
            {row.status === "UNRESOLVED" && row.canActivateEnrollment ? (
              <Button size="sm" onClick={() => setPending({ row, resolution: "ACTIVATE_ENROLLMENT", key: newIdempotencyKey() })}>
                <Zap aria-hidden="true" />
                {t("operations.actions.activate")}
              </Button>
            ) : null}
            {row.status === "UNRESOLVED" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPending({ row, resolution: "MARK_RESOLVED", key: newIdempotencyKey() })}
                >
                  <CircleCheck aria-hidden="true" />
                  {t("operations.actions.resolve")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPending({ row, resolution: "DISMISS", key: newIdempotencyKey() })}>
                  <CircleSlash aria-hidden="true" />
                  {t("operations.actions.dismiss")}
                </Button>
              </>
            ) : null}
            {row.studentUserId || row.type === "ORPHAN_PAYMENT_EVENT" ? (
              <Link
                href={
                  row.studentUserId
                    ? `/reconciliation?q=${encodeURIComponent(row.studentUserId)}&issue=ALL&days=180`
                    : "/reconciliation?view=orphans"
                }
                className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
                aria-label={t("operations.actions.viewPayments")}
                title={t("operations.actions.viewPayments")}
              >
                <ReceiptText aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        ),
      },
    ],
    [],
  );

  const onConfirm = async ({ reason }: { reason: string }) => {
    if (!pending) return;
    const result = await api.post<{ changed: boolean }>(
      `/v1/operations/exceptions/${pending.row.id}/resolve`,
      { resolution: pending.resolution, note: reason },
      { idempotencyKey: pending.key },
    );
    toast.success(result.changed ? t(RESOLUTION_COPY[pending.resolution].toast) : t("operations.toast.unchanged"));
    if (me) {
      invalidateResource(`${me.userId}:exceptions:`);
      if (pending.resolution === "ACTIVATE_ENROLLMENT") invalidateResource(`${me.userId}:recon:`);
    }
    void refreshSummary();
  };

  const target = pending?.row;
  const copy = pending ? RESOLUTION_COPY[pending.resolution] : null;
  const typeOptions = [
    { value: "", label: t("operations.filters.typeAll") },
    ...statusOptions("exceptionType"),
    ...Object.keys(data?.typeCounts ?? {})
      .filter((type) => !statusOptions("exceptionType").some((o) => o.value === type))
      .map((type) => ({ value: type, label: statusLabel("exceptionType", type) })),
  ];
  const isFiltered = table.q !== "" || Boolean(table.filters.type) || status !== "UNRESOLVED";

  return (
    <Page>
      <PageHeader
        title={t("operations.page.title")}
        description={t("operations.page.description")}
        actions={
          <Link href="/reconciliation" className={buttonVariants({ variant: "outline" })}>
            <ReceiptText aria-hidden="true" />
            {t("operations.page.openReconciliation")}
          </Link>
        }
      />

      <SegmentedControl
        aria-label={t("operations.statusTabs.label")}
        className="hidden sm:inline-flex sm:w-auto"
        value={status}
        onValueChange={(next) => table.setFilter("status", next)}
        items={statusItems}
      />
      <SelectField
        aria-label={t("operations.statusTabs.label")}
        containerClassName="w-full sm:hidden"
        value={status}
        onChange={(event) => table.setFilter("status", event.target.value)}
        options={statusItems.map((item) => ({
          value: item.value,
          label: item.count === undefined ? item.label : `${item.label} (${item.count})`,
        }))}
      />

      <FilterBar
        search={{ value: table.searchValue, onValueChange: table.setSearchValue, placeholder: t("operations.filters.search") }}
        isFiltered={isFiltered}
        onReset={table.reset}
      >
        <SelectField
          aria-label={t("operations.filters.type")}
          containerClassName="w-full sm:w-56"
          value={table.filters.type ?? ""}
          onChange={(event) => table.setFilter("type", event.target.value)}
          options={typeOptions}
        />
      </FilterBar>

      {error && !data ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          caption={t("operations.page.title")}
          rows={data?.exceptions ?? []}
          columns={columns}
          getRowKey={(row) => row.id}
          loading={isLoading || (isValidating && isPreviousData)}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={
            <EmptyState
              compact
              icon={CheckCircle2}
              tone="teal"
              title={isFiltered ? t("operations.empty.filteredTitle") : t("operations.empty.unresolvedTitle")}
              description={isFiltered ? t("operations.empty.filteredDescription") : t("operations.empty.unresolvedDescription")}
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

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        tone={pending?.resolution === "DISMISS" ? "danger" : "brand"}
        title={copy ? t(copy.title) : ""}
        description={copy ? t(copy.description) : undefined}
        confirmLabel={copy ? t(copy.confirm) : ""}
        reason={{ label: t("operations.confirm.noteLabel"), placeholder: t("operations.confirm.notePlaceholder") }}
        details={
          target ? (
            <DescriptionList
              columns={2}
              items={[
                { label: t("operations.columns.type"), value: statusLabel("exceptionType", target.type) },
                { label: t("operations.columns.student"), value: target.studentName ?? t("operations.noStudent") },
                {
                  label: t("operations.columns.amount"),
                  value: target.amountMinor != null ? <Money satang={target.amountMinor} /> : "–",
                },
                {
                  label: t("operations.columns.payment"),
                  value: target.context?.payment ? statusLabel("payment", target.context.payment.status) : t("operations.noPayment"),
                },
                { label: t("operations.columns.detail"), value: target.errorDetail || "–", wide: true },
              ]}
            />
          ) : null
        }
        onConfirm={onConfirm}
      >
        {target?.type === "REFUND_REQUESTED" && pending?.resolution === "MARK_RESOLVED" ? (
          <Notice tone="warning">{t("operations.confirm.refundNotice")}</Notice>
        ) : null}
        {pending?.resolution !== "ACTIVATE_ENROLLMENT" && target?.context && !target.context.successfulPaymentId ? (
          <Notice tone="info">{t("operations.confirm.noPaymentNotice")}</Notice>
        ) : null}
      </ConfirmDialog>
    </Page>
  );
}
