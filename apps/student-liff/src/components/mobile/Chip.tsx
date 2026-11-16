import type { LucideIcon } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Chip tones (components.md §4). `paper` sits on the hero (`onBrand` is its old
 * name and still works). `sun` is the reward chip (streak, points): at most one
 * sunshine group per view.
 */
export type ChipTone =
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "paper"
  | "onBrand"
  | "sun";

export interface ChipProps {
  children: ReactNode;
  tone?: ChipTone;
  /** sm: 24px, reading face 600 12 (default) · md: 32px, Kodchasan 600 14 */
  size?: "sm" | "md";
  /**
   * Size on narrow phones, under `narrowBelow` px: an md chip with a long
   * label drops to sm there (the landing programme chip at 320) instead of
   * wrapping or overflowing.
   */
  narrowSize?: "sm";
  /** Viewport width the narrow size applies under: 375 (default) or 360. */
  narrowBelow?: 360 | 375;
  icon?: LucideIcon;
  /** Fill the icon (rewards only: star, crown, trophy). */
  iconFilled?: boolean;
  /** Small leading 6px status dot in the tone colour. */
  dot?: boolean;
  className?: string;
}

const toneClass: Record<ChipTone, string> = {
  brand: "border-transparent bg-brand-soft text-brand-soft-fg",
  success: "border-transparent bg-success-bg text-success-fg",
  warning: "border-transparent bg-warning-bg text-warning-fg",
  danger: "border-transparent bg-danger-bg text-danger-fg",
  info: "border-transparent bg-info-bg text-info-fg",
  neutral: "border-transparent bg-tile-neutral text-icon-neutral",
  paper: "border-hero-ring bg-hero-chip text-hero-fg",
  onBrand: "border-hero-ring bg-hero-chip text-hero-fg",
  sun: "border-transparent bg-accent-solid text-on-accent shadow-[inset_0_0_0_1.5px_var(--accent-edge)]",
};

// sm look under a breakpoint (static class names, so Tailwind generates them).
const narrowSmClass = {
  375: "max-[375px]:h-6 max-[375px]:gap-1 max-[375px]:px-2.5 max-[375px]:font-sans max-[375px]:text-xs max-[375px]:leading-[1.5]",
  360: "max-[360px]:h-6 max-[360px]:gap-1 max-[360px]:px-2.5 max-[360px]:font-sans max-[360px]:text-xs max-[360px]:leading-[1.5]",
} as const;
const narrowSmIconClass = { 375: "max-[375px]:size-3.5", 360: "max-[360px]:size-3.5" } as const;

/**
 * Status / label pill (non-interactive). Status = colour + dot or icon + a word.
 * Text never goes below 12px; Kodchasan only at md (14px). Server-compatible.
 */
export function Chip({
  children,
  tone = "neutral",
  size = "sm",
  narrowSize,
  narrowBelow = 375,
  icon: Icon,
  iconFilled,
  dot,
  className,
}: ChipProps) {
  const narrowSm = size === "md" && narrowSize === "sm";
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center rounded-full border-[1.5px] whitespace-nowrap",
        size === "sm"
          ? "h-6 gap-1 px-2.5 text-xs leading-[1.5] font-semibold"
          : "h-8 gap-1.5 px-3 font-heading text-sm leading-[1.4] font-semibold",
        narrowSm && narrowSmClass[narrowBelow],
        toneClass[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      {Icon ? (
        <Icon
          aria-hidden="true"
          className={cn(
            size === "sm" ? "size-3.5" : "size-4",
            narrowSm && narrowSmIconClass[narrowBelow],
            iconFilled && "fill-current",
          )}
          strokeWidth={iconFilled ? 1.5 : 2.4}
        />
      ) : null}
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
 * Toggleable filter pill (aria-pressed). 36px visual with a 44px hit area;
 * 1.5px field border at rest; selected = soft jade fill + check icon (not
 * colour alone). Use inside <HScroll> for a scrollable filter row.
 *
 * Hit area: a fixed 44px ::before centred on the chip (4px past the 36px border
 * box each way). It is sized, not inset: an inset is measured from the padding
 * box, so it shrinks with the border (and browsers snap 1.5px borders), and it
 * must not outgrow HScroll's 4px rail padding (the rail would scroll vertically).
 * Kodchasan is for the label only: small (`text-xs`) parts such as a level or a
 * changing count fall back to the reading face (Kodchasan never under 14px).
 */
export function FilterChip({ selected, onClick, children, count, icon: Icon, disabled, className }: FilterChipProps) {
  const LeadingIcon = selected ? Check : Icon;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "pressable relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 font-heading text-sm leading-[1.4] font-semibold whitespace-nowrap [&_.text-xs]:font-sans",
        "before:absolute before:inset-x-0 before:top-[calc(50%-22px)] before:h-11 before:content-['']",
        "disabled:opacity-45",
        selected
          ? "border-brand-soft-border bg-brand-soft text-brand-soft-fg active:bg-brand-soft-border"
          : "border-field-border bg-surface text-fg active:bg-press",
        className,
      )}
    >
      {LeadingIcon ? <LeadingIcon aria-hidden="true" className="size-4" strokeWidth={selected ? 2.6 : 2.2} /> : null}
      {children}
      {typeof count === "number" ? (
        <span
          className={cn(
            "font-sans text-xs leading-[1.5] tabular-nums",
            selected ? "text-brand-soft-fg" : "text-fg-subtle",
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
 * Horizontal scroller for chip rails (filters only, not main content cards)
 * that bleeds to the screen edges (cancels the 16px page gutter), contains
 * overscroll and hides the scrollbar. Server-compatible.
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
