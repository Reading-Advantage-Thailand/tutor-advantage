import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge that knows this app's own utilities (globals.css @utility and
 * @theme). Out of the box, tailwind-merge 3 files any unknown `text-*`,
 * `bg-*` or `shadow-*` class under colours, so `text-balance-th` and `text-fg`
 * cancelled each other out, `bg-hero` lost to `bg-surface`, and `shadow-card`
 * survived next to `shadow-none`. Each custom name is placed in the group of
 * the CSS property it sets.
 */
const twMerge = extendTailwindMerge<"focus-ring-inset" | "pressable">({
  extend: {
    theme: {
      // --shadow-card / --shadow-tap / --shadow-popover in @theme inline
      shadow: ["card", "tap", "popover"],
    },
    classGroups: {
      // @utility text-balance-th: text-wrap: balance (+ word-break: keep-all)
      "text-wrap": [{ text: ["balance-th"] }],
      // @utility tabular: font-variant-numeric: tabular-nums
      "fvn-spacing": ["tabular"],
      // @utility bg-hero / bg-gradient-brand: background-image
      "bg-image": [{ bg: ["hero", "gradient-brand"] }],
      // @utility focus-ring-inset / pressable: their own groups (no overlap)
      "focus-ring-inset": ["focus-ring-inset"],
      pressable: ["pressable"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
