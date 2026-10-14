"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { LazyCheckbox as Checkbox } from "./LazyCheckbox";
import { t } from "@/lib/i18n";
import type { SortState } from "@/lib/tableState";
import { cn } from "@/lib/utils";
import { TableSkeleton } from "./Skeletons";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  /** Plain-text header for the column menu / mobile labels when `header` is not a string. */
  label?: string;
  cell: (row: T, index: number) => ReactNode;
  align?: "left" | "right" | "center";
  /** CSS width for the desktop column, e.g. "140px" or "30%". */
  width?: string;
  /** Header becomes a sort button; `sortKey` (default `key`) is what goes to the URL/API. */
  sortable?: boolean;
  sortKey?: string;
  /**
   * Where the value goes in the phone card:
   * - "primary": card title (one column; default = first column)
   * - "secondary": line under the title
   * - "trailing": top-right (amount, status chip)
   * - "field" (default): label/value pair in the card body
   * - "hidden": desktop only
   */
  mobile?: "primary" | "secondary" | "trailing" | "field" | "hidden";
  /** Cannot be hidden from the column menu. */
  alwaysVisible?: boolean;
  /** Hidden until the user turns it on in the column menu. */
  defaultHidden?: boolean;
  /** Keep this column visible while the table scrolls sideways (first column only). */
  sticky?: boolean;
  className?: string;
}

export interface DataTableSelection {
  /** Selected row keys (on the current page). */
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  /** Disable the checkbox for some rows (e.g. already processed). */
  isSelectable?: (key: string) => boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  /** Makes each row/card a link (the primary cell becomes a stretched link). */
  rowHref?: (row: T) => string | undefined;
  /** Rendered instead of the table when rows is empty and not loading. */
  empty?: ReactNode;
  /** Shows skeleton rows when there are no rows yet; dims rows while refetching. */
  loading?: boolean;
  /** Accessible table caption (visually hidden). */
  caption?: string;
  /** Below this width rows render as cards (default "md" = 768px). */
  breakpoint?: "md" | "lg";
  /** Row height: "compact" 40px (default, 48px on touch) or "comfortable" 52px. */
  density?: "compact" | "comfortable";
  /** Controlled sort (use useTableState().sort / toggleSort). */
  sort?: SortState | null;
  onSortChange?: (key: string) => void;
  /** Row selection with a header "select page" checkbox. */
  selection?: DataTableSelection;
  /** Keys of hidden columns (use <ColumnToggle> + useColumnVisibility). */
  hiddenColumns?: ReadonlySet<string>;
  /** Bar shown above the table while rows are selected (bulk actions). */
  bulkActions?: (selectedCount: number) => ReactNode;
  /** Scroll the table body inside a max height so the header sticks (long lists). */
  maxHeight?: string;
  /** Content under the table (pagination, totals). */
  footer?: ReactNode;
  className?: string;
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;
const justifyClass = { left: "justify-start", right: "justify-end", center: "justify-center" } as const;

function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  if (dir === "asc") return <ArrowUp aria-hidden="true" className="size-3.5 text-fg" />;
  if (dir === "desc") return <ArrowDown aria-hidden="true" className="size-3.5 text-fg" />;
  return <ChevronsUpDown aria-hidden="true" className="size-3.5 opacity-50" />;
}

/**
 * Admin data table: real <table> on md+ (sticky header, sortable headers,
 * selection, column visibility, horizontal scroll with an optional sticky
 * first column) that collapses to cards on phones. Cells are render
 * functions so formatting stays in the page. Pagination/sort/filter are
 * server-driven via useTableState(); pass `footer={<Pagination …/>}`.
 *
 * @example
 * const table = useTableState({ defaultSort: { key: "createdAt", dir: "desc" } });
 * <DataTable caption="คูปอง" rows={data.items} getRowKey={(c) => c.couponId}
 *   sort={table.sort} onSortChange={table.toggleSort} loading={isValidating}
 *   columns={[
 *     { key: "code", header: "รหัส", cell: (c) => c.code, mobile: "primary", sticky: true },
 *     { key: "hours", header: "ชั่วโมง", align: "right", sortable: true, cell: (c) => formatNumber(c.hours) },
 *     { key: "status", header: "สถานะ", cell: (c) => <AdminStatusChip domain="coupon" status={c.status} />, mobile: "trailing" },
 *   ]}
 *   footer={<Pagination page={table.page} pageSize={table.pageSize} total={data.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />}
 * />
 */
