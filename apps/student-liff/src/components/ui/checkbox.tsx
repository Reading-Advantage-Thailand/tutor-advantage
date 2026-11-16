"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-6 shrink-0 items-center justify-center rounded-[6px] border-2 border-field-border bg-surface transition-colors group-has-disabled/field:opacity-45 after:absolute after:-inset-3 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-danger-solid aria-invalid:aria-checked:border-brand-solid data-checked:border-brand-solid data-checked:bg-brand-solid data-checked:text-on-brand",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-4 [&>svg]:stroke-[3]"
      >
        <CheckIcon
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
