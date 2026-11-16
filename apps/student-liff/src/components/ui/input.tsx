"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-[52px] w-full rounded-[var(--radius-field)] border-2 border-field-border bg-surface px-4 py-1 text-base text-fg transition-colors placeholder:text-fg-subtle focus-visible:border-brand-fg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring read-only:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-danger-solid",
        className
      )}
      {...props}
    />
  )
}

export { Input }
