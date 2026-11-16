"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Arrow keys (and Home/End) → the next enabled index, wrapping; null for other keys. */
function nextEnabledIndex<I extends { disabled?: boolean }>(items: I[], current: number, key: string): number | null {
  const enabled = items.map((item, index) => (item.disabled ? -1 : index)).filter((index) => index >= 0);
  if (enabled.length === 0) return null;
  if (key === "Home") return enabled[0];
  if (key === "End") return enabled[enabled.length - 1];
  const delta = key === "ArrowRight" || key === "ArrowDown" ? 1 : key === "ArrowLeft" || key === "ArrowUp" ? -1 : 0;
  if (!delta) return null;
  const position = enabled.indexOf(current);
  return enabled[(position + delta + enabled.length) % enabled.length];
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
  /**
   * sm 32 · md 40 (default) · lg 44, the height of a SearchField/TextField
   * beside it. Every size is 44px per segment under a coarse pointer.
   */
  size?: "sm" | "md" | "lg";
  /**
   * Stretch segments to the full width: true (always) or "mobile" (full width
   * on phones, natural width from 768px, e.g. beside a search field).
   */
  fullWidth?: boolean | "mobile";
  /** Let long labels wrap onto two centred lines instead of truncating ("ในประเทศไทย (Thailand)"). */
  wrapLabels?: boolean;
  className?: string;
}

// Below 360px a wrapping md segment gives 4px back to the label, so "บัตรประชาชนไทย" stays on one line at 320px.
const segmentSize = {
  sm: { fixed: "h-8 px-2.5 text-[0.8125rem] pointer-coarse:h-11", wrap: "min-h-8 px-2.5 py-1.5 text-[0.8125rem] pointer-coarse:min-h-11" },
  md: { fixed: "h-[34px] px-3 text-sm pointer-coarse:h-11", wrap: "min-h-[34px] px-3 py-1.5 text-sm pointer-coarse:min-h-11 max-[360px]:px-2.5" },
  lg: { fixed: "h-9 px-3.5 text-sm pointer-coarse:h-11", wrap: "min-h-9 px-3.5 py-1.5 text-sm pointer-coarse:min-h-11" },
} as const;

/**
 * Segmented control for switching views/filters in place (list ↔ table,
 * week ↔ month, theme): --surface-muted track with a 1px clay rim; the
 * selected segment is a card pill with weight 600 and a rim (never colour
 * alone), optional tabular counts. 40 tall on desktop (lg 44), 44px segments
 * on touch. A radio group: arrow keys move the selection. For routes use
 * <TabNav>.
 */
