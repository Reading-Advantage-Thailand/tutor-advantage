import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ─── Tones ───────────────────────────────────────────────────────────── */

/** Semantic tones for chips, notices and stat icons. */
export type Tone = "brand" | "success" | "warning" | "danger" | "info" | "neutral";
/** Decorative tile tones (icons in stat cards/list rows). One per meaning, not per card. */
export type TileTone = "brand" | "teal" | "blue" | "amber" | "orange" | "purple" | "pink" | "red" | "neutral";

const chipToneClass: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-soft-fg",
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  danger: "bg-danger-bg text-danger-fg",
  info: "bg-info-bg text-info-fg",
  neutral: "bg-neutral-bg text-neutral-fg",
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

/**
 * CEFR band → tile tone (components.md §4 LevelChip): A0 teal, A1 plum
 * (purple), A2 sky (blue), B1 orange, B2 berry (pink). The same mapping is
 * used by class tiles, level dots and the week grid.
 */
export function levelTone(level: string | null | undefined): TileTone {
  const band = (level ?? "").trim().toUpperCase().slice(0, 2);
  switch (band) {
    case "A0":
      return "teal";
    case "A1":
      return "purple";
    case "A2":
      return "blue";
    case "B1":
      return "orange";
    case "B2":
      return "pink";
    default:
      return "neutral";
  }
}

/** Icon colour for a level dot / leading edge in the CEFR tone. */
export const levelIconClass: Record<TileTone, string> = {
  brand: "text-icon-brand",
  teal: "text-icon-teal",
  blue: "text-icon-blue",
  amber: "text-icon-amber",
  orange: "text-icon-orange",
  purple: "text-icon-purple",
  pink: "text-icon-pink",
  red: "text-icon-red",
  neutral: "text-icon-neutral",
};

/* ─── Chip / StatusChip ───────────────────────────────────────────────── */

export interface ChipProps {
  tone?: Tone;
  icon?: LucideIcon;
  /** sm 24px (tables, dense rows) · md 28px (default) */
  size?: "sm" | "md";
  /** 6px leading dot in the text colour (statuses: colour + dot + word). */
  dot?: boolean;
  className?: string;
  children: ReactNode;
  title?: string;
}

/**
 * Pill label (components.md §4, tutor): 28px, Noto 500 13; sm 24px / 12.
 * Statuses always carry a dot or an icon plus the word. Server-compatible.
 */
export function Chip({ tone = "neutral", icon: Icon, size = "md", dot, className, children, title }: ChipProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center rounded-(--radius-chip) font-medium whitespace-nowrap",
        size === "sm" ? "h-6 gap-1 px-2 text-xs leading-none" : "h-7 gap-1.5 px-2.5 text-[0.8125rem] leading-none",
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

/** Chip whose tone follows an API status: dot (or icon) + word. Server-compatible. */
export function StatusChip({ status, label, tone, ...rest }: StatusChipProps) {
  return (
    <Chip tone={tone ?? statusTone(status)} dot={!rest.icon} {...rest}>
      {label ?? status ?? "–"}
    </Chip>
  );
}

/* ─── LevelChip ───────────────────────────────────────────────────────── */

export interface LevelChipProps {
  /** CEFR band ("A0", "A1" …); the chip takes the band's tile tone (levelTone). */
  level: string;
  /** sm 24px · md 28px (default), the Chip heights. */
  size?: "sm" | "md";
  /** Screen-reader word before the band (default "ระดับ"), so it reads "ระดับ A1". */
  srPrefix?: string;
  className?: string;
}

/**
 * CEFR band chip in the band's tile tone (components.md §4 LevelChip, tutor
 * size): A0 teal, A1 plum, A2 sky, B1 orange, B2 berry, the same mapping as
 * class tiles, level dots and the week grid. The band is the word, so it is
 * never colour alone. Server-compatible.
 */
export function LevelChip({ level, size = "md", srPrefix = t("tutorClass.detailView.levelPrefix"), className }: LevelChipProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-(--radius-chip) leading-none font-semibold whitespace-nowrap",
        size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-[0.8125rem]",
        tileToneClass[levelTone(level)],
        className,
      )}
    >
      <span className="sr-only">{srPrefix} </span>
      {level}
    </span>
  );
}

/* ─── CountBadge-like neutral count ───────────────────────────────────── */

/** Neutral count pill (22px, 600 12, tabular): section and segment counts. */
export function Count({ value, className }: { value: number | string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-neutral-bg px-[7px] text-xs leading-none font-semibold text-neutral-fg tabular",
        className,
      )}
    >
      {value}
    </span>
  );
}

/* ─── IconTile ────────────────────────────────────────────────────────── */

