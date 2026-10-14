"use client";

import { useEffect, useRef, type RefObject } from "react";

export interface ViewportLike {
  height: number;
  offsetTop: number;
  scale?: number;
}

export interface ViewportVars {
  /** Visible height in px (shrinks while the on-screen keyboard is up). */
  height: number;
  /** How far the visible area is scrolled inside the layout viewport (iOS keyboard). */
  top: number;
  /** The on-screen keyboard (or another inset) takes a big part of the screen. */
  keyboard: boolean;
}

/** Height lost to the viewport before we treat it as "keyboard open". */
export const KEYBOARD_THRESHOLD_PX = 120;

/**
 * CSS values for a full-screen room that must stay inside the visible area.
 * Returns null while the user pinch-zooms (then the layout is left alone).
 */
export function readViewportVars(viewport: ViewportLike | null | undefined, layoutHeight: number): ViewportVars | null {
  if (!viewport || !(viewport.height > 0)) return null;
  if (typeof viewport.scale === "number" && Math.abs(viewport.scale - 1) > 0.01) return null;
  const height = Math.round(viewport.height);
  return {
    height,
    top: Math.max(0, Math.round(viewport.offsetTop)),
    keyboard: layoutHeight - height > KEYBOARD_THRESHOLD_PX,
  };
}

/**
 * Keeps `--vvh` / `--vv-top` (and `data-keyboard`) on the element in sync with
 * window.visualViewport, without React re-renders. Size a position:fixed room
 * with `top: var(--vv-top); height: var(--vvh)` and its header stays visible and
 * the composer sits right above the keyboard on iOS (where the keyboard only
 * shrinks the visual viewport) and Android (resizes-content).
 *
 * `onChange` runs after each update (e.g. keep the message list pinned to the bottom).
 */
export function useVisualViewportVars(ref: RefObject<HTMLElement | null>, onChange?: () => void): void {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const element = ref.current;
    const viewport = typeof window === "undefined" ? undefined : window.visualViewport;
    if (!element || !viewport) return;

    let frame = 0;
    const apply = () => {
      frame = 0;
      const vars = readViewportVars(viewport, window.innerHeight);
      if (!vars) return;
      element.style.setProperty("--vvh", `${vars.height}px`);
      element.style.setProperty("--vv-top", `${vars.top}px`);
      if (vars.keyboard) element.setAttribute("data-keyboard", "");
      else element.removeAttribute("data-keyboard");
      onChangeRef.current?.();
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    apply();
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
    };
  }, [ref]);
}
