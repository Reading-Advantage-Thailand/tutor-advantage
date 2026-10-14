"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DropdownPlacement = "bottom-end" | "bottom-start" | "right-start" | "right-end";

const placementClass: Record<DropdownPlacement, string> = {
  "bottom-end": "top-full right-0 mt-2",
  "bottom-start": "top-full left-0 mt-2",
  "right-start": "top-0 left-full ml-2.5",
  "right-end": "bottom-0 left-full ml-2.5",
};

export interface DropdownProps {
  /** Renders the trigger; spread `triggerProps` onto a <button>. */
  trigger: (state: {
    open: boolean;
    triggerProps: {
      "aria-expanded": boolean;
      "aria-controls": string;
      "aria-haspopup": "dialog";
      onClick: () => void;
      ref: (node: HTMLButtonElement | null) => void;
    };
  }) => ReactNode;
  /** Panel content; call `close()` after an action/navigation. */
  children: (close: () => void) => ReactNode;
  placement?: DropdownPlacement;
  /** Accessible name of the panel. */
  label: string;
  className?: string;
  panelClassName?: string;
}

/**
 * Minimal anchored panel (notification bell, account menu) without a
 * positioning library: absolutely positioned next to its trigger, closes on
 * outside press, Escape (focus returns to the trigger) and route changes made
 * through `close()`. Keeps the app shell's initial JS small.
 */
export function Dropdown({ trigger, children, placement = "bottom-end", label, className, panelClassName }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {trigger({
        open,
        triggerProps: {
          "aria-expanded": open,
          "aria-controls": panelId,
          "aria-haspopup": "dialog",
          onClick: () => setOpen((value) => !value),
          ref: (node) => {
            triggerRef.current = node;
          },
        },
      })}
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute z-(--z-popover) w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-hairline bg-surface-elevated text-fg shadow-popover animate-fade-in",
            placementClass[placement],
            panelClassName,
          )}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}
