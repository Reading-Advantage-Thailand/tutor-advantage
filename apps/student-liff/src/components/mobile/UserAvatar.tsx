import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getAvatarTone, getInitials, type AvatarTone } from "./avatarInitials";

export type UserAvatarSize = "xs" | "sm" | "rank" | "md" | "hero" | "lg" | "profile" | "xl";

export interface UserAvatarProps {
  /** Image URL (e.g. LINE pictureUrl). Omitted/failed → initials fallback. */
  src?: string | null;
  /** Used for the accessible name, initials and the deterministic fallback colour. */
  name: string;
  /** xs 24 · sm 32 · rank 36 (leaderboard) · md 40 (default) · hero 52 (home hero) · lg 56 · profile 72 (profile header) · xl 80 */
  size?: UserAvatarSize;
  /**
   * none · surface (3px card-coloured ring: on the hero and over photos) ·
   * onBrand (same ring, kept for older call sites) · you (2px jade ring: the viewer).
   */
  ring?: "none" | "surface" | "onBrand" | "you";
  /** Hide from assistive tech when the name is already visible next to it. */
  decorative?: boolean;
  className?: string;
}

// Initials always set their own face: the reading face, 600 (the reference
// `.avatar`), so they never inherit Kodchasan from a heading or an app bar title.
const sizeClass: Record<UserAvatarSize, { box: string; text: string }> = {
  xs: { box: "size-6", text: "text-xs" },
  sm: { box: "size-8", text: "text-[13px]" },
  rank: { box: "size-9", text: "text-sm" },
  md: { box: "size-10", text: "text-base" },
  hero: { box: "size-[52px]", text: "text-xl" },
  lg: { box: "size-14", text: "text-[22px]" },
  profile: { box: "size-[72px]", text: "text-[28px]" },
  xl: { box: "size-20", text: "text-[30px]" },
};

// Tile pairs (every pair ≥ 4.6:1 in both themes, so they may carry text).
const initialsToneClass: Record<AvatarTone, string> = {
  brand: "bg-tile-brand text-icon-brand",
  blue: "bg-tile-blue text-icon-blue",
  purple: "bg-tile-purple text-icon-purple",
  pink: "bg-tile-pink text-icon-pink",
  amber: "bg-tile-amber text-icon-amber",
  red: "bg-tile-red text-icon-red",
};

const ringClass = {
  none: "",
  surface: "ring-[3px] ring-surface",
  onBrand: "ring-[3px] ring-surface",
  you: "ring-2 ring-brand-fg",
} as const;

/**
 * Avatar (components.md §5) with initials + deterministic tile colour fallback
 * (never calls an external avatar service). Photos get a 1px hairline ring.
 * Built on ui/avatar (Base UI).
 */
export function UserAvatar({
  src,
  name,
  size = "md",
  ring = "none",
  decorative = false,
  className,
}: UserAvatarProps) {
  const tone = getAvatarTone(name);
  const s = sizeClass[size];
  return (
    <Avatar
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
      className={cn("after:hidden", s.box, src && ring === "none" && "ring-1 ring-hairline", ringClass[ring], className)}
    >
      {src ? <AvatarImage src={src} alt="" className="object-cover" /> : null}
      <AvatarFallback
        aria-hidden="true"
        className={cn("font-sans leading-none font-semibold", s.text, initialsToneClass[tone])}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
