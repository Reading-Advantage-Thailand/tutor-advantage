"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants, type ButtonVariantProps } from "./button-variants"

/**
 * Buttons (redesign 2026-11, components.md §2.3; API compatible). The variants
 * and sizes live in ./button-variants (no "use client"), so server components
 * can import `buttonVariants` from there to style a link as a button; they are
 * re-exported here so every existing import keeps working.
 */
type ButtonProps = ButtonPrimitive.Props &
  ButtonVariantProps & {
    /** Shows a spinner in place of the leading icon, disables the button and sets aria-busy. */
    loading?: boolean
  }

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants, type ButtonProps }
