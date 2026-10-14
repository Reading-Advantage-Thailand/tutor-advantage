import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldControlClass } from "@/components/app/constants"

/** Plain input (legacy API). New forms: <TextField label=… /> from "@/components/app". */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldControlClass,
        "h-9 py-1 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg pointer-coarse:h-11",
        className
      )}
      {...props}
    />
  )
}

export { Input }
