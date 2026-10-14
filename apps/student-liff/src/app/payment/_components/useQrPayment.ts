"use client";

import { useCallback, useEffect, useRef, useState } from "react";
// Relative imports: the root vitest config maps "@" to another app.
import { usePolling } from "../../../hooks/usePolling";
import { studentApi } from "../../../lib/api";
import { getQrExpiresAt, type PaymentStatusResponse } from "../../../lib/paymentFlow";

/** Delay between the end of one status check and the next (as before: 5s). */
export const QR_POLL_INTERVAL_MS = 5_000;

export interface QrPaymentCallbacks {
  /** Every status response from the automatic check (merge its checkout). */
  onStatus: (status: PaymentStatusResponse) => void;
  /** The intent is SUCCESS. */
  onPaid: () => void;
  /** The intent is FAILED. */
  onFailed: (status: PaymentStatusResponse) => void;
  /** GET /payments/:id/qr-code returned the QR image. */
  onQrCode: (qr: { chargeId: string; dataUri: string | null }) => void;
}

export interface QrPayment {
  /** The QR image request is in flight. */
  loading: boolean;
  /** The last QR image request failed. */
  error: boolean;
  /** Epoch ms when the shown QR stops being offered (null = no QR yet). */
  expiresAt: number | null;
  expired: boolean;
  /** The automatic status check is running. */
  polling: boolean;
  /** Loads the QR image for an intent, then starts the check and the 15-minute timer. Rejects on failure. */
  loadQr: (intentId: string) => Promise<void>;
  startPolling: (intentId: string) => void;
  stopPolling: () => void;
  /** Forgets the QR (new QR / other method): stops the check and the timer. */
  reset: () => void;
}

/**
 * PromptPay QR state: the image request, the automatic status check and the
 * expiry deadline.
 *
 * - The check is a non-overlapping setTimeout chain (usePolling): it pauses
 *   while LINE is in the background and checks right away when the student
 *   comes back from the banking app.
 * - Expiry is a stored deadline (not a per-second counter in this hook), so
 *   the page does not re-render every second and a throttled background tab
 *   cannot drift. The visible countdown lives in <QrCountdown>.
 * - When the QR expires the check stops.
 */
export function useQrPayment(callbacks: QrPaymentCallbacks): QrPayment {
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const [pollIntentId, setPollIntentId] = useState<string | null>(null);
  const pollIntentRef = useRef<string | null>(null);
  /** The intent whose QR is on screen; responses for any other intent are dropped. */
  const activeIntentRef = useRef<string | null>(null);

  const startPolling = useCallback((intentId: string) => {
    activeIntentRef.current = intentId;
    pollIntentRef.current = intentId;
    setPollIntentId(intentId);
  }, []);

  const stopPolling = useCallback(() => {
    pollIntentRef.current = null;
    setPollIntentId(null);
  }, []);

  const check = useCallback(async () => {
    const intentId = pollIntentRef.current;
    if (!intentId) return;
    const status = (await studentApi.getPaymentStatus(intentId)) as PaymentStatusResponse;
    // A different QR is on screen now (new QR / other method / unmounted).
    if (activeIntentRef.current !== intentId) return;
    callbacksRef.current.onStatus(status);
    if (status.intent.status === "SUCCESS") {
      stopPolling();
      callbacksRef.current.onPaid();
    } else if (status.intent.status === "FAILED") {
      stopPolling();
      callbacksRef.current.onFailed(status);
    }
  }, [stopPolling]);

  usePolling(check, {
    interval: QR_POLL_INTERVAL_MS,
    enabled: pollIntentId !== null && !expired,
    // The QR was just created: the first check comes one interval later (as before).
    immediate: false,
  });

  // Expiry: one timer to the deadline, plus a check when LINE comes back to
  // the front (timers are throttled while the banking app is open).
  useEffect(() => {
    if (expiresAt === null || expired) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expireIfDue = () => {
      clearTimeout(timer);
      const left = expiresAt - Date.now();
      if (left > 0) {
        // Woke up early (wall clock moved): wait for the rest instead of never expiring.
        timer = setTimeout(expireIfDue, left);
        return;
      }
      stopPolling();
      setExpired(true);
    };
    timer = setTimeout(expireIfDue, Math.max(0, expiresAt - Date.now()));
    const onVisibility = () => {
      if (document.visibilityState === "visible") expireIfDue();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [expiresAt, expired, stopPolling]);

  useEffect(
    () => () => {
      activeIntentRef.current = null;
      pollIntentRef.current = null;
    },
    [],
  );

  const loadQr = useCallback(
    async (intentId: string) => {
      activeIntentRef.current = intentId;
      setLoading(true);
      setError(false);
      try {
        const qr = await studentApi.getPaymentQrCode(intentId);
        if (activeIntentRef.current !== intentId) return;
        callbacksRef.current.onQrCode({ chargeId: qr?.chargeId, dataUri: qr?.dataUri ?? null });
        // Same order as before: QR on screen → automatic check → 15-minute timer.
        startPolling(intentId);
        setExpired(false);
        setExpiresAt(getQrExpiresAt(Date.now()));
      } catch (err) {
        if (activeIntentRef.current === intentId) setError(true);
        throw err;
      } finally {
        if (activeIntentRef.current === intentId) setLoading(false);
      }
    },
    [startPolling],
  );

  const reset = useCallback(() => {
    activeIntentRef.current = null;
    stopPolling();
    setLoading(false);
    setError(false);
    setExpiresAt(null);
    setExpired(false);
  }, [stopPolling]);

  return {
    loading,
    error,
    expiresAt,
    expired,
    polling: pollIntentId !== null && !expired,
    loadQr,
    startPolling,
    stopPolling,
    reset,
  };
}
