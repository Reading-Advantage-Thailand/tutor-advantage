/**
 * Focus helpers for the tables of this group (classes, coupons, discount codes).
 * When an action removes the control that had focus (voiding a code hides the
 * row's action buttons; "ล้างตัวกรอง" and a filter chip remove themselves),
 * focus must land somewhere sensible instead of <body>.
 */

/** Marks the element whose first visible button/link takes focus for row `id`. */
export function focusAnchorProps(id: string) {
  return { "data-focus-anchor": id } as const;
}

function visibleControlIn(anchorId: string): HTMLElement | null {
  const selector = `[data-focus-anchor="${CSS.escape(anchorId)}"]`;
  for (const anchor of document.querySelectorAll<HTMLElement>(selector)) {
    // The table (md+) and the phone cards both render the cell; one is display:none.
    if (anchor.getClientRects().length === 0) continue;
    const control = anchor.querySelector<HTMLElement>("button, a[href]");
    if (control) return control;
  }
  return null;
}

/**
 * After an action that will re-render the row without the control it came from
 * (e.g. a void that succeeded and refreshes the list): for a few seconds,
 * whenever focus has fallen back to <body>, move it to the row's anchor
 * (the code's copy button). Focus the user moved elsewhere is left alone.
 */
export function rescueFocusTo(anchorId: string, timeoutMs = 4000) {
  if (typeof window === "undefined") return;
  const started = performance.now();
  const timer = window.setInterval(() => {
    const active = document.activeElement;
    if (!active || active === document.body) {
      const control = visibleControlIn(anchorId);
      if (control) {
        control.focus();
        window.clearInterval(timer);
        return;
      }
    }
    if (performance.now() - started > timeoutMs) window.clearInterval(timer);
  }, 100);
}

/** Puts focus in the toolbar's search box (after a reset or a removed filter chip). */
export function focusSearchIn(container: HTMLElement | null) {
  container?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
}
