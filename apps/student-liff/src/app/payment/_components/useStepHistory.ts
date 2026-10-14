"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

/** history.state key marking the entry of a checkout sub-step (age check, QR, card form). */
export const PAYMENT_STEP_STATE_KEY = "__taPaymentStep";

function currentStateObject(): Record<string, unknown> {
  const state = window.history.state;
  return state && typeof state === "object" ? (state as Record<string, unknown>) : {};
}

/** Whether a history state belongs to a checkout sub-step entry. */
export function isPaymentStepState(state: unknown): boolean {
  return Boolean(state && typeof state === "object" && PAYMENT_STEP_STATE_KEY in state);
}

export interface StepHistory {
  /**
   * Call when showing a sub-step. The first one pushes ONE same-URL history
   * entry; later sub-steps replace it, so hardware back always returns to the
   * method screen (like the in-app back button).
   */
  enterSubStep: (step: string) => void;
  /** In-app back from a sub-step: pops our entry (if any). Returns true when it did. */
  leaveSubStep: () => boolean;
}

/**
 * Mirrors the checkout's sub-steps into browser history so Android's back
 * button / iOS edge swipe inside LINE go back to the method screen instead of
 * leaving /payment (which dropped the QR, age-check input and card form).
 *
 * The URL never changes and only a step marker is stored (never card data).
 * Existing state (Next.js router tree, in-app depth) is kept on the entry.
 * `onPopToBase` runs when the user goes back from a sub-step with the browser.
 */
export function useStepHistory(onPopToBase: () => void): StepHistory {
  const pushedRef = useRef(false);
  const onPopRef = useRef(onPopToBase);
  useEffect(() => {
    onPopRef.current = onPopToBase;
  });

  useEffect(() => {
    // Reloaded while on a sub-step entry: the flow restarts on the method
    // screen, so this entry becomes the base (else back would need 2 taps).
    if (isPaymentStepState(window.history.state)) {
      const rest = { ...currentStateObject() };
      delete rest[PAYMENT_STEP_STATE_KEY];
      window.history.replaceState(rest, "");
    }

    const onPopState = (event: PopStateEvent) => {
      if (!pushedRef.current) return;
      // Still on (or forward to) a sub-step entry: nothing to undo.
      if (isPaymentStepState(event.state)) return;
      pushedRef.current = false;
      onPopRef.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const enterSubStep = useCallback((step: string) => {
    const state = { ...currentStateObject(), [PAYMENT_STEP_STATE_KEY]: step };
    if (pushedRef.current) {
      window.history.replaceState(state, "");
      return;
    }
    window.history.pushState(state, "");
    pushedRef.current = true;
  }, []);

  const leaveSubStep = useCallback(() => {
    if (!pushedRef.current) return false;
    pushedRef.current = false;
    window.history.back();
    return true;
  }, []);

  return useMemo(() => ({ enterSubStep, leaveSubStep }), [enterSubStep, leaveSubStep]);
}
