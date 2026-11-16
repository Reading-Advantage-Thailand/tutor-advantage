"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
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

type PageSlot = number | "gap-start" | "gap-end";

/**
 * Page numbers to show: all of them up to 7, otherwise the first, the last,
 * the current page with its neighbours and "…" gaps (always 7 slots, so the
 * footer does not jump while paging).
 */
export function pageSlots(page: number, pages: number): PageSlot[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "gap-end", pages];
  if (page >= pages - 3) return [1, "gap-start", pages - 4, pages - 3, pages - 2, pages - 1, pages];
  return [1, "gap-start", page - 1, page, page + 1, "gap-end", pages];
}

/**
 * Table pagination footer (components.md §8): "1–10 จาก 41 รายการ" (13,
 * tabular) on the left; "แถวต่อหน้า" + a 72px select, then prev · numbered
 * pages · next on the right (phones: first · prev · "2 / 5" · next · last).
 * Page buttons 32 (44 under pointer: coarse), the current one --brand-soft
 * with aria-current="page". Server-side paging: pair
 * with useTableState() (page/pageSize live in the URL). DataTable puts it in a
 * 52px footer inside the table card.
 *
 * Phones (below sm): the range text has a row of its own and never wraps;
 * the buttons sit on a second row, right-aligned and edge to edge (each
 * target is 44px). Always two rows, at every phone width and on every page:
 * if the two shared a line whenever they happened to fit, the buttons would
 * jump from one page to the next as the numbers get wider. "2 / 5" reads
 * "หน้า 2 จาก 5" to assistive tech; the range text is the live region that
 * announces a page change. (patterns.md A2 asks for "โหลดเพิ่ม" on phones;
 * the lists page on the server through ?page=, so a load-more would have to
 * pile pages up on the client. Deliberately not built: the compact pager
 * stands in for it.)
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
  const slots = pages !== undefined ? pageSlots(page, Math.max(1, pages)) : [page];
  return (
    <div className={cn("pager max-sm:gap-x-2", className)}>
      <p className="tabular shrink-0 whitespace-nowrap max-sm:basis-full" aria-live="polite">
        {known
          ? t("shell.rangeOf", { from: formatNumber(from), to: formatNumber(to), total: formatNumber(total) })
          : t("shell.pageOf", { page, pages: "…" })}
      </p>
      <span className="flex-1 max-sm:hidden" aria-hidden="true" />
      {onPageSizeChange ? (
        <label className="hidden items-center gap-2 sm:flex">
          <span>{t("shell.rowsPerPage")}</span>
          <span className="relative inline-flex">
            <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="pager-size">
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-fg-subtle" />
          </span>
        </label>
      ) : null}
      <nav className="pager-pages shrink-0 max-sm:ml-auto max-sm:gap-0" aria-label={t("shell.pagination")}>
        {/* Phones: first/last jump buttons stand in for the numbered page 1 and last page. */}
        {pages !== undefined ? (
          <button type="button" className="pager-btn sm:hidden" disabled={page <= 1} onClick={() => onPageChange(1)} aria-label={t("shell.firstPage")}>
            <ChevronsLeft aria-hidden="true" />
          </button>
        ) : null}
        <button type="button" className="pager-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label={t("shell.prevPage")}>
          <ChevronLeft aria-hidden="true" />
        </button>
        {/* Phones: "2 / 5" instead of the numbered buttons. */}
        <span className="min-w-12 px-0.5 text-center whitespace-nowrap text-fg tabular sm:hidden">
          <span aria-hidden="true">{pages !== undefined ? `${formatNumber(page)} / ${formatNumber(pages)}` : formatNumber(page)}</span>
          <span className="sr-only">{t("shell.pageOf", { page: formatNumber(page), pages: pages !== undefined ? formatNumber(pages) : "…" })}</span>
        </span>
        {slots.map((slot) =>
          typeof slot === "number" ? (
            <button
              key={slot}
              type="button"
              className="pager-btn max-sm:hidden"
              aria-current={slot === page ? "page" : undefined}
              aria-label={t("shell.pageNumber", { page: formatNumber(slot) })}
              onClick={() => (slot === page ? undefined : onPageChange(slot))}
            >
              {formatNumber(slot)}
            </button>
          ) : (
            <span key={slot} className="pager-gap max-sm:hidden" aria-hidden="true">
              …
            </span>
          ),
        )}
        <button type="button" className="pager-btn" disabled={!canNext} onClick={() => onPageChange(page + 1)} aria-label={t("shell.nextPage")}>
          <ChevronRight aria-hidden="true" />
        </button>
        {pages !== undefined ? (
          <button type="button" className="pager-btn sm:hidden" disabled={page >= pages} onClick={() => onPageChange(pages)} aria-label={t("shell.lastPage")}>
            <ChevronsRight aria-hidden="true" />
          </button>
        ) : null}
      </nav>
    </div>
  );
}
