import { cn } from "@/lib/utils"

/**
 * Loading placeholder block. Token-based colours for both themes and a
 * compositor-only shimmer that stops under prefers-reduced-motion.
 * Size and shape come from className (e.g. "h-4 w-2/3 rounded-full").
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("skeleton-block rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
