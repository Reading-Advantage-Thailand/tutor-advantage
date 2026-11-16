import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { isValidElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { cardTapClass } from "./Surface";
import { TableScrollFrame } from "./TableScrollFrame";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: "left" | "right" | "center";
  /** CSS width for the desktop column, e.g. "140px" or "30%" (a <col> width with layout="fixed"). */
  width?: string;
  /**
   * Where the value goes in the phone card:
   * - "primary": card title (exactly one column should be primary; default = first column)
   * - "secondary": line under the title
   * - "trailing": top-right (amount, status chip)
   * - "field" (default): label/value pair in the card body
   * - "hidden": desktop only
   */
  mobile?: "primary" | "secondary" | "trailing" | "field" | "hidden";
  /**
   * Phone card: true when this row has no value here, so the field is left
   * out of the card. Needed only when `cell` renders a component; a cell that
   * returns nothing, "", "–" or an element holding just "–" is detected.
   */
  isEmpty?: (row: T) => boolean;
  /** Extra classes for the desktop <td>. */
  className?: string;
}

/** Viewport breakpoints, or "container": the table's own width (the root becomes a size container). */
export type DataTableBreakpoint = "md" | "lg" | "xl" | "container";

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  /** Makes each row/card a link (the primary cell becomes a stretched link). */
  rowHref?: (row: T) => string | undefined;
  /** Rendered instead of the table when rows is empty (e.g. <EmptyState compact />). */
  empty?: ReactNode;
  /** Accessible table caption (visually hidden). */
  caption?: string;
  /**
   * Below this width rows render as cards (default "md" = 768px). "lg" 1024,
   * "xl" 1280, or "container": the table's own width reaching
   * `containerBreakpoint` (for a table beside a side nav or in a column).
   */
  breakpoint?: DataTableBreakpoint;
  /**
   * Container width where the table replaces the cards (breakpoint="container"):
   * 48 · 56 · 64 (default) · 72 · 73rem (the 8-column payout table, which needs
   * 1160px with its widest rows).
   */
  containerBreakpoint?: "48rem" | "56rem" | "64rem" | "72rem" | "73rem";
  /**
   * Below the breakpoint: "list" (default) one card per row; "grid" two cards
   * per row from 768px (from a 48rem container with breakpoint="container"),
   * equal height; "none" no cards: the page renders its own rows there, so only
   * the table renders, from the breakpoint up.
   */
  cards?: "list" | "grid" | "none";
  /**
   * "fixed": table-layout fixed with a <colgroup> of the column widths, so
   * several tables on one page (open / closed groups) keep the same columns
   * whatever their rows hold. Columns without a width share the rest.
   */
  layout?: "auto" | "fixed";
  /** Tighter rows (40px) for dense data. */
  dense?: boolean;
  /** Content under the table (pagination, totals). */
  footer?: ReactNode;
  className?: string;
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;

/** Static class strings per breakpoint (Tailwind only generates classes it can see). */
const visibility: Record<Exclude<DataTableBreakpoint, "container">, { table: string; cards: string; grid: string }> = {
  md: { table: "hidden md:block", cards: "md:hidden", grid: "" },
  lg: { table: "hidden lg:block", cards: "lg:hidden", grid: "md:grid-cols-2" },
  xl: { table: "hidden xl:block", cards: "xl:hidden", grid: "md:grid-cols-2" },
};
const containerVisibility: Record<NonNullable<DataTableProps<unknown>["containerBreakpoint"]>, { table: string; cards: string }> = {
  "48rem": { table: "hidden @min-[48rem]:block", cards: "@min-[48rem]:hidden" },
  "56rem": { table: "hidden @min-[56rem]:block", cards: "@min-[56rem]:hidden" },
  "64rem": { table: "hidden @min-[64rem]:block", cards: "@min-[64rem]:hidden" },
  "72rem": { table: "hidden @min-[72rem]:block", cards: "@min-[72rem]:hidden" },
  "73rem": { table: "hidden @min-[73rem]:block", cards: "@min-[73rem]:hidden" },
};

const EMPTY_TEXT = new Set(["", "-", "–", "—"]);

/** A cell with nothing to show: nothing, "", a dash, or a plain element (e.g. a muted <span>) holding only a dash. */
function isEmptyCell(node: ReactNode): boolean {
  if (node === null || node === undefined || typeof node === "boolean") return true;
  if (typeof node === "string") return EMPTY_TEXT.has(node.trim());
  if (isValidElement<{ children?: ReactNode }>(node) && typeof node.type === "string") {
    const { children } = node.props;
    return typeof children === "string" && EMPTY_TEXT.has(children.trim());
  }
  return false;
}

