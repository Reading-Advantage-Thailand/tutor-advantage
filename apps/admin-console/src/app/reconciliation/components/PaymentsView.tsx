"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, SearchCheck, UserRound, Zap } from "lucide-react";
import {
  AdminStatusChip,
  Chip,
  ColumnToggle,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  FilterBar,
  IdCell,
  Money,
  Pagination,
  SelectField,
  useAdminSession,
  useColumnVisibility,
  useHasRole,
  type DataTableColumn,
} from "@/components/app";
import { toast } from "@/components/app/toastStore";
import { Button, buttonVariants } from "@/components/ui/button";
import type { UseTableStateResult } from "@/hooks/useTableState";
import { api, newIdempotencyKey } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatThaiDateTime } from "@/lib/format";
import { t, type I18nKey } from "@/lib/i18n";
import { statusLabel, statusOptions } from "@/lib/status";
import { ISSUE_TONE, ISSUE_TYPES, type IssueType, type PaymentsResponse, type ReconPayment } from "../types";
import "@/locales/th/reconciliation";

type Pending = { kind: "activate" | "verify"; row: ReconPayment; key: string } | null;

const issueLabel = (type: IssueType) => t(`reconciliation.issues.${type}` as I18nKey);
const issueHint = (type: IssueType) => t(`reconciliation.issueHints.${type}` as I18nKey);

function methodLabel(method: string) {
  const key = method.toUpperCase();
  return key === "PROMPTPAY" || key === "CARD" ? t(`reconciliation.methods.${key}` as I18nKey) : method;
}

