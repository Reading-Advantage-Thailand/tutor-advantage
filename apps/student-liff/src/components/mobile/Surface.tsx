import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SurfaceProps {
  children: ReactNode;
  /** Makes the whole card a link (gets press feedback). */
  href?: string;
  /** Makes the whole card a button (gets press feedback). Ignored with `href`. */
  onClick?: MouseEventHandler<HTMLElement>;
  /** Inner padding: none · sm 12px · md 16px (default) · lg 20px */
  padding?: "none" | "sm" | "md" | "lg";
  /** Element for static cards (default "div"). */
  as?: "div" | "section" | "article" | "li";
  /** Tinted variants for highlighted cards. */
  tone?: "default" | "brand" | "warning";
  className?: string;
  "aria-label"?: string;
}

const paddingClass = { none: "", sm: "p-3", md: "p-4", lg: "p-5" } as const;
const toneClass = {
  default: "border-hairline bg-surface",
  brand: "border-brand-soft-border bg-brand-soft",
  warning: "border-warning-border bg-warning-bg",
} as const;

/**
 * White card: 20px radius, hairline border, very soft shadow. Only
 * interactive cards (href/onClick) get press feedback — static cards never
 * shrink on touch. Server-compatible.
 */
export function Surface({
  children,
  href,
  onClick,
  padding = "md",
  as: Component = "div",
  tone = "default",
  className,
  ...rest
}: SurfaceProps) {
  const classes = cn(
    "block rounded-[var(--radius-card)] border text-left shadow-[var(--shadow-card)]",
    toneClass[tone],
    paddingClass[padding],
    (href || onClick) && "pressable w-full active:bg-press",
    className,
  );
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={classes} aria-label={rest["aria-label"]}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} aria-label={rest["aria-label"]}>
        {children}
      </button>
    );
  }
  return (
    <Component className={classes} aria-label={rest["aria-label"]}>
      {children}
    </Component>
  );
}
