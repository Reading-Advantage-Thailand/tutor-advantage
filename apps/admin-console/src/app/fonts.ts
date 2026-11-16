import { Noto_Sans_Thai } from "next/font/google";

/**
 * Admin reading face (redesign 2026-11, README §4): Noto Sans Thai 400/500/600,
 * one variable file per subset (thai + latin, about 56 KB). Admin has no display
 * face; the TA mark is an outlined SVG. The variable name differs from the
 * semantic --font-body token on purpose, so next/font and :root never write the
 * same variable (globals.css: --font-body: var(--font-noto-thai), …).
 */
export const notoThai = Noto_Sans_Thai({
  weight: ["400", "500", "600"],
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-noto-thai",
  fallback: ["Sukhumvit Set", "Thonburi", "Leelawadee UI", "Tahoma", "sans-serif"],
});
