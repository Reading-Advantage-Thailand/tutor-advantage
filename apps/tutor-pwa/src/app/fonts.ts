import { Kodchasan, Noto_Sans_Thai } from "next/font/google";

/**
 * Web fonts (redesign 2026-11, README §4). Kodchasan 600 is the display face:
 * page titles, the greeting, static hero numbers and the projected presenter
 * only, never under 14px and never in lists or ticking numbers. Noto Sans Thai
 * (variable 400-600, tabular figures) is the reading face for everything else.
 * The variable names differ from the semantic --font-body / --font-display
 * tokens in globals.css, so next/font and :root never write the same variable.
 */
export const kodchasan = Kodchasan({
  weight: ["600"],
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-kodchasan",
  fallback: ["Noto Sans Thai", "Sukhumvit Set", "Thonburi", "Leelawadee UI", "Tahoma", "sans-serif"],
});

export const notoThai = Noto_Sans_Thai({
  weight: ["400", "500", "600"],
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-noto-thai",
  fallback: ["Sukhumvit Set", "Thonburi", "Leelawadee UI", "Tahoma", "sans-serif"],
});
