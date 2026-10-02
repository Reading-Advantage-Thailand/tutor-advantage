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
  /** ghost (default, transparent) · tonal (soft grey fill) · onBrand (white on green). */
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
  tonal: "bg-fill-muted text-fg active:bg-press",
  onBrand: "text-white active:bg-white/15",
};

/**
 * 44×44 icon-only button with press feedback (no hover-only affordance).
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
    "disabled:pointer-events-none disabled:opacity-40",
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
            "absolute top-1 right-1 flex items-center justify-center rounded-full bg-danger-solid text-[11px] leading-none font-bold text-white ring-2 ring-surface",
            typeof badge === "number" ? "h-[18px] min-w-[18px] px-1" : "size-2.5",
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
