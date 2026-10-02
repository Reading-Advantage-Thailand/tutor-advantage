/**
 * Tone tokens shared by Atoms and the shell (kept tiny and separate so the
 * root layout — which only needs <UserAvatar> — does not pull in all atoms).
 */
/** Semantic tones for chips, notices and stat icons. */
export type Tone = "brand" | "success" | "warning" | "danger" | "info" | "neutral";
/** Decorative tile tones (icons in stat cards/list rows). One per meaning, not per card. */
export type TileTone = "brand" | "teal" | "blue" | "amber" | "orange" | "purple" | "pink" | "red" | "neutral";

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
