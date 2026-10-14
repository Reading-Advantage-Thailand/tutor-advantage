import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: "left" | "right" | "center";
  /** CSS width for the desktop column, e.g. "140px" or "30%". */
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
  /** Extra classes for the desktop <td>. */
  className?: string;
}

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
  /** Below this width rows render as cards (default "md" = 768px). */
  breakpoint?: "md" | "lg";
  /** Tighter rows (40px) for dense data. */
  dense?: boolean;
  /** Content under the table (pagination, totals). */
  footer?: ReactNode;
  className?: string;
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;

/**
 * Desktop table that collapses to cards on phones. Cells are render functions
 * so money/status formatting stays in the page. Server-compatible (use it
 * directly in RSC pages).
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
  const tableVisible = breakpoint === "md" ? "hidden md:block" : "hidden lg:block";
  const cardsVisible = breakpoint === "md" ? "md:hidden" : "lg:hidden";

  return (
    <div className={cn("min-w-0", className)}>
      {/* Desktop / tablet table */}
      <div className={cn(tableVisible, "overflow-hidden rounded-xl border border-hairline bg-surface shadow-card")}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <thead>
              <tr className="bg-surface-muted">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    className={cn(
                      "px-4 py-2.5 text-[0.8125rem] font-medium whitespace-nowrap text-fg-muted",
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
                    className={cn("relative border-t border-hairline", href && "hover:bg-surface-muted")}
                  >
                    {columns.map((column, columnIndex) => {
                      const content = column.cell(row, rowIndex);
                      return (
                        <td
                          key={column.key}
                          className={cn(
                            "px-4 align-middle text-fg",
                            dense ? "py-2" : "py-3",
                            alignClass[column.align ?? "left"],
                            column.align === "right" && "tabular",
                            column.className,
                          )}
                        >
                          {href && columnIndex === primaryIndex ? (
                            <Link
                              href={href}
                              className="font-medium text-fg outline-none after:absolute after:inset-0 focus-visible:underline"
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
        </div>
        {footer ? <div className="border-t border-hairline px-4 py-3">{footer}</div> : null}
      </div>

      {/* Phone cards */}
      <ul className={cn(cardsVisible, "flex flex-col gap-2")} aria-label={caption}>
        {rows.map((row, rowIndex) => {
          const href = rowHref?.(row);
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
              {fields.length ? (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-hairline pt-3">
                  {fields.map((column) => (
                    <div key={column.key} className="min-w-0">
                      <dt className="text-xs text-fg-muted">{column.header}</dt>
                      <dd className="mt-0.5 text-sm break-words text-fg">{column.cell(row, rowIndex)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </>
          );
          const cardClass = "block rounded-xl border border-hairline bg-surface p-4 shadow-card";
          return (
            <li key={getRowKey(row, rowIndex)}>
              {href ? (
                <Link href={href} className={cn(cardClass, "pressable active:bg-press")}>
                  {inner}
                </Link>
              ) : (
                <div className={cardClass}>{inner}</div>
              )}
            </li>
          );
        })}
        {footer ? <li className="px-1 pt-1">{footer}</li> : null}
      </ul>
    </div>
  );
}
