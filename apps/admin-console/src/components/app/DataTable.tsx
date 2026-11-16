"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown } from "lucide-react";
import { isValidElement, useMemo, type MouseEvent, type ReactNode } from "react";
import { LazyCheckbox as Checkbox } from "./LazyCheckbox";
import { t } from "@/lib/i18n";
import type { SortState } from "@/lib/tableState";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./Avatar";
import { TableSkeleton } from "./Skeletons";
import { TableScrollFrame } from "./TableScrollFrame";

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
   * - "secondary": line under the title (starts under the name when the
   *   title is an IdentityCell with an avatar/tile)
   * - "trailing": top-right (amount, status chip)
   * - "field" (default): label/value pair in the card body
   * - "actions": a full-width row of buttons at the bottom of the card (no
   *   label; outside the card's link when the row has `rowHref`)
   * - "hidden": desktop only
   * Phone cards leave out a secondary line, trailing value, field or actions
   * row whose cell is empty: nothing, "", "–", an element holding only "–",
   * or `isEmpty(row)`. Inside a cell, an element marked `data-card-empty`
   * (e.g. a "–" line under a name) shows in the table but not in the card.
   */
  mobile?: "primary" | "secondary" | "trailing" | "field" | "actions" | "hidden";
  /** The cell has nothing to say for this row (phone cards then leave it out). */
  isEmpty?: (row: T) => boolean;
  /** Cannot be hidden from the column menu. */
  alwaysVisible?: boolean;
  /** Hidden until the user turns it on in the column menu. */
  defaultHidden?: boolean;
  /**
   * Keep this column visible while the table scrolls sideways (first column
   * only; not with `selection`). Works with `rowHref` (the whole row stays one
   * link) and with a row button marked `data-row-link`.
   */
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
  /**
   * Makes each row/card a link (the primary cell becomes a stretched link; the
   * keyboard focus ring goes around the whole row). Rows that open a side sheet
   * instead stretch their own button (after:absolute after:inset-0) and mark it
   * `data-row-link` for the same ring.
   */
  rowHref?: (row: T) => string | undefined;
  /** Rendered instead of the table when rows is empty and not loading. */
  empty?: ReactNode;
  /** Shows skeleton rows when there are no rows yet; dims rows while refetching. */
  loading?: boolean;
  /** Accessible table caption (visually hidden). */
  caption?: string;
  /** Below this width rows render as cards (default "md" = 768px). */
  breakpoint?: "md" | "lg";
  /**
   * Row height (tokens.md §6.3): "default" 52px (--row-h, two-line identity
   * rows), "compact" 40px (--row-h-compact, single-line tables such as the
   * audit log); 56px (--row-h-touch) under pointer: coarse. "comfortable" is
   * the old name of the 52px row.
   */
  density?: "default" | "compact" | "comfortable";
  /** Key of the row open in a side sheet (highlighted --row-selected). */
  activeRowKey?: string | null;
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

const EMPTY_TEXT = new Set(["", "–", "-", "—"]);

/** Nothing worth a line in a phone card: null, "", "–", or an element holding only "–". */
function isEmptyContent(node: ReactNode): boolean {
  if (node === null || node === undefined || typeof node === "boolean") return true;
  if (typeof node === "string") return EMPTY_TEXT.has(node.trim());
  if (Array.isArray(node)) return node.every(isEmptyContent);
  if (isValidElement<{ children?: ReactNode }>(node) && typeof node.type === "string") {
    const children = node.props.children;
    return typeof children === "string" && EMPTY_TEXT.has(children.trim());
  }
  return false;
}
const justifyClass = { left: "justify-start", right: "justify-end", center: "justify-center" } as const;

function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  if (dir === "asc") return <ArrowUp aria-hidden="true" className="size-3.5 text-fg" />;
  if (dir === "desc") return <ArrowDown aria-hidden="true" className="size-3.5 text-fg" />;
  return <ChevronsUpDown aria-hidden="true" className="size-3.5 text-fg-subtle" />;
}

/**
 * Identity cell (first column): avatar 32 + name (500 14) + a secondary line
 * (13, --text-secondary). Long names and emails are cut with an ellipsis at
 * 280px; the full value stays in `title` (and belongs in the detail sheet).
 * The avatar is decorative here (the name is right next to it). In a phone
 * card the lines under the title start where the name starts, and an empty
 * secondary ("–") is left out (it stays in the table, like other "–" cells).
 *
 * A string `name` is cut here. Any other `name` (a link) is not clipped by
 * the cell, so a link's enlarged touch area (an ::after outside its box)
 * still works: cut it inside the link, e.g.
 * `<Link className="relative block min-w-0 …"><span className="block truncate">…</span></Link>`.
 */
