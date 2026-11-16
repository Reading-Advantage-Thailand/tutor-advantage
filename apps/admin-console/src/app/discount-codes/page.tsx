"use client";

import { Ban, CheckCircle2, Pencil, Plus, TicketPercent, TicketX, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdminStatusChip,
  ColumnToggle,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  FilterBar,
  KpiStrip,
  Money,
  Page,
  PageHeader,
  Pagination,
  SegmentedControl,
  StatCard,
  useAdminSession,
  useColumnVisibility,
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
import { CELL_CLAMP } from "../classes/components/cellText";
import { focusSearchIn, rescueFocusTo } from "../classes/components/focusRescue";
import { RowAction, RowActions, RowActionSlot } from "../classes/components/RowAction";
import { CodeCell } from "../coupons/components/CodeCell";
import { DiscountCodeFormSheet } from "./components/DiscountCodeFormSheet";
import { OfflinePaidSheet } from "./components/OfflinePaidSheet";
import { RedemptionsSheet } from "./components/RedemptionsSheet";
import {
  canEditOfflinePaid,
  isVoidable,
  latestRedeemer,
  listQuery,
  offlinePaidOf,
  readCreateRequest,
  redeemerLabel,
  withoutCreateParam,
  type DiscountCode,
  type DiscountCodePage,
  type DiscountCodeStatus,
} from "./discountCodeForm";
import { adminClassesKey, useClassLookup } from "./useClassLookup";
import "@/locales/th/discountCodes";

function ClassCell({ row }: { row: DiscountCode }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className={`max-w-44 font-medium text-fg ${CELL_CLAMP}`} title={row.classTitle ?? undefined}>
        {row.classTitle ?? t("discountCodes.classUnknown")}
      </span>
      {row.tutorUserId ? (
        <span className={`max-w-44 text-[0.8125rem] text-fg-muted ${CELL_CLAMP}`} title={row.tutorEmail ?? undefined}>
          {row.tutorName || row.tutorEmail || t("discountCodes.tutorUnnamed")}
        </span>
      ) : null}
    </span>
  );
}