export function DataTable<T>({
  columns: allColumns,
  rows,
  getRowKey,
  rowHref,
  empty,
  loading = false,
  caption,
  breakpoint = "md",
  density = "compact",
  sort,
  onSortChange,
  selection,
  hiddenColumns,
  bulkActions,
  maxHeight,
  footer,
  className,
}: DataTableProps<T>) {
  const columns = useMemo(
    () => allColumns.filter((column) => !hiddenColumns?.has(column.key)),
    [allColumns, hiddenColumns],
  );
  const keys = useMemo(() => rows.map((row, index) => getRowKey(row, index)), [rows, getRowKey]);

  if (rows.length === 0 && loading) {
    return <TableSkeleton rows={6} columns={Math.min(columns.length, 6)} className={className} />;
  }
  if (rows.length === 0 && empty) return <>{empty}</>;

  const primaryIndex = Math.max(0, columns.findIndex((column) => column.mobile === "primary"));
  const primary = columns[primaryIndex];
  const secondary = columns.filter((column) => column.mobile === "secondary");
  const trailing = columns.filter((column) => column.mobile === "trailing");
  const fields = columns.filter((column, index) => index !== primaryIndex && (column.mobile ?? "field") === "field");
  const tableVisible = breakpoint === "md" ? "hidden md:block" : "hidden lg:block";
  const cardsVisible = breakpoint === "md" ? "md:hidden" : "lg:hidden";

  const selectableKeys = selection ? keys.filter((key) => selection.isSelectable?.(key) ?? true) : [];
  const selectedOnPage = selection ? selectableKeys.filter((key) => selection.selected.has(key)).length : 0;
  const allSelected = selectableKeys.length > 0 && selectedOnPage === selectableKeys.length;
  const someSelected = selectedOnPage > 0 && !allSelected;
  const toggleAll = () => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (allSelected) selectableKeys.forEach((key) => next.delete(key));
    else selectableKeys.forEach((key) => next.add(key));
    selection.onChange(next);
  };
  const toggleRow = (key: string) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    selection.onChange(next);
  };
  const selectedCount = selection?.selected.size ?? 0;
  const labelOf = (column: DataTableColumn<T>) => column.label ?? (typeof column.header === "string" ? column.header : column.key);

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)} aria-busy={loading || undefined}>
      {bulkActions && selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-soft-border bg-brand-soft px-3 py-2 text-sm text-brand-fg">
          <span className="font-medium">{t("shell.selectedCount", { count: selectedCount })}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {bulkActions(selectedCount)}
            <button
              type="button"
              onClick={() => selection?.onChange(new Set())}
              className="rounded-md px-2 py-1 text-sm font-medium hover:bg-press"
            >
              {t("shell.clearSelection")}
            </button>
          </div>
        </div>
      ) : null}

      {/* Desktop / tablet table */}
      <div className={cn(tableVisible, "overflow-hidden rounded-xl border border-hairline bg-surface shadow-card")}>
        <div
          className={cn("overflow-x-auto transition-opacity", loading && "opacity-60")}
          style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
        >
          <table className="data-table" data-density={density}>
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <thead>
              <tr>
                {selection ? (
                  <th scope="col" className="w-10 !pr-0">
                    <Checkbox
                      aria-label={t("shell.selectAll")}
                      checked={allSelected}
                      indeterminate={someSelected}
                      disabled={selectableKeys.length === 0}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                ) : null}
                {columns.map((column, columnIndex) => {
                  const sortKey = column.sortKey ?? column.key;
                  const dir = sort?.key === sortKey ? sort.dir : null;
                  const sticky = column.sticky && columnIndex === 0 && !selection;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      style={column.width ? { width: column.width } : undefined}
                      data-sticky-col={sticky ? "" : undefined}
                      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : column.sortable ? "none" : undefined}
                      className={cn(alignClass[column.align ?? "left"])}
                    >
                      {column.sortable && onSortChange ? (
                        <button
                          type="button"
                          onClick={() => onSortChange(sortKey)}
                          className={cn(
                            "-mx-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 hover:bg-press hover:text-fg",
                            dir && "text-fg",
                            justifyClass[column.align ?? "left"],
                          )}
                          title={dir === "asc" ? t("shell.sortDescending") : t("shell.sortAscending")}
                        >
                          {column.align === "right" ? <SortIcon dir={dir} /> : null}
                          {column.header}
                          {column.align !== "right" ? <SortIcon dir={dir} /> : null}
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
                {rowHref ? <th aria-hidden="true" className="w-8" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const key = keys[rowIndex];
                const href = rowHref?.(row);
                const isSelected = selection?.selected.has(key) ?? false;
                return (
                  <tr
                    key={key}
                    className="relative"
                    data-interactive={href ? "" : undefined}
                    data-selected={isSelected ? "" : undefined}
                  >
                    {selection ? (
                      <td className="w-10 !pr-0">
                        <Checkbox
                          aria-label={t("shell.selectRow")}
                          checked={isSelected}
                          disabled={!(selection.isSelectable?.(key) ?? true)}
                          onCheckedChange={() => toggleRow(key)}
                          className="relative z-[1]"
                        />
                      </td>
                    ) : null}
                    {columns.map((column, columnIndex) => {
                      const content = column.cell(row, rowIndex);
                      const sticky = column.sticky && columnIndex === 0 && !selection;
                      return (
                        <td
                          key={column.key}
                          data-sticky-col={sticky ? "" : undefined}
                          className={cn(alignClass[column.align ?? "left"], column.align === "right" && "tabular whitespace-nowrap", column.className)}
                        >
                          {href && columnIndex === primaryIndex ? (
                            <Link href={href} className="font-medium text-fg outline-none after:absolute after:inset-0 focus-visible:underline">
                              {content}
                            </Link>
                          ) : (
                            content
                          )}
                        </td>
                      );
                    })}
                    {href ? (
                      <td className="w-8 pr-3 text-fg-subtle">
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {footer ? <div className="border-t border-hairline px-3 py-2.5">{footer}</div> : null}
      </div>

      {/* Phone cards */}
      <ul className={cn(cardsVisible, "flex flex-col gap-2", loading && "opacity-60")} aria-label={caption}>
        {rows.map((row, rowIndex) => {
          const key = keys[rowIndex];
          const href = rowHref?.(row);
          const isSelected = selection?.selected.has(key) ?? false;
          const inner = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[0.9375rem] font-medium break-words text-fg">{primary?.cell(row, rowIndex)}</div>
                  {secondary.map((column) => (
                    <div key={column.key} className="mt-0.5 text-[0.8125rem] text-fg-muted">
                      {column.cell(row, rowIndex)}
                    </div>
                  ))}
                </div>
                {trailing.length ? (
                  <div className="flex shrink-0 flex-col items-end gap-1 text-sm font-semibold text-fg tabular">
                    {trailing.map((column) => (
                      <div key={column.key}>{column.cell(row, rowIndex)}</div>
                    ))}
                  </div>
                ) : null}
                {href ? <ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" /> : null}
              </div>
              {fields.length ? (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-hairline pt-3">
                  {fields.map((column) => (
                    <div key={column.key} className={cn("min-w-0", column.align === "right" && "text-left")}>
                      <dt className="text-xs text-fg-muted">{labelOf(column)}</dt>
                      <dd className="mt-0.5 text-sm break-words text-fg">{column.cell(row, rowIndex)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </>
          );
          const cardClass = cn(
            "block rounded-xl border bg-surface p-4 shadow-card",
            isSelected ? "border-brand-soft-border ring-2 ring-brand-vivid/30" : "border-hairline",
          );
          return (
            <li key={key} className="relative">
              {selection ? (
                <span className="absolute top-4 left-4 z-[1]">
                  <Checkbox
                    aria-label={t("shell.selectRow")}
                    checked={isSelected}
                    disabled={!(selection.isSelectable?.(key) ?? true)}
                    onCheckedChange={() => toggleRow(key)}
                  />
                </span>
              ) : null}
              {href ? (
                <Link href={href} className={cn(cardClass, "pressable active:bg-press", selection && "pl-11")}>
                  {inner}
                </Link>
              ) : (
                <div className={cn(cardClass, selection && "pl-11")}>{inner}</div>
              )}
            </li>
          );
        })}
        {footer ? <li className="px-1 pt-1">{footer}</li> : null}
      </ul>
    </div>
  );
}
