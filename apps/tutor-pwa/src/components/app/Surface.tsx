import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";
import { thaiCopy, thaiLabel } from "@/lib/thaiText";
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

/**
 * Tappable card skin (components.md §3.1): clay rim, --shadow-tap (2px ledge),
 * --row-hover on hover (hover-capable pointers only) and a 1px press with the
 * ledge collapsed. Written as utilities on purpose: a component-layer class
 * on the same element loses to `bg-surface`/`shadow-card`. Use it instead of
 * those, never next to them (Surface, StatCard and DataTable phone cards).
 */
export const cardTapClass =
  "border-clay-rim bg-surface shadow-tap transition-[translate,box-shadow,background-color] duration-(--duration-press) ease-(--ease-out) [-webkit-tap-highlight-color:transparent] hover:bg-row-hover active:translate-y-px active:shadow-[0_1px_0_var(--clay-ledge)]";

const surfacePaddingClass = {
  none: "",
  sm: "p-3",
  md: "p-4 md:p-5",
  lg: "p-5 md:p-6",
} as const;

export interface SurfaceProps {
  children: ReactNode;
  /** Makes the whole card a link (tappable: ledge + press feedback). */
  href?: string;
  /** Makes the whole card a button. Ignored with `href`. */
  onClick?: MouseEventHandler<HTMLElement>;
  /** none · sm 12 · md 16/20 (default) · lg 20/24 */
  padding?: keyof typeof surfacePaddingClass;
  tone?: SurfaceTone;
  /** Element of a static card. Name a section/aside with `aria-labelledby` (its heading's id). */
  as?: "div" | "section" | "article" | "aside" | "li";
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/**
 * Card (components.md §3.1, tutor): white surface, 16px radius, the mandatory
 * 1px clay rim and the near-flat --shadow-card. Interactive cards
 * (href/onClick) are tappable: --shadow-tap (2px ledge) that presses down 1px;
 * static cards never move. A whole-card link has one accessible name and no
 * nested interactive elements. `id`, `aria-label` and `aria-labelledby` pass
 * through to the rendered element. Server-compatible.
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
  const tappable = interactive && tone === "default";
  const classes = cn(
    "block min-w-0 rounded-(--radius-card) border text-left",
    tappable ? cardTapClass : surfaceToneClass[tone],
    surfacePaddingClass[padding],
    interactive && "w-full cursor-pointer",
    interactive && !tappable && "pressable hover:brightness-[0.98]",
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
  /** Heading level of the title (default h3; h2 for a card that is a page section). */
  as?: "h2" | "h3";
  /** id of the heading, so the card can be named by it (`<Surface as="section" aria-labelledby={id}>`). */
  id?: string;
  /** Title size: "card" Noto 600 16 (default) · "section" Noto 600 18 (type-section, a panel that heads a page block). */
  size?: "card" | "section";
  /**
   * "start" (default): the title block and action sit at the top of the row.
   * "center": they centre on the leading icon when shorter than it (a one-line
   * title next to a 40px tile).
   */
  align?: "start" | "center";
  /** Balanced wrapping for a long dynamic title (a class or book name), so it leaves no one-word last line. Default off. */
  balance?: boolean;
  className?: string;
}

/**
 * Title row inside a Surface (use with padding="md"/"lg", or give it padding
 * with `className` on a padding="none" card). Server-compatible.
 */
export function CardHeader({
  title,
  description,
  icon,
  action,
  as: Heading = "h3",
  id,
  size = "card",
  align = "start",
  balance = false,
  className,
}: CardHeaderProps) {
  return (
    <div className={cn("mb-4 flex items-start gap-3", className)}>
      {icon}
      <div className={cn("min-w-0 flex-1", align === "center" && "self-center")}>
        <Heading id={id} className={cn(size === "section" ? "type-section" : "type-card", balance && "text-balance-th", "text-fg")}>
          {thaiLabel(title)}
        </Heading>
        {description ? <p className="mt-0.5 type-body-s text-fg-muted">{thaiCopy(description)}</p> : null}
      </div>
      {action ? <div className={cn("flex shrink-0 items-center gap-2", align === "center" && "self-center")}>{action}</div> : null}
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
          {header ? <h2 className="type-label font-semibold text-fg-muted">{header}</h2> : <span />}
          {headerAction}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-(--radius-card) border border-clay-rim bg-surface shadow-card">{children}</div>
      {footer ? <p className="px-1 pt-2 text-[0.8125rem] text-fg-muted">{footer}</p> : null}
    </section>
  );
}

