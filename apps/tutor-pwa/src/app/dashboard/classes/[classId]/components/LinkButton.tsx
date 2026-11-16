import Link from "next/link";
import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/**
 * A next/link that looks like the shared button (buttonVariants: sizes, ledge,
 * pointer-coarse minimums, focus ring), for server and client components. It
 * stays a link (no role="button"), unlike Button's render prop.
 */
export function LinkButton({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
