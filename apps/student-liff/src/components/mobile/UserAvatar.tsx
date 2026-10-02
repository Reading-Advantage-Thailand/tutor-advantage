import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getAvatarTone, getInitials } from "./avatarInitials";
import { iconTileToneClass } from "./IconTile";

export type UserAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface UserAvatarProps {
  /** Image URL (e.g. LINE pictureUrl). Omitted/failed → initials fallback. */
  src?: string | null;
  /** Used for the accessible name, initials and the deterministic fallback colour. */
  name: string;
  /** xs 24 · sm 32 · md 40 (default) · lg 56 · xl 80 */
  size?: UserAvatarSize;
  /** Adds a 2px ring (white on brand heroes, surface elsewhere). */
  ring?: "none" | "surface" | "onBrand";
  /** Hide from assistive tech when the name is already visible next to it. */
  decorative?: boolean;
  className?: string;
}

const sizeClass: Record<UserAvatarSize, { box: string; text: string }> = {
  xs: { box: "size-6", text: "text-[10px]" },
  sm: { box: "size-8", text: "text-xs" },
  md: { box: "size-10", text: "text-sm" },
  lg: { box: "size-14", text: "text-lg" },
  xl: { box: "size-20", text: "text-2xl" },
};

const ringClass = {
  none: "",
  surface: "ring-2 ring-surface",
  onBrand: "ring-2 ring-white/60",
} as const;

/**
 * Avatar with initials + deterministic colour fallback (never calls an
 * external avatar service). Built on ui/avatar (Base UI).
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
      className={cn("after:hidden", s.box, ringClass[ring], className)}
    >
      {src ? <AvatarImage src={src} alt="" className="object-cover" /> : null}
      <AvatarFallback aria-hidden="true" className={cn("leading-none font-bold", s.text, iconTileToneClass[tone])}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
