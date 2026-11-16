"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import { CheckIcon, MinusIcon } from "lucide-react"

/**
 * Checkbox (components.md §5): 20px box, radius 6, 2px --field-border; checked
 * --brand-solid with an --on-brand check (never text-white: dark brand-solid is
 * light jade). The hit area is a centred ::after, inset from the 16px padding
 * box: 40×32 on desktop, 44×44 under pointer: coarse (16 + 2 × 14).
 * Focus: the global 3px --focus-ring outline.
 */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2 border-field-border bg-surface text-on-brand transition-colors group-has-disabled/field:opacity-45 after:absolute after:-inset-x-3 after:-inset-y-2 pointer-coarse:after:-inset-3.5 disabled:cursor-not-allowed disabled:opacity-45 data-disabled:cursor-not-allowed data-disabled:opacity-45 aria-invalid:border-danger-solid data-checked:border-brand-solid data-checked:bg-brand-solid data-indeterminate:border-brand-solid data-indeterminate:bg-brand-solid",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5 [&>svg]:stroke-3"
      >
        {props.indeterminate ? <MinusIcon aria-hidden="true" /> : <CheckIcon aria-hidden="true" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
