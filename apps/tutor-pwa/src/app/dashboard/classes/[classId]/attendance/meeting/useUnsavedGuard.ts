"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BACK_GUARD_START, backGuardStep, guardedLinkTarget, type BackGuardEvent } from "../attendanceModel";

/** How long a confirmed back may take before we assume there was nothing to go back to. */
const BACK_STUCK_MS = 500;

/**
 * While `dirty`, asks before leaving: the browser's own prompt for reloads and
 * closing the tab, `pendingHref` (show a dialog) for in-app link clicks, and
 * `askingBack` (show a dialog) for the browser's back button or gesture. The
 * history handling for back is `backGuardStep` in attendanceModel.
 */
export function useUnsavedGuard(dirty: boolean) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [askingBack, setAskingBack] = useState(false);
  const backGuard = useRef(BACK_GUARD_START);
  const stuckTimer = useRef<number | undefined>(undefined);

  const step = useCallback((event: BackGuardEvent) => {
    const { state, effect } = backGuardStep(backGuard.current, event);
    backGuard.current = state;
    // Next copies its router state onto a native pushState, so its popstate handler restores this same page.
    if (effect === "pushGuard") window.history.pushState(null, "", window.location.href);
    if (effect === "goBack") window.history.back();
    setAskingBack(state.askingBack);
  }, []);

  useEffect(() => {
    step(dirty ? "dirty" : "clean");
  }, [dirty, step]);

  useEffect(() => {
    const onPopState = () => {
      window.clearTimeout(stuckTimer.current);
      step("pop");
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.clearTimeout(stuckTimer.current);
    };
  }, [step]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (backGuard.current.leaving) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const target = guardedLinkTarget(
        {
          href: anchor.href,
          target: anchor.target,
          download: anchor.hasAttribute("download"),
          modified: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
        },
        window.location.href,
      );
      if (!target) return;
      // Capture phase on document runs before React's listener on the root, so next/link never sees this click.
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(target);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  return {
    pendingHref,
    clearPending: () => setPendingHref(null),
    askingBack,
    cancelBack: () => step("cancel"),
    /** Leaves through the previous history entry; `onNoPrevious` runs when there is none, such as a page opened directly. */
    confirmBack: (onNoPrevious: () => void) => {
      step("confirm");
      stuckTimer.current = window.setTimeout(onNoPrevious, BACK_STUCK_MS);
    },
  };
}