export interface IconTileProps {
  icon: LucideIcon;
  tone?: TileTone;
  /** sm 32 · md 40 (default) · lg 48 · xl 56 (error states) */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

/** Rounded-square icon on a soft tone (list rows, stat cards). Server-compatible. */
export function IconTile({ icon: Icon, tone = "brand", size = "md", className }: IconTileProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        size === "sm" && "size-8 rounded-(--radius-ctl-sm) [&_svg]:size-4",
        size === "md" && "size-10 rounded-(--radius-tile) [&_svg]:size-5",
        size === "lg" && "size-12 rounded-(--radius-tile) [&_svg]:size-6",
        size === "xl" && "size-14 rounded-2xl [&_svg]:size-7",
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

const THAI_LEADING_VOWELS = /^[เ-ไ]/u;
const THAI_CHAR = /[฀-๿]/u;
// Titles are skipped: dotted abbreviations always, words only when a space follows
// (so names such as "คุณากร" keep their first letter).
const TITLE_PREFIX = /^(?:(?:ด\.ช\.|ด\.ญ\.|น\.ส\.|T\.)\s*|(?:นางสาว|นาง|นาย|ครู|คุณ)\s+)/u;

/**
 * Initials (components.md §5): one leading character for Thai names (two
 * Thai initials read badly; a leading vowel such as "เ" is skipped), two
 * letters for Latin names.
 */
export function getInitials(name: string | null | undefined): string {
  const words = (name ?? "").trim().replace(TITLE_PREFIX, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0];
  if (THAI_CHAR.test(first)) {
    const chars = Array.from(first);
    const lead = THAI_LEADING_VOWELS.test(chars[0] ?? "") && chars[1] ? chars[1] : chars[0];
    return lead ?? "?";
  }
  const a = Array.from(first)[0] ?? "";
  const b = words.length > 1 ? (Array.from(words[1])[0] ?? "") : "";
  return (a + b).toUpperCase();
}

function toneForName(name: string): TileTone {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export interface UserAvatarProps {
  name?: string | null;
  src?: string | null;
  /** xs 24 · sm 32 · nav 36 · md 40 (default) · lg 52 · stage 64, 80 from 1280px (presenter podium) */
  size?: "xs" | "sm" | "nav" | "md" | "lg" | "stage";
  /** The viewer ("คุณ"): 2px --brand-fg ring. */
  self?: boolean;
  /** Stable key for the tone (user id); defaults to the name. */
  toneKey?: string | null;
  /** 1 = always a single initial (overlapping stacks); default follows the name's script. */
  maxInitials?: 1 | 2;
  className?: string;
  style?: CSSProperties;
}

/** Photo or initials on a stable tone. Server-compatible (plain <img>, no next/image). */
export function UserAvatar({ name, src, size = "md", self, toneKey, maxInitials = 2, className, style }: UserAvatarProps) {
  const sizeClass = {
    xs: "size-6 text-xs",
    sm: "size-8 text-xs",
    nav: "size-9 text-[0.8125rem]",
    md: "size-10 text-sm",
    lg: "size-[52px] text-lg",
    stage: "size-16 text-xl xl:size-20 xl:text-2xl",
  }[size];
  const ring = self ? "ring-2 ring-brand-fg ring-offset-2 ring-offset-surface" : null;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? ""}
        referrerPolicy="no-referrer"
        style={style}
        className={cn("shrink-0 rounded-full bg-fill-muted object-cover ring-1 ring-hairline", sizeClass, ring, className)}
      />
    );
  }
  return (
    <span
      aria-hidden={name ? undefined : true}
      title={name ?? undefined}
      style={style}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full leading-none font-semibold",
        sizeClass,
        tileToneClass[toneForName(toneKey || name || "?")],
        ring,
        className,
      )}
    >
      {maxInitials === 1 ? Array.from(getInitials(name))[0] : getInitials(name)}
    </span>
  );
}

/* ─── Spinner ─────────────────────────────────────────────────────────── */

/** 16 / 20 / 24 ring spinner (currentColor). Pulses instead of spinning under reduced motion. */
export function Spinner({ className, label, size = 16 }: { className?: string; label?: string; size?: 16 | 20 | 24 }) {
  const sizeClass = size === 24 ? "size-6" : size === 20 ? "size-5" : "size-4";
  return (
    <span role={label ? "status" : undefined} className={cn("inline-flex items-center gap-2", className)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={cn(sizeClass, "animate-[spin_800ms_linear_infinite] text-current motion-reduce:animate-pulse")}
        fill="none"
      >
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
  /** brand (default) · warning · danger · info · success · ink (wallet hero: sunshine on the ink track) */
  tone?: "brand" | "warning" | "danger" | "info" | "success" | "ink";
  /** sm 6px · md 10px (default) */
  size?: "sm" | "md";
  label?: string;
  className?: string;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * Progress bar (components.md §5): --track with a --brand-vivid fill (≥ 3:1),
 * 10px. The fill grows with transform: scaleX() once (600ms; the final value
 * under reduced motion), never width. Always pair it with visible text.
 * Server-compatible.
 */
export function ProgressBar({ value, tone = "brand", size = "md", label, className }: ProgressBarProps) {
  const pct = clampPercent(value);
  const fill = {
    brand: "bg-brand-vivid",
    success: "bg-success-solid",
    warning: "bg-warning-solid",
    danger: "bg-danger-solid",
    info: "bg-info-solid",
    ink: "bg-accent-solid",
  }[tone];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn(
        "w-full overflow-hidden rounded-full",
        tone === "ink" ? "bg-ink-track" : "bg-track",
        size === "sm" ? "h-1.5" : "h-2.5",
        className,
      )}
    >
      <div
        className={cn("ds-progress-fill h-full w-full rounded-full transition-transform duration-500 ease-(--ease-out)", fill)}
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  );
}
