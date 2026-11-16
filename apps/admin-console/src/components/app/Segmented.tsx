"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Scrolls the nearest sideways-scrolling ancestor of `element` (a tab rail on
 * phones) just enough to show it, with `margin` px to spare. Only that rail's
 * scrollLeft changes: the page never scrolls (scrollIntoView could jump it
 * vertically when the rail is off-screen).
 */
function revealInRail(element: HTMLElement | null, margin = 8) {
  let rail = element?.parentElement ?? null;
  while (rail && rail !== document.body) {
    const overflowX = getComputedStyle(rail).overflowX;
    if ((overflowX === "auto" || overflowX === "scroll") && rail.scrollWidth > rail.clientWidth + 1) break;
    rail = rail.parentElement;
  }
  if (!element || !rail || rail === document.body) return;
  const railRect = rail.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  if (rect.left < railRect.left + margin) rail.scrollLeft -= railRect.left + margin - rect.left;
  else if (rect.right > railRect.right - margin) rail.scrollLeft += rect.right - (railRect.right - margin);
}

/* ─── SegmentedControl ────────────────────────────────────────────────── */

export interface SegmentedItem<V extends string> {
  value: V;
  label: ReactNode;
  icon?: LucideIcon;
  /** Small count after the label. */
  count?: number;
  disabled?: boolean;
}

export interface SegmentedControlProps<V extends string> {
  items: SegmentedItem<V>[];
  value: V;
  onValueChange: (value: V) => void;
  /** Accessible name of the group. */
  "aria-label": string;
  size?: "sm" | "md";
  /** Stretch segments to the full width (phones). */
  fullWidth?: boolean;
  className?: string;
}

/**
 * Pill segmented control for switching views/filters in place (list ↔ table,
 * week ↔ month, theme). A radio group: arrow keys move the selection.
 * For switching between routes use <TabNav>. In a sideways-scrolling rail
 * (FilterBar count tabs on phones) the selected segment is kept in view, on
 * mount, on change and when the counts arrive.
 */
export function SegmentedControl<V extends string>({
  items,
  value,
  onValueChange,
  size = "md",
  fullWidth,
  className,
  ...rest
}: SegmentedControlProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = items.filter((item) => !item.disabled);
  const selectedIndex = items.findIndex((item) => item.value === value);
  // Counts arriving widen the segments: show the selected one again then.
  const countsKey = items.map((item) => item.count ?? "").join(",");

  useEffect(() => {
    revealInRail(refs.current[selectedIndex] ?? null);
  }, [selectedIndex, countsKey]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta || enabled.length === 0) return;
    event.preventDefault();
    // Step from the radio that has focus, not the `value` prop: when the parent commits the change
    // asynchronously (useTableState's router.replace) the prop lags, and quick presses would be lost.
    const focused = enabled.findIndex((item) => refs.current[items.indexOf(item)] === event.currentTarget);
    const current = focused >= 0 ? focused : enabled.findIndex((item) => item.value === value);
    const next = enabled[(current + delta + enabled.length) % enabled.length];
    onValueChange(next.value);
    refs.current[items.indexOf(next)]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={rest["aria-label"]}
      data-size={size}
      data-full={fullWidth ? "" : undefined}
      className={cn("seg", className)}
    >
      {items.map((item, index) => {
        const selected = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            onKeyDown={onKeyDown}
            // relative: the sr-only separator below is absolutely positioned. Anchored to the segment, it
            // stays inside a sideways-scrolling rail instead of widening the page on phones.
            className="seg-item relative"
          >
            {Icon ? <Icon aria-hidden="true" /> : null}
            <span className="truncate">{item.label}</span>
            {item.count !== undefined ? (
              <span className="seg-count">
                {/* Accessible name "ติวเตอร์ 12", not "ติวเตอร์12": flex items get no space between them. */}
                <span className="sr-only">{" "}</span>
                {item.count.toLocaleString("th-TH")}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ─── TabNav (route tabs) ─────────────────────────────────────────────── */

export interface TabNavItem {
  href: string;
  label: ReactNode;
  count?: number;
  /** Match nested paths too (default: exact match). */
  matchPrefix?: boolean;
}

/**
 * Underlined tabs that navigate between sub-routes (e.g. class detail:
 * ภาพรวม · บทเรียน · นักเรียน). Scrolls horizontally on phones, with the
 * open tab kept in view.
 */
export function TabNav({ items, className, "aria-label": ariaLabel }: { items: TabNavItem[]; className?: string; "aria-label"?: string }) {
  const pathname = usePathname() ?? "";
  const navRef = useRef<HTMLElement>(null);
  const tabsKey = items.map((item) => item.href).join("|");

  // Phones: the row scrolls sideways; keep the open tab in view (e.g. the last one).
  useEffect(() => {
    revealInRail(navRef.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? null, 16);
  }, [pathname, tabsKey]);

  return (
    <nav ref={navRef} aria-label={ariaLabel} className={cn("-mx-4 overflow-x-auto px-4 scrollbar-hide md:mx-0 md:px-0", className)}>
      <ul className="flex min-w-max gap-5 border-b border-hairline">
        {items.map((item) => {
          const active = item.matchPrefix ? pathname === item.href || pathname.startsWith(`${item.href}/`) : pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-11 items-center gap-1.5 rounded-t-(--radius-ctl-sm) text-sm whitespace-nowrap transition-colors focus-ring-inset",
                  active ? "font-semibold text-fg" : "font-medium text-fg-muted hover:text-fg",
                )}
              >
                {item.label}
                {item.count !== undefined ? (
                  <span className={cn("text-xs font-semibold tabular", active ? "text-brand-fg" : "text-fg-subtle")}>
                    <span className="sr-only">{" "}</span>
                    {item.count}
                  </span>
                ) : null}
                {active ? <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-[3px] rounded-t-full bg-brand-solid" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