/** "ใช้โดย": newest student who used the code (link to the user) + when; "+n คน" opens the full list. */
function RedeemedByCell({ row, onShowAll }: { row: DiscountCode; onShowAll: () => void }) {
  const { latest, others } = latestRedeemer(row);
  if (!latest) {
    // redeemedCount > 0 without redeemers only while an older finance version is deployed.
    return (
      <span className="whitespace-nowrap text-fg-muted">{row.redeemedCount > 0 ? "–" : t("discountCodes.redeemersNone")}</span>
    );
  }
  const contact = [latest.studentEmail, latest.studentPhone].filter(Boolean).join(" · ");
  const othersCount = formatNumber(others);
  return (
    <span className="flex min-w-0 flex-col">
      <span className="flex min-w-0 items-center gap-1.5">
        {/* Touch: the ::after grows the hit area to 44px tall without moving the text. */}
        <Link
          href={`/users/${encodeURIComponent(latest.studentUserId)}`}
          className="relative block max-w-48 min-w-0 text-fg hover:underline pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-3"
          title={contact || undefined}
        >
          <span className={CELL_CLAMP}>{redeemerLabel(latest) ?? t("discountCodes.redeemerUnknown")}</span>
        </Link>
        {others > 0 ? (
          <Button
            size="xs"
            variant="soft"
            className="shrink-0"
            aria-label={t("discountCodes.redeemersMoreLabel", { code: row.code, count: othersCount })}
            onClick={onShowAll}
          >
            {t("discountCodes.redeemersMore", { count: othersCount })}
          </Button>
        ) : null}
      </span>
      <span className="text-[0.8125rem] whitespace-nowrap text-fg-muted tabular">{formatThaiDateTime(latest.redeemedAt)}</span>
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
  // Kept after closing so the sheet can animate out; `key` resets its field per opening.
  const [amountTarget, setAmountTarget] = useState<{ open: boolean; key: number; code: DiscountCode | null }>({
    open: false,
    key: 0,
    code: null,
  });

  const refreshAll = () => {
    if (me) invalidateResource(`${me.userId}:discount-codes:`);
  };
  const openCreate = (classId: string | null = null) => setForm((current) => ({ open: true, key: current.key + 1, classId }));
  // The empty state's "ล้างตัวกรอง" and the class chip remove themselves: focus goes to the search
  // box, not <body>. (FilterBar's own "ล้างตัวกรอง" moves focus by itself.)
  const toolbarRef = useRef<HTMLDivElement>(null);
  const resetFilters = () => {
    table.reset();
    focusSearchIn(toolbarRef.current);
  };

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
        cell: (row) => <CodeCell id={row.discountCodeId} code={row.code} note={row.note} copyLabel={t("discountCodes.copyCode")} />,
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
        key: "offlinePaid",
        header: t("discountCodes.colOfflinePaid"),
        align: "right",
        cell: (row) => {
          const amount = offlinePaidOf(row);
          return amount > 0 ? (
            <Money satang={amount} />
          ) : (
            <span className="whitespace-nowrap text-fg-muted">{t("discountCodes.offlinePaidFree")}</span>
          );
        },
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
        key: "redeemedBy",
        header: t("discountCodes.colRedeemedBy"),
        cell: (row) => <RedeemedByCell row={row} onShowAll={() => setRedemptions({ open: true, code: row })} />,
      },
      {
        key: "expiresAt",
        header: t("discountCodes.colExpires"),
        sortable: true,
        cell: (row) => (
          <span className={row.expiresAt ? "whitespace-nowrap tabular" : "whitespace-nowrap text-fg-muted"}>
            {row.expiresAt ? formatThaiDate(row.expiresAt) : t("discountCodes.noExpiry")}
          </span>
        ),
      },
      {
        key: "createdAt",
        header: t("discountCodes.colCreated"),
        sortable: true,
        cell: (row) => (
          <span className="flex min-w-0 flex-col" title={formatThaiDateTime(row.createdAt)}>
            <span className="whitespace-nowrap tabular">{formatThaiDate(row.createdAt)}</span>
            {row.createdByName ? (
              <span
                className={`max-w-40 text-[0.8125rem] text-fg-muted ${CELL_CLAMP}`}
                title={t("discountCodes.createdBy", { name: row.createdByName })}
              >
                {t("discountCodes.createdBy", { name: row.createdByName })}
              </span>
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
        // Phones: a full-width row of labelled buttons at the bottom of the card.
        mobile: "actions",
        // Fixed slots in the table: a missing optional action leaves an empty slot, so each
        // icon sits in the same place on every row.
        cell: (row) => (
          <RowActions label={t("discountCodes.rowActions", { code: row.code })}>
            <RowAction icon={UsersRound} label={t("discountCodes.redemptionsAction")} onClick={() => setRedemptions({ open: true, code: row })} />
            {canEditOfflinePaid(row) ? (
              <RowAction
                icon={Pencil}
                label={t("discountCodes.editOfflinePaidAction")}
                onClick={() => setAmountTarget((current) => ({ open: true, key: current.key + 1, code: row }))}
              />
            ) : (
              <RowActionSlot />
            )}
            {isVoidable(row) ? (
              <RowAction
                icon={Ban}
                danger
                label={t("discountCodes.voidAction")}
                onClick={() => setVoidTarget({ code: row, idempotencyKey: newIdempotencyKey() })}
              />
            ) : (
              <RowActionSlot />
            )}
          </RowActions>
        ),
      },
    ],
    [],
  );
  const visibility = useColumnVisibility("discount-codes", columns);

  const summary = data?.summary;
  const tabCounts = classFilter || table.q.trim() ? undefined : summary;
  const rows = data?.items ?? [];
  const voidCode = voidTarget?.code;
  const createButton = (
    <Button onClick={() => openCreate(classFilter || null)}>
      <Plus aria-hidden="true" />
      {t("discountCodes.createAction")}
    </Button>
  );
  // In the empty states: the header keeps the page's one primary, this is its tonal echo.
  const createButtonTonal = (
    <Button variant="tonal" onClick={() => openCreate(classFilter || null)}>
      <Plus aria-hidden="true" />
      {t("discountCodes.createAction")}
    </Button>
  );

  return (
    <Page>
      <PageHeader title={t("discountCodes.pageTitle")} description={t("discountCodes.pageDescription")} actions={createButton} />

      <KpiStrip aria-label={t("discountCodes.statsLabel")}>
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
      </KpiStrip>

      <div className="flex flex-col gap-3">
        <div ref={toolbarRef} className="flex flex-col gap-3">
          <FilterBar
            tabs={
              // Count tabs drive the same `status` filter the select did. Their counts are over
              // all codes (the summary ignores the filters), so they hide while the class filter
              // or a search narrows the list: the tabs still filter, without numbers it doesn't match.
              <SegmentedControl<string>
                aria-label={t("discountCodes.statusFilterLabel")}
                value={table.filters.status ?? ""}
                onValueChange={(value) => table.setFilter("status", value)}
                items={[
                  { value: "", label: t("discountCodes.tabAll"), count: tabCounts?.total },
                  ...statusOptions("discountCode").map((option) => ({
                    value: option.value,
                    label: option.label,
                    count: tabCounts?.[option.value as DiscountCodeStatus],
                  })),
                ]}
              />
            }
            search={{ value: table.searchValue, onValueChange: table.setSearchValue, placeholder: t("discountCodes.searchPlaceholder") }}
            isFiltered={table.isFiltered}
            onReset={table.reset}
            actions={<ColumnToggle id="discount-codes-columns" columns={columns} hidden={visibility.hidden} onToggle={visibility.toggle} />}
          />
          {classFilter ? (
            // Active filters as removable chips under the toolbar (patterns.md A2).
            <div role="group" aria-label={t("discountCodes.activeFilters")} className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 max-w-full min-w-0 items-center gap-1 rounded-full border border-brand-soft-border bg-brand-soft pr-1 pl-3 text-[0.8125rem] font-medium text-brand-soft-fg pointer-coarse:h-11 pointer-coarse:pr-0">
                <span className="truncate" title={filteredClass.data?.title ?? undefined}>
                  {t("discountCodes.classFilter", { title: filteredClass.data?.title ?? t("discountCodes.classFilterSelected") })}
                </span>
                <button
                  type="button"
                  aria-label={t("discountCodes.classFilterClear")}
                  title={t("discountCodes.classFilterClear")}
                  onClick={() => {
                    table.setFilter("classId", "");
                    focusSearchIn(toolbarRef.current);
                  }}
                  className="relative flex size-6 shrink-0 items-center justify-center rounded-full after:absolute after:-inset-1.5 hover:bg-brand-soft-border pointer-coarse:size-11 pointer-coarse:after:inset-0"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </span>
            </div>
          ) : null}
        </div>

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
            hiddenColumns={visibility.hidden}
            empty={
              table.isFiltered ? (
                <EmptyState
                  icon={TicketPercent}
                  title={t("discountCodes.emptyFilteredTitle")}
                  description={t("discountCodes.emptyFilteredDescription")}
                  action={
                    <>
                      <Button variant="outline" onClick={resetFilters}>
                        {t("shell.clearFilters")}
                      </Button>
                      {classFilter ? createButtonTonal : null}
                    </>
                  }
                />
              ) : (
                <EmptyState
                  icon={TicketPercent}
                  tone="brand"
                  title={t("discountCodes.emptyTitle")}
                  description={t("discountCodes.emptyFirstDescription")}
                  action={createButtonTonal}
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

      {/* Keys differ per sheet: both count openings from 1 and sit side by side. */}
      <DiscountCodeFormSheet
        key={`create-${form.key}`}
        open={form.open}
        initialClassId={form.classId}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
        onCreated={() => {
          refreshAll();
          if (me) invalidateResource(adminClassesKey(me.userId));
        }}
      />

      {amountTarget.code ? (
        <OfflinePaidSheet
          key={`amount-${amountTarget.key}`}
          open={amountTarget.open}
          code={amountTarget.code}
          onOpenChange={(open) => setAmountTarget((current) => ({ ...current, open }))}
          onChanged={refreshAll}
        />
      ) : null}

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
          // The row loses its void button once the list refreshes: keep focus in that row.
          rescueFocusTo(voidTarget.code.discountCodeId);
          refreshAll();
        }}
      />
    </Page>
  );
}
