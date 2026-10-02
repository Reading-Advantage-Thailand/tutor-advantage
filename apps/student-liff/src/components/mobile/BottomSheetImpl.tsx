"use client";

import { Drawer } from "@base-ui/react/drawer";
import { X } from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { BottomSheetProps } from "./BottomSheet";

/**
 * Base UI Drawer implementation of <BottomSheet>. Loaded lazily (see
 * BottomSheet.tsx) so the drawer code is not part of any route's initial JS.
 * Provides focus trap, Escape + backdrop close, scroll lock and swipe-down
 * to dismiss (only when the body is scrolled to the top).
 */
export function BottomSheetImpl({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  showClose = true,
  dismissible = true,
  onClosed,
  className,
  bodyClassName,
}: BottomSheetProps) {
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
          <Drawer.Popup className={cn("sheet-popup", className)} data-has-footer={footer ? "" : undefined}>
            <div className="sheet-handle" aria-hidden="true" />
            <div className="flex shrink-0 items-start gap-2 pt-1 pr-2 pb-3 pl-5">
              <div className="min-w-0 flex-1 pt-2">
                <Drawer.Title className="text-lg leading-[1.45] font-bold text-fg">{title}</Drawer.Title>
                {description ? (
                  <Drawer.Description className="mt-0.5 text-sm leading-[1.6] text-fg-muted">
                    {description}
                  </Drawer.Description>
                ) : null}
              </div>
              {showClose && dismissible ? (
                <Drawer.Close
                  aria-label={t("common.closeSheet")}
                  className="pressable flex size-11 shrink-0 items-center justify-center rounded-full text-fg-muted active:bg-press"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-fill-muted">
                    <X aria-hidden="true" className="size-[18px]" strokeWidth={2.4} />
                  </span>
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
