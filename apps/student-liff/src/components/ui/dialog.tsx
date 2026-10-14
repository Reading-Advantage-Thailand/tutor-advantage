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
    <div className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        data-slot="dialog-content"
        className={cn(
          "relative max-h-[85dvh] w-full max-w-lg overflow-auto rounded-xl border border-border bg-background p-6 text-foreground shadow-xl",
          className
        )}
        {...props}
      >
        <button
          type="button"
          className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted active:bg-muted"
          onClick={() => context.onOpenChange?.(false)}
          aria-label={t("common.close")}
        >
          <X className="size-4" aria-hidden="true" />
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
      className={cn("text-lg font-semibold leading-none", className)}
      {...props}
    />
  )
}

export { Dialog, DialogContent, DialogHeader, DialogTitle }
