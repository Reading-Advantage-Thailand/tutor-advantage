"use client";

import { Drawer } from "@base-ui/react/drawer";
import { X } from "lucide-react";
import type { CSSProperties } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { SheetProps } from "./Sheet";

/**
 * Base UI Drawer implementation of <Sheet>: bottom sheet on phones (swipe
 * down to close), centred dialog from 768px (CSS in globals.css). Loaded
 * lazily so the drawer code is not part of any route's initial JS.
 */
export function SheetImpl({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  showClose = true,
  dismissible = true,
  onClosed,
  width,
  className,
  bodyClassName,
}: SheetProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !dismissible) return;
        onOpenChange(next);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) onClosed?.();
      }}
      disablePointerDismissal={!dismissible}
    >
      <Drawer.Portal>
        <Drawer.Backdrop className="sheet-backdrop" />
        <Drawer.Viewport className="sheet-viewport">
          <Drawer.Popup
            className={cn("sheet-popup", className)}
            data-has-footer={footer ? "" : undefined}
            style={width ? ({ "--sheet-width": `${width}px` } as CSSProperties) : undefined}
          >
            <div className="sheet-handle" aria-hidden="true" />
            <div className="flex shrink-0 items-start gap-2 pt-2 pr-3 pb-3 pl-5 md:pt-4">
              <div className="min-w-0 flex-1 pt-1">
                <Drawer.Title className="text-lg leading-snug font-semibold text-fg">{title}</Drawer.Title>
                {description ? (
                  <Drawer.Description className="mt-1 text-sm text-fg-muted">{description}</Drawer.Description>
                ) : null}
              </div>
              {showClose && dismissible ? (
                <Drawer.Close
                  aria-label={t("shell.close")}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-press hover:text-fg"
                >
                  <X aria-hidden="true" className="size-5" />
                </Drawer.Close>
              ) : null}
            </div>
            <Drawer.Content className={cn("sheet-body", bodyClassName)}>{children}</Drawer.Content>
            {footer ? <div className="sheet-footer">{footer}</div> : null}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
