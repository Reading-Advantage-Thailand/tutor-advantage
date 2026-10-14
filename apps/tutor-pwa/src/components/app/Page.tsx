import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { ShellTitle } from "./ShellContext";

/* ─── Page ────────────────────────────────────────────────────────────── */

export type PageWidth = "narrow" | "medium" | "default" | "full";

const pageWidthClass: Record<PageWidth, string> = {
  /** forms, settings, single-column reading (768px) */
  narrow: "max-w-3xl",
  /** detail pages with one main column (1024px) */
  medium: "max-w-5xl",
  /** dashboards, lists, tables: fills the shell content area (≤1280px) */
  default: "",
  /** edge to edge of the content area (wide tables, schedule grid) */
  full: "",
};

export interface PageProps {
  width?: PageWidth;
  className?: string;
  children: ReactNode;
}

/**
 * Page wrapper: centres the page at a max width and stacks its blocks with a
 * consistent 24px rhythm (32px on desktop). Server-compatible.
 * Structure: <Page> → <PageHeader/> → <Section/>… (→ <StickyActions/> for forms).
 */
export function Page({ width = "default", className, children }: PageProps) {
  return (
    <div className={cn("mx-auto flex w-full min-w-0 flex-col gap-6 lg:gap-8", pageWidthClass[width], className)}>
      {children}
    </div>
  );
}

/* ─── PageHeader ──────────────────────────────────────────────────────── */

export interface PageHeaderProps {
  title: ReactNode;
  /** One short sentence under the title. */
  description?: ReactNode;
  /** Buttons on the right (desktop) / under the text (mobile). Put the primary action last. */
  actions?: ReactNode;
  /** Small row under the description: chips, meta text. */
  meta?: ReactNode;
  /** Desktop "← label" link above the title; also the mobile app-bar back target. */
  backHref?: string;
  backLabel?: string;
  /** Plain-text title for the mobile app bar (defaults to `title` when it is a string). */
  appBarTitle?: string;
  /**
   * On phones the app bar already shows the title, so the H1 is visually
   * hidden by default ("appbar"). Use "inline" to also show it in the page
   * (e.g. a class name that is longer than the bar).
   */
  mobileTitle?: "appbar" | "inline";
  className?: string;
}

/**
 * Page title block. Desktop: 24px bold title + description, actions on the
 * right. Phone: the title moves to the sticky app bar; description and
 * actions stay. Registers the app-bar title/back target. Server-compatible.
 */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  backHref,
  backLabel,
  appBarTitle,
  mobileTitle = "appbar",
  className,
}: PageHeaderProps) {
  const barTitle = appBarTitle ?? (typeof title === "string" ? title : undefined);
  const hasBody = Boolean(description || meta || mobileTitle === "inline");
  return (
    <header className={cn("flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-6", className)}>
      <ShellTitle title={barTitle} backHref={backHref} />
      <div className={cn("min-w-0 flex-1", !hasBody && "max-md:contents")}>
        {backHref ? (
          <Link
            href={backHref}
            className="mb-2 hidden items-center gap-1 rounded-md text-sm font-medium text-fg-muted hover:text-fg md:inline-flex"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            {backLabel ?? t("shell.back")}
          </Link>
        ) : null}
        <h1
          className={cn(
            "text-xl font-bold text-fg text-balance-th md:text-2xl",
            mobileTitle === "appbar" && "max-md:sr-only",
          )}
        >
          {title}
        </h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-fg-muted md:text-[0.9375rem]">{description}</p> : null}
        {meta ? <div className="mt-2.5 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">{actions}</div> : null}
    </header>
  );
}

/* ─── Section ─────────────────────────────────────────────────────────── */

export interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned link/button (e.g. "ดูทั้งหมด"). */
  action?: ReactNode;
  /** Heading level (default h2). */
  as?: "h2" | "h3";
  id?: string;
  className?: string;
}

/** Section title row. Server-compatible. */
export function SectionHeader({ title, description, action, as: Heading = "h2", id, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <Heading id={id} className="text-base font-semibold text-fg">
          {title}
        </Heading>
        {description ? <p className="mt-0.5 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export interface SectionProps extends Omit<SectionHeaderProps, "title" | "id"> {
  title?: ReactNode;
  /** Anchor id (e.g. #verify) on the section element. */
  id?: string;
  children: ReactNode;
}

/** Titled block of a page: header + content with a 12px gap. Server-compatible. */
export function Section({ title, description, action, as, id, className, children }: SectionProps) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("flex min-w-0 flex-col gap-3", className)}>
      {title ? <SectionHeader title={title} description={description} action={action} as={as} id={headingId} /> : null}
      {children}
    </section>
  );
}

/* ─── Layout helpers ──────────────────────────────────────────────────── */

export interface ToolbarProps {
  children: ReactNode;
  className?: string;
}

/** Search + filter row above a list/table: wraps on phones, one line on desktop. */
export function Toolbar({ children, className }: ToolbarProps) {
  return <div className={cn("flex flex-wrap items-center gap-2 md:flex-nowrap", className)}>{children}</div>;
}

/**
 * Responsive card grid. `cols` is the desktop column count (≥1024px); it is
 * 1 column on phones and min(cols, 2) on tablets.
 */
export function Grid({
  cols = 3,
  className,
  children,
}: {
  cols?: 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 md:gap-4",
        cols >= 2 && "sm:grid-cols-2",
        cols === 3 && "lg:grid-cols-3",
        cols === 4 && "lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Main + side column layout for detail pages (side column 320px on ≥1024px,
 * stacked below on smaller screens; put the side first in DOM order only if it
 * matters more on phones).
 */
export function SplitLayout({
  main,
  side,
  className,
}: {
  main: ReactNode;
  side: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8", className)}>
      <div className="flex min-w-0 flex-col gap-6">{main}</div>
      <aside className="flex min-w-0 flex-col gap-6">{side}</aside>
    </div>
  );
}

/**
 * Form action bar that sticks to the bottom of the viewport (above the mobile
 * tab bar) while the form scrolls. Put it as the last child of the form.
 */
export function StickyActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("sticky-actions flex items-center justify-end gap-2", className)}>{children}</div>
  );
}
