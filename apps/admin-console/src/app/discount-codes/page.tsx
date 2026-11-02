"use client";

import { Ban, CheckCircle2, Plus, TicketPercent, TicketX, UsersRound, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import { api, ApiError, newIdempotencyKey } from "@/lib/api";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatThaiDate, formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusOptions } from "@/lib/status";
import { DiscountCodeFormSheet } from "./components/DiscountCodeFormSheet";
import { RedemptionsSheet } from "./components/RedemptionsSheet";
import {
  isVoidable,
  listQuery,
  readCreateRequest,
  withoutCreateParam,
  type DiscountCode,
  type DiscountCodePage,
} from "./discountCodeForm";
import { adminClassesKey, useClassLookup } from "./useClassLookup";
import "@/locales/th/discountCodes";

function ClassCell({ row }: { row: DiscountCode }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="block max-w-56 truncate text-fg" title={row.classTitle ?? undefined}>
        {row.classTitle ?? t("discountCodes.classUnknown")}
      </span>
      {row.tutorUserId ? (
        <span className="block max-w-56 truncate text-[0.8125rem] text-fg-muted" title={row.tutorEmail ?? undefined}>
          {row.tutorName || row.tutorEmail || t("discountCodes.tutorUnnamed")}
        </span>
      ) : null}
    </span>
  );
}

