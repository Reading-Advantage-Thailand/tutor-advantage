"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedControlItem<T extends string = string> {
  value: T;
  label: ReactNode;
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
  className?: string;
}

/**
 * iOS-style segmented control (role="tablist"): 44px tall, equal-width
 * segments, arrow-key navigation, optional count badges.
 */
export function SegmentedControl<T extends string = string>({
  items,
  value,
  onChange,
  className,
  ...rest
}: SegmentedControlProps<T>) {
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
      className={cn("flex h-11 w-full items-stretch gap-1 rounded-full bg-fill-muted p-1", className)}
    >
      {items.map((item, index) => {
        const selected = item.value === value;
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
              "relative flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm leading-[1.5] font-semibold transition-colors duration-150",
              "before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] focus-visible:outline-offset-0",
              selected ? "bg-surface text-fg shadow-[0_1px_3px_rgb(15_23_42/0.12)]" : "text-fg-muted active:bg-press",
            )}
          >
            <span className="truncate">{item.label}</span>
            {item.badge ? (
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 text-[11px] leading-[1.6] font-bold tabular-nums",
                  selected ? "bg-brand-solid text-white" : "bg-danger-solid text-white",
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
