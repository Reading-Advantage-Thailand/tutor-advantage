import type { RefObject } from "react";

/**
 * Where focus goes when a Sheet / ConfirmDialog closes and the control that
 * opened it is gone or disabled: the deleted row's "ลบ", "ล้างข้อมูล" once
 * nothing is selected, a "void" button that the refreshed row no longer has.
 * An element, a ref, or a function that finds it when it is needed.
 */
export type FinalFocusTarget = HTMLElement | null | RefObject<HTMLElement | null> | (() => HTMLElement | null | undefined);

export function resolveFinalFocus(target: FinalFocusTarget | undefined): HTMLElement | null {
  if (!target) return null;
  if (typeof target === "function") return target() ?? null;
  if ("current" in target) return target.current ?? null;
  return target;
}

/** Can focus go here: on the page, enabled, not inert, rendered (not display:none). */
export function canTakeFocus(element: HTMLElement | null | undefined): element is HTMLElement {
  if (!element || !element.isConnected) return false;
  if ((element as HTMLButtonElement).disabled || element.getAttribute("aria-disabled") === "true") return false;
  if (element.closest("[inert]")) return false;
  return element.getClientRects().length > 0;
}

/**
 * Focus has fallen out of the page: on <body>, on the <main> landmark (what
 * the browser picks when the focused control is removed inside it), or on a
 * control that was removed or disabled.
 */
export function focusIsLost(): boolean {
  const active = document.activeElement as HTMLElement | null;
  return (
    !active ||
    active === document.body ||
    active.id === "main-content" ||
    !active.isConnected ||
    (active instanceof HTMLButtonElement && active.disabled)
  );
}

/**
 * After a sheet closes: for a few seconds (the list refresh that removes the
 * row can land after the close animation), move focus to the target whenever
 * it falls out of the page. Stops as soon as it has done so, or when the
 * user presses a key or the pointer (their own focus move wins).
 * Returns a cancel function.
 */
export function guardFocusAfterClose(getTarget: () => HTMLElement | null, timeoutMs = 4000): () => void {
  if (typeof window === "undefined") return () => {};
  const started = performance.now();
  let timer = 0;
  const stop = () => {
    window.clearInterval(timer);
    document.removeEventListener("pointerdown", stop, true);
    document.removeEventListener("keydown", stop, true);
  };
  timer = window.setInterval(() => {
    if (focusIsLost()) {
      const target = getTarget();
      if (canTakeFocus(target)) {
        target.focus();
        stop();
        return;
      }
    }
    if (performance.now() - started > timeoutMs) stop();
  }, 100);
  document.addEventListener("pointerdown", stop, true);
  document.addEventListener("keydown", stop, true);
  return stop;
}
