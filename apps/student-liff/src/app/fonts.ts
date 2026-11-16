// Web fonts for the student app (redesign 2026-11, README §4.3).
// Kodchasan = display face (titles, buttons, chips, static hero numbers; never
// under 14px, never in lists, tables or ticking numbers). Noto Sans Thai Looped
// = reading face (everything else; tabular figures by default).
// The CSS variable names deliberately differ from the semantic --font-body /
// --font-display tokens in globals.css, so next/font and :root never write the
// same variable.
import { Kodchasan, Noto_Sans_Thai_Looped } from "next/font/google";

export const kodchasan = Kodchasan({
  weight: ["600", "700"],
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-kodchasan",
  fallback: ["Noto Sans Thai Looped", "Sukhumvit Set", "Thonburi", "Leelawadee UI", "Tahoma", "sans-serif"],
});

export const notoLooped = Noto_Sans_Thai_Looped({
  weight: ["400", "500", "600"],
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-noto-thai-looped",
  fallback: ["Noto Sans Thai", "Sukhumvit Set", "Thonburi", "Leelawadee UI", "Tahoma", "sans-serif"],
});
