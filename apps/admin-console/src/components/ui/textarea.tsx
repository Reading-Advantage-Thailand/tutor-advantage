import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldControlClass } from "@/components/app/constants"

/** Plain textarea (legacy API). New forms: <TextAreaField label=… />. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldControlClass, "min-h-16 resize-y py-2 leading-relaxed", className)}
      {...props}
    />
  )
}

export { Textarea };
