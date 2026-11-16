import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, ChevronRight, Info, Inbox, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { ReedyMini } from "@/components/mascot/ReedyMini";
import { thaiCopy, thaiLabel } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { IconTile, type TileTone } from "./Atoms";

/* ─── EmptyState ──────────────────────────────────────────────────────── */

export interface EmptyStateProps {
  icon?: LucideIcon;
  tone?: TileTone;
  /** Tone tile size: lg 48 (default) · xl 56 (errors and not-found, components.md §10). */
  iconSize?: "lg" | "xl";
  title: ReactNode;
  /** Heading level of the title (default h3). A full-page state (not found) uses "h1". */
  headingAs?: "h1" | "h2" | "h3";
  description?: ReactNode;
  /** Primary or tonal action (Button / Link styled as button). */
  action?: ReactNode;
  /**
   * Show Reedy (calm, 72px) instead of the icon tile (components.md §10, the
   * tutor empty state). At most one Reedy per screen, so pages opt in.
   */
  mascot?: boolean;
  /** Inside a card/table area: less padding, no card. */
  compact?: boolean;
  className?: string;
}

/**
 * "Nothing here yet" (components.md §10): a normal card (rim, no dashed
 * border) with Reedy calm 72 (`mascot`) or a tone tile, a title (section
 * size), one line of help (14/1.6, balanced so a narrow card keeps no
 * one-word last line) and one action. Server-compatible.
 */
export function EmptyState({
  icon = Inbox,
  tone = "neutral",
  iconSize = "lg",
  title,
  headingAs: Heading = "h3",
  description,
  action,
  mascot,
  compact,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "rounded-(--radius-card) border border-clay-rim bg-surface px-6 py-10 shadow-card",
        className,
      )}
    >
      {mascot ? <ReedyMini mood="calm" size={72} decorative /> : <IconTile icon={icon} tone={tone} size={iconSize} />}
      <Heading className="mt-4 type-section text-balance-th text-fg">{thaiLabel(title)}</Heading>
      {description ? <p className="mt-1 max-w-md text-sm leading-[1.6] text-balance-th text-fg-muted">{thaiCopy(description)}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
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
 * Tone banner for page-level messages (components.md §10 Notice): *-bg + 1px
 * *-border, card radius, padding 12 14, icon 20, title 600 15 (balanced) +
 * description 14, both at the Thai body line-height 1.6, in the tone's text
 * colour, a chevron when the whole notice links.
 * Calm by default: use "danger" only for real errors. Server-compatible.
 */
export function Notice({ tone = "info", title, children, icon, action, href, className, role }: NoticeProps) {
  const Icon = icon === null ? null : (icon ?? noticeIcon[tone]);
  const body = (
    <>
      {Icon ? <Icon aria-hidden="true" className="size-5 shrink-0" /> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="text-[0.9375rem] leading-[1.6] font-semibold text-balance-th">{thaiLabel(title)}</p> : null}
        {/* A notice that is a link reads its text as the link's name: spans only there, no no-break space. */}
        {children ? <div className="text-sm leading-[1.6]">{href ? thaiLabel(children) : thaiCopy(children)}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      {href ? <ChevronRight aria-hidden="true" className="size-5 shrink-0" /> : null}
    </>
  );
  const classes = cn("flex items-center gap-3 rounded-(--radius-card) border px-3.5 py-3", noticeToneClass[tone], className);
  if (href) {
    return (
      <Link href={href} className={cn(classes, "pressable hover:brightness-[0.98]")} role={role}>
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
