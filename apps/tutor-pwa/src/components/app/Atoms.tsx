import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ─── Tones ───────────────────────────────────────────────────────────── */

/** Semantic tones for chips, notices and stat icons. */
export type Tone = "brand" | "success" | "warning" | "danger" | "info" | "neutral";
/** Decorative tile tones (icons in stat cards/list rows). One per meaning, not per card. */
export type TileTone = "brand" | "teal" | "blue" | "amber" | "orange" | "purple" | "pink" | "red" | "neutral";

const chipToneClass: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-fg border-brand-soft-border",
  success: "bg-success-bg text-success-fg border-success-border",
  warning: "bg-warning-bg text-warning-fg border-warning-border",
  danger: "bg-danger-bg text-danger-fg border-danger-border",
  info: "bg-info-bg text-info-fg border-info-border",
  neutral: "bg-neutral-bg text-neutral-fg border-neutral-border",
};

export const tileToneClass: Record<TileTone, string> = {
  brand: "bg-tile-brand text-icon-brand",
  teal: "bg-tile-teal text-icon-teal",
  blue: "bg-tile-blue text-icon-blue",
  amber: "bg-tile-amber text-icon-amber",
  orange: "bg-tile-orange text-icon-orange",
  purple: "bg-tile-purple text-icon-purple",
  pink: "bg-tile-pink text-icon-pink",
  red: "bg-tile-red text-icon-red",
  neutral: "bg-tile-neutral text-icon-neutral",
};

/** Maps a semantic tone to the matching tile tone (stat icons). */
export const toneToTile: Record<Tone, TileTone> = {
  brand: "brand",
  success: "brand",
  warning: "amber",
  danger: "red",
  info: "blue",
  neutral: "neutral",
};

/* ─── Chip / StatusChip ───────────────────────────────────────────────── */

export interface ChipProps {
  tone?: Tone;
  icon?: LucideIcon;
  /** sm 20px (tables) · md 24px (default) */
  size?: "sm" | "md";
  /** Small leading dot instead of an icon (live status). */
  dot?: boolean;
  className?: string;
  children: ReactNode;
  title?: string;
}

/** Small rounded label. Server-compatible. */
export function Chip({ tone = "neutral", icon: Icon, size = "md", dot, className, children, title }: ChipProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "h-5 px-1.5 text-[0.6875rem] leading-none" : "h-6 px-2 text-xs leading-none",
        chipToneClass[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
      {Icon ? <Icon aria-hidden="true" className={size === "sm" ? "size-3" : "size-3.5"} /> : null}
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

/** Chip whose tone follows an API status. Server-compatible. */
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
  /** sm 32 · md 40 (default) · lg 48 */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Rounded-square icon on a soft tone (list rows, stat cards). Server-compatible. */
export function IconTile({ icon: Icon, tone = "brand", size = "md", className }: IconTileProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg",
        size === "sm" && "size-8 [&_svg]:size-4",
        size === "md" && "size-10 [&_svg]:size-5",
        size === "lg" && "size-12 rounded-xl [&_svg]:size-6",
        tileToneClass[tone],
        className,
      )}
    >
      <Icon />
    </span>
  );
}

/* ─── UserAvatar ──────────────────────────────────────────────────────── */

const AVATAR_TONES: TileTone[] = ["brand", "teal", "blue", "amber", "purple", "pink", "orange"];

/** Up to two initials (Thai names: first character of the first two words). */
export function getInitials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = Array.from(words[0])[0] ?? "";
  const second = words.length > 1 ? (Array.from(words[1])[0] ?? "") : "";
  return (first + second).toUpperCase();
}

function toneForName(name: string): TileTone {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export interface UserAvatarProps {
  name?: string | null;
  src?: string | null;
  /** xs 24 · sm 32 · md 40 (default) · lg 56 */
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

/** Photo or initials on a stable tone. Server-compatible (plain <img>, no next/image). */
export function UserAvatar({ name, src, size = "md", className }: UserAvatarProps) {
  const sizeClass = {
    xs: "size-6 text-[0.625rem]",
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-14 text-lg",
  }[size];
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? ""}
        referrerPolicy="no-referrer"
        className={cn("shrink-0 rounded-full bg-fill-muted object-cover", sizeClass, className)}
      />
    );
  }
  return (
    <span
      aria-hidden={name ? undefined : true}
      title={name ?? undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizeClass,
        tileToneClass[toneForName(name ?? "?")],
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}

/* ─── Spinner ─────────────────────────────────────────────────────────── */

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className={cn("inline-flex items-center gap-2", className)}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 animate-spin text-current" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
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
  size?: "sm" | "md";
  label?: string;
  className?: string;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Thin progress bar. Server-compatible. */
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
      className={cn("w-full overflow-hidden rounded-full bg-fill-muted", size === "sm" ? "h-1.5" : "h-2", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}
