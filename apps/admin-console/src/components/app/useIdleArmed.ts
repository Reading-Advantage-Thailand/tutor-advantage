"use client";

import { useEffect, useState } from "react";

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Becomes true once the browser is idle after mount (fallback: 800 ms).
 * Lazy interaction-only pieces (Sheet, ConfirmDialog) mount their code then,
 * so it is ready before the first click without being in the first load.
 */
export function useIdleArmed(): boolean {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (armed) return;
    const win = window as IdleWindow;
    if (win.requestIdleCallback) {
      const handle = win.requestIdleCallback(() => setArmed(true), { timeout: 2500 });
      return () => win.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(() => setArmed(true), 800);
    return () => window.clearTimeout(timer);
  }, [armed]);
  return armed;
}
