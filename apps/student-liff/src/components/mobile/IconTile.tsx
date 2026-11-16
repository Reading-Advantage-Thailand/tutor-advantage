import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type IconTileTone = "brand" | "amber" | "blue" | "purple" | "pink" | "red" | "neutral" | "teal" | "orange";
export type IconTileSize = "sm" | "md" | "lg" | "quick";

export interface IconTileProps {
  icon: LucideIcon;
  tone?: IconTileTone;
  /** sm 40px · md 48px (default) · lg 56px · quick 60px (quick-menu tile: rim + clay ledge) */
  size?: IconTileSize;
  shape?: "rounded" | "circle";
  className?: string;
}

/**
 * Tone → background + icon colour classes (theme-aware tokens).
 *
 * App-wide concept → tone mapping (keep consistent):
 *   classes / books / lessons → brand · schedule / calendar → purple
 *   payment / price → amber · chat / tutor → blue · notifications → pink
 *   profile / account → teal · progress / achievements → orange
 *   danger / logout → red · settings / legal / misc → neutral
 */
export const iconTileToneClass: Record<IconTileTone, string> = {
  brand: "bg-tile-brand text-icon-brand",
  amber: "bg-tile-amber text-icon-amber",
  blue: "bg-tile-blue text-icon-blue",
  purple: "bg-tile-purple text-icon-purple",
  pink: "bg-tile-pink text-icon-pink",
  red: "bg-tile-red text-icon-red",
  neutral: "bg-tile-neutral text-icon-neutral",
  teal: "bg-tile-teal text-icon-teal",
  orange: "bg-tile-orange text-icon-orange",
};

// components.md §5 (student): sm 40 (r12, icon 22) · md 48 (r16, icon 24) ·
// lg 56 (r18, icon 28) · quick 60 (r20, icon 28, rim + 3px ledge: tappable).
const sizeClass: Record<IconTileSize, { box: string; radius: string; icon: string }> = {
  sm: { box: "size-10", radius: "rounded-[12px]", icon: "size-[22px]" },
  md: { box: "size-12", radius: "rounded-[var(--radius-tile)]", icon: "size-6" },
  lg: { box: "size-14", radius: "rounded-[18px]", icon: "size-7" },
  quick: {
    box: "size-[60px] border-[1.5px] border-clay-rim shadow-[0_var(--ledge-sm)_0_var(--clay-ledge)]",
    radius: "rounded-[20px]",
    icon: "size-7",
  },
};

/** Tinted square/circle with a coloured icon (decorative; aria-hidden). */
export function IconTile({ icon: Icon, tone = "brand", size = "md", shape = "rounded", className }: IconTileProps) {
  const s = sizeClass[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        s.box,
        shape === "circle" ? "rounded-full" : s.radius,
        iconTileToneClass[tone],
        className,
      )}
    >
      <Icon className={s.icon} strokeWidth={2.1} />
    </span>
  );
}
