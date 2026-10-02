import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-[1.4] font-medium whitespace-nowrap transition-colors [&_svg]:size-3 [&_svg]:shrink-0",
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
