import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ─── Surface / Card ──────────────────────────────────────────────────── */

export type SurfaceTone = "default" | "muted" | "brand" | "hero" | "success" | "warning" | "danger" | "info";

const surfaceToneClass: Record<SurfaceTone, string> = {
  default: "border-hairline bg-surface shadow-card",
  muted: "border-transparent bg-surface-muted",
  brand: "border-brand-soft-border bg-brand-soft",
  hero: "border-hero-ring bg-hero text-hero-fg",
  success: "border-success-border bg-success-bg",
  warning: "border-warning-border bg-warning-bg",
  danger: "border-danger-border bg-danger-bg",
  info: "border-info-border bg-info-bg",
};

const surfacePaddingClass = {
  none: "",
  sm: "p-3",
  md: "p-4 md:p-5",
  lg: "p-5 md:p-6",
} as const;

export interface SurfaceProps {
  children: ReactNode;
  /** Makes the whole card a link (hover + press feedback). */
  href?: string;
  /** Makes the whole card a button. Ignored with `href`. */
  onClick?: MouseEventHandler<HTMLElement>;
  /** none · sm 12 · md 16/20 (default) · lg 20/24 */
  padding?: keyof typeof surfacePaddingClass;
  tone?: SurfaceTone;
  as?: "div" | "section" | "article" | "li";
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/**
 * Card: white surface, 12px radius, hairline border, near-flat shadow.
 * Interactive cards (href/onClick) get a hover border + press feedback;
 * static cards never move. Server-compatible.
 */
export function Surface({
  children,
  href,
  onClick,
  padding = "md",
  tone = "default",
  as: Component = "div",
  className,
  ...rest
}: SurfaceProps) {
  const interactive = Boolean(href || onClick);
  const classes = cn(
    "block min-w-0 rounded-xl border text-left",
    surfaceToneClass[tone],
    surfacePaddingClass[padding],
    interactive &&
      "pressable w-full cursor-pointer hover:border-hairline-strong focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
    className,
  );
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={classes} {...rest}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} {...rest}>
        {children}
      </button>
    );
  }
  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}

/** Alias: `Card` reads better in page code. Same props as Surface. */
export const Card = Surface;

export interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Leading icon/IconTile. */
  icon?: ReactNode;
  /** Right side: link, button, chip. */
  action?: ReactNode;
  className?: string;
}

/** Title row inside a Surface (use with padding="md"/"lg"). Server-compatible. */
export function CardHeader({ title, description, icon, action, className }: CardHeaderProps) {
  return (
    <div className={cn("mb-4 flex items-start gap-3", className)}>
      {icon}
      <div className="min-w-0 flex-1">
        <h3 className="text-[0.9375rem] font-semibold text-fg">{title}</h3>
        {description ? <p className="mt-0.5 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

/* ─── ListGroup / ListRow ─────────────────────────────────────────────── */

export interface ListGroupProps {
  /** Small label above the group (sentence case; never uppercase Thai). */
  header?: ReactNode;
  /** Right side of the header row (e.g. "ดูทั้งหมด" link). */
  headerAction?: ReactNode;
  /** Helper text under the group. */
  footer?: ReactNode;
  /** Keep <ListRow>s as direct children so dividers render. */
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

/** Card containing divided rows (settings lists, recent items). Server-compatible. */
export function ListGroup({ header, headerAction, footer, children, className, ...rest }: ListGroupProps) {
  return (
    <section className={cn("min-w-0", className)} aria-label={rest["aria-label"]}>
      {header || headerAction ? (
        <div className="flex min-h-8 items-center justify-between gap-3 px-1 pb-1.5">
          {header ? <h2 className="text-sm font-semibold text-fg-muted">{header}</h2> : <span />}
          {headerAction}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-card">{children}</div>
      {footer ? <p className="px-1 pt-2 text-xs text-fg-muted">{footer}</p> : null}
    </section>
  );
}

export interface ListRowProps {
  /** Renders a next/link. */
  href?: string;
  /** Renders a <button>. Ignored when `href` is set. */
  onClick?: MouseEventHandler<HTMLElement>;
  /** Left slot (~40px): IconTile, UserAvatar, date badge. */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Extra line under the subtitle: chips/meta (wraps). */
  meta?: ReactNode;
  /** Right slot: value, Chip, Switch, Button. */
  trailing?: ReactNode;
  /** Chevron at the end (default: true with href). */
  chevron?: boolean;
  disabled?: boolean;
  /** Red title for destructive actions. */
  destructive?: boolean;
  /** Max title/subtitle lines before ellipsis (default 2). */
  lines?: 1 | 2;
  className?: string;
}

/**
 * 56px+ row with an inset divider; Link (href), button (onClick) or static.
 * Server-compatible.
 */
export function ListRow({
  href,
  onClick,
  leading,
  title,
  subtitle,
  meta,
  trailing,
  chevron,
  disabled,
  destructive,
  lines = 2,
  className,
}: ListRowProps) {
  const interactive = Boolean(href || onClick) && !disabled;
  const showChevron = chevron ?? Boolean(href);
  const clamp = lines === 1 ? "truncate" : "line-clamp-2";
  const content = (
    <>
      {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-sm font-medium text-fg md:text-[0.9375rem]", clamp, destructive && "text-danger-fg")}>
          {title}
        </span>
        {subtitle ? <span className={cn("text-[0.8125rem] text-fg-muted", clamp)}>{subtitle}</span> : null}
        {meta ? <span className="mt-1.5 flex flex-wrap items-center gap-1.5">{meta}</span> : null}
      </span>
      {trailing ? <span className="flex shrink-0 items-center gap-2 text-sm text-fg-muted">{trailing}</span> : null}
      {showChevron ? <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" /> : null}
    </>
  );
  const classes = cn(
    "list-row flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left",
    interactive && "pressable cursor-pointer hover:bg-surface-muted active:bg-press focus-visible:bg-surface-muted focus-visible:outline-none",
    disabled && "opacity-50",
    className,
  );
  const dataLeading = leading ? "" : undefined;
  if (href && !disabled) {
    return (
      <Link href={href} onClick={onClick} className={classes} data-leading={dataLeading}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={classes} data-leading={dataLeading}>
        {content}
      </button>
    );
  }
  return (
    <div className={classes} data-leading={dataLeading}>
      {content}
    </div>
  );
}

/* ─── DescriptionList ─────────────────────────────────────────────────── */

export interface DescriptionItem {
  label: ReactNode;
  value: ReactNode;
  /** Span both columns on desktop (long text). */
  wide?: boolean;
}

/**
 * Label/value pairs (class info, bank details). 1 column on phones,
 * `columns` (default 2) on ≥768px. Server-compatible.
 */
export function DescriptionList({
  items,
  columns = 2,
  className,
}: {
  items: DescriptionItem[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-4",
        columns === 2 && "md:grid-cols-2",
        columns === 3 && "md:grid-cols-3",
        className,
      )}
    >
      {items.map((item, index) => (
        <div key={index} className={cn("min-w-0", item.wide && "md:col-span-full")}>
          <dt className="text-[0.8125rem] text-fg-muted">{item.label}</dt>
          <dd className="mt-0.5 text-sm font-medium break-words text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
