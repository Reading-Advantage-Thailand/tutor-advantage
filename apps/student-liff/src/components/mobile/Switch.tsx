import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps extends Omit<SwitchPrimitive.Root.Props, "className" | "render"> {
  className?: string;
}

/**
 * On/off switch (Base UI): 48×28 visual with a 44px+ hit area, brand colour
 * when on. Give it an accessible name via aria-label / aria-labelledby, or
 * wrap it in a <label> (see <SwitchRow>).
 */
export function Switch({ className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200",
        "bg-[var(--neutral-400)] data-checked:bg-brand-vivid data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "before:absolute before:-inset-2 before:content-[''] focus-visible:outline-offset-2",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-6 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform duration-200",
          "data-checked:translate-x-5",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export interface SwitchRowProps extends Omit<SwitchProps, "children" | "title"> {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Left slot (IconTile…). */
  leading?: ReactNode;
  /** Classes for the row (the switch itself takes `className`). */
  rowClassName?: string;
}

/**
 * A full-width list row whose whole surface toggles the switch (it is a
 * <label>). Use inside <ListGroup> next to <ListRow>s.
 */
export function SwitchRow({ title, subtitle, leading, rowClassName, disabled, ...switchProps }: SwitchRowProps) {
  return (
    <label
      className={cn(
        "list-row flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors duration-150 active:bg-press",
        disabled && "cursor-not-allowed opacity-50",
        rowClassName,
      )}
      data-leading={leading ? "" : undefined}
    >
      {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-[1.5] font-semibold text-fg">{title}</span>
        {subtitle ? <span className="block text-[13px] leading-[1.5] text-fg-muted">{subtitle}</span> : null}
      </span>
      <Switch disabled={disabled} {...switchProps} />
    </label>
  );
}
