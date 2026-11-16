import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { MouseEventHandler } from "react";
import { cn } from "@/lib/utils";

export type IconButtonVariant = "ghost" | "tonal" | "onBrand";

export interface IconButtonProps {
  /** Lucide icon component, e.g. `ChevronLeft`. */
  icon: LucideIcon;
  /** Accessible name — required because the control has no visible text. */
  label: string;
  /** Renders a next/link when set; otherwise a <button type="button">. */
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  /** ghost (default, transparent) · tonal (card + clay rim + ledge) · onBrand (paper chip on the hero). */
  variant?: IconButtonVariant;
  /** Red count (number) or dot (true) at the top-right corner. */
  badge?: number | boolean;
  disabled?: boolean;
  /** Use replace navigation for href (e.g. closing a pushed screen). */
  replace?: boolean;
  className?: string;
}

const variantClass: Record<IconButtonVariant, string> = {
  ghost: "text-fg active:bg-press",
  tonal:
    "border-[1.5px] border-clay-rim bg-surface text-fg shadow-[0_3px_0_var(--clay-ledge)] transition-[translate,transform,box-shadow] duration-[var(--duration-press)] ease-[var(--ease-out)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--clay-ledge)]",
  onBrand: "border-[1.5px] border-hero-ring bg-hero-chip text-hero-fg active:bg-hero-ring",
};

/**
 * 44×44 round icon-only button (components.md §2.4), glyph 22 / stroke 2.2,
 * press feedback (no hover-only affordance). Badge: a number → 20px danger
 * pill (reading 600 12, tabular); `true` → 10px danger dot.
 * Server-compatible; pass `onClick` only from client components.
 */
export function IconButton({
  icon: Icon,
  label,
  href,
  onClick,
  variant = "ghost",
  badge,
  disabled,
  replace,
  className,
}: IconButtonProps) {
  const classes = cn(
    "pressable relative inline-flex size-11 shrink-0 items-center justify-center rounded-full",
    "disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none",
    variantClass[variant],
    className,
  );
  const content = (
    <>
      <Icon className="size-[22px]" strokeWidth={2.2} aria-hidden="true" />
      {badge ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute flex items-center justify-center rounded-full bg-danger-solid text-xs leading-none font-semibold text-on-danger tabular-nums ring-2 ring-surface",
            typeof badge === "number" ? "-top-0.5 -right-1 h-5 min-w-5 px-1.5" : "top-1.5 right-1.5 size-2.5",
          )}
        >
          {typeof badge === "number" ? (badge > 99 ? "99+" : badge) : null}
        </span>
      ) : null}
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} replace={replace} aria-label={label} onClick={onClick} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className={classes}>
      {content}
    </button>
  );
}
