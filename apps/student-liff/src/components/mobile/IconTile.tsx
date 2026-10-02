import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type IconTileTone = "brand" | "amber" | "blue" | "purple" | "pink" | "red" | "neutral";
export type IconTileSize = "sm" | "md" | "lg";

export interface IconTileProps {
  icon: LucideIcon;
  tone?: IconTileTone;
  /** sm 32px · md 40px (default) · lg 48px */
  size?: IconTileSize;
  shape?: "rounded" | "circle";
  className?: string;
}

/** Tone → background + icon colour classes (theme-aware tokens). */
export const iconTileToneClass: Record<IconTileTone, string> = {
  brand: "bg-tile-brand text-icon-brand",
  amber: "bg-tile-amber text-icon-amber",
  blue: "bg-tile-blue text-icon-blue",
  purple: "bg-tile-purple text-icon-purple",
  pink: "bg-tile-pink text-icon-pink",
  red: "bg-tile-red text-icon-red",
  neutral: "bg-tile-neutral text-icon-neutral",
};

const sizeClass: Record<IconTileSize, { box: string; radius: string; icon: string }> = {
  sm: { box: "size-8", radius: "rounded-[10px]", icon: "size-4" },
  md: { box: "size-10", radius: "rounded-xl", icon: "size-5" },
  lg: { box: "size-12", radius: "rounded-[14px]", icon: "size-6" },
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
      <Icon className={s.icon} strokeWidth={2.2} />
    </span>
  );
}
