"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Link2, TriangleAlert, XCircle } from "lucide-react";
import {
  AdminStatusChip,
  Chip,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  EmptyState,
  FilterBar,
  IdCell,
  Money,
  Notice,
  Pagination,
  SelectField,
  useAdminSession,
  type DataTableColumn,
} from "@/components/app";
import { toast } from "@/components/app/toastStore";
import { Button } from "@/components/ui/button";
import type { UseTableStateResult } from "@/hooks/useTableState";
import { api, newIdempotencyKey } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatSatang, formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import { focusToolbar, LoadError } from "../../settlements/financeUi";
import type { OrphanEvent, Paged } from "../types";
import "@/locales/th/reconciliation";

type Pending = { kind: "link" | "dismiss"; row: OrphanEvent; key: string } | null;

export function OrphanEventsView({ table, onMutated }: { table: UseTableStateResult; onMutated: () => void }) {
  const me = useAdminSession();
  const [pending, setPending] = useState<Pending>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
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
        sticky: true,
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
        cell: (row) => <span className="whitespace-nowrap tabular">{formatThaiDateTime(row.createdAt)}</span>,
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
        cell: (row) => (row.amountMinor != null ? <Money satang={row.amountMinor} fractionDigits={2} /> : <span className="text-fg-subtle">–</span>),
      },
      {
        key: "candidate",
        header: t("reconciliation.columns.candidate"),
        label: t("reconciliation.columns.candidate"),
        cell: (row) =>
          row.candidate ? (
            <div className="flex flex-col items-start gap-1">
              <IdCell id={row.candidate.paymentIntentId} />
              <span className="flex flex-wrap items-center gap-1.5">
                <AdminStatusChip domain="payment" status={row.candidate.status} />
                <AmountMismatch event={row.amountMinor} candidate={row.candidate.amountMinor} />
              </span>
            </div>
          ) : (
            <span className="text-[0.8125rem] whitespace-nowrap text-fg-muted">{t("reconciliation.noCandidate")}</span>
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
        // Phones: a full-width row at the bottom of the card, not a half-width field.
        mobile: "actions",
        cell: (row) =>
          row.dismissed ? null : (
            <div className="flex flex-wrap justify-end gap-1.5">
              {row.candidate ? (
                <Button size="sm" variant="tonal" onClick={() => setPending({ kind: "link", row, key: newIdempotencyKey() })}>
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

  const isFiltered = table.q !== "" || state !== "OPEN";
  // The empty state's "ล้างตัวกรอง" removes itself: focus goes back to the toolbar.
  // (FilterBar's own button moves focus by itself.)
  const resetFilters = () => {
    table.reset();
    focusToolbar(toolbarRef.current);
  };
  const stateOptions = [
    { value: "OPEN", label: t("reconciliation.filters.stateOpen") },
    { value: "DISMISSED", label: t("reconciliation.filters.stateDismissed") },
    { value: "ALL", label: t("reconciliation.filters.stateAll") },
  ];
  // The state filter: inline from 768px, in the "ตัวกรอง" sheet on phones (patterns.md A2).
  const stateSelect = (props: { id: string; label?: string; containerClassName: string }) => (
    <SelectField
      id={props.id}
      aria-label={props.label ? undefined : t("reconciliation.filters.state")}
      label={props.label}
      containerClassName={props.containerClassName}
      value={state}
      onChange={(event) => table.setFilter("state", event.target.value)}
      options={stateOptions}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <Notice tone="info">{t("reconciliation.orphansNotice")}</Notice>
      <div ref={toolbarRef}>
        <FilterBar
          search={{
            value: table.searchValue,
            onValueChange: table.setSearchValue,
            placeholder: t("reconciliation.filters.searchOrphans"),
          }}
          isFiltered={isFiltered}
          onReset={table.reset}
          moreFilters={{
            active:
              state !== "OPEN"
                ? [
                    {
                      key: "state",
                      label: `${t("reconciliation.filters.state")}: ${stateOptions.find((option) => option.value === state)?.label ?? state}`,
                      onRemove: () => table.setFilter("state", "OPEN"),
                    },
                  ]
                : [],
            onReset: () => table.setFilter("state", "OPEN"),
            children: stateSelect({ id: "recon-state-sheet", label: t("reconciliation.filters.state"), containerClassName: "w-full" }),
          }}
        >
          {stateSelect({ id: "recon-state", containerClassName: "hidden md:flex md:w-44" })}
        </FilterBar>
      </div>
      {error && !data ? (
        <LoadError error={error} onRetry={refetch} />
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
              icon={CheckCircle2}
              tone="teal"
              title={t("reconciliation.empty.orphansTitle")}
              description={t("reconciliation.empty.orphansDescription")}
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

/**
 * The webhook amount differs from the matching payment: a warning chip plus
 * "ต่างกัน ฿X" in --warning-fg (patterns.md A5: never colour alone).
 */
function AmountMismatch({ event, candidate }: { event: number | null; candidate: number | null }) {
  if (event == null || candidate == null || event === candidate) return null;
  return (
    <>
      <Chip size="sm" tone="warning" icon={TriangleAlert}>
        {t("reconciliation.amountMismatch")}
      </Chip>
      <span className="text-[0.8125rem] font-medium whitespace-nowrap text-warning-fg tabular">
        {t("reconciliation.amountDiff", { amount: formatSatang(Math.abs(event - candidate), { fractionDigits: 2 }) })}
      </span>
    </>
  );
}