export function SegmentedControl<V extends string>({
  items,
  value,
  onValueChange,
  size = "md",
  fullWidth,
  wrapLabels,
  className,
  ...rest
}: SegmentedControlProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = items.filter((item) => !item.disabled);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta || enabled.length === 0) return;
    event.preventDefault();
    const current = enabled.findIndex((item) => item.value === value);
    const next = enabled[(current + delta + enabled.length) % enabled.length];
    onValueChange(next.value);
    refs.current[items.indexOf(next)]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={rest["aria-label"]}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-(--radius-ctl) border border-clay-rim bg-surface-muted p-[3px]",
        fullWidth === true && "flex w-full",
        fullWidth === "mobile" && "flex w-full md:inline-flex md:w-auto md:shrink-0",
        wrapLabels && "items-stretch",
        className,
      )}
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
            className={cn(
              "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-[9px] transition-[color,background-color,box-shadow] duration-(--duration-fast) outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-focus-ring disabled:opacity-45",
              wrapLabels ? segmentSize[size].wrap : cn("whitespace-nowrap", segmentSize[size].fixed),
              fullWidth === true && "flex-1",
              fullWidth === "mobile" && "flex-1 md:flex-none",
              selected
                ? "bg-surface font-semibold text-fg shadow-[0_1px_2px_rgb(40_30_15/0.10),0_0_0_1px_var(--clay-rim)]"
                : "font-medium text-fg-muted hover:text-fg",
            )}
          >
            {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
            {/* Wrapped Thai labels keep the 1.6 line height of multi-line Thai (README §4.2). */}
            <span className={wrapLabels ? "text-center leading-[1.6]" : "truncate"}>{item.label}</span>
            {item.count !== undefined ? (
              <span className={cn("text-xs font-semibold tabular", selected ? "text-brand-fg" : "text-fg-subtle")}>{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ─── TabNav (route tabs, or in-page tabs) ────────────────────────────── */

/** A route tab (links to a sub-route). */
export interface TabNavItem {
  href: string;
  label: ReactNode;
  count?: number;
  /** Match nested paths too (default: exact match). */
  matchPrefix?: boolean;
}

/** An in-page tab (swaps content on this page). */
export interface TabNavOption<V extends string> {
  value: V;
  label: ReactNode;
  count?: number;
  disabled?: boolean;
  /** id of the panel this tab shows (aria-controls; tabs semantics). */
  controls?: string;
}

interface TabNavRouteProps {
  items: TabNavItem[];
  value?: undefined;
  onValueChange?: undefined;
  className?: string;
  "aria-label"?: string;
}

interface TabNavInPageProps<V extends string> {
  items: TabNavOption<V>[];
  /** The selected tab: in-page mode (buttons, no navigation). */
  value: V;
  onValueChange: (value: V) => void;
  /**
   * "tabs" (default): role tablist/tab; give each panel role="tabpanel" and
   * aria-labelledby={`${idPrefix}-${value}`}. "radiogroup": a filter that
   * swaps one list in place (no panels).
   */
  semantics?: "tabs" | "radiogroup";
  /** Prefix of the tab ids (tabs semantics), default "tab". */
  idPrefix?: string;
  className?: string;
  "aria-label": string;
}

export type TabNavProps<V extends string = string> = TabNavRouteProps | TabNavInPageProps<V>;

const tabClass = (active: boolean) =>
  cn(
    "relative inline-flex h-11 items-center gap-1.5 text-[0.9375rem] whitespace-nowrap transition-colors duration-(--duration-fast)",
    active ? "font-semibold text-fg" : "font-medium text-fg-muted hover:text-fg",
  );

function TabBody({ label, count, active }: { label: ReactNode; count?: number; active: boolean }) {
  return (
    <>
      {label}
      {count !== undefined ? <span className="text-xs text-fg-subtle tabular">{count}</span> : null}
      {active ? <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-brand-solid" /> : null}
    </>
  );
}

/**
 * Horizontal scroller around the tabs. The 5px padding (cancelled by a
 * negative margin, so the layout does not move) keeps the 3px focus ring with
 * its 2px offset inside the scroller, which would otherwise clip it.
 */
const tabScrollerClass = "-mx-4 -my-[5px] overflow-x-auto px-4 py-[5px] scrollbar-hide md:-mx-[5px] md:px-[5px]";

/**
 * Underlined tabs (class detail: ภาพรวม · บทเรียน · นักเรียน): 44 tall, the
 * active tab in weight 600 with a 3px --brand-solid bar. Scrolls horizontally
 * on phones. Route mode (items with href): links, the active one by pathname
 * (aria-current="page"). In-page mode (value + onValueChange): buttons with
 * tab (or radio) semantics, arrow keys and Home/End move the selection.
 */
export function TabNav<V extends string = string>(props: TabNavProps<V>) {
  const pathname = usePathname() ?? "";
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  if (props.value === undefined) {
    const { items, className, "aria-label": ariaLabel } = props as TabNavRouteProps;
    return (
      <nav aria-label={ariaLabel} className={cn(tabScrollerClass, className)}>
        <ul className="flex min-w-max gap-5 border-b border-hairline">
          {items.map((item) => {
            const active = item.matchPrefix ? pathname === item.href || pathname.startsWith(`${item.href}/`) : pathname === item.href;
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                  <TabBody label={item.label} count={item.count} active={active} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  const { items, value, onValueChange, semantics = "tabs", idPrefix = "tab", className, "aria-label": ariaLabel } = props as TabNavInPageProps<V>;
  const tabs = semantics === "tabs";
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextEnabledIndex(items, index, event.key);
    if (next === null) return;
    event.preventDefault();
    onValueChange(items[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div className={cn(tabScrollerClass, className)}>
      <div role={tabs ? "tablist" : "radiogroup"} aria-label={ariaLabel} className="flex min-w-max gap-5 border-b border-hairline">
        {items.map((item, index) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="button"
              role={tabs ? "tab" : "radio"}
              id={tabs ? `${idPrefix}-${item.value}` : undefined}
              aria-selected={tabs ? active : undefined}
              aria-checked={tabs ? undefined : active}
              aria-controls={tabs ? item.controls : undefined}
              tabIndex={active ? 0 : -1}
              disabled={item.disabled}
              onClick={() => onValueChange(item.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(tabClass(active), "disabled:opacity-45")}
            >
              <TabBody label={item.label} count={item.count} active={active} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
