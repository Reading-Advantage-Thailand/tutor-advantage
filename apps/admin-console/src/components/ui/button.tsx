import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Slot } from "./slot"

/**
 * Buttons (admin design system; API compatible with the old shadcn Button,
 * including `asChild`). New: `loading`, variants `brand`/`soft`/`danger`, size `xl`.
 *
 * Variants: default/brand (solid green) · soft (tonal green) · outline ·
 * secondary (neutral fill) · ghost · danger (solid red, for confirm buttons) ·
 * destructive (tonal red) · link.
 * Sizes: xs 28 · sm 32 · default 36 (40 on touch) · lg 40 (44 on touch) ·
 * xl 48 · icon / icon-xs / icon-sm / icon-lg.
 */
const buttonVariantsBase = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 outline-none select-none active:not-disabled:scale-[0.98] focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-brand-solid text-on-brand shadow-xs hover:bg-brand-solid-pressed",
        brand: "bg-brand-solid text-on-brand shadow-xs hover:bg-brand-solid-pressed",
        soft: "bg-brand-soft text-brand-fg hover:bg-brand-soft-border/70 dark:hover:bg-brand-soft-border",
        outline:
          "border-field-border bg-surface text-fg hover:bg-surface-muted aria-expanded:bg-surface-muted dark:border-hairline-strong",
        secondary: "bg-fill-muted text-fg hover:bg-press aria-expanded:bg-press",
        ghost: "text-fg-muted hover:bg-press hover:text-fg aria-expanded:bg-press aria-expanded:text-fg",
        danger: "bg-danger-solid text-white shadow-xs hover:bg-danger-solid/90",
        destructive: "bg-danger-bg text-danger-fg hover:bg-danger-border/60 focus-visible:ring-destructive/30",
        link: "h-auto px-0 text-brand-fg underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5 pointer-coarse:h-10",
        xs: "h-7 gap-1 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 rounded-md px-3 text-[0.8125rem] [&_svg:not([class*='size-'])]:size-4",
        lg: "h-10 px-4 pointer-coarse:h-11",
        xl: "h-12 px-5 text-base rounded-xl [&_svg:not([class*='size-'])]:size-5",
        icon: "size-9 pointer-coarse:size-10",
        "icon-xs": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-10 pointer-coarse:size-11 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/** Class string for links styled as buttons (twMerge'd so variant colours win over the base). */
function buttonVariants(props?: Parameters<typeof buttonVariantsBase>[0]) {
  return cn(buttonVariantsBase(props))
}

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariantsBase> & {
    /** Render the single child (e.g. <Link>) with button styles. */
    asChild?: boolean
    /** Spinner, disabled, aria-busy. */
    loading?: boolean
  }

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, className }))
  if (asChild) {
    return (
      <Slot data-slot="button" className={classes} {...(props as React.HTMLAttributes<HTMLElement>)}>
        {children}
      </Slot>
    )
  }
  return (
    <button
      data-slot="button"
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
      {children}
    </button>
  )
}

export { Button, buttonVariants, type ButtonProps }