export interface ListRowProps {
  /** Renders a next/link. */
  href?: string;
  /**
   * Renders a <button>. Ignored when `href` is set. With `actions` or as="li"
   * the row keeps its element and the title becomes a stretched button.
   */
  onClick?: MouseEventHandler<HTMLElement>;
  /** Left slot (~40px): IconTile, UserAvatar, date badge. */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Extra line under the subtitle: chips/meta (wraps). */
  meta?: ReactNode;
  /** Right slot: value, Chip, Switch, Button. In a row with `href`/`onClick` and `actions`, keep it static (it sits under the row target). */
  trailing?: ReactNode;
  /**
   * Secondary actions under the text (a setup link, a delete button). They sit
   * above the row's target: with `href` (or `onClick`) the title becomes a
   * stretched link (or button) over the whole row, so the row still opens as
   * one target and these stay clickable (no interactive element nested in
   * another).
   */
  actions?: ReactNode;
  /** Chevron at the end (default: true with href). */
  chevron?: boolean;
  disabled?: boolean;
  /** Red title for destructive actions. */
  destructive?: boolean;
  /** Selected (the record open beside the list): brand-soft fill + 3px inset bar. */
  selected?: boolean;
  /**
   * Max title/subtitle lines before ellipsis (default 2). "none": no clamp;
   * the title wraps balanced (long class or student names).
   */
  lines?: 1 | 2 | "none";
  /**
   * "center" (default): leading, text and trailing centre on each other.
   * "start": tall rows (meta, actions) keep the leading tile at the top;
   * trailing and the chevron stay centred.
   */
  align?: "center" | "start";
  /**
   * Element of a static row or a row with `actions` ("li" inside a <ul>).
   * Link and button rows are <a>/<button>, except an "li" (or a row with
   * `actions`): it keeps its element and its title becomes the stretched row
   * link or button.
   */
  as?: "div" | "li";
  /** Element of the title (default span). A heading suits a list of named records; not in whole-row onClick (button) rows. */
  titleAs?: "span" | "h2" | "h3";
  className?: string;
}

/** Stretched row link: an ::after over the whole row (the row is position: relative), inset focus ring. */
const stretchedLinkClass =
  "outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-3 focus-visible:after:-outline-offset-3 focus-visible:after:outline-solid focus-visible:after:outline-focus-ring";

/**
 * Flat 64px+ row with an inset divider (no ledge; the card is the container):
 * title Noto 600 16/1.6, subtitle 14/1.6 --text-secondary, chevron 16
 * --text-tertiary. Link (href), button (onClick) or static; with `actions` (or
 * as="li") the title is a stretched link/button and the actions sit above it.
 * Pressed --press-tint, hover --row-hover, selected --brand-soft with a 3px
 * --brand-solid bar. Server-compatible.
 */
