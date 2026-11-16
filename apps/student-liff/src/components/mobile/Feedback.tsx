import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CloudOff, Info, OctagonAlert, RotateCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { ReedyMini, type ReedyMood } from "@/components/mascot/ReedyMini";
import { IconTile, iconTileToneClass, type IconTileTone } from "./IconTile";

/** Default Reedy mood for a status tone (warnings/errors look worried, neutral stays calm). */
function moodForTone(tone: IconTileTone): ReedyMood {
  if (tone === "amber" || tone === "red") return "oops";
  if (tone === "neutral" || tone === "blue") return "calm";
  return "happy";
}

/**
 * The "normal card" of patterns.md "Empty, error and loading": rim, card
 * radius and the container shadow (no ledge: it is not tappable).
 */
const stateCardClass = "rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface shadow-[var(--shadow-card)]";

/* ─── EmptyState ─────────────────────────────────────────────────────────── */

export interface EmptyStateProps {
  icon: LucideIcon;
  /** Defaults to t("common.emptyTitle"). */
  title?: ReactNode;
  description?: ReactNode;
  /** One primary action, e.g. <Button variant="brand" size="touch">…</Button>. */
  action?: ReactNode;
  tone?: IconTileTone;
  /**
   * Reedy mascot mood (default "calm"); the icon becomes a small badge beside him.
   * Pass false to show only the plain icon tile.
   */
  mascot?: ReedyMood | false;
  /** Title heading level: h2 under a screen's h1 (default); one below the section heading when nested. */
  headingLevel?: "h2" | "h3" | "h4";
  /**
   * Render as a normal card (rim, card radius, container shadow), as
   * patterns.md asks for empty states in page content. Default false: bare,
   * for a state that already sits inside a card or fills a screen.
   */
  card?: boolean;
  className?: string;
}

/**
 * Friendly in-list empty state (Reedy + icon badge, title, one action). The
 * description wraps in balanced lines; a string description also keeps Thai
 * compounds whole (thaiCopy). Server-compatible.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "brand",
  mascot = "calm",
  headingLevel: Heading = "h2",
  card = false,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", card && stateCardClass, className)}>
      {mascot ? (
        <ReedyMini mood={mascot} size="md" decorative badge={<Icon strokeWidth={2.4} />} badgeClassName={iconTileToneClass[tone]} />
      ) : (
        <IconTile icon={Icon} tone={tone} size="lg" shape="circle" className="size-16 [&>svg]:size-7" />
      )}
      <Heading className="mt-4 font-heading text-lg leading-[1.4] font-semibold text-balance text-fg">{title ?? t("common.emptyTitle")}</Heading>
      {description ? (
        <p className="mt-1 max-w-[300px] text-[15px] leading-[1.6] text-balance text-fg-muted">{thaiCopy(description)}</p>
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
  /** Reedy mascot mood (default "oops"). Pass false to show only the plain icon tile. */
  mascot?: ReedyMood | false;
  /** Title heading level: h2 under a screen's h1 (default); one below the section heading when nested. */
  headingLevel?: "h2" | "h3" | "h4";
  /**
   * Render as a normal card (rim, card radius, container shadow), as
   * patterns.md asks for load errors in page content. Default false: bare,
   * for an error that already sits inside a card or fills a screen.
   */
  card?: boolean;
  className?: string;
}

