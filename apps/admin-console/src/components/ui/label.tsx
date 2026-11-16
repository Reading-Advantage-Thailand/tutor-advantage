import * as React from "react"

import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-[0.8125rem] leading-normal font-medium text-fg select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-45",
        className
      )}
      {...props}
    />
  )
}

export { Label }
