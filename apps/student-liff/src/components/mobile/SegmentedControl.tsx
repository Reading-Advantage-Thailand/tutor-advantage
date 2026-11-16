"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SegmentedControlItem<T extends string = string> {
  value: T;
  label: ReactNode;
  /**
   * Optional 16px icon before the label (ThemeSegmented: sun / moon /
   * monitor). It shows only when the segment has room for it next to a label
   * of up to ~7 Thai letters (each segment is a container query), so the word
   * never truncates on a 320px phone.
   */
  icon?: LucideIcon;
  /** Small count after the label (e.g. unread). Hidden when 0/undefined. */
  badge?: number;
  /** id of the tab panel this segment controls (sets aria-controls). */
  controls?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  items: SegmentedControlItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the tablist. */
  "aria-label"?: string;
  /**
   * md (default): 15px labels, 12px segment padding · compact: 14px labels,
   * 4px segment padding and a tighter track, so three segments with icons
   * ("ตามระบบ") fit a list row at 320–390. Both stay 44px tall.
   */
  size?: "md" | "compact";
  className?: string;
}

// Icon thresholds are the segment's content width (container queries measure
// inside the padding): icon 16 + gap + a ~7-letter Thai label ("ตามระบบ" is
// 65px bold at 14px, 69px at 15px), with a few px to spare.
const sizeClass = {
  md: { track: "gap-1 p-1", segment: "gap-1.5 px-3 text-[15px]", icon: "@min-[6rem]:block" },
  compact: { track: "gap-0.5 p-[3px]", segment: "gap-1 px-1 text-sm", icon: "@min-[5.5rem]:block" },
} as const;

/**
 * Segmented control (role="tablist", components.md §8): muted track with a
 * 1.5px clay rim, 44px pills, equal-width segments, arrow-key navigation. The
 * selected pill is a white card with a 2px clay ledge and a heavier label
 * (selection is fill + weight, not colour alone); counts are tabular numbers.
 */
export function SegmentedControl<T extends string = string>({
  items,
  value,
  onChange,
  size = "md",
  className,
  ...rest
}: SegmentedControlProps<T>) {
  const s = sizeClass[size];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    onChange(items[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={rest["aria-label"]}
      className={cn(
        "flex w-full items-stretch rounded-full border-[1.5px] border-clay-rim bg-surface-muted",
        s.track,
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
            role="tab"
            aria-selected={selected}
            aria-controls={item.controls}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "relative flex h-11 min-w-0 flex-1 items-center justify-center rounded-full font-heading transition-colors duration-[var(--duration-fast)]",
              // Line height after the size: tailwind-merge drops a leading-* that comes before a text size.
              s.segment,
              "leading-[1.3]",
              // Each segment is a size container, so its icon can show only when it fits.
              Icon && "@container",
              "focus-visible:outline-offset-0",
              selected
                ? "bg-surface font-bold text-fg shadow-[0_2px_0_var(--clay-ledge)]"
                : "font-semibold text-fg-muted active:bg-press",
            )}
          >
            {Icon ? <Icon aria-hidden="true" className={cn("hidden size-4 shrink-0", s.icon)} strokeWidth={2.4} /> : null}
            <span className="truncate">{item.label}</span>
            {item.badge ? (
              <span
                className={cn(
                  "shrink-0 font-sans text-sm leading-none font-semibold tabular-nums",
                  selected ? "text-brand-fg" : "text-fg-subtle",
                )}
              >
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
