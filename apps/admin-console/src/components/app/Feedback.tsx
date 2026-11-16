import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, ChevronRight, Info, Inbox, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { keepThaiWords, thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { IconTile, type TileTone } from "./Atoms";

/* ─── EmptyState ──────────────────────────────────────────────────────── */

export interface EmptyStateProps {
  icon?: LucideIcon;
  tone?: TileTone;
  title: ReactNode;
  description?: ReactNode;
  /** Primary action (Button / Link styled as button). */
  action?: ReactNode;
  /** Inside a card/table area: less padding, no border. */
  compact?: boolean;
  /** Title heading level (default h2, right under the page h1). Use h3 under a Section/Sheet title, h1 on a page without one. */
  as?: "h1" | "h2" | "h3";
  className?: string;
}

/**
 * Friendly "nothing here yet" block with an icon, one sentence and an
 * optional action. Server-compatible.
 */
export function EmptyState({ icon = Inbox, tone = "neutral", title, description, action, compact, as: Heading = "h2", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "card px-6 py-10",
        className,
      )}
    >
      <IconTile icon={icon} tone={tone} size="md" />
      <Heading className="mt-3 text-base leading-normal font-semibold text-fg">{typeof title === "string" ? keepThaiWords(title) : title}</Heading>
      {/* Thai body line-height (1.6) and balanced lines, so a two-line help text does not end in one word. */}
      {description ? <p className="mt-1 max-w-md text-sm leading-[1.6] text-balance text-fg-muted">{thaiCopy(description)}</p> : null}
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/* ─── Notice ──────────────────────────────────────────────────────────── */

export type NoticeTone = "info" | "success" | "warning" | "danger" | "neutral" | "brand";

const noticeToneClass: Record<NoticeTone, string> = {
  info: "border-info-border bg-info-bg text-info-fg",
  success: "border-success-border bg-success-bg text-success-fg",
  warning: "border-warning-border bg-warning-bg text-warning-fg",
  danger: "border-danger-border bg-danger-bg text-danger-fg",
  neutral: "border-clay-rim bg-surface text-fg",
  brand: "border-brand-soft-border bg-brand-soft text-brand-soft-fg",
};

const noticeIcon: Record<NoticeTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  neutral: Info,
  brand: Info,
};

export interface NoticeProps {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: LucideIcon | null;
  /** Right side action (button/link). */
  action?: ReactNode;
  /** Makes the whole notice a link with a chevron. */
  href?: string;
  className?: string;
  role?: "status" | "alert";
}

/**
 * Inline banner for page-level messages (verification needed, saved, offline).
 * Calm by default: use "danger" only for real errors. Server-compatible.
 */
export function Notice({ tone = "info", title, children, icon, action, href, className, role }: NoticeProps) {
  const Icon = icon === null ? null : (icon ?? noticeIcon[tone]);
  const body = (
    <>
      {Icon ? <Icon aria-hidden="true" className="mt-px size-5 shrink-0" /> : null}
      <div className="min-w-0 flex-1">
        {/* A title that wraps is Thai body text too: 1.6 line height, balanced lines. */}
        {title ? <p className="text-[0.9375rem] leading-[1.6] font-semibold text-balance-th">{thaiCopy(title)}</p> : null}
        {children ? <div className={cn("text-sm leading-[1.6]", title && "mt-0.5")}>{thaiCopy(children)}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2 self-center">{action}</div> : null}
      {href ? <ChevronRight aria-hidden="true" className="size-4 shrink-0 self-center opacity-70" /> : null}
    </>
  );
  const classes = cn("flex items-start gap-3 rounded-(--radius-card) border px-3.5 py-3", noticeToneClass[tone], className);
  if (href) {
    return (
      <Link href={href} className={cn(classes, "pressable hover:brightness-[0.98] active:brightness-95")} role={role}>
        {body}
      </Link>
    );
  }
  return (
    <div className={classes} role={role}>
      {body}
    </div>
  );
}
