import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { tileToneClass, type TileTone, type Tone } from "./tones";

export { tileToneClass, type TileTone, type Tone } from "./tones";
export { getInitials, UserAvatar, type UserAvatarProps } from "./Avatar";

/* ─── Tones ───────────────────────────────────────────────────────────── */

/** Status chip fills (no border: the dot + word carry the status, not an outline). */
const chipToneClass: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-soft-fg",
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  danger: "bg-danger-bg text-danger-fg",
  info: "bg-info-bg text-info-fg",
  neutral: "bg-neutral-bg text-neutral-fg",
};

/** Maps a semantic tone to the matching tile tone (stat icons). */
export const toneToTile: Record<Tone, TileTone> = {
  brand: "brand",
  success: "teal",
  warning: "amber",
  danger: "red",
  info: "blue",
  neutral: "neutral",
};

/* ─── Chip / StatusChip ───────────────────────────────────────────────── */

export interface ChipProps {
  tone?: Tone;
  icon?: LucideIcon;
  /** Both 24px: md (default) padding 8 / 12.5px, sm padding 6 / 12px for dense cells. */
  size?: "sm" | "md";
  /**
   * 6px leading dot in the text colour (dot + word). On by default when there
   * is no icon (components.md §4: a chip always carries a dot or an icon);
   * pass `dot={false}` to opt out.
   */
  dot?: boolean;
  className?: string;
  children: ReactNode;
  title?: string;
}

/**
 * Status badge: radius 6 (--radius-chip), Noto 500 12.5, a 6px dot or a 14px
 * icon plus the word; never colour alone. Server-compatible.
 */
export function Chip({ tone = "neutral", icon: Icon, size = "md", dot = !Icon, className, children, title }: ChipProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-(--radius-chip) font-medium whitespace-nowrap",
        size === "sm" ? "h-6 px-1.5 text-xs leading-normal" : "h-6 px-2 text-[12.5px] leading-normal",
        chipToneClass[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      {Icon ? <Icon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

const SUCCESS = ["PAID", "VERIFIED", "ACTIVE", "OPEN", "SENT", "COMPLETED", "ACCEPTED", "APPROVED", "SUCCESS", "DONE", "PUBLISHED"];
const WARNING = ["PENDING", "PENDING_TRANSFER", "SENT_PENDING", "CREATED", "PROCESSING", "DRAFT", "LOBBY", "WAITING", "SCHEDULED", "UNVERIFIED", "EXPIRING"];
const DANGER = ["FAILED", "TRANSFER_FAILED", "REJECTED", "CANCELLED", "CANCELED", "EXPIRED", "ERROR", "SUSPENDED"];
const INFO = ["RUNNING", "ONGOING", "LIVE", "IN_PROGRESS", "STARTED"];

/** Generic status → tone mapping for API status strings (case-insensitive). */
export function statusTone(status: string | null | undefined): Tone {
  const key = (status ?? "").toUpperCase();
  if (SUCCESS.includes(key)) return "success";
  if (WARNING.includes(key)) return "warning";
  if (DANGER.includes(key)) return "danger";
  if (INFO.includes(key)) return "info";
  return "neutral";
}

export interface StatusChipProps extends Omit<ChipProps, "tone" | "children"> {
  /** API status, e.g. "PAID" — picks the tone. */
  status: string | null | undefined;
  /** Thai label to show (pages own the wording). Defaults to the raw status. */
  label?: ReactNode;
  /** Override the tone from statusTone(). */
  tone?: Tone;
}

/** Chip whose tone follows an API status (dot + word). Server-compatible. */
export function StatusChip({ status, label, tone, ...rest }: StatusChipProps) {
  return (
    <Chip tone={tone ?? statusTone(status)} dot={!rest.icon} {...rest}>
      {label ?? status ?? "–"}
    </Chip>
  );
}

/* ─── IconTile ────────────────────────────────────────────────────────── */

export interface IconTileProps {
  icon: LucideIcon;
  tone?: TileTone;
  /** sm 32 (admin default in rows and KPI cells, icon 18) · md 40 (empty/error states) · lg 48 */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Rounded-square icon on a soft tone (radius 8). One tone per meaning. Server-compatible. */
export function IconTile({ icon: Icon, tone = "brand", size = "md", className }: IconTileProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-(--radius-tile)",
        size === "sm" && "size-8 [&_svg]:size-[18px]",
        size === "md" && "size-10 [&_svg]:size-5",
        size === "lg" && "size-12 [&_svg]:size-6",
        tileToneClass[tone],
        className,
      )}
    >
      <Icon />
    </span>
  );
}

/* ─── Spinner ─────────────────────────────────────────────────────────── */

/** 16px ring, 2px stroke: 25% track + a 100% arc, 800ms linear (pulses under reduced motion). */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className={cn("inline-flex items-center gap-2", className)}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 animate-spin text-current" style={{ animationDuration: "800ms" }} fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {label ? <span className="text-sm text-fg-muted">{label}</span> : null}
    </span>
  );
}

/* ─── ProgressBar ─────────────────────────────────────────────────────── */

export interface ProgressBarProps {
  /** 0–100 */
  value: number;
  tone?: "brand" | "warning" | "danger" | "info";
  /** sm 4px (micro-bar) · md 6px (admin default) */
  size?: "sm" | "md";
  label?: string;
  className?: string;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * Thin progress bar: --track with a --brand-vivid fill (≥3.38:1), pill.
 * The fill scales with transform (never width); pair it with text ("36%").
 * Server-compatible.
 */
export function ProgressBar({ value, tone = "brand", size = "md", label, className }: ProgressBarProps) {
  const pct = clampPercent(value);
  const fill = { brand: "bg-brand-vivid", warning: "bg-warning-solid", danger: "bg-danger-solid", info: "bg-info-solid" }[tone];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("w-full overflow-hidden rounded-full bg-track", size === "sm" ? "h-1" : "h-1.5", className)}
    >
      <div
        className={cn("h-full w-full origin-left rounded-full transition-transform duration-[600ms] ease-(--ease-out)", fill)}
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  );
}
