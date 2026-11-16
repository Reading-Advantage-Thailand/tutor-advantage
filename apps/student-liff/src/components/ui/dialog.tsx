"use client"

import * as React from "react"
import { X } from "lucide-react"

import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

type DialogContextValue = {
  open: boolean
  onOpenChange?: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

function Dialog({
  open = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

function DialogContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const context = React.useContext(DialogContext)
  if (!context?.open) return null

  return (
    // z = --z-overlay (60): above the TabBar (50), which comes later in the DOM.
    <div className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-scrim p-4">
      <div
        role="dialog"
        aria-modal="true"
        data-slot="dialog-content"
        className={cn(
          "relative max-h-[85dvh] w-full max-w-lg overflow-auto rounded-[var(--radius-dialog)] border-[1.5px] border-clay-rim bg-popover p-6 text-popover-foreground shadow-[var(--shadow-popover)]",
          className
        )}
        {...props}
      >
        <button
          type="button"
          className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-press active:bg-press"
          onClick={() => context.onOpenChange?.(false)}
          aria-label={t("common.close")}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        {children}
      </div>
    </div>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("mb-4 flex flex-col gap-1.5 pr-8", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn("font-heading text-xl leading-[1.35] font-semibold", className)}
      {...props}
    />
  )
}

export { Dialog, DialogContent, DialogHeader, DialogTitle }
