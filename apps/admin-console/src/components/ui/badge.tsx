import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Slot } from "./slot"

/**
 * Small label (API compatible). For statuses prefer <AdminStatusChip> from
 * "@/components/app", which carries the Thai label + tone.
 */
/** Status variants carry the chip's 6px currentColor dot (components.md §4), unless the badge holds an icon. */
const statusDot =
  "before:size-1.5 before:shrink-0 before:rounded-full before:bg-current has-[>svg]:before:hidden"

const badgeVariants = cva(
  "inline-flex h-6 w-fit max-w-full shrink-0 items-center gap-1.5 overflow-hidden rounded-(--radius-chip) border px-2 text-[12.5px] leading-normal font-medium whitespace-nowrap transition-colors [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand-soft text-brand-soft-fg",
        brand: "border-transparent bg-brand-soft text-brand-soft-fg",
        solid: "border-transparent bg-brand-solid text-on-brand",
        secondary: "border-transparent bg-neutral-bg text-neutral-fg",
        neutral: "border-transparent bg-neutral-bg text-neutral-fg",
        success: cn("border-transparent bg-success-bg text-success-fg", statusDot),
        warning: cn("border-transparent bg-warning-bg text-warning-fg", statusDot),
        info: cn("border-transparent bg-info-bg text-info-fg", statusDot),
        destructive: cn("border-transparent bg-danger-bg text-danger-fg", statusDot),
        danger: cn("border-transparent bg-danger-bg text-danger-fg", statusDot),
        outline: "border-field-border text-fg-muted",
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
