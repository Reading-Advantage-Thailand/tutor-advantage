"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Link2, XCircle } from "lucide-react";
import {
  AdminStatusChip,
  Chip,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  FilterBar,
  IdCell,
  Money,
  Notice,
  Pagination,
  SelectField,
  useAdminSession,
  type DataTableColumn,
} from "@/components/app";
import { toast } from "@/components/app/Toast";
import { Button } from "@/components/ui/button";
import type { UseTableStateResult } from "@/hooks/useTableState";
import { api, newIdempotencyKey } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import type { OrphanEvent, Paged } from "../types";

type Pending = { kind: "link" | "dismiss"; row: OrphanEvent; key: string } | null;

export function OrphanEventsView({ table, onMutated }: { table: UseTableStateResult; onMutated: () => void }) {
  const me = useAdminSession();
  const [pending, setPending] = useState<Pending>(null);
  const state = table.filters.state || "OPEN";
  const query = {
    state,
    page: table.page,
    pageSize: table.pageSize,
    q: table.q || undefined,
    order: table.sort?.dir,
  };
  const { data, error, isLoading, isValidating, isPreviousData, refetch } = useCachedResource(
    me ? `${me.userId}:recon:orphans:${JSON.stringify(query)}` : null,
    () => api.get<Paged<OrphanEvent>>("/v1/reconciliation/orphan-events", { query }),
    { keepPreviousData: true },
  );

  const columns: DataTableColumn<OrphanEvent>[] = useMemo(
    () => [
      {
        key: "chargeId",
        header: t("reconciliation.columns.chargeId"),
        label: t("reconciliation.columns.chargeId"),
        alwaysVisible: true,
        mobile: "primary",
        cell: (row) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-mono text-[0.8125rem] text-fg">{row.chargeId ?? "–"}</span>
            <span className="truncate text-[0.8125rem] text-fg-muted">{row.eventType}</span>
          </div>
        ),
      },
      {
        key: "createdAt",
        header: t("reconciliation.columns.receivedAt"),
        sortable: true,
        mobile: "secondary",
        cell: (row) => <span className="whitespace-nowrap">{formatThaiDateTime(row.createdAt)}</span>,
      },
      {
        key: "chargeStatus",
        header: t("reconciliation.columns.chargeStatus"),
        label: t("reconciliation.columns.chargeStatus"),
        mobile: "trailing",
        cell: (row) =>
          row.chargeStatus ? (
            <Chip size="sm" dot tone={row.chargeStatus === "successful" ? "success" : row.chargeStatus === "failed" ? "danger" : "neutral"}>
              {row.chargeStatus === "successful"
                ? statusLabel("payment", "SUCCESS")
                : row.chargeStatus === "failed"
                  ? statusLabel("payment", "FAILED")
                  : row.chargeStatus}
            </Chip>
          ) : (
            <span className="text-fg-subtle">–</span>
          ),
      },
      {
        key: "amount",
        header: t("reconciliation.columns.amount"),
        align: "right",
        cell: (row) => (row.amountMinor != null ? <Money satang={row.amountMinor} /> : <span className="text-fg-subtle">–</span>),
      },
      {
        key: "candidate",
        header: t("reconciliation.columns.candidate"),
        label: t("reconciliation.columns.candidate"),
        cell: (row) =>
          row.candidate ? (
            <div className="flex flex-col items-start gap-1">
              <IdCell id={row.candidate.paymentIntentId} />
              <AdminStatusChip domain="payment" status={row.candidate.status} />
            </div>
          ) : (
            <span className="text-[0.8125rem] text-fg-muted">{t("reconciliation.noCandidate")}</span>
          ),
      },
      {
        key: "review",
        header: t("reconciliation.columns.review"),
        label: t("reconciliation.columns.review"),
        cell: (row) =>
          row.dismissed ? (
            <div className="flex flex-col gap-0.5">
              <Chip size="sm" tone="neutral">
                {t("reconciliation.filters.stateDismissed")}
              </Chip>
              {row.dismissReason ? <span className="text-[0.8125rem] text-fg-muted">{row.dismissReason}</span> : null}
              {row.dismissedAt ? (
                <span className="text-[0.8125rem] text-fg-subtle">{formatThaiDateTime(row.dismissedAt)}</span>
              ) : null}
            </div>
          ) : (
            <Chip size="sm" dot tone="warning">
              {t("reconciliation.filters.stateOpen")}
            </Chip>
          ),
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("reconciliation.columns.actions")}</span>,
        label: t("reconciliation.columns.actions"),
        alwaysVisible: true,
        align: "right",
        cell: (row) =>
          row.dismissed ? null : (
            <div className="flex flex-wrap justify-end gap-1.5">
              {row.candidate ? (
                <Button size="sm" onClick={() => setPending({ kind: "link", row, key: newIdempotencyKey() })}>
                  <Link2 aria-hidden="true" />
                  {t("reconciliation.actions.link")}
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => setPending({ kind: "dismiss", row, key: newIdempotencyKey() })}>
                <XCircle aria-hidden="true" />
                {t("reconciliation.actions.dismiss")}
              </Button>
            </div>
          ),
      },
    ],
    [],
  );

  const target = pending?.row;
  const runAction = async ({ reason }: { reason: string }) => {
    if (!pending) return;
    const { kind, row, key } = pending;
    if (kind === "link" && row.candidate) {
      await api.post(
        `/v1/reconciliation/orphan-events/${row.paymentEventId}/link`,
        { paymentIntentId: row.candidate.paymentIntentId, reason },
        { idempotencyKey: key },
      );
      toast.success(t("reconciliation.toast.linked"));
    } else {
      await api.post(`/v1/reconciliation/orphan-events/${row.paymentEventId}/dismiss`, { reason }, { idempotencyKey: key });
      toast.success(t("reconciliation.toast.dismissed"));
    }
    onMutated();
  };

  return (
    <div className="flex flex-col gap-3">
      <Notice tone="info">{t("reconciliation.orphansNotice")}</Notice>
      <FilterBar
        search={{
          value: table.searchValue,
          onValueChange: table.setSearchValue,
          placeholder: t("reconciliation.filters.searchOrphans"),
        }}
        isFiltered={table.q !== "" || state !== "OPEN"}
        onReset={table.reset}
      >
        <SelectField
          aria-label={t("reconciliation.filters.state")}
          containerClassName="w-full sm:w-44"
          value={state}
          onChange={(event) => table.setFilter("state", event.target.value)}
          options={[
            { value: "OPEN", label: t("reconciliation.filters.stateOpen") },
            { value: "DISMISSED", label: t("reconciliation.filters.stateDismissed") },
            { value: "ALL", label: t("reconciliation.filters.stateAll") },
          ]}
        />
      </FilterBar>
      {error && !data ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          caption={t("reconciliation.views.orphans")}
          rows={data?.items ?? []}
          columns={columns}
          getRowKey={(row) => row.paymentEventId}
          loading={isLoading || (isValidating && isPreviousData)}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={
            <EmptyState
              compact
              icon={CheckCircle2}
              tone="teal"
              title={t("reconciliation.empty.orphansTitle")}
              description={t("reconciliation.empty.orphansDescription")}
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
        tone={pending?.kind === "dismiss" ? "danger" : "brand"}
        title={pending?.kind === "link" ? t("reconciliation.confirm.linkTitle") : t("reconciliation.confirm.dismissTitle")}
        description={
          pending?.kind === "link" ? t("reconciliation.confirm.linkDescription") : t("reconciliation.confirm.dismissDescription")
        }
        details={
          target ? (
            <DescriptionList
              columns={2}
              items={[
                { label: t("reconciliation.columns.chargeId"), value: target.chargeId ?? "–" },
                { label: t("reconciliation.columns.event"), value: target.eventType },
                ...(pending?.kind === "link" && target.candidate
                  ? [
                      { label: t("reconciliation.columns.paymentId"), value: <IdCell id={target.candidate.paymentIntentId} /> },
                      {
                        label: t("reconciliation.columns.paymentStatus"),
                        value: statusLabel("payment", target.candidate.status),
                      },
                    ]
                  : []),
              ]}
            />
          ) : null
        }
        reason={{ label: t("reconciliation.confirm.reasonLabel"), placeholder: t("reconciliation.confirm.reasonPlaceholder") }}
        confirmLabel={pending?.kind === "link" ? t("reconciliation.confirm.linkConfirm") : t("reconciliation.confirm.dismissConfirm")}
        onConfirm={runAction}
      />
    </div>
  );
}
