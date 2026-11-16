/**
 * Remembers the control the user last pressed with a pointer. Safari and iOS
 * do not focus a button when it is clicked or tapped, so a sheet opened that
 * way cannot learn its opener from document.activeElement. Sheet starts the
 * listener when its module loads, before any sheet code is fetched, and reads
 * the opener when it opens (not when the sheet code arrives).
 */
const CONTROL = 'button, a[href], input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])';
// A press older than this is not what opened the sheet.
const PRESS_WINDOW_MS = 1500;

let pressed: HTMLElement | null = null;
let pressedAt = 0;
let tracking = false;

export function trackPressedControls() {
  if (tracking || typeof document === "undefined") return;
  tracking = true;
  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target instanceof Element ? event.target.closest(CONTROL) : null;
      pressed = target instanceof HTMLElement ? target : null;
      pressedAt = performance.now();
    },
    true,
  );
}

/** The control pressed just now, if it is still on the page. */
function recentlyPressedControl(): HTMLElement | null {
  if (!pressed || !pressed.isConnected || performance.now() - pressedAt > PRESS_WINDOW_MS) return null;
  return pressed;
}

/**
 * The control that opened something just now: the focused control, or the
 * control the user just pressed when focus is on <body> or on a container.
 * Safari does not focus a clicked button; it focuses the nearest focusable
 * ancestor instead (body, or e.g. <main tabIndex={-1}> or a sheet popup).
 */
export function currentOpener(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  const focused = active instanceof HTMLElement && active !== document.body ? active : null;
  const justPressed = recentlyPressedControl();
  if (focused && (focused.matches(CONTROL) || !justPressed)) return focused;
  return justPressed ?? focused;
}
