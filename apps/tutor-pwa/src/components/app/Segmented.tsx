"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

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
 * For switching between routes use <TabNav>.
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
        "inline-flex items-center gap-0.5 rounded-lg bg-fill-muted p-0.5",
        fullWidth && "flex w-full",
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
              "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm pointer-coarse:h-9",
              fullWidth && "flex-1",
              selected ? "bg-surface text-fg shadow-xs dark:bg-surface-elevated" : "text-fg-muted hover:text-fg",
            )}
          >
            {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
            <span className="truncate">{item.label}</span>
            {item.count !== undefined ? (
              <span className={cn("text-xs tabular", selected ? "text-fg-muted" : "text-fg-subtle")}>{item.count}</span>
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
 * ภาพรวม · บทเรียน · นักเรียน). Scrolls horizontally on phones.
 */
export function TabNav({ items, className, "aria-label": ariaLabel }: { items: TabNavItem[]; className?: string; "aria-label"?: string }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label={ariaLabel} className={cn("-mx-4 overflow-x-auto px-4 scrollbar-hide md:mx-0 md:px-0", className)}>
      <ul className="flex min-w-max gap-5 border-b border-hairline">
        {items.map((item) => {
          const active = item.matchPrefix ? pathname === item.href || pathname.startsWith(`${item.href}/`) : pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center gap-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "text-brand-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {item.label}
                {item.count !== undefined ? <span className="text-xs text-fg-subtle tabular">{item.count}</span> : null}
                {active ? <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-vivid" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
