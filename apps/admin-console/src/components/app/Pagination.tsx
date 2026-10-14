"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatNumber } from "@/lib/format";
import { DEFAULT_PAGE_SIZES, pageCount } from "@/lib/tableState";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  page: number;
  pageSize: number;
  /** Total rows on the server. Omit when unknown (then `hasNextPage` drives "next"). */
  total?: number;
  hasNextPage?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizes?: readonly number[];
  className?: string;
}

const navButton =
  "inline-flex size-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-press hover:text-fg disabled:pointer-events-none disabled:opacity-40 pointer-coarse:size-10";

/**
 * Server-side pagination: "1–20 จาก 134 รายการ", page size select and
 * first/prev/next/last. Pair with useTableState(): page/pageSize live in the URL.
 */
export function Pagination({
  page,
  pageSize,
  total,
  hasNextPage,
  onPageChange,
  onPageSizeChange,
  pageSizes = DEFAULT_PAGE_SIZES,
  className,
}: PaginationProps) {
  const known = typeof total === "number" && Number.isFinite(total);
  const pages = known ? pageCount(total, pageSize) : undefined;
  const from = known && total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = known ? Math.min(page * pageSize, total) : page * pageSize;
  const canNext = pages !== undefined ? page < pages : Boolean(hasNextPage);
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[0.8125rem] text-fg-muted", className)}>
      <p className="tabular" aria-live="polite">
        {known
          ? t("shell.rangeOf", { from: formatNumber(from), to: formatNumber(to), total: formatNumber(total) })
          : t("shell.pageOf", { page, pages: "…" })}
      </p>
      <div className="flex items-center gap-3">
        {onPageSizeChange ? (
          <label className="hidden items-center gap-2 sm:flex">
            <span>{t("shell.rowsPerPage")}</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-8 cursor-pointer rounded-md border border-field-border bg-surface px-2 text-[0.8125rem] text-fg outline-none focus-visible:ring-3 focus-visible:ring-brand-vivid/20"
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <nav className="flex items-center gap-0.5" aria-label={t("shell.pageOf", { page, pages: pages ?? "…" })}>
          {pages !== undefined ? (
            <button type="button" className={navButton} disabled={page <= 1} onClick={() => onPageChange(1)} aria-label={t("shell.firstPage")}>
              <ChevronsLeft aria-hidden="true" className="size-4" />
            </button>
          ) : null}
          <button type="button" className={navButton} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label={t("shell.prevPage")}>
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <span className="min-w-16 px-1 text-center tabular text-fg">
            {pages !== undefined ? `${formatNumber(page)} / ${formatNumber(pages)}` : formatNumber(page)}
          </span>
          <button type="button" className={navButton} disabled={!canNext} onClick={() => onPageChange(page + 1)} aria-label={t("shell.nextPage")}>
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
          {pages !== undefined ? (
            <button type="button" className={navButton} disabled={page >= pages} onClick={() => onPageChange(pages)} aria-label={t("shell.lastPage")}>
              <ChevronsRight aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </nav>
      </div>
    </div>
  );
}