export default function DiscountCodesPage() {
  const me = useAdminSession();
  const router = useRouter();
  const pathname = usePathname() ?? "/discount-codes";
  const searchParams = useSearchParams();
  const table = useTableState({
    filterKeys: ["status", "classId"],
    defaultSort: { key: "createdAt", dir: "desc" },
    sortKeys: ["createdAt", "expiresAt", "redeemedCount", "code"],
  });
  const resourceKey = me ? `${me.userId}:discount-codes:${table.queryKey}` : null;
  const { data, error, isLoading, isValidating, refetch } = useCachedResource(
    resourceKey,
    () => api.get<DiscountCodePage>("/v1/discount-codes", { query: listQuery(table.apiQuery) }),
    { keepPreviousData: true },
  );

  const classFilter = table.filters.classId ?? "";
  const filteredClass = useClassLookup(classFilter || null);

  const [form, setForm] = useState<{ open: boolean; key: number; classId: string | null }>({ open: false, key: 0, classId: null });
  const [redemptions, setRedemptions] = useState<{ open: boolean; code: DiscountCode | null }>({ open: false, code: null });
  const [voidTarget, setVoidTarget] = useState<{ code: DiscountCode; idempotencyKey: string } | null>(null);

  const refreshAll = () => {
    if (me) invalidateResource(`${me.userId}:discount-codes:`);
  };
  const openCreate = (classId: string | null = null) => setForm((current) => ({ open: true, key: current.key + 1, classId }));

  // "ออกโค้ดส่วนลด" on /classes links here with ?create=1&classId=…: open the
  // sheet once, then drop `create` (keep the class filter) so a reload doesn't reopen it.
  useEffect(() => {
    const request = readCreateRequest(searchParams);
    if (!request) return;
    setForm((current) => ({ open: true, key: current.key + 1, classId: request.classId }));
    const qs = withoutCreateParam(searchParams?.toString() ?? "");
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  const columns = useMemo<DataTableColumn<DiscountCode>[]>(
    () => [
      {
        key: "code",
        header: t("discountCodes.colCode"),
        sortable: true,
        sticky: true,
        alwaysVisible: true,
        mobile: "primary",
        cell: (row) => (
          <span className="flex min-w-0 flex-col">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <code className="font-mono text-sm font-semibold tracking-wide text-fg">{row.code}</code>
              <CopyButton value={row.code} label={t("discountCodes.copyCode")} />
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
        header: t("discountCodes.colStatus"),
        mobile: "trailing",
        cell: (row) => <AdminStatusChip domain="discountCode" status={row.status} />,
      },
      {
        key: "class",
        header: t("discountCodes.colClass"),
        mobile: "secondary",
        cell: (row) => <ClassCell row={row} />,
      },
      {
        key: "redeemedCount",
        header: t("discountCodes.colUsed"),
        align: "right",
        sortable: true,
        cell: (row) => (
          <span className="whitespace-nowrap tabular" title={t("discountCodes.usedHint", { remaining: formatNumber(row.remaining) })}>
            {t("discountCodes.usedValue", { used: formatNumber(row.redeemedCount), max: formatNumber(row.maxRedemptions) })}
          </span>
        ),
      },
      {
        key: "expiresAt",
        header: t("discountCodes.colExpires"),
        sortable: true,
        cell: (row) => (
          <span className={row.expiresAt ? "whitespace-nowrap" : "whitespace-nowrap text-fg-muted"}>
            {row.expiresAt ? formatThaiDate(row.expiresAt) : t("discountCodes.noExpiry")}
          </span>
        ),
      },
      {
        key: "createdAt",
        header: t("discountCodes.colCreated"),
        sortable: true,
        cell: (row) => (
          <span className="flex flex-col whitespace-nowrap" title={formatThaiDateTime(row.createdAt)}>
            <span>{formatThaiDate(row.createdAt)}</span>
            {row.createdByName ? (
              <span className="text-[0.8125rem] text-fg-muted">{t("discountCodes.createdBy", { name: row.createdByName })}</span>
            ) : null}
          </span>
        ),
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("discountCodes.colActions")}</span>,
        label: t("discountCodes.colActions"),
        align: "right",
        alwaysVisible: true,
        cell: (row) => (
          <span role="group" aria-label={t("discountCodes.rowActions", { code: row.code })} className="flex flex-wrap justify-end gap-1 md:flex-nowrap">
            <Button size="sm" variant="ghost" onClick={() => setRedemptions({ open: true, code: row })}>
              <UsersRound aria-hidden="true" />
              {t("discountCodes.redemptionsAction")}
            </Button>
            {isVoidable(row) ? (
              <Button size="sm" variant="destructive" onClick={() => setVoidTarget({ code: row, idempotencyKey: newIdempotencyKey() })}>
                <Ban aria-hidden="true" />
                {t("discountCodes.voidAction")}
              </Button>
            ) : null}
          </span>
        ),
      },
    ],
    [],
  );

  const summary = data?.summary;
  const rows = data?.items ?? [];
  const voidCode = voidTarget?.code;
  const createButton = (
    <Button onClick={() => openCreate(classFilter || null)}>
      <Plus aria-hidden="true" />
      {t("discountCodes.createAction")}
    </Button>
  );

  return (
    <Page>
      <PageHeader title={t("discountCodes.pageTitle")} description={t("discountCodes.pageDescription")} actions={createButton} />

      <Grid cols={4} className="grid-cols-2">
        <StatCard
          label={t("discountCodes.statActive")}
          value={summary ? formatNumber(summary.ACTIVE) : "–"}
          icon={TicketPercent}
          tone="brand"
          hint={summary ? t("discountCodes.statActiveHint", { total: formatNumber(summary.total) }) : undefined}
        />
        <StatCard
          label={t("discountCodes.statUsedUp")}
          value={summary ? formatNumber(summary.USED_UP) : "–"}
          icon={CheckCircle2}
          tone="blue"
          hint={summary ? t("discountCodes.statUsedUpHint") : undefined}
        />
        <StatCard
          label={t("discountCodes.statRedemptions")}
          value={summary ? formatNumber(summary.redemptions) : "–"}
          icon={UsersRound}
          tone="teal"
          hint={summary ? t("discountCodes.statRedemptionsHint") : undefined}
        />
        <StatCard
          label={t("discountCodes.statVoidExpired")}
          value={summary ? formatNumber(summary.VOID + summary.EXPIRED) : "–"}
          icon={TicketX}
          tone="neutral"
          hint={
            summary
              ? t("discountCodes.statVoidExpiredHint", { void: formatNumber(summary.VOID), expired: formatNumber(summary.EXPIRED) })
              : undefined
          }
        />
      </Grid>

      <div className="flex flex-col gap-3">
        <FilterBar
          search={{ value: table.searchValue, onValueChange: table.setSearchValue, placeholder: t("discountCodes.searchPlaceholder") }}
          isFiltered={table.isFiltered}
          onReset={table.reset}
        >
          <SelectField
            aria-label={t("discountCodes.statusFilterLabel")}
            containerClassName="w-full sm:w-44"
            value={table.filters.status ?? ""}
            onChange={(event) => table.setFilter("status", event.target.value)}
            options={statusOptions("discountCode", { all: t("discountCodes.allStatus") })}
          />
          {classFilter ? (
            <span className="inline-flex h-9 max-w-full min-w-0 items-center gap-1 rounded-lg border border-brand-soft-border bg-brand-soft pr-1 pl-3 text-sm font-medium text-brand-fg">
              <span className="truncate">
                {t("discountCodes.classFilter", { title: filteredClass.data?.title ?? t("discountCodes.classFilterSelected") })}
              </span>
              <button
                type="button"
                aria-label={t("discountCodes.classFilterClear")}
                title={t("discountCodes.classFilterClear")}
                onClick={() => table.setFilter("classId", "")}
                className="flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-press"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </span>
          ) : null}
        </FilterBar>

        {error && !data ? (
          <ErrorState onRetry={refetch} />
        ) : (
          <DataTable
            caption={t("discountCodes.listTitle")}
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.discountCodeId}
            loading={isLoading || isValidating}
            sort={table.sort}
            onSortChange={table.toggleSort}
            empty={
              table.isFiltered ? (
                <EmptyState
                  compact
                  icon={TicketPercent}
                  title={t("discountCodes.emptyFilteredTitle")}
                  description={t("discountCodes.emptyFilteredDescription")}
                  action={
                    <>
                      <Button variant="outline" onClick={table.reset}>
                        {t("shell.clearFilters")}
                      </Button>
                      {classFilter ? createButton : null}
                    </>
                  }
                />
              ) : (
                <EmptyState
                  icon={TicketPercent}
                  title={t("discountCodes.emptyTitle")}
                  description={t("discountCodes.emptyFirstDescription")}
                  action={createButton}
                />
              )
            }
            footer={
              data && data.total > 0 ? (
                <Pagination
                  page={table.page}
                  pageSize={table.pageSize}
                  total={data.total}
                  onPageChange={table.setPage}
                  onPageSizeChange={table.setPageSize}
                />
              ) : null
            }
          />
        )}
      </div>

      <DiscountCodeFormSheet
        key={form.key}
        open={form.open}
        initialClassId={form.classId}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        onCreated={() => {
          refreshAll();
          if (me) invalidateResource(adminClassesKey(me.userId));
        }}
      />

      <RedemptionsSheet
        open={redemptions.open}
        code={redemptions.code}
        onOpenChange={(open) => setRedemptions((current) => ({ ...current, open }))}
      />

      <ConfirmDialog
        open={Boolean(voidTarget)}
        onOpenChange={(open) => {
          if (!open) setVoidTarget(null);
        }}
        tone="danger"
        title={voidCode ? t("discountCodes.voidTitle", { code: voidCode.code }) : ""}
        description={t("discountCodes.voidDescription")}
        irreversible
        details={
          voidCode ? (
            <DescriptionList
              columns={2}
              items={[
                { label: t("discountCodes.detailClass"), value: voidCode.classTitle ?? t("discountCodes.classUnknown"), wide: true },
                {
                  label: t("discountCodes.colUsed"),
                  value: t("discountCodes.usedValue", {
                    used: formatNumber(voidCode.redeemedCount),
                    max: formatNumber(voidCode.maxRedemptions),
                  }),
                },
                {
                  label: t("discountCodes.detailExpires"),
                  value: voidCode.expiresAt ? formatThaiDate(voidCode.expiresAt) : t("discountCodes.noExpiry"),
                },
              ]}
            />
          ) : null
        }
        reason={{ label: t("discountCodes.voidReasonLabel"), placeholder: t("discountCodes.voidReasonPlaceholder"), minLength: 5 }}
        confirmLabel={t("discountCodes.voidConfirm")}
        cancelLabel={t("discountCodes.voidKeep")}
        onConfirm={async ({ reason }) => {
          if (!voidTarget) return;
          try {
            await api.post(
              `/v1/discount-codes/${voidTarget.code.discountCodeId}/void`,
              { reason },
              { idempotencyKey: voidTarget.idempotencyKey },
            );
          } catch (err) {
            // The shared CANNOT_VOID message talks about coupons.
            if (err instanceof ApiError && err.code === "CANNOT_VOID") {
              refreshAll();
              throw new Error(t("discountCodes.voidCannot"));
            }
            throw err;
          }
          toast.success(t("discountCodes.voidSuccess", { code: voidTarget.code.code }));
          refreshAll();
        }}
      />
    </Page>
  );
}
