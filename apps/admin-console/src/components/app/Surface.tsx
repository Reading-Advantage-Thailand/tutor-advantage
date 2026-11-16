import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ─── Surface / Card ──────────────────────────────────────────────────── */

export type SurfaceTone = "default" | "muted" | "brand" | "hero" | "success" | "warning" | "danger" | "info";

const surfaceToneClass: Record<SurfaceTone, string> = {
  default: "border-clay-rim bg-surface shadow-card",
  muted: "border-transparent bg-surface-muted",
  brand: "border-brand-soft-border bg-brand-soft",
  hero: "border-hero-ring bg-hero-bg-base text-hero-fg",
  success: "border-success-border bg-success-bg",
  warning: "border-warning-border bg-warning-bg",
  danger: "border-danger-border bg-danger-bg",
  info: "border-info-border bg-info-bg",
};

const surfacePaddingClass = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
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
 * Card: --surface-card, 12px radius, the mandatory 1px --clay-rim, near-flat shadow.
 * Interactive cards (href/onClick) are flat: hover --row-hover, press --press-tint;
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
      "pressable w-full cursor-pointer active:bg-press",
    interactive && tone === "default" && "hover:bg-row-hover",
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
  /** Title heading level (default h2, right under the page h1). Use h3 inside a Section. */
  as?: "h1" | "h2" | "h3";
  className?: string;
}

/** Title row inside a Surface (use with padding="md"/"lg"). Server-compatible. */
export function CardHeader({ title, description, icon, action, as: Heading = "h2", className }: CardHeaderProps) {
  return (
    <div className={cn("mb-4 flex items-start gap-3", className)}>
      {icon}
      <div className="min-w-0 flex-1">
        <Heading className="text-base leading-normal font-semibold text-fg">{title}</Heading>
        {description ? <p className="mt-0.5 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

/* ─── ListGroup / ListRow ─────────────────────────────────────────────── */

/** Plain text (string/number) doubles as the tooltip of a clamped line. */
function tooltipFor(node: ReactNode): string | undefined {
  return typeof node === "string" || typeof node === "number" ? String(node) : undefined;
}

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
        <div className="flex min-h-9 items-center justify-between gap-3 px-0.5 pb-2">
          {header ? <h2 className="text-base leading-normal font-semibold text-fg">{header}</h2> : <span />}
          {headerAction}
        </div>
      ) : null}
      <div className="card overflow-hidden">{children}</div>
      {footer ? <p className="px-1 pt-2 text-xs leading-[1.6] text-fg-muted">{footer}</p> : null}
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
  /** Row title. A string or number is also the tooltip (`title`), so a clamped value can still be read in full. */
  title: ReactNode;
  /** Secondary line. A string or number is also the tooltip, like `title`. */
  subtitle?: ReactNode;
  /** Classes for the subtitle line, e.g. "text-balance" for a sentence that wraps to two lines. */
  subtitleClassName?: string;
  /** Extra line under the subtitle: chips/meta (wraps). */
  meta?: ReactNode;
  /** Right slot: value, Chip, Switch, Button. */
  trailing?: ReactNode;
  /** Chevron at the end (default: true with href). */
  chevron?: boolean;
  disabled?: boolean;
  /** The record open in a side sheet: --brand-soft with a 3px jade bar on the leading edge. */
  selected?: boolean;
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
  subtitleClassName,
  meta,
  trailing,
  chevron,
  disabled,
  selected,
  destructive,
  lines = 2,
  className,
}: ListRowProps) {
  const interactive = Boolean(href || onClick) && !disabled;
  const showChevron = chevron ?? Boolean(href);
  const clamp = lines === 1 ? "truncate" : "line-clamp-2";
  // A title that may wrap gets the Thai body leading (1.6); a one-line title keeps the tight 1.45.
  const titleClamp = lines === 1 ? "truncate leading-[1.45]" : "line-clamp-2 leading-[1.6]";
  const content = (
    <>
      {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-sm font-semibold text-fg", titleClamp, destructive && "text-danger-fg")} title={tooltipFor(title)}>
          {title}
        </span>
        {subtitle ? (
          <span className={cn("text-[0.8125rem] leading-[1.6] text-fg-muted", clamp, subtitleClassName)} title={tooltipFor(subtitle)}>
            {subtitle}
          </span>
        ) : null}
        {meta ? <span className="mt-1.5 flex flex-wrap items-center gap-1.5">{meta}</span> : null}
      </span>
      {trailing ? <span className="flex shrink-0 items-center gap-2 text-sm text-fg-muted">{trailing}</span> : null}
      {showChevron ? <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" /> : null}
    </>
  );
  const classes = cn(
    "list-row flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left",
    interactive && "pressable cursor-pointer hover:bg-row-hover active:bg-press focus-ring-inset",
    disabled && "opacity-45",
    className,
  );
  const dataLeading = leading ? "" : undefined;
  if (href && !disabled) {
    return (
      <Link href={href} onClick={onClick} className={classes} data-leading={dataLeading} data-selected={selected ? "" : undefined}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={classes} data-leading={dataLeading} data-selected={selected ? "" : undefined}>
        {content}
      </button>
    );
  }
  return (
    <div className={classes} data-leading={dataLeading} data-selected={selected ? "" : undefined}>
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
