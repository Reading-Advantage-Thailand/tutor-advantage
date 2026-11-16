"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  CircleCheck,
  CircleSlash,
  ReceiptText,
  RotateCcw,
  TimerOff,
  TriangleAlert,
  Unlink,
  UserX,
  Webhook,
  Zap,
} from "lucide-react";
import {
  AdminStatusChip,
  ColumnToggle,
  DataTable,
  DescriptionList,
  EmptyState,
  FilterBar,
  IconTile,
  Money,
  Notice,
  Page,
  PageHeader,
  Pagination,
  SegmentedControl,
  SelectField,
  toneToTile,
  useAdminSession,
  useColumnVisibility,
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
import { statusLabel, statusOptions, statusToneFor } from "@/lib/status";
import { keepThaiWords } from "@/lib/thaiText";
import { DateTimeParts, focusToolbar, LoadError } from "../../settlements/financeUi";
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

/** Leading icon per case type (the tile carries the type's tone; the word is next to it). */
const TYPE_ICON: Record<string, LucideIcon> = {
  PAYMENT_WEBHOOK_MISMATCH: Webhook,
  WEBHOOK_FAILED: Webhook,
  ORPHAN_PAYMENT_EVENT: Unlink,
  ENROLLMENT_ACTIVATION_FAILED: UserX,
  ENROLLMENT_MISMATCH: UserX,
  REFUND_REQUESTED: RotateCcw,
  PAYMENT_TIMEOUT: TimerOff,
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
  const toolbarRef = useRef<HTMLDivElement>(null);
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
        sticky: true,
        // Tile + type name (wraps, so phone cards show it whole) + the error detail on up to two lines.
        cell: (row) => (
          <span className="flex min-w-0 items-start gap-2.5 md:max-w-80">
            <IconTile
              icon={TYPE_ICON[row.type] ?? TriangleAlert}
              tone={toneToTile[statusToneFor("exceptionType", row.type)]}
              size="sm"
            />
            <span className="flex min-w-0 flex-col md:min-w-32">
              <span className="text-sm leading-[1.6] font-medium text-balance text-fg">{statusLabel("exceptionType", row.type)}</span>
              <span className="line-clamp-2 text-[0.8125rem] leading-[1.6] font-normal break-words text-fg-muted" title={row.errorDetail || undefined}>
                {row.errorDetail || "–"}
              </span>
            </span>
          </span>
        ),
      },
      {
        key: "createdAt",
        header: t("operations.columns.createdAt"),
        sortable: true,
        mobile: "secondary",
        // Date over time in the table (the spare width goes to the case type); one wrapping line in phone cards.
        cell: (row) => (
          <span className="tabular md:flex md:flex-col">
            <DateTimeParts at={row.createdAt} />
          </span>
        ),
      },
      {
        key: "student",
        header: t("operations.columns.student"),
        label: t("operations.columns.student"),
        cell: (row) => (
          <div className="flex max-w-56 min-w-0 flex-col">
            <span className="truncate text-fg" title={row.studentName ?? undefined}>
              {row.studentName ?? t("operations.noStudent")}
            </span>
            {row.context?.classTitle ? (
              <span className="truncate text-[0.8125rem] text-fg-muted" title={row.context.classTitle}>
                {row.context.classTitle}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: "amount",
        header: t("operations.columns.amount"),
        align: "right",
        cell: (row) => (row.amountMinor != null ? <Money satang={row.amountMinor} fractionDigits={2} /> : <span className="text-fg-subtle">–</span>),
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
                <span className="text-[0.8125rem] whitespace-nowrap text-fg-muted">{t("operations.noPayment")}</span>
              )}
              {row.context.enrollmentStatus ? (
                <AdminStatusChip domain="enrollment" status={row.context.enrollmentStatus} />
              ) : (
                <span className="text-[0.8125rem] whitespace-nowrap text-fg-muted">{t("operations.noEnrollment")}</span>
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
            <div className="flex max-w-60 min-w-36 flex-col">
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
        // Phones: a full-width row at the bottom of the card, not a half-width field.
        mobile: "actions",
        cell: (row) => (
          // From 1400px the case buttons sit on one line (the column is wide enough for two; a third wraps).
          <div className="flex flex-wrap justify-start gap-1.5 md:justify-end min-[1400px]:min-w-[12.5rem]">
            {row.status === "UNRESOLVED" && row.canActivateEnrollment ? (
              <Button size="sm" variant="tonal" onClick={() => setPending({ row, resolution: "ACTIVATE_ENROLLMENT", key: newIdempotencyKey() })}>
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
  const visibility = useColumnVisibility("operations-exceptions", columns);
  // The empty state's "ล้างตัวกรอง" removes itself: focus goes back to the toolbar.
  // (FilterBar's own button moves focus by itself.)
  const resetFilters = () => {
    table.reset();
    focusToolbar(toolbarRef.current);
  };

  // The type filter: inline from 768px, in the "ตัวกรอง" sheet on phones (patterns.md A2).
  const typeSelect = (props: { id: string; label?: string; containerClassName: string }) => (
    <SelectField
      id={props.id}
      aria-label={props.label ? undefined : t("operations.filters.type")}
      label={props.label}
      containerClassName={props.containerClassName}
      value={table.filters.type ?? ""}
      onChange={(event) => table.setFilter("type", event.target.value)}
      options={typeOptions}
    />
  );

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

      {/* Count-tab toolbar (A2): status tabs with counts → search → type → columns. */}
      <div ref={toolbarRef}>
        <FilterBar
          tabs={
            <SegmentedControl
              aria-label={t("operations.statusTabs.label")}
              value={status}
              onValueChange={(next) => table.setFilter("status", next)}
              items={statusItems}
            />
          }
          search={{ value: table.searchValue, onValueChange: table.setSearchValue, placeholder: t("operations.filters.search") }}
          isFiltered={isFiltered}
          onReset={table.reset}
          actions={<ColumnToggle id="exceptions-columns" columns={columns} hidden={visibility.hidden} onToggle={visibility.toggle} />}
          moreFilters={{
            active: table.filters.type
              ? [
                  {
                    key: "type",
                    label: `${t("operations.filters.type")}: ${typeOptions.find((option) => option.value === table.filters.type)?.label ?? table.filters.type}`,
                    onRemove: () => table.setFilter("type", ""),
                  },
                ]
              : [],
            onReset: () => table.setFilter("type", ""),
            children: typeSelect({ id: "exceptions-type-sheet", label: t("operations.filters.type"), containerClassName: "w-full" }),
          }}
        >
          {typeSelect({ id: "exceptions-type", containerClassName: "hidden md:flex md:w-48" })}
        </FilterBar>
      </div>

      {error && !data ? (
        <LoadError error={error} onRetry={refetch} />
      ) : (
        <DataTable
          caption={t("operations.page.title")}
          rows={data?.exceptions ?? []}
          columns={columns}
          getRowKey={(row) => row.id}
          hiddenColumns={visibility.hidden}
          loading={isLoading || (isValidating && isPreviousData)}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={
            <EmptyState
              icon={CheckCircle2}
              tone="teal"
              title={isFiltered ? t("operations.empty.filteredTitle") : t("operations.empty.unresolvedTitle")}
              description={isFiltered ? t("operations.empty.filteredDescription") : t("operations.empty.unresolvedDescription")}
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
                { label: t("operations.columns.type"), value: keepThaiWords(statusLabel("exceptionType", target.type)) },
                { label: t("operations.columns.student"), value: target.studentName ?? t("operations.noStudent") },
                {
                  label: t("operations.columns.amount"),
                  value: target.amountMinor != null ? <Money satang={target.amountMinor} fractionDigits={2} className="font-semibold" /> : "–",
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
