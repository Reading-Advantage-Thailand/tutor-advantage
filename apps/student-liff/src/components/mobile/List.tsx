import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ListGroupProps {
  /** Small label above the group (no uppercase — it does nothing for Thai). */
  header?: ReactNode;
  /** Small helper text under the group. */
  footer?: ReactNode;
  /**
   * true (default): rounded white card inside the 16px page gutter.
   * false: full-bleed list (cancels the gutter with -mx-4, no radius).
   */
  inset?: boolean;
  /** Rows. Keep <ListRow>s as direct children so inset dividers render. */
  children: ReactNode;
  className?: string;
  /** Accessible name when there is no visible header. */
  "aria-label"?: string;
}

/** Native-style grouped list container for <ListRow>s. Server-compatible. */
export function ListGroup({ header, footer, inset = true, children, className, ...rest }: ListGroupProps) {
  return (
    <section className={cn(!inset && "-mx-4", className)} aria-label={rest["aria-label"]}>
      {header ? (
        <h2 className="px-4 pb-2 text-[13px] leading-[1.5] font-semibold text-fg-muted">
          {header}
        </h2>
      ) : null}
      <div
        className={cn(
          "overflow-hidden bg-surface",
          inset
            ? "rounded-[var(--radius-card)] border border-hairline shadow-[var(--shadow-card)]"
            : "border-y border-hairline",
        )}
      >
        {children}
      </div>
      {footer ? (
        <p className="px-4 pt-2 text-xs leading-[1.5] text-fg-muted">{footer}</p>
      ) : null}
    </section>
  );
}

export interface ListRowProps {
  /** Renders a next/link (navigates). */
  href?: string;
  /** Renders a <button> (action). Ignored when `href` is set. */
  onClick?: MouseEventHandler<HTMLElement>;
  /** Left slot: <IconTile>, <UserAvatar>, number badge… (~40px). */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right slot: value text, <Chip>, <Switch>… */
  trailing?: ReactNode;
  /** Chevron at the end. Defaults to true when `href` is set. */
  chevron?: boolean;
  disabled?: boolean;
  /** Red title for destructive actions (ออกจากระบบ, ลบ…). */
  destructive?: boolean;
  className?: string;
  /** Max lines for the title and the subtitle before ellipsis (default 2). */
  lines?: 1 | 2;
}

/**
 * 56px+ list row with inset divider and press feedback. Renders a Link
 * (href), a button (onClick) or a static div. Server-compatible.
 */
export function ListRow({
  href,
  onClick,
  leading,
  title,
  subtitle,
  trailing,
  chevron,
  disabled,
  destructive,
  className,
  lines = 2,
}: ListRowProps) {
  const interactive = !disabled && (Boolean(href) || Boolean(onClick));
  const showChevron = chevron ?? Boolean(href);
  const clamp = lines === 1 ? "truncate" : "line-clamp-2";

  const classes = cn(
    "list-row flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left",
    interactive &&
      "cursor-pointer transition-colors duration-150 active:bg-press focus-visible:outline-offset-[-2px]",
    disabled && "opacity-50",
    className,
  );

  const content = (
    <>
      {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[15px] leading-[1.5] font-semibold",
            destructive ? "text-danger-fg" : "text-fg",
            clamp,
          )}
        >
          {title}
        </span>
        {subtitle ? (
          <span className={cn("block text-[13px] leading-[1.5] text-fg-muted", clamp)}>{subtitle}</span>
        ) : null}
      </span>
      {trailing ? (
        <span className="flex shrink-0 items-center gap-2 text-[13px] leading-[1.5] text-fg-muted">{trailing}</span>
      ) : null}
      {showChevron ? <ChevronRight className="-mr-1 size-5 shrink-0 text-fg-subtle" aria-hidden="true" /> : null}
    </>
  );

  const dataLeading = leading ? "" : undefined;

  if (href && !disabled) {
    return (
      <Link href={href} onClick={onClick} className={classes} data-leading={dataLeading}>
        {content}
      </Link>
    );
  }
  if (onClick || (href && disabled)) {
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

export interface ListRowSkeletonProps {
  /** Number of placeholder rows (default 3). */
  count?: number;
  /** Show the 40px leading placeholder (default true). */
  leading?: boolean;
  /** Show a subtitle line (default true). */
  subtitle?: boolean;
}

/** Placeholder rows matching <ListRow>; place inside a <ListGroup>. */
export function ListRowSkeleton({ count = 3, leading = true, subtitle = true }: ListRowSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="list-row flex min-h-14 items-center gap-3 px-4 py-3"
          data-leading={leading ? "" : undefined}
          aria-hidden="true"
        >
          {leading ? <Skeleton className="size-10 shrink-0 rounded-xl" /> : null}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className={cn("h-3.5 rounded-full", index % 2 ? "w-1/2" : "w-2/3")} />
            {subtitle ? <Skeleton className="h-3 w-1/3 rounded-full" /> : null}
          </div>
        </div>
      ))}
    </>
  );
}
