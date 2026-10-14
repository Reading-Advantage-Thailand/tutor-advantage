import { cn } from "@/lib/utils"

/** Legacy skeleton block. New code: Skeleton / TableSkeleton / PageSkeleton from "@/components/app". */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn("skeleton-block", className)} {...props} />
}

export { Skeleton }
