import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Button styles. The original shadcn variants/sizes are unchanged (games use
 * them). Mobile additions:
 * - variants: `brand` (filled LINE green, white text, AA contrast), `brandSoft`
 *   (tonal green), `warning` (amber, dark text), `danger` (red), `line`
 *   (official LINE-login green).
 * - sizes: `touch` (44px), `cta` (52px, 16px text, rounded-2xl),
 *   `icon-touch` (44px round icon button).
 *
 * Link styled as a button — either:
 *   <Link href="/pay" className={buttonVariants({ variant: "brand", size: "cta" })}>…</Link>
 * or the base-ui render prop (keeps Button's data-slot/disabled handling):
 *   <Button variant="brand" size="cta" nativeButton={false} render={<Link href="/pay" />}>…</Button>
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        // ── Mobile design-system variants ──
        brand:
          "bg-brand-solid font-semibold text-white shadow-[0_2px_8px_-2px_rgb(4_125_54/0.45)] focus-visible:ring-brand-500/40 hover:bg-brand-solid-pressed active:scale-[0.97] active:bg-brand-solid-pressed",
        brandSoft:
          "bg-brand-soft font-semibold text-brand-fg focus-visible:ring-brand-500/40 hover:bg-brand-soft-border/60 active:scale-[0.97] active:bg-brand-soft-border/70",
        warning:
          "bg-warning-solid font-semibold text-on-warning focus-visible:ring-warning-solid/40 hover:bg-[#e8930a] active:scale-[0.97] active:bg-[#d98806]",
        danger:
          "bg-danger-solid font-semibold text-white focus-visible:ring-danger-solid/40 hover:bg-[#c81f1f] active:scale-[0.97] active:bg-[#b91c1c]",
        line:
          "bg-line-green font-bold text-white focus-visible:ring-brand-500/40 hover:bg-[#05b34c] active:scale-[0.97] active:bg-[#049a42]",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
        // ── Mobile touch sizes (44px+ targets) ──
        touch: "h-11 gap-2 rounded-xl px-4 text-[15px] leading-[1.4] [&_svg:not([class*='size-'])]:size-[18px]",
        cta: "h-[52px] gap-2 rounded-2xl px-6 text-base leading-[1.4] [&_svg:not([class*='size-'])]:size-5",
        "icon-touch": "size-11 rounded-full [&_svg:not([class*='size-'])]:size-[22px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Shows a spinner, sets aria-busy and disables the button (stays focusable). */
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
      focusableWhenDisabled={loading ? true : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden="true" data-icon="inline-start" /> : null}
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
export type { ButtonProps }