export function ListRow({
  href,
  onClick,
  leading,
  title,
  subtitle,
  meta,
  trailing,
  actions,
  chevron,
  disabled,
  destructive,
  selected,
  lines = 2,
  align = "center",
  as: Outer = "div",
  titleAs: TitleTag = "span",
  className,
}: ListRowProps) {
  // A row that holds actions, or is an <li>, cannot itself be the <a>/<button> (no control
  // nested in another, no <button> straight in a <ul>): it keeps its own element and the title
  // becomes a stretched link (href) or button (onClick) over the whole row.
  const keepsElement = Boolean(actions) || Outer === "li";
  const stretchedLink = Boolean(keepsElement && href && !disabled);
  const stretchedButton = Boolean(keepsElement && !stretchedLink && onClick);
  const stretchedActive = stretchedLink || (stretchedButton && !disabled);
  const interactive = Boolean(href || onClick) && !disabled;
  const showChevron = chevron ?? Boolean(href);
  const clamp = lines === 1 ? "truncate" : lines === 2 ? "line-clamp-2" : "break-words";
  const centred = align === "start" && "self-center";
  // cn() knows text-balance-th as a wrap utility (lib/utils.ts), so it sits next to text-fg without dropping it.
  const balance = lines === "none" && "text-balance-th";
  // 16/1.6: a title may take two lines, and Thai needs the room for its upper and lower marks.
  const titleText = cn("text-base leading-[1.6] font-semibold text-fg", destructive && "text-danger-fg");
  const titleClass = cn(titleText, clamp, balance);
  // A heading title needs a flow-content column (a <span> may not hold an <h3>).
  const Column = TitleTag === "span" ? "span" : "div";
  const content = (
    <>
      {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
      <Column className="flex min-w-0 flex-1 flex-col">
        {stretchedButton ? (
          // A <button> lays out as an inline-block, so the clamp and balance go on a block inside it.
          <TitleTag className={titleText}>
            <button
              type="button"
              onClick={onClick}
              disabled={disabled}
              data-row-link=""
              className={cn(stretchedLinkClass, "block w-full cursor-pointer text-left disabled:cursor-default")}
              aria-current={selected ? "true" : undefined}
            >
              <span className={cn("block", clamp, balance)}>{title}</span>
            </button>
          </TitleTag>
        ) : (
          <TitleTag className={titleClass}>
            {stretchedLink && href ? (
              <Link href={href} onClick={onClick} data-row-link="" className={stretchedLinkClass} aria-current={selected ? "true" : undefined}>
                {title}
              </Link>
            ) : (
              title
            )}
          </TitleTag>
        )}
        {subtitle ? (
          // A row that is a link or button reads its subtitle as part of its name: spans only there, no no-break space.
          <span className={cn("text-sm leading-[1.6] text-fg-muted", clamp)}>{href || onClick ? thaiLabel(subtitle) : thaiCopy(subtitle)}</span>
        ) : null}
        {meta ? <span className="mt-1.5 flex flex-wrap items-center gap-1.5">{meta}</span> : null}
        {actions ? (
          // Only the controls sit above the row link; the gaps between them still open the row.
          <span className="pointer-events-none relative z-10 mt-2.5 flex flex-wrap items-center gap-2 [&>*]:pointer-events-auto">{actions}</span>
        ) : null}
      </Column>
      {trailing ? <span className={cn("flex shrink-0 items-center gap-2 text-sm text-fg-muted", centred)}>{trailing}</span> : null}
      {showChevron ? <ChevronRight aria-hidden="true" className={cn("size-4 shrink-0 text-fg-subtle", centred)} /> : null}
    </>
  );
  const classes = cn(
    "list-row flex min-h-16 w-full gap-3 px-4 py-3 text-left",
    align === "start" ? "items-start" : "items-center",
    interactive &&
      !keepsElement &&
      "cursor-pointer transition-colors duration-(--duration-fast) hover:bg-row-hover active:bg-press focus-visible:bg-row-hover focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus-ring",
    stretchedActive &&
      "transition-colors duration-(--duration-fast) has-[[data-row-link]:hover]:bg-row-hover has-[[data-row-link]:active]:bg-press",
    selected && "bg-brand-soft shadow-[inset_3px_0_0_var(--brand-solid)] hover:bg-brand-soft",
    disabled && "opacity-45",
    className,
  );
  const dataLeading = leading ? "" : undefined;
  if (href && !disabled && !keepsElement) {
    return (
      <Link href={href} onClick={onClick} className={classes} data-leading={dataLeading} aria-current={selected ? "true" : undefined}>
        {content}
      </Link>
    );
  }
  if (onClick && !keepsElement) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={classes} data-leading={dataLeading} aria-current={selected ? "true" : undefined}>
        {content}
      </button>
    );
  }
  return (
    <Outer className={classes} data-leading={dataLeading}>
      {content}
    </Outer>
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
 * Label/value pairs (class info, bank details): label 13 --text-secondary
 * above value 15. 1 column on phones, `columns` (default 2) on ≥768px.
 * Server-compatible.
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
          <dd className="mt-0.5 text-[0.9375rem] font-medium break-words text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
