"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

/**
 * Checkbox (components.md §5): 20px, radius 6, 2px --field-border; checked is
 * the jade fill with an --on-brand check (dark text on the light dark-mode
 * jade). 44px hit area via ::after (inset from the 16px padding box, so
 * 16 + 2 × 14); 3px blue focus ring.
 */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2 border-field-border bg-surface transition-colors duration-(--duration-fast) outline-none group-has-disabled/field:opacity-45 after:absolute after:-inset-3.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-danger-solid aria-invalid:aria-checked:border-brand-solid data-checked:border-brand-solid data-checked:bg-brand-solid data-checked:text-on-brand",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5 [&>svg]:stroke-[3]"
      >
        <CheckIcon
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
