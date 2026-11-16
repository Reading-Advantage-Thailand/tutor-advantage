"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

/**
 * Switch (components.md §5, tutor scale): off = muted track with a 2px
 * --field-border edge and a --field-border thumb; on = --brand-vivid track
 * with a surface thumb. 44px hit area via ::after, role="switch" from Base UI,
 * 3px blue focus ring.
 */
function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border-2 transition-colors duration-(--duration-fast) outline-none after:absolute after:-inset-x-1 after:-inset-y-3 data-[size=sm]:after:-inset-y-3.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-focus-ring aria-invalid:border-danger-solid data-[size=default]:h-6 data-[size=default]:w-11 data-[size=sm]:h-5 data-[size=sm]:w-9 data-checked:border-brand-vivid data-checked:bg-brand-vivid data-unchecked:border-field-border data-unchecked:bg-fill-muted data-disabled:cursor-not-allowed data-disabled:opacity-45",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block translate-x-0.5 rounded-full shadow-xs ring-0 transition-transform duration-(--duration-fast) ease-(--ease-out) group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-checked:bg-surface data-unchecked:bg-field-border group-data-[size=default]/switch:data-checked:translate-x-[22px] group-data-[size=sm]/switch:data-checked:translate-x-[18px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
