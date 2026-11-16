import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps extends Omit<SwitchPrimitive.Root.Props, "className" | "render"> {
  className?: string;
}

/**
 * On/off switch (Base UI, components.md §5): 52×32 track (off: muted fill +
 * 1.5px field border; on: brand-vivid), 26px card-coloured thumb, 44px+ hit area. Give it an accessible name via aria-label / aria-labelledby, or
 * wrap it in a <label> (see <SwitchRow>).
 */
export function Switch({ className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-8 w-[52px] shrink-0 cursor-pointer items-center rounded-full border-[1.5px] border-field-border bg-fill-muted p-[1.5px] transition-colors duration-[var(--duration-normal)]",
        "data-checked:border-brand-vivid data-checked:bg-brand-vivid data-disabled:cursor-not-allowed data-disabled:opacity-45",
        "before:absolute before:-inset-2 before:content-[''] focus-visible:outline-offset-2",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-[26px] rounded-full bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform duration-[var(--duration-normal)] ease-[var(--ease-out)]",
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
 * <label>). Use inside <ListGroup> next to <ListRow>s. Title `t-row` as in
 * ListRow (1.6 between wrapped lines, one line keeps the 24px box); only the
 * press tint animates.
 */
export function SwitchRow({ title, subtitle, leading, rowClassName, disabled, ...switchProps }: SwitchRowProps) {
  return (
    <label
      className={cn(
        "list-row flex min-h-16 w-full cursor-pointer items-center gap-3.5 px-4 py-2.5 transition-[background-color] duration-[var(--duration-fast)] active:bg-press",
        disabled && "cursor-not-allowed opacity-45",
        rowClassName,
      )}
      data-leading={leading ? "" : undefined}
    >
      {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="t-row block text-fg">{title}</span>
        {subtitle ? <span className="block text-sm leading-[1.6] text-fg-muted">{subtitle}</span> : null}
      </span>
      <Switch disabled={disabled} {...switchProps} />
    </label>
  );
}
