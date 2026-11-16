import { cn } from "@/lib/utils";

/**
 * "TA" in Kodchasan 700, outlined into path data on a 100×100 box (font size
 * 42, ink centred), so the mark never depends on a web font. Same artwork as
 * public/icons/ta-mark.svg and the PWA icons.
 */
export const TA_MARK_LETTERS_PATH =
  "M36.33 65.12Q35.07 65.12 34.31 64.45Q33.56 63.78 33.56 62.6L33.56 39.63L25.45 39.63Q24.23 39.63 23.54 39.06Q22.85 38.49 22.85 37.48Q22.85 36.43 23.52 35.87Q24.19 35.3 25.45 35.3L47.25 35.3Q48.51 35.3 49.18 35.87Q49.85 36.43 49.85 37.48Q49.85 38.49 49.16 39.06Q48.47 39.63 47.25 39.63L39.14 39.63L39.14 62.6Q39.14 63.73 38.37 64.43Q37.59 65.12 36.33 65.12ZM53.55 65.08Q52.29 65.08 51.53 64.41Q50.78 63.73 50.78 62.56L50.78 47.86Q50.78 41.77 54.26 38.32Q57.75 34.88 63.97 34.88Q68.04 34.88 71.02 36.43Q74 37.99 75.58 40.93Q77.15 43.87 77.15 47.86L77.15 62.56Q77.15 63.73 76.4 64.41Q75.64 65.08 74.38 65.08Q73.12 65.08 72.34 64.38Q71.57 63.69 71.57 62.56L71.57 55.71L56.36 55.71L56.36 62.56Q56.36 63.69 55.59 64.38Q54.81 65.08 53.55 65.08ZM71.57 51.39L71.57 47.73Q71.57 43.53 69.66 41.41Q67.75 39.29 63.97 39.29Q56.36 39.29 56.36 47.73L56.36 51.39Z";

export interface BrandMarkProps {
  /** Pixel size (T uses 32 in bars, 36 in the side nav, 44 on sign-in). */
  size?: number;
  className?: string;
}

/**
 * TA mark: jade rounded square (radius 30% of the size) with white "TA".
 * Constant in both themes (--logo-bg / --logo-fg); dark mode adds a 1px white
 * 14% ring (.ta-mark in globals.css). Decorative: always next to the visible
 * product name or inside a link with an accessible name. Server-compatible.
 */
export function BrandMark({ size = 32, className }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("ta-mark shrink-0", className)}
    >
      <rect width="100" height="100" rx="30" fill="var(--logo-bg)" />
      <path d={TA_MARK_LETTERS_PATH} fill="var(--logo-fg)" />
    </svg>
  );
}
