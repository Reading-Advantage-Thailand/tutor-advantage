/**
 * Round clock: keeps a game's time on real time.
 *
 * Without it a game counts its 60 seconds by adding up capped frame steps, so a
 * slow phone plays a longer round and a hidden tab never ends. With it:
 *
 * - Time left comes from a real deadline, so every phone ends together.
 * - Movement still gets steps of at most 50 ms. A slow frame is split into
 *   several steps, up to 200 ms per frame, so a slow phone still walks at full
 *   speed and a long stall never makes anything jump.
 * - `onExpire` fires once when time is up, even in a hidden tab with no frames.
 *
 * Wiring, in the game loop effect:
 *
 *   const clock = createRoundClock({ durationMs: 60_000, onExpire: finishRound });
 *   clock.start();                             // when the board is on screen
 *   const loop = (timestamp: number) => {
 *     const frame = clock.tick(timestamp);
 *     for (const stepMs of frame.stepsMs) state = advanceGame(state, stepMs, input);
 *     showTimeLeft(frame.remainingMs);
 *     if (!frame.isOver) rafId = requestAnimationFrame(loop);
 *   };
 *   rafId = requestAnimationFrame(loop);
 *   return () => { cancelAnimationFrame(rafId); clock.stop(); };
 *
 * Do not start a clock in a tutor demo or tutorial: they have no round to end.
 * Call `start()` only once images are ready, so a slow download costs no play time.
 *
 * A phone that reloads or joins while the class round is already running plays
 * only the time that is left, set through `setLiveRoundStartedAt`. No game has to
 * know: it asks for its usual duration and the clock shortens it.
 *
 * When the tutor ends the class round early, `endRunningRoundsNow` runs out every
 * started clock, so each game ends the usual way and hands in what the student
 * has so far.
 */

/** The longest single movement step, the cap the games already use. */
export const MAX_MOVE_STEP_MS = 50;
/** The most movement one frame may catch up. */
export const MAX_CATCH_UP_MS = 200;

const HIDDEN_TAB_CHECK_MS = 1_000;

/** A student who returns at the very end still gets a moment to play. */
export const MIN_RESUMED_ROUND_MS = 10_000;

// On the performance.now() timeline. Null means this phone saw the round start.
let liveRoundStartedAt: number | null = null;

// Clocks started and not yet stopped. A clock whose time is up stays here until
// its game stops it, because that game may still be handing in its result.
const startedRounds = new Set<() => void>();

/**
 * Runs out every started round now, as if its time were up. The tutor ended the
 * class round early: each game then finishes the usual way, so the student keeps
 * the points earned so far. Returns how many rounds had started, including one
 * whose time is already up and is still finishing; 0 means nothing was played.
 */
export function endRunningRoundsNow(): number {
  const rounds = Array.from(startedRounds);
  rounds.forEach((endNow) => endNow());
  return rounds.length;
}

/**
 * The lesson page calls this when it finds a round already running. Pass null
 * for a round this phone saw start: its time then begins when its images are
 * ready, so a slow download costs no play time.
 */
export function setLiveRoundStartedAt(startedAt: number | null): void {
  liveRoundStartedAt = startedAt;
}

/** How long a round of this length runs from now, given when the class round began. */
export function resumedRoundMs(durationMs: number, elapsedMs: number): number {
  return Math.min(durationMs, Math.max(durationMs - elapsedMs, MIN_RESUMED_ROUND_MS));
}

export type RoundFrame = {
  /** Movement steps to run this frame, in order, each at most MAX_MOVE_STEP_MS. Can be empty. */
  stepsMs: number[];
  remainingMs: number;
  isOver: boolean;
};

export type RoundClock = {
  /** Starts the deadline. A second call does nothing. */
  start(): void;
  /** Call once per animation frame, with the timestamp requestAnimationFrame gives. */
  tick(timestamp?: number): RoundFrame;
  remainingMs(): number;
  /** Stops the background check. Call on unmount and when the game ends early. */
  stop(): void;
};

export type RoundClockOptions = {
  durationMs: number;
  /** Runs once when time is up. Not called after `stop()`. */
  onExpire?: () => void;
  /** For tests. Must use the same timeline as requestAnimationFrame timestamps. */
  now?: () => number;
};

/** Splits one frame's real time into capped movement steps. */
export function splitFrameTime(frameMs: number): number[] {
  const steps: number[] = [];
  let left = Math.min(Math.max(frameMs, 0), MAX_CATCH_UP_MS);
  while (left > 0.001) {
    const step = Math.min(left, MAX_MOVE_STEP_MS);
    steps.push(step);
    left -= step;
  }
  return steps;
}

export function createRoundClock({ durationMs, onExpire, now = () => performance.now() }: RoundClockOptions): RoundClock {
  let deadline: number | null = null;
  let lastFrame: number | null = null;
  let expired = false;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const remaining = (at: number) => (deadline === null ? durationMs : Math.max(0, deadline - at));

  const removeBackgroundCheck = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", checkExpired);
  };

  const fireIfOver = (at: number) => {
    if (expired || stopped || deadline === null || at < deadline) return;
    expired = true;
    removeBackgroundCheck();
    onExpire?.();
  };

  // Frames stop in a hidden tab, and a phone can suspend the page. Timers still
  // run while hidden, and visibilitychange covers the moment a suspended page wakes.
  function checkExpired() {
    fireIfOver(now());
  }

  const endNow = () => {
    if (expired || stopped || deadline === null) return;
    deadline = now();
    fireIfOver(deadline);
  };

  return {
    start() {
      if (deadline !== null || stopped) return;
      const at = now();
      deadline = at + (liveRoundStartedAt === null ? durationMs : resumedRoundMs(durationMs, at - liveRoundStartedAt));
      startedRounds.add(endNow);
      timer = setInterval(checkExpired, HIDDEN_TAB_CHECK_MS);
      if (typeof document !== "undefined") document.addEventListener("visibilitychange", checkExpired);
    },
    tick(timestamp) {
      const at = timestamp ?? now();
      const frameMs = lastFrame === null ? 0 : at - lastFrame;
      lastFrame = at;
      const stepsMs = deadline === null ? [] : splitFrameTime(frameMs);
      fireIfOver(at);
      const remainingMs = remaining(at);
      return { stepsMs, remainingMs, isOver: deadline !== null && remainingMs <= 0 };
    },
    remainingMs() {
      return remaining(now());
    },
    stop() {
      stopped = true;
      startedRounds.delete(endNow);
      removeBackgroundCheck();
    },
  };
}