export function IdentityCell({
  name,
  secondary,
  title,
  avatarSrc,
  seed,
  leading,
  className,
}: {
  name: ReactNode;
  secondary?: ReactNode;
  /**
   * Plain-text name when `name` is not a string (a link, a name + chip): the
   * tooltip of the cut name and the avatar's initials.
   */
  title?: string;
  avatarSrc?: string | null;
  /** Stable avatar tone key (user id). */
  seed?: string | null;
  /** Replaces the avatar (e.g. an IconTile). */
  leading?: ReactNode;
  className?: string;
}) {
  const plainName = typeof name === "string" ? name : title;
  const plainSecondary = typeof secondary === "string" ? secondary : undefined;
  return (
    <span data-identity-cell="" className={cn("flex min-w-0 items-center gap-2.5", className)}>
      {leading ?? <UserAvatar name={plainName} src={avatarSrc} seed={seed} size="sm" decorative />}
      <span className="min-w-0 md:max-w-[280px]">
        <span
          className={cn("block min-w-0 text-sm leading-[1.45] font-medium text-fg", typeof name === "string" && "truncate")}
          title={plainName}
        >
          {name}
        </span>
        {secondary ? (
          <span
            data-card-empty={isEmptyContent(secondary) ? "" : undefined}
            className="block max-w-[280px] truncate text-[0.8125rem] leading-[1.45] font-normal text-fg-muted"
            title={plainSecondary}
          >
            {secondary}
          </span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * Rows that open a side sheet mark their button with `data-row-link` and
 * stretch it over the row (after:absolute after:inset-0), like the row link.
 * A sticky first cell paints above that stretch, so a click on its empty
 * space is handed to the row's button. (Rows with `rowHref` get a hidden link
 * copy instead, see RowLinkOverlay.)
 */
function forwardStickyClick(event: MouseEvent<HTMLTableCellElement>) {
  if ((event.target as Element).closest("a, button, input, select, textarea, label, [role='button']")) return;
  event.currentTarget.parentElement?.querySelector<HTMLElement>(":scope > td:not([data-sticky-col]) [data-row-link]")?.click();
}

/**
 * A hidden copy of the row link that covers the rest of a row (see the sticky
 * column note in DataTable). Not a Tab stop and hidden from assistive tech:
 * the primary cell's link stays the row's one link for keyboards and readers.
 */
function RowLinkOverlay({ href }: { href: string }) {
  return <Link href={href} tabIndex={-1} aria-hidden="true" className="absolute inset-0" />;
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
  density = "default",
  activeRowKey,
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
    return <TableSkeleton columns={Math.min(columns.length, 6)} className={className} />;
  }
  if (rows.length === 0 && empty) return <>{empty}</>;

  const primaryIndex = Math.max(0, columns.findIndex((column) => column.mobile === "primary"));
  const primary = columns[primaryIndex];
  const secondary = columns.filter((column) => column.mobile === "secondary");
  const trailing = columns.filter((column) => column.mobile === "trailing");
  const fields = columns.filter((column, index) => index !== primaryIndex && (column.mobile ?? "field") === "field");
  const actionColumns = columns.filter((column, index) => index !== primaryIndex && column.mobile === "actions");
  /** A column's cells for one phone card, without the empty ones. */
  const cardCells = (list: DataTableColumn<T>[], row: T, rowIndex: number) =>
    list.flatMap((column) => {
      if (column.isEmpty?.(row)) return [];
      const content = column.cell(row, rowIndex);
      return isEmptyContent(content) ? [] : [{ column, content }];
    });
  // Sticky first column (not with a selection column, which would come first).
  const stickyIndex = columns[0]?.sticky && !selection ? 0 : -1;
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
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-soft-border bg-brand-soft px-3 py-2 text-sm text-brand-soft-fg">
          <span className="font-semibold">{t("shell.selectedCount", { count: selectedCount })}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {bulkActions(selectedCount)}
            <button
              type="button"
              onClick={() => selection?.onChange(new Set())}
              className="inline-flex h-8 items-center rounded-(--radius-ctl) px-2.5 text-sm font-medium hover:bg-press pointer-coarse:min-h-11"
            >
              {t("shell.clearSelection")}
            </button>
          </div>
        </div>
      ) : null}

      {/* Desktop / tablet table */}
      <div className={cn(tableVisible, "data-table-card card overflow-hidden")}>
        {/* scroll-px-2: when a wide table scrolls sideways, a focused control in the
            last column stops 8px clear of the card edge so its focus ring is not clipped.
            The frame adds the edge shadows while the table overflows (components.md §11). */}
        <TableScrollFrame
          scrollClassName={cn("scroll-px-2 transition-opacity", loading && "opacity-60")}
          style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
        >
          <table className="data-table" data-density={density === "compact" ? "compact" : "default"}>
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <thead>
              <tr>
                {selection ? (
                  <th scope="col" className="w-11 !pr-0">
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
                  const sticky = columnIndex === stickyIndex;
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
                            "-mx-1.5 inline-flex h-7 items-center gap-1 rounded-(--radius-ctl-sm) px-1.5 font-semibold hover:bg-press hover:text-fg pointer-coarse:min-h-11",
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
                {rowHref ? <th aria-hidden="true" className="data-table-chevron" /> : null}
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
                    data-selected={isSelected || (activeRowKey != null && activeRowKey === key) ? "" : undefined}
                  >
                    {selection ? (
                      <td className="w-11 !pr-0">
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
                      const sticky = columnIndex === stickyIndex;
                      // The row link is the primary cell's link stretched over its containing
                      // block: the <tr>, or the sticky cell when the primary cell is the sticky
                      // one (a sticky cell is positioned). The rest of the row then gets a
                      // hidden copy of the link: from the cell after the sticky one (covering
                      // the row; the sticky cell paints above it), or inside the sticky cell
                      // when the primary cell is another one. The focus ring is drawn around
                      // the whole row (globals.css, "tables owner" block).
                      const overlay =
                        href !== undefined &&
                        stickyIndex >= 0 &&
                        (primaryIndex === stickyIndex ? columnIndex === stickyIndex + 1 : sticky);
                      return (
                        <td
                          key={column.key}
                          data-sticky-col={sticky ? "" : undefined}
                          onClick={sticky && !href ? forwardStickyClick : undefined}
                          className={cn(alignClass[column.align ?? "left"], column.align === "right" && "tabular whitespace-nowrap", column.className)}
                        >
                          {overlay ? <RowLinkOverlay href={href} /> : null}
                          {href && columnIndex === primaryIndex ? (
                            <Link href={href} data-row-link="" className="font-medium text-fg outline-none after:absolute after:inset-0 focus-visible:underline">
                              {content}
                            </Link>
                          ) : (
                            content
                          )}
                        </td>
                      );
                    })}
                    {href ? (
                      <td className="data-table-chevron">
                        {stickyIndex >= 0 && primaryIndex === stickyIndex && columns.length === stickyIndex + 1 ? (
                          <RowLinkOverlay href={href} />
                        ) : null}
                        <ChevronRight aria-hidden="true" className="mx-auto block size-4" />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScrollFrame>
        {footer ? <div className="border-t border-hairline pr-3 pl-4">{footer}</div> : null}
      </div>

      {/* Phones: list rows inside one card (identity, status, chevron); no sideways scroll. */}
      <div className={cn(cardsVisible, "flex flex-col gap-2", loading && "opacity-60")}>
      <ul className="card overflow-hidden [&_[data-card-empty]]:hidden" aria-label={caption}>
        {rows.map((row, rowIndex) => {
          const key = keys[rowIndex];
          const href = rowHref?.(row);
          const isSelected = selection?.selected.has(key) ?? false;
          const secondaryCells = cardCells(secondary, row, rowIndex);
          const trailingCells = cardCells(trailing, row, rowIndex);
          const fieldCells = cardCells(fields, row, rowIndex);
          const actionCells = cardCells(actionColumns, row, rowIndex);
          const inner = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[0.9375rem] font-medium break-words text-fg">{primary?.cell(row, rowIndex)}</div>
                  {secondaryCells.map(({ column, content }) => (
                    // Under an IdentityCell title the lines start where the name starts (avatar 32 + gap 10).
                    <div key={column.key} className="mt-0.5 text-[0.8125rem] text-fg-muted group-has-[[data-identity-cell]]/card:pl-[2.625rem]">
                      {content}
                    </div>
                  ))}
                </div>
                {trailingCells.length ? (
                  <div className="flex shrink-0 flex-col items-end gap-1 text-sm font-semibold text-fg tabular">
                    {trailingCells.map(({ column, content }) => (
                      <div key={column.key}>{content}</div>
                    ))}
                  </div>
                ) : null}
                {href ? <ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" /> : null}
              </div>
              {fieldCells.length ? (
                <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2">
                  {fieldCells.map(({ column, content }) => (
                    <div key={column.key} className={cn("min-w-0", column.align === "right" && "text-left")}>
                      <dt className="text-xs text-fg-muted">{labelOf(column)}</dt>
                      <dd className="mt-0.5 text-sm break-words text-fg">{content}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </>
          );
          const cardClass = cn("block px-4 py-3", isSelected && "bg-row-selected");
          return (
            <li key={key} className="group/card relative border-t border-hairline first:border-t-0">
              {selection ? (
                <span className="absolute top-3.5 left-4 z-[1]">
                  <Checkbox
                    aria-label={t("shell.selectRow")}
                    checked={isSelected}
                    disabled={!(selection.isSelectable?.(key) ?? true)}
                    onCheckedChange={() => toggleRow(key)}
                  />
                </span>
              ) : null}
              {href ? (
                <Link href={href} className={cn(cardClass, "pressable focus-ring-inset active:bg-press", selection && "pl-12")}>
                  {inner}
                </Link>
              ) : (
                <div className={cn(cardClass, selection && "pl-12")}>{inner}</div>
              )}
              {actionCells.length ? (
                // Full-width actions (mobile: "actions"), outside the card's link: buttons keep their words.
                <div className={cn("-mt-1 flex flex-col gap-2 px-4 pb-3", isSelected && "bg-row-selected", selection && "pl-12")}>
                  {actionCells.map(({ column, content }) => (
                    <div key={column.key} className="flex min-w-0 flex-wrap items-center gap-2">
                      {content}
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {footer ? <div className="px-1">{footer}</div> : null}
      </div>
    </div>
  );
}