/**
 * Desktop table that collapses to cards on phones. Cells are render functions
 * so money/status formatting stays in the page. A table wider than its card
 * scrolls inside it, with edge shadows while there is more to see
 * (components.md §11). Phone cards leave out fields with no value.
 * Server-compatible (use it directly in RSC pages).
 *
 * @example
 * <DataTable
 *   caption="ประวัติการจ่ายเงิน"
 *   rows={payouts}
 *   getRowKey={(p) => p.id}
 *   columns={[
 *     { key: "period", header: "รอบ", cell: (p) => formatThaiMonthYear(p.period), mobile: "primary" },
 *     { key: "amount", header: "ยอดสุทธิ", align: "right", cell: (p) => formatTHB(p.net), mobile: "trailing" },
 *     { key: "status", header: "สถานะ", cell: (p) => <StatusChip status={p.status} label={…} /> },
 *   ]}
 *   empty={<EmptyState compact title="ยังไม่มีรายการ" />}
 * />
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  rowHref,
  empty,
  caption,
  breakpoint = "md",
  containerBreakpoint = "64rem",
  cards = "list",
  layout = "auto",
  dense = false,
  footer,
  className,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  const primaryIndex = Math.max(0, columns.findIndex((column) => column.mobile === "primary"));
  const primary = columns[primaryIndex];
  const secondary = columns.filter((column) => column.mobile === "secondary");
  const trailing = columns.filter((column) => column.mobile === "trailing");
  const fields = columns.filter(
    (column, index) => index !== primaryIndex && (column.mobile ?? "field") === "field",
  );
  const inContainer = breakpoint === "container";
  const show = inContainer ? containerVisibility[containerBreakpoint] : visibility[breakpoint];
  const gridColumns = inContainer ? "@min-[48rem]:grid-cols-2" : visibility[breakpoint].grid;
  const fixed = layout === "fixed";

  return (
    <div className={cn("min-w-0", inContainer && "@container", className)}>
      {/* Desktop / tablet table */}
      <div className={cn(show.table, "overflow-hidden rounded-(--radius-card) border border-clay-rim bg-surface shadow-card")}>
        {/* Scrolls inside the card, with edge shadows only while the table really overflows. */}
        <TableScrollFrame>
          <table className={cn("w-full border-collapse text-sm", fixed && "table-fixed")}>
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            {fixed ? (
              <colgroup>
                {columns.map((column) => (
                  <col key={column.key} style={column.width ? { width: column.width } : undefined} />
                ))}
                {rowHref ? <col className="w-8" /> : null}
              </colgroup>
            ) : null}
            <thead>
              <tr className="bg-surface-muted">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    style={column.width && !fixed ? { width: column.width } : undefined}
                    className={cn(
                      "h-10 px-4 text-[0.8125rem] leading-[1.4] font-semibold whitespace-nowrap text-fg-muted",
                      alignClass[column.align ?? "left"],
                    )}
                  >
                    {column.header}
                  </th>
                ))}
                {rowHref ? <th aria-hidden="true" className="w-8" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const href = rowHref?.(row);
                return (
                  <tr
                    key={getRowKey(row, rowIndex)}
                    className={cn("relative border-t border-hairline transition-colors duration-(--duration-fast)", href && "hover:bg-row-hover")}
                  >
                    {columns.map((column, columnIndex) => {
                      const content = column.cell(row, rowIndex);
                      return (
                        <td
                          key={column.key}
                          className={cn(
                            "px-4 align-middle text-sm leading-[1.6] text-fg",
                            dense ? "py-2" : "py-3",
                            alignClass[column.align ?? "left"],
                            column.align === "right" && "tabular",
                            column.className,
                          )}
                        >
                          {href && columnIndex === primaryIndex ? (
                            <Link
                              href={href}
                              className="font-medium text-fg outline-none after:absolute after:inset-0 focus-visible:underline focus-visible:after:outline-3 focus-visible:after:-outline-offset-3 focus-visible:after:outline-solid focus-visible:after:outline-focus-ring"
                            >
                              {content}
                            </Link>
                          ) : (
                            content
                          )}
                        </td>
                      );
                    })}
                    {href ? (
                      <td className="pr-3 text-fg-subtle">
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScrollFrame>
        {footer ? <div className="border-t border-hairline px-4 py-3">{footer}</div> : null}
      </div>

      {/* Phone cards */}
      {cards === "none" ? null : (
        <ul
          className={cn(show.cards, cards === "grid" ? cn("grid grid-cols-1 gap-2", gridColumns) : "flex flex-col gap-2")}
          aria-label={caption}
        >
          {rows.map((row, rowIndex) => {
            const href = rowHref?.(row);
            const fieldCells = fields
              .map((column) => ({ column, content: column.cell(row, rowIndex) }))
              .filter(({ column, content }) => !(column.isEmpty?.(row) ?? isEmptyCell(content)));
            const inner = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.9375rem] font-medium text-fg">{primary?.cell(row, rowIndex)}</div>
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
                {fieldCells.length ? (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-hairline pt-3">
                    {fieldCells.map(({ column, content }) => (
                      <div key={column.key} className="min-w-0">
                        <dt className="text-xs text-fg-muted">{column.header}</dt>
                        <dd className="mt-0.5 text-sm leading-[1.6] break-words text-fg">{content}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </>
            );
            const cardClass = cn("block rounded-(--radius-card) border p-4", cards === "grid" && "h-full");
            return (
              <li key={getRowKey(row, rowIndex)}>
                {href ? (
                  <Link href={href} className={cn(cardClass, cardTapClass)}>
                    {inner}
                  </Link>
                ) : (
                  <div className={cn(cardClass, "border-clay-rim bg-surface shadow-card")}>{inner}</div>
                )}
              </li>
            );
          })}
          {footer ? <li className={cn("px-1 pt-1", cards === "grid" && "col-span-full")}>{footer}</li> : null}
        </ul>
      )}
    </div>
  );
}
