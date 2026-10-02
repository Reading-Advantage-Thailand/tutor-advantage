import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CloudOff, Info, OctagonAlert, RotateCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { IconTile, type IconTileTone } from "./IconTile";

/* ─── EmptyState ─────────────────────────────────────────────────────────── */

export interface EmptyStateProps {
  icon: LucideIcon;
  /** Defaults to t("common.emptyTitle"). */
  title?: ReactNode;
  description?: ReactNode;
  /** One primary action, e.g. <Button variant="brand" size="touch">…</Button>. */
  action?: ReactNode;
  tone?: IconTileTone;
  className?: string;
}

/** Friendly in-list empty state (icon, title, one action). Server-compatible. */
export function EmptyState({ icon, title, description, action, tone = "brand", className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <IconTile icon={icon} tone={tone} size="lg" shape="circle" className="size-16 [&>svg]:size-7" />
      <h3 className="mt-4 text-base leading-[1.45] font-bold text-fg">{title ?? t("common.emptyTitle")}</h3>
      {description ? (
        <p className="mt-1 max-w-[300px] text-sm leading-[1.6] text-fg-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ─── ErrorState ─────────────────────────────────────────────────────────── */

export interface ErrorStateProps {
  /** Defaults to t("common.errorTitle"). */
  title?: ReactNode;
  /** Defaults to t("common.errorDescription"). Never show raw technical errors. */
  description?: ReactNode;
  /** Shows a retry button. Prefer a refetch over window.location.reload(). */
  onRetry?: () => void;
  /** Defaults to t("common.retry"). */
  retryLabel?: string;
  /** True while a retry is in flight (spinner on the button). */
  retrying?: boolean;
  /** Extra action under retry, e.g. a "กลับหน้าหลัก" link button. */
  secondaryAction?: ReactNode;
  /** Use "offline" for network errors (cloud icon + network copy default). */
  kind?: "error" | "offline";
  className?: string;
}

/** Kid-friendly error block with a single clear retry. Server-compatible (pass onRetry from a client component). */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  retrying,
  secondaryAction,
  kind = "error",
  className,
}: ErrorStateProps) {
  const offline = kind === "offline";
  return (
    <div role="alert" className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <IconTile
        icon={offline ? CloudOff : AlertTriangle}
        tone={offline ? "neutral" : "amber"}
        size="lg"
        shape="circle"
        className="size-16 [&>svg]:size-7"
      />
      <h3 className="mt-4 text-base leading-[1.45] font-bold text-fg">
        {title ?? (offline ? t("common.offlineTitle") : t("common.errorTitle"))}
      </h3>
      <p className="mt-1 max-w-[300px] text-sm leading-[1.6] text-fg-muted">
        {description ?? (offline ? t("common.networkError") : t("common.errorDescription"))}
      </p>
      {onRetry || secondaryAction ? (
        <div className="mt-5 flex w-full max-w-[280px] flex-col items-stretch gap-2">
          {onRetry ? (
            <Button variant="brand" size="touch" onClick={onRetry} loading={retrying}>
              {retrying ? null : <RotateCw aria-hidden="true" />}
              {retryLabel ?? t("common.retry")}
            </Button>
          ) : null}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

/* ─── StatusScreen ───────────────────────────────────────────────────────── */

export interface StatusScreenProps {
  icon: LucideIcon;
  tone?: IconTileTone;
  title: ReactNode;
  description?: ReactNode;
  /** Main action (full-width CTA recommended). */
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  /** Extra content between the text and the actions. */
  children?: ReactNode;
  className?: string;
}

/**
 * Full-height centred state for blocking situations (not found, payment
 * required, coming soon, kicked from lesson…). Fills the remaining height of a
 * <Screen> (put it after the <AppBar>). Server-compatible.
 */
export function StatusScreen({
  icon,
  tone = "brand",
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
  className,
}: StatusScreenProps) {
  return (
    <div
      className={cn(
        "flex min-h-[60dvh] flex-1 flex-col items-center justify-center px-6 pt-8 pb-[calc(32px+var(--safe-bottom))] text-center",
        className,
      )}
    >
      <IconTile icon={icon} tone={tone} size="lg" shape="circle" className="size-20 [&>svg]:size-9" />
      <h2 className="mt-5 text-xl leading-[1.4] font-extrabold text-fg">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-[320px] text-[15px] leading-[1.6] text-fg-muted">{description}</p>
      ) : null}
      {children ? <div className="mt-5 w-full max-w-[360px]">{children}</div> : null}
      {primaryAction || secondaryAction ? (
        <div className="mt-7 flex w-full max-w-[320px] flex-col items-stretch gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

/* ─── Notice ─────────────────────────────────────────────────────────────── */

export type NoticeTone = "info" | "success" | "warning" | "danger" | "brand";

export interface NoticeProps {
  tone?: NoticeTone;
  /** Defaults to a tone-appropriate icon. */
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** Small action under the text, e.g. <Button size="touch" variant="brandSoft">. */
  action?: ReactNode;
  className?: string;
  /** Pass "alert" for errors that appear after a user action. */
  role?: "status" | "alert";
}

const noticeToneClass: Record<NoticeTone, { box: string; fg: string; icon: LucideIcon }> = {
  info: { box: "border-info-border bg-info-bg", fg: "text-info-fg", icon: Info },
  success: { box: "border-success-border bg-success-bg", fg: "text-success-fg", icon: CheckCircle2 },
  warning: { box: "border-warning-border bg-warning-bg", fg: "text-warning-fg", icon: AlertTriangle },
  danger: { box: "border-danger-border bg-danger-bg", fg: "text-danger-fg", icon: OctagonAlert },
  brand: { box: "border-brand-soft-border bg-brand-soft", fg: "text-brand-fg", icon: Sparkles },
};

/** Inline callout (icon + bold title + description + optional action). Server-compatible. */
export function Notice({ tone = "info", icon, title, description, action, className, role }: NoticeProps) {
  const toneStyle = noticeToneClass[tone];
  const Icon = icon ?? toneStyle.icon;
  return (
    <div role={role} className={cn("flex gap-3 rounded-2xl border p-4", toneStyle.box, className)}>
      <Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", toneStyle.fg)} strokeWidth={2.2} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-[1.5] font-bold", toneStyle.fg)}>{title}</p>
        {description ? <div className="mt-0.5 text-[13px] leading-[1.6] text-fg-muted">{description}</div> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}

/* ─── StatTile ───────────────────────────────────────────────────────────── */

export interface StatTileProps {
  icon: LucideIcon;
  value: ReactNode;
  label: ReactNode;
  tone?: IconTileTone;
  className?: string;
}

/** Compact metric card (icon, big value, small label) for 2–3 column grids. Server-compatible. */
export function StatTile({ icon, value, label, tone = "brand", className }: StatTileProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-[var(--radius-card)] border border-hairline bg-surface p-3 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <IconTile icon={icon} tone={tone} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-xl leading-[1.4] font-extrabold text-fg tabular-nums">{value}</p>
        <p className="line-clamp-2 text-xs leading-[1.5] text-fg-muted">{label}</p>
      </div>
    </div>
  );
}

/* ─── BottomActionBar ────────────────────────────────────────────────────── */

export interface BottomActionBarProps {
  children: ReactNode;
  className?: string;
}

/**
 * Sticky bottom action area for pushed screens (no TabBar): opaque surface,
 * top hairline, safe-area padding. Place it as the LAST child of <Screen>; it
 * sits at the bottom of short pages and sticks while long pages scroll.
 * Children are laid out in a row with 12px gaps — give the primary button
 * `className="flex-1"`.
 */
export function BottomActionBar({ children, className }: BottomActionBarProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-[var(--z-appbar)] mt-auto border-t border-hairline bg-surface px-4 pt-3 pb-[calc(12px+var(--safe-bottom))]",
        className,
      )}
    >
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}