/**
 * Kid-friendly error block with a single clear retry; the description wraps
 * in balanced lines and a string one keeps Thai compounds whole (thaiCopy).
 * Server-compatible (pass onRetry from a client component).
 */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  retrying,
  secondaryAction,
  kind = "error",
  mascot = "oops",
  headingLevel: Heading = "h2",
  card = false,
  className,
}: ErrorStateProps) {
  const offline = kind === "offline";
  const Icon = offline ? CloudOff : AlertTriangle;
  const tone: IconTileTone = offline ? "neutral" : "amber";
  return (
    <div role="alert" className={cn("flex flex-col items-center px-6 py-10 text-center", card && stateCardClass, className)}>
      {mascot ? (
        <ReedyMini mood={mascot} size="md" decorative badge={<Icon strokeWidth={2.4} />} badgeClassName={iconTileToneClass[tone]} />
      ) : (
        <IconTile icon={Icon} tone={tone} size="lg" shape="circle" className="size-16 [&>svg]:size-7" />
      )}
      <Heading className="mt-4 font-heading text-lg leading-[1.4] font-semibold text-balance text-fg">
        {title ?? (offline ? t("common.offlineTitle") : t("common.errorTitle"))}
      </Heading>
      <p className="mt-1 max-w-[300px] text-[15px] leading-[1.6] text-balance text-fg-muted">
        {thaiCopy(description ?? (offline ? t("common.networkError") : t("common.errorDescription")))}
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
  /**
   * Reedy mascot mood; defaults from `variant` and `tone` (not found → "oops";
   * otherwise amber/red → "oops", neutral/blue → "calm", the rest "happy"). The
   * icon becomes a badge beside him. Pass false for the plain icon tile (when
   * the icon itself is the message, e.g. a QR code).
   */
  mascot?: ReedyMood | false;
  /**
   * "notFound": a missing page or record (patterns.md "Not found": Reedy oops
   * 120), whatever the badge tone. Default "status".
   */
  variant?: "status" | "notFound";
  /** Title heading level: h2 under an AppBar (default), h1 on a screen without one (e.g. 404). */
  as?: "h1" | "h2";
  /**
   * Live-region role, for a screen that replaces the page without a navigation
   * (the route error boundary): "alert" reads the title and description at once.
   * Leave unset on a screen the user navigated to.
   */
  role?: "status" | "alert";
  className?: string;
}

/**
 * Full-height centred state for blocking situations (not found, payment
 * required, coming soon, kicked from lesson…). Fills the remaining height of a
 * <Screen> (put it after the <AppBar>). The description wraps in balanced
 * lines; a string one keeps Thai compounds whole (thaiCopy). Server-compatible.
 */
export function StatusScreen({
  icon: Icon,
  tone = "brand",
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
  mascot,
  variant = "status",
  as: Heading = "h2",
  role,
  className,
}: StatusScreenProps) {
  const mood = mascot === undefined ? (variant === "notFound" ? "oops" : moodForTone(tone)) : mascot;
  return (
    <div
      role={role}
      className={cn(
        "flex min-h-[60dvh] flex-1 flex-col items-center justify-center px-6 pt-8 pb-[calc(32px+var(--safe-bottom))] text-center",
        className,
      )}
    >
      {mood ? (
        <ReedyMini mood={mood} size="lg" float decorative badge={<Icon strokeWidth={2.4} />} badgeClassName={iconTileToneClass[tone]} />
      ) : (
        <IconTile icon={Icon} tone={tone} size="lg" shape="circle" className="size-20 [&>svg]:size-9" />
      )}
      <Heading className="mt-5 font-heading text-2xl leading-[1.3] font-bold text-balance text-fg">{title}</Heading>
      {description ? (
        <p className="mt-2 max-w-[320px] text-[15px] leading-[1.6] text-balance text-fg-muted">{thaiCopy(description)}</p>
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
  brand: { box: "border-brand-soft-border bg-brand-soft", fg: "text-brand-soft-fg", icon: Sparkles },
};

/**
 * Inline tone banner (components.md §10): *-bg + rim, card radius, icon 20,
 * title 600 15/1.6 (balanced lines) and description 14/1.6 (pretty wrap: no
 * one-word last line) in the tone's text colour, optional action. String title
 * and description keep Thai compounds whole (thaiCopy). Server-compatible.
 */
export function Notice({ tone = "info", icon, title, description, action, className, role }: NoticeProps) {
  const toneStyle = noticeToneClass[tone];
  const Icon = icon ?? toneStyle.icon;
  return (
    <div role={role} className={cn("flex gap-3 rounded-[var(--radius-card)] border-[1.5px] px-3.5 py-3", toneStyle.box, className)}>
      <Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", toneStyle.fg)} strokeWidth={2.2} />
      <div className={cn("min-w-0 flex-1", toneStyle.fg)}>
        <p className="text-[15px] leading-[1.6] font-semibold text-balance">{thaiCopy(title)}</p>
        {description ? <div className="mt-0.5 text-sm leading-[1.6] text-pretty">{thaiCopy(description)}</div> : null}
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

/**
 * Compact metric card (icon, static value, small label) for 2–3 column grids.
 * The value is a static hero number (Kodchasan 700); for numbers that tick use
 * the reading face with tabular-nums instead. Not tappable: rim, no ledge.
 * Server-compatible.
 */
export function StatTile({ icon, value, label, tone = "brand", className }: StatTileProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-3.5 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <IconTile icon={icon} tone={tone} size="sm" />
      <div className="min-w-0">
        <p className="truncate font-heading text-[28px] leading-[1.2] font-bold text-fg">{value}</p>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-[1.6] text-fg-muted">{label}</p>
      </div>
    </div>
  );
}

/* ─── StatStrip ──────────────────────────────────────────────────────────── */

export interface StatStripItem {
  value: ReactNode;
  label: ReactNode;
  /**
   * "sun": the value sits in a sunshine pill, for the view's one reward (the
   * week streak on Progress, patterns.md S9). One sunshine reward group per
   * view: only the first sun cell of a strip gets the pill, and use it only
   * when nothing else on the screen is sunshine. Default "default".
   */
  tone?: "default" | "sun";
  /** Leading icon inside the sun pill (e.g. Flame for a streak). */
  icon?: LucideIcon;
}

/** Sunshine reward pill around a stat value (reading face, tabular). */
function SunValue({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full bg-accent-solid px-2.5 leading-none text-on-accent shadow-[inset_0_0_0_1.5px_var(--accent-edge)]">
      {Icon ? <Icon aria-hidden="true" className="size-[18px]" strokeWidth={2.4} /> : null}
      {children}
    </span>
  );
}

export interface StatStripProps {
  items: StatStripItem[];
  /**
   * hero (default): static numbers in Kodchasan 700 28 (landing stats).
   * tabular: reading face 600 22 with tabular figures (numbers that change, e.g. progress).
   */
  numbers?: "hero" | "tabular";
  "aria-label"?: string;
  className?: string;
}

const stripColumns = ["grid-cols-1", "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"] as const;

/**
 * Up to four stats in ONE card with hairline dividers between cells (landing,
 * progress). Labels 13/1.6 with balanced lines (Thai labels wrap in narrow
 * cells at 320px: "สัปดาห์ / ต่อเนื่อง", not "สัปดาห์ต่อ / เนื่อง"). Not
 * tappable: rim, no ledge. Server-compatible.
 */
export function StatStrip({ items, numbers = "hero", className, ...rest }: StatStripProps) {
  // One sunshine reward group per view: only the first sun cell gets the pill.
  const sunIndex = items.findIndex((item) => item.tone === "sun");
  return (
    <dl
      aria-label={rest["aria-label"]}
      className={cn(
        "grid rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface px-1 py-3.5 shadow-[var(--shadow-card)]",
        stripColumns[Math.min(items.length, 4)],
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className={cn("flex min-w-0 flex-col-reverse justify-end px-1.5 text-center", index > 0 && "border-l-[1.5px] border-hairline")}
        >
          <dt className="text-[13px] leading-[1.6] text-balance text-fg-muted">{item.label}</dt>
          <dd
            className={cn(
              "truncate text-fg",
              numbers === "hero"
                ? "font-heading text-[28px] leading-[1.2] font-bold"
                : "text-[22px] leading-[1.3] font-semibold tabular-nums",
            )}
          >
            {index === sunIndex ? <SunValue icon={item.icon}>{item.value}</SunValue> : item.value}
          </dd>
        </div>
      ))}
    </dl>
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
 * `className="flex-1"`. Full-bleed: inside `.page-content` it spans the app
 * column like the app bar (`bottom-action-bar`, globals.css).
 */
export function BottomActionBar({ children, className }: BottomActionBarProps) {
  return (
    <div
      className={cn(
        "bottom-action-bar sticky bottom-0 z-[var(--z-appbar)] mt-auto border-t-[1.5px] border-clay-rim bg-[var(--surface-nav)] px-4 pt-3 pb-[calc(12px+var(--safe-bottom))]",
        className,
      )}
    >
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}
