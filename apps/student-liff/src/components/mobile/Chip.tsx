import type { LucideIcon } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChipTone = "brand" | "success" | "warning" | "danger" | "info" | "neutral" | "onBrand";

export interface ChipProps {
  children: ReactNode;
  tone?: ChipTone;
  /** sm: 24px / 12px text (default) · md: 30px / 13px text */
  size?: "sm" | "md";
  icon?: LucideIcon;
  /** Small leading status dot in the tone colour. */
  dot?: boolean;
  className?: string;
}

const toneClass: Record<ChipTone, string> = {
  brand: "border-brand-soft-border bg-brand-soft text-brand-fg",
  success: "border-success-border bg-success-bg text-success-fg",
  warning: "border-warning-border bg-warning-bg text-warning-fg",
  danger: "border-danger-border bg-danger-bg text-danger-fg",
  info: "border-info-border bg-info-bg text-info-fg",
  neutral: "border-transparent bg-fill-muted text-fg-muted",
  onBrand: "border-hero-ring bg-hero-chip text-hero-fg",
};

/** Status / label pill (non-interactive). Text never goes below 12px. Server-compatible. */
export function Chip({ children, tone = "neutral", size = "sm", icon: Icon, dot, className }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border font-semibold whitespace-nowrap",
        size === "sm" ? "h-6 px-2.5 text-xs leading-[1.5]" : "h-[30px] px-3 text-[13px] leading-[1.5]",
        toneClass[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      {Icon ? <Icon aria-hidden="true" className={size === "sm" ? "size-3.5" : "size-4"} strokeWidth={2.4} /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

export interface FilterChipProps {
  selected: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
  /** Optional count shown inside the chip. */
  count?: number;
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
}

/**
 * Toggleable filter pill (aria-pressed). 40px visual height with a 44px+ hit
 * area. Use inside <HScroll> for a scrollable filter row.
 */
export function FilterChip({ selected, onClick, children, count, icon: Icon, disabled, className }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "pressable relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm leading-[1.5] font-semibold whitespace-nowrap",
        "before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
        "disabled:opacity-50",
        selected
          ? "border-transparent bg-brand-solid text-white active:bg-brand-solid-pressed"
          : "border-hairline bg-surface text-fg-muted active:bg-press",
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-4" strokeWidth={2.2} /> : null}
      {children}
      {typeof count === "number" ? (
        <span
          className={cn(
            "rounded-full px-1.5 text-xs leading-[1.5] tabular-nums",
            selected ? "bg-white/20 text-white" : "bg-fill-muted text-fg-muted",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export interface HScrollProps {
  children: ReactNode;
  /** Snap children to the start edge while scrolling. */
  snap?: boolean;
  /** Gap between items in px (default 8). */
  gap?: 8 | 12 | 16;
  className?: string;
  "aria-label"?: string;
}

const gapClass = { 8: "gap-2", 12: "gap-3", 16: "gap-4" } as const;

/**
 * Horizontal scroller that bleeds to the screen edges (cancels the 16px page
 * gutter), contains overscroll and hides the scrollbar. Server-compatible.
 */
export function HScroll({ children, snap, gap = 8, className, ...rest }: HScrollProps) {
  return (
    <div
      role={rest["aria-label"] ? "group" : undefined}
      aria-label={rest["aria-label"]}
      className={cn(
        "scrollbar-hide -mx-4 flex overflow-x-auto overscroll-x-contain px-4 py-1 [-webkit-overflow-scrolling:touch]",
        gapClass[gap],
        snap && "snap-x snap-mandatory scroll-px-4 *:snap-start",
        className,
      )}
    >
      {children}
    </div>
  );
}
