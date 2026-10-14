import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ProgressBarTone = "brand" | "onBrand" | "warning";

export interface ProgressBarProps {
  /** 0–100 (clamped; NaN → 0). */
  value: number;
  /** brand (default) · onBrand (on hero surfaces) · warning (amber). */
  tone?: ProgressBarTone;
  /** sm 6px · md 8px (default) · lg 12px */
  size?: "sm" | "md" | "lg";
  /** Accessible name; defaults to t("common.progressAria"). */
  label?: string;
  className?: string;
}

const toneClass: Record<ProgressBarTone, { track: string; fill: string }> = {
  brand: { track: "bg-[var(--neutral-200)]", fill: "bg-brand-vivid" },
  onBrand: { track: "bg-hero-track", fill: "bg-brand-vivid" },
  warning: { track: "bg-warning-bg", fill: "bg-warning-solid" },
};

const sizeClass = { sm: "h-1.5", md: "h-2", lg: "h-3" } as const;

/** Clamps any number to the 0–100 range (NaN/±Infinity safe). */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return value === Infinity ? 100 : 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * Lightweight determinate progress bar (role="progressbar"). The fill moves
 * with a compositor-only transform. Server-compatible.
 */
export function ProgressBar({ value, tone = "brand", size = "md", label, className }: ProgressBarProps) {
  const percent = clampPercent(value);
  const colors = toneClass[tone];
  return (
    <div
      role="progressbar"
      aria-label={label ?? t("common.progressAria")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      className={cn("relative w-full overflow-hidden rounded-full", sizeClass[size], colors.track, className)}
    >
      <div
        className={cn("h-full w-full rounded-full transition-transform duration-500 ease-out", colors.fill)}
        style={{ transform: `translateX(${percent - 100}%)` }}
      />
    </div>
  );
}
