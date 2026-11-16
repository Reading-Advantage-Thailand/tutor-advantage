import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SurfaceTone = "default" | "brand" | "warning" | "muted" | "hero" | "success" | "danger" | "info";

export interface SurfaceProps {
  children: ReactNode;
  /** Makes the whole card a link (gets the clay ledge and press feedback). */
  href?: string;
  /** Makes the whole card a button (gets the clay ledge and press feedback). Ignored with `href`. */
  onClick?: MouseEventHandler<HTMLElement>;
  /** Inner padding: none · sm 12px · md 16px (default) · lg 20px */
  padding?: "none" | "sm" | "md" | "lg";
  /** Element for static cards (default "div"). */
  as?: "div" | "section" | "article" | "li";
  /**
   * default (white card) · brand (soft jade) · warning / success / danger / info
   * (status tones) · muted (well, no shadow) · hero (flat hero colour).
   */
  tone?: SurfaceTone;
  className?: string;
  /** id on the card element (e.g. a scroll or skip-link target). */
  id?: string;
  "aria-label"?: string;
  /** Names the card from a heading inside it: <Surface as="section" aria-labelledby="x"><h2 id="x">… */
  "aria-labelledby"?: string;
}

const paddingClass = { none: "", sm: "p-3", md: "p-4", lg: "p-5" } as const;
const toneClass: Record<SurfaceTone, string> = {
  default: "border-clay-rim bg-surface",
  brand: "border-brand-soft-border bg-brand-soft",
  warning: "border-warning-border bg-warning-bg",
  success: "border-success-border bg-success-bg",
  danger: "border-danger-border bg-danger-bg",
  info: "border-info-border bg-info-bg",
  muted: "border-transparent bg-surface-muted shadow-none",
  hero: "border-hero-ring bg-hero-bg-base text-hero-fg",
};

/**
 * Card (components.md §3.1): 24px radius, mandatory 1.5px clay rim, soft
 * container shadow. Only tappable cards (href/onClick) get the 4px clay ledge
 * and press down onto it — static cards never move. Server-compatible.
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
  const tappable = Boolean(href || onClick);
  const a11y = { id: rest.id, "aria-label": rest["aria-label"], "aria-labelledby": rest["aria-labelledby"] };
  const classes = cn(
    "block rounded-[var(--radius-card)] border-[1.5px] text-left shadow-[var(--shadow-card)]",
    toneClass[tone],
    paddingClass[padding],
    tappable &&
      "w-full shadow-[var(--shadow-tap)] transition-[translate,transform,box-shadow] duration-[var(--duration-press)] ease-[var(--ease-out)] [-webkit-tap-highlight-color:transparent] active:translate-y-[2px] active:shadow-[0_1px_0_var(--clay-ledge)]",
    className,
  );
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={classes} {...a11y}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} {...a11y}>
        {children}
      </button>
    );
  }
  return (
    <Component className={classes} {...a11y}>
      {children}
    </Component>
  );
}
