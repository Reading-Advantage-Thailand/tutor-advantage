import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Small status pill mapped onto the student chips (components.md §4): 24px,
 * pill, reading face 600 12 (Kodchasan never under 14), tokens only. Pair a
 * tone with a word (and an icon or dot), never colour alone.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 text-xs leading-none font-semibold whitespace-nowrap transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3.5!",
  {
    variants: {
      variant: {
        default: "bg-brand-soft text-brand-soft-fg [a]:hover:bg-brand-soft-border",
        secondary: "bg-tile-neutral text-icon-neutral [a]:hover:bg-fill-muted",
        destructive: "bg-danger-bg text-danger-fg [a]:hover:bg-danger-border",
        outline: "border-clay-rim bg-surface text-fg [a]:hover:bg-press",
        ghost: "text-fg-muted hover:bg-press",
        link: "text-brand-fg underline-offset-4 hover:underline",
        success: "bg-success-bg text-success-fg",
        warning: "bg-warning-bg text-warning-fg",
        info: "bg-info-bg text-info-fg",
        reward: "bg-accent-solid text-on-accent shadow-[inset_0_0_0_1.5px_var(--accent-edge)]",
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
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
