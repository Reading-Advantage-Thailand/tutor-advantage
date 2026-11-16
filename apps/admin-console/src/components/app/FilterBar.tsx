"use client";

import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SearchField } from "./Fields";
import { ActiveFilterChips, FilterSheetButton, type MoreFilters } from "./PhoneFilters";

export interface FilterBarProps {
  /**
   * Segmented count tabs at the start of the toolbar (patterns.md A2), e.g.
   * <SegmentedControl items={[{ value: "all", label: "ทั้งหมด", count: 41 }, …]} />.
   * They replace KPI tiles and a role select on table pages.
   */
  tabs?: ReactNode;
  /** Controlled search (useTableState().searchValue / setSearchValue). Omit to hide the search box. */
  search?: { value: string; onValueChange: (value: string) => void; placeholder?: string; label?: string };
  /**
   * Filter controls (at most two selects, 160px): <SelectField aria-label=… containerClassName="w-40" />,
   * date inputs, a quick toggle. They wrap as one group with "ล้างตัวกรอง" and the actions.
   */
  children?: ReactNode;
  /**
   * More filters in a "ตัวกรอง" sheet, with removable chips of the active ones
   * under the toolbar (patterns.md A2 phone). By default for phones only: hide
   * the inline copies of those filters below 768px (`hidden md:flex`).
   */
  moreFilters?: MoreFilters;
  /** Right side (ColumnToggle, export button). Stays with the filters: never on a line of its own. */
  actions?: ReactNode;
  /** Show "ล้างตัวกรอง" (useTableState().isFiltered) and what it does. */
  isFiltered?: boolean;
  /**
   * Clears the filters. The button then disappears, so FilterBar moves focus
   * to the search box (else the selected count tab, else the first control):
   * callers need no refocus of their own.
   */
  onReset?: () => void;
  className?: string;
}

/**
 * The table toolbar: count tabs → search (flexible, min 200px) → filters →
 * "ล้างตัวกรอง" → actions (the "คอลัมน์" ColumnToggle), in that order on
 * screen and for Tab. One line when it all fits; otherwise it wraps whole
 * groups, never squeezing the search below 200px:
 * - the count tabs keep the first line to themselves when the search does
 *   not fit beside them;
 * - with filters, the filters wrap as one group together with "ล้างตัวกรอง"
 *   and the actions (the search may stay beside the tabs);
 * - without filters, "ล้างตัวกรอง" and the actions stay on the search's line;
 * - with neither a search nor filters, the tabs scroll sideways rather than
 *   push the actions onto a line of their own.
 * So "คอลัมน์" never sits on a line alone. Phones: the tabs scroll sideways
 * on their own line and the search takes a full line; extra filters go in
 * the `moreFilters` sheet.
 */
export function FilterBar({ tabs, search, children, moreFilters, actions, isFiltered, onReset, className }: FilterBarProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const showReset = Boolean(isFiltered && onReset);
  const hasFilters = Boolean(children || moreFilters);
  const hasTail = hasFilters || showReset || Boolean(actions);
  // Without filters the tail is only "ล้างตัวกรอง" + actions: glue it to the search.
  const glued = Boolean(search) && !hasFilters;

  const reset = () => {
    onReset?.();
    // "ล้างตัวกรอง" unmounts once nothing is filtered: keep focus in the toolbar, not on <body>.
    window.requestAnimationFrame(() => {
      const root = rootRef.current;
      if (!root) return;
      const target =
        root.querySelector<HTMLElement>('input[type="search"]') ??
        root.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ??
        Array.from(root.querySelectorAll<HTMLElement>("select, input, button, a[href]")).find(
          (element) => element.getClientRects().length > 0 && !element.matches(":disabled"),
        );
      target?.focus();
    });
  };

  const searchField = search ? (
    <SearchField
      value={search.value}
      onValueChange={search.onValueChange}
      label={search.label}
      placeholder={search.placeholder}
      // 200px is where it wraps; it then grows far more than the filter group, so spare room goes to it.
      containerClassName={cn(
        "min-w-[200px] max-md:basis-full",
        glued ? "grow-[100] md:w-[200px] md:flex-none md:grow-[100]" : "grow-[100] md:basis-[200px]",
      )}
    />
  ) : null;

  // Phones: the tail and the actions wrapper are display: contents, so their items join the toolbar's
  // own wrapping row. Items hidden on phones (the "คอลัมน์" menu, desktop-only selects) then leave no
  // empty box behind, and so no empty line and row gap under the search or the tabs.
  const tail = hasTail ? (
    <div className={cn("flex min-w-0 grow items-center gap-2 max-md:contents", hasFilters ? "flex-wrap" : "shrink-0")}>
      {children}
      {moreFilters ? <FilterSheetButton {...moreFilters} buttonRef={filterButtonRef} /> : null}
      {showReset ? (
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-9 items-center gap-1 rounded-(--radius-ctl) px-2.5 text-sm font-medium whitespace-nowrap text-fg-muted hover:bg-press hover:text-fg pointer-coarse:min-h-11"
        >
          <X aria-hidden="true" className="size-4" />
          {t("shell.clearFilters")}
        </button>
      ) : null}
      {actions ? <div className="ml-auto flex items-center gap-2 max-md:contents">{actions}</div> : null}
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className={cn("flex items-center gap-x-2 gap-y-3", search || hasFilters ? "flex-wrap" : "max-md:flex-wrap")}>
        {tabs ? (
          // Scrolls sideways when it does not fit; the padding keeps the focus ring visible. relative: the
          // rail also clips absolutely positioned bits of the tabs (sr-only text), so they cannot widen the page.
          <div className="relative -m-1 flex max-w-[calc(100%+8px)] min-w-0 overflow-x-auto p-1 scrollbar-hide max-md:basis-[calc(100%+8px)] [&_.seg-item]:shrink-0 [&>.seg]:w-max [&>.seg]:max-w-none">
            {tabs}
          </div>
        ) : null}
        {glued ? (
          <div className="flex min-w-0 grow items-center gap-2 max-md:basis-full max-md:flex-wrap">
            {searchField}
            {tail}
          </div>
        ) : (
          <>
            {searchField}
            {tail}
          </>
        )}
      </div>
      {moreFilters ? (
        // Stays mounted while empty: removing the last chip still moves focus to "ตัวกรอง".
        <ActiveFilterChips items={moreFilters.active ?? []} fallbackRef={filterButtonRef} show={moreFilters.show} />
      ) : null}
    </div>
  );
}
