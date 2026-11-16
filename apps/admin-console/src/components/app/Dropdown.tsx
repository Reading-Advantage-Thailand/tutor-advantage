"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DropdownPlacement = "bottom-end" | "bottom-start" | "right-start" | "right-end";

const placementClass: Record<DropdownPlacement, string> = {
  "bottom-end": "top-full right-0 mt-2",
  "bottom-start": "top-full left-0 mt-2",
  "right-start": "top-0 left-full ml-2.5",
  "right-end": "bottom-0 left-full ml-2.5",
};

/** Gap between trigger and panel (8px below, 10px beside), and the viewport margin. */
const GAP_BELOW = 8;
const GAP_BESIDE = 10;
const VIEWPORT_MARGIN = 12;

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
  /**
   * Stable panel id. Pass one for menus rendered in the server-rendered app
   * shell: a generated useId() can differ between server and client there
   * (hydration mismatch on aria-controls).
   */
  id?: string;
  /**
   * "absolute" (default): the panel sits in the trigger's box (app shell
   * menus). "fixed": the panel is placed with position: fixed from the
   * trigger's rect, so a scrolling or overflow-hidden ancestor (a DataTable
   * cell inside its scroller and card) cannot clip it. It opens below the
   * trigger (beside it for right-*), flips above when there is no room below
   * (above the phone tab bar), is shifted sideways to stay 12px inside the
   * viewport (a bottom-end menu whose trigger sits at the left of a phone card
   * opens rightwards), and closes on scroll or resize. It stays in the DOM
   * next to its trigger, so Tab order, outside-press and Escape behave the
   * same as "absolute".
   */
  strategy?: "absolute" | "fixed";
  className?: string;
  panelClassName?: string;
}

/**
 * Height of the phone bottom tab bar under `from` (the app shell's
 * --tabbar-space: 68px + safe area below 768px, 0 from there), so a fixed
 * panel flips above it instead of covering it.
 */
function bottomInset(from: HTMLElement): number {
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0;height:var(--tabbar-space,0px)";
  from.appendChild(probe);
  const inset = probe.offsetHeight;
  probe.remove();
  return inset;
}

/** Where a fixed panel goes for a trigger rect (before the panel is measured). */
function fixedPosition(rect: DOMRect, placement: DropdownPlacement): CSSProperties {
  const viewportWidth = document.documentElement.clientWidth;
  switch (placement) {
    case "bottom-start":
      return { top: rect.bottom + GAP_BELOW, left: Math.max(VIEWPORT_MARGIN, rect.left) };
    case "right-start":
      return { top: rect.top, left: rect.right + GAP_BESIDE };
    case "right-end":
      return { bottom: window.innerHeight - rect.bottom, left: rect.right + GAP_BESIDE };
    case "bottom-end":
    default:
      return { top: rect.bottom + GAP_BELOW, right: Math.max(VIEWPORT_MARGIN, viewportWidth - rect.right) };
  }
}

/**
 * Minimal anchored panel (notification bell, account menu, column menu, row
 * menus) without a positioning library: next to its trigger, closes on
 * outside press, Escape (focus returns to the trigger) and route changes made
 * through `close()`. Keeps the app shell's initial JS small.
 */
export function Dropdown({
  trigger,
  children,
  placement = "bottom-end",
  label,
  id,
  strategy = "absolute",
  className,
  panelClassName,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [fixedStyle, setFixedStyle] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const generatedId = useId();
  const panelId = id ?? generatedId;
  const fixed = strategy === "fixed";

  const close = useCallback(() => setOpen(false), []);

  const toggle = () => {
    if (!open && fixed && triggerRef.current) {
      // Placed before the first paint; flipped once the panel's height is known.
      setFixedStyle(fixedPosition(triggerRef.current.getBoundingClientRect(), placement));
    }
    setOpen((value) => !value);
  };

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

  // Fixed panels, once measured: keep inside the viewport on both axes (a
  // trigger near the left edge of a phone card must not push a bottom-end
  // panel off-screen) and flip above when there is no room below.
  useLayoutEffect(() => {
    if (!open || !fixed) return;
    const panel = panelRef.current;
    const anchor = triggerRef.current;
    const root = rootRef.current;
    if (!panel || !anchor || !root) return;
    const rect = anchor.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    // Usable bottom edge: above the phone tab bar.
    const bottomEdge = viewportHeight - bottomInset(root);
    const clampLeft = (left: number) =>
      Math.min(Math.max(VIEWPORT_MARGIN, left), Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN));
    if (placement === "bottom-end" || placement === "bottom-start") {
      const left = clampLeft(placement === "bottom-start" ? rect.left : rect.right - width);
      const roomBelow = bottomEdge - rect.bottom - GAP_BELOW - VIEWPORT_MARGIN;
      const roomAbove = rect.top - GAP_BELOW - VIEWPORT_MARGIN;
      setFixedStyle(
        height > roomBelow && roomAbove > roomBelow
          ? { left, bottom: viewportHeight - rect.top + GAP_BELOW }
          : { left, top: rect.bottom + GAP_BELOW },
      );
    } else {
      // Beside the trigger; on the other side when the right one has no room.
      const fitsRight = rect.right + GAP_BESIDE + width <= viewportWidth - VIEWPORT_MARGIN;
      const left = clampLeft(fitsRight ? rect.right + GAP_BESIDE : rect.left - GAP_BESIDE - width);
      const top = placement === "right-start" ? rect.top : rect.bottom - height;
      const clamped = Math.min(Math.max(VIEWPORT_MARGIN, top), Math.max(VIEWPORT_MARGIN, bottomEdge - height - VIEWPORT_MARGIN));
      setFixedStyle({ left, top: clamped });
    }
  }, [open, fixed, placement]);

  // Fixed panels would drift from their trigger: close on scroll (any scroller
  // but the panel itself) and on resize. Focus inside goes back to the trigger.
  useEffect(() => {
    if (!open || !fixed) return;
    const dismiss = () => {
      if (panelRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
      setOpen(false);
    };
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
      dismiss();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open, fixed]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {trigger({
        open,
        triggerProps: {
          "aria-expanded": open,
          "aria-controls": panelId,
          "aria-haspopup": "dialog",
          onClick: toggle,
          ref: (node) => {
            triggerRef.current = node;
          },
        },
      })}
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          style={fixed ? (fixedStyle ?? undefined) : undefined}
          className={cn(
            "z-(--z-popover) w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-(--radius-ctl) border border-clay-rim bg-surface-elevated text-fg shadow-popover animate-fade-in",
            fixed ? "fixed overflow-y-auto" : ["absolute", placementClass[placement]],
            fixed && "max-h-[calc(100dvh-1.5rem)]",
            panelClassName,
          )}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}
