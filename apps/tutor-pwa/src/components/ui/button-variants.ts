import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Button variants (redesign 2026-11, components.md §2.3), kept in a module
 * without "use client" so server components can style a <Link> or a <span>
 * as a button: `className={buttonVariants({ variant: "outline", size: "lg" })}`.
 * `components/ui/button.tsx` re-exports it, so existing imports keep working.
 * The result is already merged (tailwind-merge), so a size or variant class
 * replaces the base one it overrides (border-transparent → border-field-border,
 * gap-2 → gap-1.5) even when the string is used on its own.
 *
 * Variants:
 * - default / brand: primary, jade fill + --on-brand text and the only 2px
 *   ledge. One per screen ("เริ่มสอนสด", "บันทึก").
 * - outline: the spec's "secondary" (card fill, 1px --field-border).
 * - tonal / soft / secondary: brand-soft fill + --brand-soft-fg (row actions).
 * - ghost: neutral text (cancel, icon buttons). ghost-brand: jade text link
 *   button ("ดูทั้งหมด"). link: inline jade link.
 * - danger: solid red + --on-danger, inside confirm dialogs only.
 *   destructive: tonal red (legacy trigger style).
 * - on-ink: secondary action inside the ink wallet hero.
 * Sizes: xs 28 · sm 32 · default 40 · lg 44 · xl 48 (a page's primary on
 * phones) · icon 40 / icon-lg 44 · icon-sm 32 / icon-xs 28. On touch
 * (pointer: coarse) every size reaches a 44px hit area: default/lg/icon/icon-lg
 * grow to at least 44, sm/xs to at least 40 tall and 44 wide plus a taller
 * ::after hit area, icon-sm/icon-xs keep their look and get an ::after hit
 * area. Touch sizes are minimums, so a caller's h-auto (two-line buttons)
 * still grows with its content.
 * Focus: 3px --focus-ring outline, 2px offset (--focus-ring-ink on ink).
 * Pressed: 1px down; the primary's ledge shrinks to 1px (no layout shift).
 */
const buttonCva = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-(--radius-ctl) border border-transparent bg-clip-padding text-[0.9375rem] leading-tight font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-(--duration-press) ease-(--ease-out) outline-none select-none active:not-disabled:translate-y-px focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none aria-disabled:pointer-events-none aria-disabled:opacity-45 aria-disabled:shadow-none aria-invalid:border-danger-solid aria-invalid:ring-3 aria-invalid:ring-danger-solid/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-brand-solid text-on-brand shadow-[0_var(--ledge)_0_var(--brand-solid-edge)] hover:bg-brand-solid-pressed active:not-disabled:shadow-[0_1px_0_var(--brand-solid-edge)]",
        brand:
          "bg-brand-solid text-on-brand shadow-[0_var(--ledge)_0_var(--brand-solid-edge)] hover:bg-brand-solid-pressed active:not-disabled:shadow-[0_1px_0_var(--brand-solid-edge)]",
        tonal:
          "bg-brand-soft text-brand-soft-fg hover:bg-brand-soft-border aria-expanded:bg-brand-soft-border",
        soft:
          "bg-brand-soft text-brand-soft-fg hover:bg-brand-soft-border aria-expanded:bg-brand-soft-border",
        secondary:
          "bg-brand-soft text-brand-soft-fg hover:bg-brand-soft-border aria-expanded:bg-brand-soft-border",
        outline:
          "border-field-border bg-surface text-fg hover:bg-surface-muted aria-expanded:bg-surface-muted",
        ghost:
          "text-fg-muted hover:bg-press hover:text-fg aria-expanded:bg-press aria-expanded:text-fg",
        "ghost-brand":
          "px-2.5 text-brand-fg hover:bg-press aria-expanded:bg-press",
        danger:
          "bg-danger-solid text-on-danger hover:bg-danger-solid/90",
        destructive:
          "bg-danger-bg text-danger-fg hover:bg-danger-border/60",
        link: "h-auto px-0 text-brand-fg underline-offset-4 hover:underline",
        "on-ink":
          "border-[rgb(255_255_255/0.28)] bg-ink-chip text-ink-fg hover:bg-[rgb(255_255_255/0.18)] focus-visible:outline-focus-ring-ink",
      },
      size: {
        default:
          "h-10 px-4 pointer-coarse:min-h-11 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-(--radius-ctl-sm) px-2 text-xs pointer-coarse:min-h-10 pointer-coarse:min-w-11 pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 rounded-(--radius-ctl-sm) px-3 text-sm pointer-coarse:min-h-10 pointer-coarse:min-w-11 pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-11 px-5 pointer-coarse:min-h-11 [&_svg:not([class*='size-'])]:size-5",
        xl: "h-12 px-5 text-base [&_svg:not([class*='size-'])]:size-5",
        icon: "size-10 pointer-coarse:min-h-11 pointer-coarse:min-w-11 [&_svg:not([class*='size-'])]:size-5",
        "icon-xs": "size-7 rounded-(--radius-ctl-sm) pointer-coarse:after:absolute pointer-coarse:after:-inset-2 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 rounded-(--radius-ctl-sm) pointer-coarse:after:absolute pointer-coarse:after:-inset-1.5",
        "icon-lg": "size-11 pointer-coarse:min-h-11 pointer-coarse:min-w-11 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export type ButtonVariantProps = VariantProps<typeof buttonCva>

export function buttonVariants(props?: Parameters<typeof buttonCva>[0]): string {
  return cn(buttonCva(props))
}
