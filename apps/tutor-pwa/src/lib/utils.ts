import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge that knows this app's own utilities (globals.css @utility and
 * @theme). Out of the box, tailwind-merge 3 files any `text-*` / `shadow-*` it
 * does not know under the colour group, so a custom utility and a real colour
 * cancel each other out (`cn("text-balance-th text-fg")` kept only `text-fg`).
 */
const twMerge = extendTailwindMerge<"type-role">({
  extend: {
    theme: {
      // @theme --shadow-card / -tap / -raised / -popover: box shadows, not shadow colours.
      shadow: ["card", "tap", "raised", "popover"],
    },
    classGroups: {
      // @utility bg-hero / bg-gradient-brand paint a background-image (a flat
      // gradient over a fallback background-color): file them with the images, as
      // in student-liff, so a colour such as bg-surface does not drop them.
      "bg-image": [{ bg: ["hero", "gradient-brand"] }],
      // @utility text-balance-th (text-wrap: balance + word-break: keep-all): a wrap utility.
      "text-wrap": [{ text: ["balance-th"] }],
      // @utility tabular: font-variant-numeric: tabular-nums.
      "fvn-spacing": ["tabular"],
      // @utility type-*: one type role each (family, weight, size, line height);
      // of two roles the later one wins. Plain text-* / leading-* still merge as before.
      "type-role": [
        {
          type: [
            "page",
            "appbar",
            "greet",
            "hero-amount",
            "hero-time",
            "section",
            "card",
            "body",
            "body-s",
            "label",
            "caption",
            "stat",
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
