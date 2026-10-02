import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface BrandMarkProps {
  /** sm 36px · md 48px · lg 72px · xl 88px */
  size?: "sm" | "md" | "lg" | "xl";
  /**
   * "onBrand": white app-icon tile with green letters (on the green gradient).
   * "brand": green gradient tile with white letters (on light surfaces).
   */
  tone?: "onBrand" | "brand";
  className?: string;
}

const sizeClass = {
  sm: "size-9 rounded-[11px] text-[13px]",
  md: "size-12 rounded-[14px] text-base",
  lg: "size-[72px] rounded-[22px] text-2xl",
  xl: "size-[88px] rounded-[26px] text-[30px]",
} as const;

const toneClass = {
  onBrand: "bg-white text-brand-700 shadow-[0_10px_30px_-10px_rgb(0_0_0/0.45)]",
  brand: "bg-gradient-brand text-white shadow-[0_6px_16px_-6px_rgb(22_163_74/0.45)]",
} as const;

/** "TA" app-icon monogram used on the splash, login and landing screens. Decorative; server-compatible. */
export function BrandMark({ size = "md", tone = "brand", className }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center leading-none font-extrabold tracking-tight select-none",
        sizeClass[size],
        toneClass[tone],
        className,
      )}
    >
      {t("entry.brandMonogram")}
    </span>
  );
}
