import { cn } from "@/lib/utils";

/* ─── UserAvatar ──────────────────────────────────────────────────────── */

/**
 * Initials sit on the tile pairs (--tile-* / --icon-*). Every pair reaches
 * 4.6:1 or more in both themes (tokens.md §8), so the tiles may carry text.
 */
const AVATAR_TONE_CLASS = {
  brand: "bg-tile-brand text-icon-brand",
  teal: "bg-tile-teal text-icon-teal",
  blue: "bg-tile-blue text-icon-blue",
  amber: "bg-tile-amber text-icon-amber",
  purple: "bg-tile-purple text-icon-purple",
  orange: "bg-tile-orange text-icon-orange",
  pink: "bg-tile-pink text-icon-pink",
} as const;

type AvatarTone = keyof typeof AVATAR_TONE_CLASS;

const AVATAR_TONES: AvatarTone[] = ["brand", "teal", "blue", "amber", "purple", "orange", "pink"];

/** Thai consonants ก–ฮ (leading vowels เ แ โ ใ ไ are skipped). */
const THAI_CONSONANT = /[ก-ฮ]/;
const THAI = /[฀-๿]/;

/**
 * Initials: one leading consonant for Thai names (two Thai initials read
 * badly), up to two letters for Latin names ("Local Admin 020" → "LA").
 */
export function getInitials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (THAI.test(words[0])) {
    const consonant = Array.from(words[0]).find((char) => THAI_CONSONANT.test(char));
    if (consonant) return consonant;
  }
  const first = Array.from(words[0]).find((char) => /[A-Za-z0-9]/.test(char)) ?? Array.from(words[0])[0] ?? "";
  const secondWord = words.slice(1).find((word) => /^[A-Za-z]/.test(word));
  const second = secondWord ? secondWord.charAt(0) : "";
  return (first + second).toUpperCase();
}

function toneForSeed(seed: string): AvatarTone {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export interface UserAvatarProps {
  name?: string | null;
  src?: string | null;
  /** Stable key for the tone (the user id); defaults to the name. */
  seed?: string | null;
  /** xs 24 · sm 32 (tables, nav) · md 40 (default) · lg 56 */
  size?: "xs" | "sm" | "md" | "lg";
  /** 2px --brand-fg ring: "you". */
  self?: boolean;
  /**
   * The name is shown right next to the avatar (identity cells, list rows,
   * the nav account row): hide it from assistive tech so the initials ("LS")
   * or the photo's alt are not read before the name.
   */
  decorative?: boolean;
  className?: string;
}

/**
 * Photo or initials on a stable tile tone (circle, Noto 600). Photos get a
 * 1px hairline ring. Server-compatible (plain <img>, no next/image).
 */
export function UserAvatar({ name, src, seed, size = "md", self, decorative = false, className }: UserAvatarProps) {
  const sizeClass = {
    xs: "size-6 text-xs",
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-14 text-lg",
  }[size];
  const selfRing = self ? "ring-2 ring-brand-fg ring-offset-2 ring-offset-surface" : undefined;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={decorative ? "" : (name ?? "")}
        referrerPolicy="no-referrer"
        className={cn("shrink-0 rounded-full bg-fill-muted object-cover", self ? selfRing : "ring-1 ring-hairline", sizeClass, className)}
      />
    );
  }
  return (
    <span
      aria-hidden={name && !decorative ? undefined : true}
      title={decorative ? undefined : (name ?? undefined)}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full leading-none font-semibold select-none",
        sizeClass,
        AVATAR_TONE_CLASS[toneForSeed(seed || name || "?")],
        selfRing,
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
