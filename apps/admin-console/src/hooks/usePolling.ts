import { useCallback, useEffect, useMemo, useRef } from "react";

export interface UsePollingOptions {
  /** Delay in ms between the END of one run and the start of the next. */
  interval: number;
  /** Start/stop polling. Default true. */
  enabled?: boolean;
  /** Stop scheduling while the page is hidden (tab in background); run right away when visible again. Default true. */
  pauseWhenHidden?: boolean;
  /** Run once immediately when polling starts (otherwise wait one interval). Default true. */
  immediate?: boolean;
}

export interface UsePollingResult {
  /**
   * Run now (e.g. right after sending a chat message) and restart the interval.
   * If a run is in progress, one more run is queued after it; the promise
   * resolves when that requested run has finished. Never rejects.
   */
  runNow: () => Promise<void>;
}

interface Poller {
  start: (immediate: boolean) => void;
  runNow: () => Promise<void>;
  /** Re-arm a pending timer with the current interval. */
  reschedule: () => void;
  dispose: () => void;
}

function isPageHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function createPoller(
  /** `isActive()` turns false once this poller is disposed. */
  run: (isActive: () => boolean) => unknown,
  getInterval: () => number,
  pauseWhenHidden: boolean,
): Poller {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;
  let queued: { promise: Promise<void>; resolve: () => void } | null = null;
  let disposed = false;

  const shouldPause = () => pauseWhenHidden && isPageHidden();

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = () => {
    clearTimer();
    if (disposed || shouldPause()) return;
    timer = setTimeout(() => {
      timer = null;
      void tick();
    }, Math.max(0, getInterval()));
  };

  const tick = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    if (running) {
      if (!queued) {
        let resolve!: () => void;
        const promise = new Promise<void>((r) => {
          resolve = r;
        });
        queued = { promise, resolve };
      }
      return queued.promise;
    }

    clearTimer();
    const current = (async () => {
      try {
        await run(() => !disposed);
      } catch {
        // A failed run must not break the chain; `run` owns its error UI.
      }
    })();
    running = current;

    return current.then(() => {
      running = null;
      const next = queued;
      queued = null;
      if (disposed) {
        next?.resolve();
        return;
      }
      if (next) {
        void tick().then(next.resolve);
        return;
      }
      schedule();
    });
  };

  const onVisibilityChange = () => {
    if (disposed) return;
    if (isPageHidden()) {
      clearTimer();
    } else {
      void tick();
    }
  };

  return {
    start(immediate) {
      if (pauseWhenHidden) document.addEventListener("visibilitychange", onVisibilityChange);
      if (immediate && !shouldPause()) void tick();
      else schedule();
    },
    runNow: tick,
    reschedule() {
      if (timer !== null) schedule();
    },
    dispose() {
      disposed = true;
      clearTimer();
      if (pauseWhenHidden) document.removeEventListener("visibilitychange", onVisibilityChange);
      queued?.resolve();
      queued = null;
    },
  };
}

/**
 * Poll `fn` with a setTimeout chain: the next run is scheduled only after the
 * previous one settles, so slow networks never cause overlapping requests (also
 * across `enabled` toggles: a restarted chain waits for a run still in flight).
 * Pauses while the page is hidden and runs immediately when it becomes visible.
 *
 * `fn` and `interval` are read from refs, so changing them does not restart
 * the chain (a pending wait is re-armed with the new interval). A run that is in
 * flight when the component unmounts still completes; guard state updates there
 * if needed.
 *
 * @example
 * const { runNow } = usePolling(loadMessages, { interval: 4000, enabled: !!conversationId });
 */
export function usePolling(
  fn: () => unknown,
  { interval, enabled = true, pauseWhenHidden = true, immediate = true }: UsePollingOptions,
): UsePollingResult {
  const fnRef = useRef(fn);
  const intervalRef = useRef(interval);
  const immediateRef = useRef(immediate);
  useEffect(() => {
    fnRef.current = fn;
    intervalRef.current = interval;
    immediateRef.current = immediate;
  });

  const pollerRef = useRef<Poller | null>(null);

  // One run at a time across every poller this hook creates (enabled/pauseWhenHidden
  // toggles, Strict Mode) and runNow while disabled: a new run first waits for a
  // run that is still in flight, so responses can never arrive out of order.
  const inFlightRef = useRef<Promise<void> | null>(null);
  const runExclusive = useCallback(async (isActive: () => boolean = () => true): Promise<void> => {
    while (inFlightRef.current) {
      await inFlightRef.current;
    }
    // The poller that queued this run was disposed (disabled/unmounted) while waiting.
    if (!isActive()) return;
    const current = (async () => {
      try {
        await fnRef.current();
      } catch {
        // swallow, same as polled runs
      }
    })();
    inFlightRef.current = current;
    try {
      await current;
    } finally {
      if (inFlightRef.current === current) inFlightRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const poller = createPoller(runExclusive, () => intervalRef.current, pauseWhenHidden);
    pollerRef.current = poller;
    poller.start(immediateRef.current);
    return () => {
      poller.dispose();
      if (pollerRef.current === poller) pollerRef.current = null;
    };
  }, [enabled, pauseWhenHidden, runExclusive]);

  // A new interval takes effect immediately for a pending wait.
  useEffect(() => {
    pollerRef.current?.reschedule();
  }, [interval]);

  const runNow = useCallback((): Promise<void> => {
    const poller = pollerRef.current;
    if (poller) return poller.runNow();
    // Polling is disabled: still honour an explicit request, once (after any run in flight).
    return runExclusive();
  }, [runExclusive]);

  return useMemo(() => ({ runNow }), [runNow]);
}
