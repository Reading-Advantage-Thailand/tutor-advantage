import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Slot } from "./slot"

/**
 * Buttons (admin design system, components.md §2.3; API compatible with the old
 * shadcn Button, including `asChild`). Flat: admin has no ledges.
 *
 * Variants: default / primary / brand (jade fill, --on-brand text; one per
 * screen) · outline = the spec's "secondary" (card fill, 1px --field-border) ·
 * secondary / tonal / soft (--brand-soft / --brand-soft-fg) · ghost / link
 * (transparent, --brand-fg; icon sizes stay neutral) · danger (solid
 * --danger-solid / --on-danger, inside confirm dialogs) · destructive (tonal
 * red, for row actions that open a confirm dialog).
 * Sizes: xs 28 · sm 32 · default 36 (--ctl-h) · lg 40 · xl 48 · icon 36 /
 * icon-xs 28 / icon-sm 32 / icon-lg 40. On touch (pointer-coarse) every size
 * is at least 44px tall (icon sizes and xs/sm also at least 44px wide); these
 * are minimums, so a caller's h-auto still grows with its content.
 * Pressed: the fill steps to its pressed tone (no scale, no translate).
 * Focus: the global 3px --focus-ring outline with a 2px offset.
 */
const buttonVariantsBase = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-(--radius-ctl) border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-(--duration-press) ease-(--ease-out) select-none disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 aria-invalid:border-danger-solid [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-brand-solid text-on-brand hover:bg-brand-solid-pressed active:bg-brand-solid-pressed",
        primary: "bg-brand-solid text-on-brand hover:bg-brand-solid-pressed active:bg-brand-solid-pressed",
        brand: "bg-brand-solid text-on-brand hover:bg-brand-solid-pressed active:bg-brand-solid-pressed",
        outline:
          "border-field-border bg-surface text-fg hover:bg-row-hover active:bg-press aria-expanded:bg-surface-muted",
        secondary: "bg-brand-soft text-brand-soft-fg hover:bg-brand-soft-border/60 active:bg-brand-soft-border aria-expanded:bg-brand-soft-border/60",
        tonal: "bg-brand-soft text-brand-soft-fg hover:bg-brand-soft-border/60 active:bg-brand-soft-border aria-expanded:bg-brand-soft-border/60",
        soft: "bg-brand-soft text-brand-soft-fg hover:bg-brand-soft-border/60 active:bg-brand-soft-border aria-expanded:bg-brand-soft-border/60",
        ghost: "text-brand-fg hover:bg-press active:bg-press aria-expanded:bg-press",
        danger: "bg-danger-solid text-on-danger hover:bg-danger-solid/90 active:bg-danger-solid/80",
        destructive: "bg-danger-bg text-danger-fg hover:bg-danger-border/60 active:bg-danger-border",
        link: "h-auto px-0 text-brand-fg underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5 pointer-coarse:min-h-11",
        xs: "h-7 gap-1 rounded-(--radius-ctl-sm) px-2 text-xs pointer-coarse:min-h-11 pointer-coarse:min-w-11 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3 text-[0.8125rem] pointer-coarse:min-h-11 pointer-coarse:min-w-11 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-10 px-4 pointer-coarse:min-h-11",
        xl: "h-12 px-5 text-base [&_svg:not([class*='size-'])]:size-5",
        icon: "size-9 pointer-coarse:min-h-11 pointer-coarse:min-w-11 [&_svg:not([class*='size-'])]:size-[18px]",
        "icon-xs": "size-7 rounded-(--radius-ctl-sm) pointer-coarse:min-h-11 pointer-coarse:min-w-11 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 pointer-coarse:min-h-11 pointer-coarse:min-w-11",
        "icon-lg": "size-10 pointer-coarse:min-h-11 pointer-coarse:min-w-11 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    compoundVariants: [
      // Icon-only ghost buttons (close, refresh, row menus) stay neutral: the
      // brand colour is for text actions such as "ดูทั้งหมด".
      {
        variant: "ghost",
        size: ["icon", "icon-xs", "icon-sm", "icon-lg"],
        class: "text-fg-muted hover:text-fg aria-expanded:text-fg",
      },
    ],
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
