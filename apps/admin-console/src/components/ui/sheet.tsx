"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Side sheet (legacy shadcn API on Base UI; radix removed). Controlled usage
 * is unchanged. New code: <Sheet> from "@/components/app" for forms/pickers,
 * or a detail route for large content (lines tables).
 */
function Sheet({
  onOpenChange,
  ...props
}: Omit<SheetPrimitive.Root.Props, "onOpenChange"> & { onOpenChange?: (open: boolean) => void }) {
  return <SheetPrimitive.Root data-slot="sheet" onOpenChange={onOpenChange ? (open) => onOpenChange(open) : undefined} {...props} />
}

function SheetTrigger({ asChild, children, ...props }: SheetPrimitive.Trigger.Props & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return <SheetPrimitive.Trigger data-slot="sheet-trigger" render={children as React.ReactElement} {...props} />
  }
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props}>{children}</SheetPrimitive.Trigger>
}

function SheetClose({ asChild, children, ...props }: SheetPrimitive.Close.Props & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return <SheetPrimitive.Close data-slot="sheet-close" render={children as React.ReactElement} {...props} />
  }
  return <SheetPrimitive.Close data-slot="sheet-close" {...props}>{children}</SheetPrimitive.Close>
}

function SheetPortal(props: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-(--z-sheet) bg-(--scrim) transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className as string
      )}
      {...props}
    />
  )
}

const sideClass = {
  right:
    "inset-y-0 right-0 h-full w-[min(100%,28rem)] border-l data-ending-style:translate-x-full data-starting-style:translate-x-full",
  left: "inset-y-0 left-0 h-full w-[min(100%,28rem)] border-r data-ending-style:-translate-x-full data-starting-style:-translate-x-full",
  top: "inset-x-0 top-0 h-auto max-h-[85dvh] border-b data-ending-style:-translate-y-full data-starting-style:-translate-y-full",
  bottom:
    "inset-x-0 bottom-0 h-auto max-h-[90dvh] rounded-t-2xl border-t pb-(--safe-bottom) data-ending-style:translate-y-full data-starting-style:translate-y-full",
} as const

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-(--z-sheet) flex flex-col gap-4 overflow-y-auto border-hairline bg-surface-elevated text-fg shadow-popover outline-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          sideClass[side],
          className as string
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetPrimitive.Close className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-md text-fg-muted hover:bg-press hover:text-fg">
            <XIcon className="size-4" />
            <span className="sr-only">ปิด</span>
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5 p-4 pr-12", className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return <SheetPrimitive.Title data-slot="sheet-title" className={cn("text-lg font-semibold text-fg", className as string)} {...props} />
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description data-slot="sheet-description" className={cn("text-sm text-fg-muted", className as string)} {...props} />
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }
