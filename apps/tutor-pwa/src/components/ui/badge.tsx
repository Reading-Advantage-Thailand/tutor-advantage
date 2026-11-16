import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Legacy shadcn badge, mapped onto the tutor chips (components.md §4): pill,
 * Noto 500, semantic tone pairs only. For statuses prefer <StatusChip> from
 * "@/components/app" (dot + word).
 */
const badgeVariants = cva(
  "inline-flex min-h-6 max-w-full items-center gap-1 rounded-(--radius-chip) border border-transparent px-2.5 py-0.5 text-xs leading-[1.4] font-medium whitespace-nowrap transition-colors [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-brand-soft text-brand-soft-fg",
        brand: "bg-brand-soft text-brand-soft-fg",
        solid: "bg-brand-solid text-on-brand",
        secondary: "bg-neutral-bg text-neutral-fg",
        neutral: "bg-neutral-bg text-neutral-fg",
        success: "bg-success-bg text-success-fg",
        warning: "bg-warning-bg text-warning-fg",
        info: "bg-info-bg text-info-fg",
        destructive: "bg-danger-bg text-danger-fg",
        danger: "bg-danger-bg text-danger-fg",
        outline: "border-hairline-strong text-fg-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
