import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Slot } from "./slot"

/**
 * Small label (API compatible). For statuses prefer <AdminStatusChip> from
 * "@/components/app", which carries the Thai label + tone.
 */
const badgeVariants = cva(
  "inline-flex w-fit max-w-full shrink-0 items-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-xs leading-[1.4] font-medium whitespace-nowrap transition-colors [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand-soft text-brand-fg",
        brand: "border-transparent bg-brand-soft text-brand-fg",
        solid: "border-transparent bg-brand-solid text-on-brand",
        secondary: "border-transparent bg-neutral-bg text-neutral-fg",
        neutral: "border-transparent bg-neutral-bg text-neutral-fg",
        success: "border-transparent bg-success-bg text-success-fg",
        warning: "border-transparent bg-warning-bg text-warning-fg",
        info: "border-transparent bg-info-bg text-info-fg",
        destructive: "border-transparent bg-danger-bg text-danger-fg",
        danger: "border-transparent bg-danger-bg text-danger-fg",
        outline: "border-hairline-strong text-fg-muted",
        ghost: "border-transparent text-fg-muted",
        link: "border-transparent text-brand-fg underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  if (asChild) {
    return <Slot data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...(props as React.HTMLAttributes<HTMLElement>)} />
  }
  return <span data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
