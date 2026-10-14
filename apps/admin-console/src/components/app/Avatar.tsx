import { cn } from "@/lib/utils";
import { tileToneClass, type TileTone } from "./tones";

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