export function PaymentsView({
  table,
  days,
  onMutated,
}: {
  table: UseTableStateResult;
  days: string;
  onMutated: () => void;
}) {
  const me = useAdminSession();
  const isAdmin = useHasRole("ADMIN");
  const [pending, setPending] = useState<Pending>(null);
  const issue = table.filters.issue ?? "ISSUES";
  const status = table.filters.status ?? "";

  const query = {
    days,
    page: table.page,
    pageSize: table.pageSize,
    issue: issue || "ALL",
    status: status || undefined,
    q: table.q || undefined,
    sort: table.sort?.key,
    order: table.sort?.dir,
  };
  const { data, error, isLoading, isValidating, isPreviousData, refetch } = useCachedResource(
    me ? `${me.userId}:recon:payments:${JSON.stringify(query)}` : null,
    () => api.get<PaymentsResponse>("/v1/reconciliation/payments", { query }),
    { keepPreviousData: true },
  );

  const columns: DataTableColumn<ReconPayment>[] = useMemo(
    () => [
      {
        key: "student",
        header: t("reconciliation.columns.student"),
        alwaysVisible: true,
        mobile: "primary",
        cell: (row) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-fg">
              {row.studentName ?? t("reconciliation.unknownStudent")}
            </span>
            <span className="truncate text-[0.8125rem] text-fg-muted">
              {row.enrollmentPackageId ? t("reconciliation.packageTarget") : (row.classTitle ?? "–")}
            </span>
          </div>
        ),
      },
      {
        key: "createdAt",
        header: t("reconciliation.columns.createdAt"),
        sortable: true,
        mobile: "secondary",
        cell: (row) => <span className="whitespace-nowrap">{formatThaiDateTime(row.createdAt)}</span>,
      },
      {
        key: "amount",
        header: t("reconciliation.columns.amount"),
        align: "right",
        sortable: true,
        mobile: "trailing",
        cell: (row) => <Money satang={row.amountMinor ?? 0} />,
      },
      {
        key: "paymentStatus",
        header: t("reconciliation.columns.paymentStatus"),
        label: t("reconciliation.columns.paymentStatus"),
        cell: (row) => (
          <div className="flex flex-col items-start gap-1">
            <AdminStatusChip domain="payment" status={row.status} />
            <span className="text-[0.8125rem] text-fg-muted">{methodLabel(row.method)}</span>
          </div>
        ),
      },
      {
        key: "enrollmentStatus",
        header: t("reconciliation.columns.enrollmentStatus"),
        label: t("reconciliation.columns.enrollmentStatus"),
        cell: (row) => {
          const value = row.enrollmentPackageId ? row.packageStatus : row.enrollmentStatus;
          return value ? <AdminStatusChip domain="enrollment" status={value} /> : <span className="text-fg-subtle">–</span>;
        },
      },
      {
        key: "issue",
        header: t("reconciliation.columns.issue"),
        label: t("reconciliation.columns.issue"),
        cell: (row) => (
          <Chip size="sm" dot tone={ISSUE_TONE[row.issue.type] ?? "neutral"} title={issueHint(row.issue.type)}>
            {issueLabel(row.issue.type)}
          </Chip>
        ),
      },
      {
        key: "providerRef",
        header: t("reconciliation.columns.providerRef"),
        label: t("reconciliation.columns.providerRef"),
        defaultHidden: true,
        cell: (row) => <IdCell id={row.providerRef} />,
      },
      {
        key: "paymentId",
        header: t("reconciliation.columns.paymentId"),
        label: t("reconciliation.columns.paymentId"),
        defaultHidden: true,
        cell: (row) => <IdCell id={row.paymentIntentId} />,
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("reconciliation.columns.actions")}</span>,
        label: t("reconciliation.columns.actions"),
        alwaysVisible: true,
        align: "right",
        cell: (row) => (
          <div className="flex flex-wrap justify-start gap-1.5 md:justify-end lg:flex-nowrap">
            {row.actions.includes("ACTIVATE_ENROLLMENT") ? (
              <Button
                size="sm"
                variant={row.issue.type === "SUCCESS_NOT_ACTIVE" ? "default" : "outline"}
                onClick={() => setPending({ kind: "activate", row, key: newIdempotencyKey() })}
              >
                <Zap aria-hidden="true" />
                {row.issue.type === "SUCCESS_NOT_ACTIVE" ? t("reconciliation.actions.activate") : t("reconciliation.actions.fillRef")}
              </Button>
            ) : null}
            {row.actions.includes("VERIFY_WITH_PROVIDER") ? (
              <Button size="sm" variant="outline" onClick={() => setPending({ kind: "verify", row, key: newIdempotencyKey() })}>
                <SearchCheck aria-hidden="true" />
                {t("reconciliation.actions.verify")}
              </Button>
            ) : null}
            {isAdmin ? (
              <Link
                href={`/users/${row.studentUserId}`}
                className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
                aria-label={`${t("reconciliation.actions.openUser")} ${row.studentName ?? ""}`}
                title={t("reconciliation.actions.openUser")}
              >
                <UserRound aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        ),
      },
    ],
    [isAdmin],
  );
  const visibility = useColumnVisibility("recon-payments", columns);

  const issueOptions = [
    { value: "ISSUES", label: t("reconciliation.filters.issueOnly") },
    { value: "ALL", label: t("reconciliation.filters.issueAll") },
    ...ISSUE_TYPES.map((type) => ({ value: type, label: issueLabel(type) })),
    { value: "OK", label: issueLabel("OK") },
  ];

  const runAction = async ({ reason }: { reason: string }) => {
    if (!pending) return;
    const { row, kind, key } = pending;
    if (kind === "activate") {
      const result = await api.post<{ changed: boolean }>(
        `/v1/reconciliation/payments/${row.paymentIntentId}/activate`,
        { reason },
        { idempotencyKey: key },
      );
      toast.success(result.changed ? t("reconciliation.toast.activated") : t("reconciliation.toast.alreadyActive"));
    } else {
      const result = await api.post<{ outcome: string }>(
        `/v1/reconciliation/payments/${row.paymentIntentId}/verify`,
        { reason: reason || undefined },
        { idempotencyKey: key },
      );
      const message =
        result.outcome === "CONFIRMED"
          ? t("reconciliation.toast.verifyConfirmed")
          : result.outcome === "MARKED_FAILED"
            ? t("reconciliation.toast.verifyFailed")
            : result.outcome === "DUPLICATE_PAYMENT"
              ? t("reconciliation.toast.verifyDuplicate")
              : t("reconciliation.toast.verifyUnchanged");
      toast.success(message);
    }
    onMutated();
  };

  const target = pending?.row;
  const details = target ? (
    <DescriptionList
      columns={2}
      items={[
        { label: t("reconciliation.columns.student"), value: target.studentName ?? t("reconciliation.unknownStudent") },
        { label: t("reconciliation.columns.amount"), value: <Money satang={target.amountMinor ?? 0} /> },
        {
          label: t("reconciliation.columns.paymentStatus"),
          value: statusLabel("payment", target.status),
        },
        {
          label: t("reconciliation.columns.enrollmentStatus"),
          value: statusLabel("enrollment", target.enrollmentPackageId ? target.packageStatus : target.enrollmentStatus),
        },
        { label: t("reconciliation.columns.providerRef"), value: target.providerRef ?? "–", wide: true },
      ]}
    />
  ) : null;

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        search={{
          value: table.searchValue,
          onValueChange: table.setSearchValue,
          placeholder: t("reconciliation.filters.searchPayments"),
        }}
        isFiltered={table.q !== "" || issue !== "ISSUES" || status !== "" || days !== "30"}
        onReset={table.reset}
        actions={<ColumnToggle columns={columns} hidden={visibility.hidden} onToggle={visibility.toggle} />}
      >
        <SelectField
          aria-label={t("reconciliation.filters.issue")}
          containerClassName="w-full sm:w-52"
          value={issue}
          onChange={(event) => table.setFilter("issue", event.target.value)}
          options={issueOptions}
        />
        <SelectField
          aria-label={t("reconciliation.filters.status")}
          containerClassName="w-full sm:w-40"
          value={status}
          onChange={(event) => table.setFilter("status", event.target.value)}
          options={statusOptions("payment", { all: t("reconciliation.filters.statusAll") }).filter(
            (option) => option.value !== "PAID",
          )}
        />
        <DaysSelect value={days} onChange={(value) => table.setFilter("days", value)} />
      </FilterBar>

      {error && !data ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          caption={t("reconciliation.views.payments")}
          rows={data?.payments ?? []}
          columns={columns}
          getRowKey={(row) => row.paymentIntentId}
          loading={isLoading || (isValidating && isPreviousData)}
          sort={table.sort}
          onSortChange={table.toggleSort}
          hiddenColumns={visibility.hidden}
          empty={
            <EmptyState
              compact
              icon={CheckCircle2}
              tone="teal"
              title={t("reconciliation.empty.paymentsTitle")}
              description={t("reconciliation.empty.paymentsDescription")}
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
        open={pending?.kind === "activate"}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          target?.issue.type === "SUCCESS_NOT_ACTIVE"
            ? t("reconciliation.confirm.activateTitle", { name: target?.studentName ?? t("reconciliation.unknownStudent") })
            : t("reconciliation.confirm.fillRefTitle", { name: target?.studentName ?? t("reconciliation.unknownStudent") })
        }
        description={
          target?.issue.type === "SUCCESS_NOT_ACTIVE"
            ? t("reconciliation.confirm.activateDescription")
            : t("reconciliation.confirm.fillRefDescription")
        }
        details={details}
        reason={{ label: t("reconciliation.confirm.reasonLabel"), placeholder: t("reconciliation.confirm.reasonPlaceholder") }}
        confirmLabel={
          target?.issue.type === "SUCCESS_NOT_ACTIVE" ? t("reconciliation.confirm.activateConfirm") : t("reconciliation.actions.fillRef")
        }
        onConfirm={runAction}
      />
      <ConfirmDialog
        open={pending?.kind === "verify"}
        onOpenChange={(open) => !open && setPending(null)}
        title={t("reconciliation.confirm.verifyTitle")}
        description={t("reconciliation.confirm.verifyDescription")}
        details={details}
        reason={{ label: t("reconciliation.confirm.optionalNote"), required: false }}
        confirmLabel={t("reconciliation.confirm.verifyConfirm")}
        onConfirm={runAction}
      />
    </div>
  );
}

export function DaysSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <SelectField
      aria-label={t("reconciliation.filters.days")}
      containerClassName="w-full sm:w-40"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      options={["7", "30", "90", "180"].map((d) => ({ value: d, label: t("reconciliation.filters.daysOption", { days: d }) }))}
    />
  );
}
