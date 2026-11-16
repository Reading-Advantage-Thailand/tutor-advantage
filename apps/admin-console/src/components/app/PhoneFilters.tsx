"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CountBadge } from "./CountBadge";
import { Sheet } from "./Sheet";

/**
 * The "ตัวกรอง" sheet and the active-filter chips (patterns.md A2/A7: "more
 * filters go in a sheet; active filters show as removable chips under the
 * toolbar"). FilterBar renders them from its `moreFilters` prop; they drive
 * the page's own filter state (usually the URL via useTableState), nothing is
 * stored here.
 */

export interface ActiveFilter {
  key: string;
  /** "หมวดคำร้อง: คืนเงิน" */
  label: string;
  onRemove: () => void;
}

export interface MoreFilters {
  /** The filter fields in the sheet: labelled SelectFields, toggles (give them stable ids). */
  children: ReactNode;
  /** Filters set from the sheet: removable chips under the toolbar, and the count on the button. */
  active?: ActiveFilter[];
  /** Clears the sheet's filters (the sheet's "ล้างตัวกรอง", shown while some are active). */
  onReset?: () => void;
  /**
   * "phone" (default): button and chips below 768px only (from there the same
   * filters sit inline in the toolbar). "always": at every width; from 768px the
   * button is a 36px icon button (the word stays its accessible name and
   * tooltip) and the sheet opens at the right. Use it when some filters live
   * only in the sheet.
   */
  show?: "phone" | "always";
  /** Stable id prefix for the sheet's fields (not used for layout). */
  id?: string;
}

/** "ตัวกรอง" button that opens a sheet with the page's extra filters. */
export function FilterSheetButton({
  children,
  active = [],
  onReset,
  show = "phone",
  buttonRef,
}: MoreFilters & { buttonRef?: RefObject<HTMLButtonElement | null> }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const always = show === "always";
  const count = active.length;

  const reset = () => {
    onReset?.();
    // The clear button disappears once nothing is filtered: keep focus in the
    // sheet on its first field instead of letting it fall to <body>.
    window.requestAnimationFrame(() => {
      bodyRef.current?.querySelector<HTMLElement>("select, input, button")?.focus();
    });
  };

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        aria-haspopup="dialog"
        title={always ? t("shell.filters") : undefined}
        className={cn(always ? "md:w-9 md:px-0" : "md:hidden", "pointer-coarse:min-w-11")}
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal aria-hidden="true" />
        <span className={cn(always && "md:sr-only")}>{t("shell.filters")}</span>
        <CountBadge count={count} tone="brand" aria-hidden className={cn(always && "md:absolute md:-top-2 md:-right-2")} />
        {count > 0 ? <span className="sr-only">{t("shell.itemsCount", { count })}</span> : null}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        side="right"
        width={400}
        title={t("shell.filters")}
        footer={
          // DOM order = visual order at every width (Tab goes clear → close):
          // phones stack clear above the full-width close button.
          <div className="flex flex-col gap-2 md:flex-row md:justify-end">
            {count > 0 && onReset ? (
              <Button variant="outline" onClick={reset}>
                {t("shell.clearFilters")}
              </Button>
            ) : null}
            <Button onClick={() => setOpen(false)}>{t("shell.close")}</Button>
          </div>
        }
      >
        <div ref={bodyRef} className="flex flex-col gap-4">
          {children}
        </div>
      </Sheet>
    </>
  );
}

/**
 * Removable chips for the filters set from the sheet. Removing one moves
 * focus to the chip that takes its place (or the one before it), and to
 * `fallbackRef` (the "ตัวกรอง" button) when none is left: never to <body>.
 */
export function ActiveFilterChips({
  items,
  fallbackRef,
  show = "phone",
  className,
}: {
  items: ActiveFilter[];
  fallbackRef?: RefObject<HTMLElement | null>;
  show?: "phone" | "always";
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // The removed chip: filters live in the URL, so the list changes a render
  // or two later. Focus moves once that chip is really gone.
  const [removed, setRemoved] = useState<{ key: string; index: number } | null>(null);

  useEffect(() => {
    if (!removed || items.some((item) => item.key === removed.key)) return;
    const target = items.length > 0 ? refs.current[Math.min(removed.index, items.length - 1)] : null;
    if (target) target.focus();
    else fallbackRef?.current?.focus();
    setRemoved(null);
  }, [removed, items, fallbackRef]);

  if (items.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2", show === "phone" && "md:hidden", className)} aria-label={t("shell.activeFilters")}>
      {items.map((item, index) => (
        <li key={item.key} className="max-w-full min-w-0">
          <button
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            onClick={() => {
              item.onRemove();
              setRemoved({ key: item.key, index });
            }}
            aria-label={t("shell.removeFilter", { label: item.label })}
            title={item.label}
            className="pressable inline-flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-(--radius-chip) border border-brand-soft-border bg-brand-soft pr-1.5 pl-2.5 text-[0.8125rem] font-medium text-brand-soft-fg hover:bg-brand-soft-border/60 active:bg-brand-soft-border pointer-coarse:min-h-11"
          >
            <span className="truncate">{item.label}</span>
            <X aria-hidden="true" className="size-4 shrink-0" />
          </button>
        </li>
      ))}
    </ul>
  );
}
