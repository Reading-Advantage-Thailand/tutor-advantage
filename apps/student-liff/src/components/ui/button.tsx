import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Button styles. The original shadcn variants/sizes are unchanged (games use
 * them). Mobile design system (redesign 2026-11, components.md §2.1):
 * - variants: `brand` = primary (jade fill, --on-brand text, 4px ledge; one per
 *   screen), `brandSoft` = tonal (soft jade, 3px ledge), `reward` (sunshine,
 *   the next step after a reward; never payments), `warning` (pending payment
 *   CTA only), `danger` (destructive confirmations in sheets), `line` (LINE
 *   login: LINE's green, white label, logo cell + divider, no ledge).
 *   `primary` and `tonal` are aliases of `brand` and `brandSoft`.
 *   `outline` and `ghost` with a mobile size (`touch` / `cta` / `cta-lg`) get
 *   the mobile look (card fill + 2px field border + clay ledge; jade text).
 * - sizes: `touch` = sm (44px, Kodchasan 15), `cta` = md (52px, 17),
 *   `cta-lg` = lg (56px, 18; hero CTAs and bottom bars), `icon-touch` (44px
 *   round icon button).
 * - press: ledged buttons move down onto their ledge (no layout shift);
 *   disabled: .45 and no ledge; loading: spinner + aria-busy, stays focusable.
 *
 * Link styled as a button — either:
 *   <Link href="/pay" className={buttonVariants({ variant: "brand", size: "cta" })}>…</Link>
 * or the base-ui render prop (keeps Button's data-slot/disabled handling):
 *   <Button variant="brand" size="cta" nativeButton={false} render={<Link href="/pay" />}>…</Button>
 */
const PRIMARY =
  "bg-brand-solid font-semibold text-on-brand shadow-[0_var(--ledge)_0_var(--brand-solid-edge),inset_0_2px_0_rgb(255_255_255/0.16)] hover:bg-brand-solid-pressed active:not-aria-[haspopup]:translate-y-[3px] active:bg-brand-solid-pressed active:shadow-[0_1px_0_var(--brand-solid-edge)] disabled:opacity-45 disabled:shadow-none"
const TONAL =
  "bg-brand-soft font-semibold text-brand-soft-fg shadow-[0_var(--ledge-sm)_0_var(--brand-soft-border)] hover:bg-brand-soft-border/60 active:not-aria-[haspopup]:translate-y-[2px] active:shadow-[0_1px_0_var(--brand-soft-border)] disabled:opacity-45 disabled:shadow-none"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[translate,transform,box-shadow,background-color,color,opacity] duration-[var(--duration-press)] ease-[var(--ease-out)] outline-none select-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-focus-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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
        brand: PRIMARY,
        primary: PRIMARY,
        brandSoft: TONAL,
        tonal: TONAL,
        reward:
          "bg-accent-solid font-semibold text-on-accent shadow-[0_var(--ledge)_0_var(--accent-edge),inset_0_2px_0_rgb(255_255_255/0.35)] active:not-aria-[haspopup]:translate-y-[3px] active:shadow-[0_1px_0_var(--accent-edge)] disabled:opacity-45 disabled:shadow-none",
        warning:
          "bg-warning-solid font-semibold text-on-warning shadow-[0_var(--ledge-sm)_0_var(--accent-edge)] active:not-aria-[haspopup]:translate-y-[2px] active:shadow-[0_1px_0_var(--accent-edge)] disabled:opacity-45 disabled:shadow-none",
        danger:
          "bg-danger-solid font-semibold text-on-danger shadow-[0_var(--ledge)_0_var(--answer-a-edge)] active:not-aria-[haspopup]:translate-y-[3px] active:shadow-[0_1px_0_var(--answer-a-edge)] dark:shadow-none dark:active:not-aria-[haspopup]:translate-y-px dark:active:shadow-none disabled:opacity-45 disabled:shadow-none",
        line:
          "bg-line-green font-semibold text-on-line hover:bg-line-green-hover active:not-aria-[haspopup]:translate-y-0 active:bg-line-green-pressed disabled:opacity-45",
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
        // ── Mobile touch sizes (44px+ targets; Kodchasan labels ≥ 15px) ──
        touch:
          "h-11 gap-2 rounded-[var(--radius-ctl-sm)] px-4 font-heading text-[15px] leading-[1.3] [&_svg:not([class*='size-'])]:size-5",
        cta: "h-[52px] gap-2.5 rounded-[var(--radius-ctl)] px-6 font-heading text-[17px] leading-[1.3] [&_svg:not([class*='size-'])]:size-6",
        "cta-lg":
          "h-14 gap-2.5 rounded-[20px] px-6 font-heading text-lg leading-[1.3] [&_svg:not([class*='size-'])]:size-6",
        "icon-touch": "size-11 rounded-full [&_svg:not([class*='size-'])]:size-[22px]",
      },
    },
    compoundVariants: [
      // Mobile outline: the neutral alternative ("ดูคลาสเรียนทั้งหมด"), clay ledge.
      {
        variant: "outline",
        size: ["touch", "cta", "cta-lg"],
        class:
          "border-2 border-field-border bg-surface font-semibold text-fg shadow-[0_var(--ledge-sm)_0_var(--clay-ledge)] hover:bg-surface hover:text-fg active:not-aria-[haspopup]:translate-y-[2px] active:shadow-[0_1px_0_var(--clay-ledge)] dark:border-field-border dark:bg-surface dark:hover:bg-surface disabled:opacity-45 disabled:shadow-none",
      },
      // Mobile ghost / link-style action: jade text, press tint, 44px hit area.
      {
        variant: "ghost",
        size: ["touch", "cta", "cta-lg"],
        class:
          "font-semibold text-brand-fg hover:bg-press hover:text-brand-fg active:not-aria-[haspopup]:translate-y-0 active:bg-press dark:hover:bg-press",
      },
      // LINE login (components.md §2.2): 56px, radius 20, logo cell 48×44 with a
      // 1px divider, Kodchasan 600 18. The logo cell spans 6–55px, so equal 12px
      // insets on both sides of the remaining width (pl 55+12, pr 12) centre the
      // label in the space right of the logo, and leave it the most room in
      // narrow containers (the login card and the splash at 320).
      {
        variant: "line",
        class:
          "relative h-14 rounded-[20px] pr-3 pl-[67px] font-heading text-lg leading-[1.3] [&>svg:first-child]:absolute [&>svg:first-child]:top-1/2 [&>svg:first-child]:left-1.5 [&>svg:first-child]:box-content [&>svg:first-child]:size-[34px]! [&>svg:first-child]:-translate-y-1/2 [&>svg:first-child]:border-r [&>svg:first-child]:border-[rgb(0_0_0/0.08)] [&>svg:first-child]:px-[7px] [&>svg:first-child]:py-[5px]",
      },
    ],
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
      className={cn(
        buttonVariants({ variant, size, className }),
        // Loading keeps the button focusable, so base-ui sets aria-disabled (not
        // disabled) and the disabled: styles above do not apply: dim it here.
        loading && "aria-disabled:pointer-events-none aria-disabled:opacity-45 aria-disabled:shadow-none",
      )}
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
