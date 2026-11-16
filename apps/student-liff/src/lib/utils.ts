import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge that knows this app's own utilities (globals.css @utility and
 * @theme). Out of the box, tailwind-merge 3 files any `text-*` / `bg-*` it does
 * not know under the colour group, so a custom utility and a real colour
 * cancel each other out (`cn("text-balance-th text-fg")` kept only `text-fg`).
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // @utility bg-hero / bg-gradient-brand set background-image only, not a colour.
      "bg-image": [{ bg: ["hero", "gradient-brand"] }],
      // text-balance-th (text-wrap: balance + word-break: keep-all), the tutor and
      // admin name for balanced Thai headings: a wrap utility, not a text colour.
      "text-wrap": [{ text: ["balance-th"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
