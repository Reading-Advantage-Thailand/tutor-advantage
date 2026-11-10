import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createRoundClock,
  endRunningRoundsNow,
  MAX_CATCH_UP_MS,
  MAX_MOVE_STEP_MS,
  MIN_RESUMED_ROUND_MS,
  resumedRoundMs,
  setLiveRoundStartedAt,
  splitFrameTime,
} from "./roundClock";

const sum = (steps: number[]) => steps.reduce((total, step) => total + step, 0);

describe("a round the tutor ends early", () => {
  it("runs out a started round at once, so the game hands in what it has", () => {
    let now = 5_000;
    const onExpire = vi.fn();
    const clock = createRoundClock({ durationMs: 60_000, onExpire, now: () => now });
    clock.start();
    now += 20_000;

    expect(endRunningRoundsNow()).toBe(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(clock.tick(now).isOver).toBe(true);
    expect(clock.remainingMs()).toBe(0);
    clock.stop();
  });

  it("still counts a round whose time is up until its game stops the clock", () => {
    let now = 0;
    const onExpire = vi.fn();
    const clock = createRoundClock({ durationMs: 1_000, onExpire, now: () => now });
    clock.start();
    now += 2_000;
    clock.tick(now);
    expect(onExpire).toHaveBeenCalledTimes(1);

    expect(endRunningRoundsNow()).toBe(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
    clock.stop();
    expect(endRunningRoundsNow()).toBe(0);
  });

  it("reports nothing played when no clock has started", () => {
    const onExpire = vi.fn();
    const clock = createRoundClock({ durationMs: 60_000, onExpire, now: () => 0 });
    expect(endRunningRoundsNow()).toBe(0);
    expect(onExpire).not.toHaveBeenCalled();
    clock.stop();
  });
});

describe("a round already running", () => {
  afterEach(() => setLiveRoundStartedAt(null));

  it("plays only the time left when the phone returned mid-round", () => {
    let now = 100_000;
    setLiveRoundStartedAt(now - 40_000);
    const clock = createRoundClock({ durationMs: 60_000, now: () => now });
    clock.start();
    expect(clock.remainingMs()).toBe(20_000);
    now += 20_000;
    expect(clock.tick(now).isOver).toBe(true);
    clock.stop();
  });

  it("still gives a moment to play when the round is nearly or already over", () => {
    expect(resumedRoundMs(60_000, 59_000)).toBe(MIN_RESUMED_ROUND_MS);
    expect(resumedRoundMs(60_000, 500_000)).toBe(MIN_RESUMED_ROUND_MS);
  });

  it("never gives more than a full round", () => {
    expect(resumedRoundMs(60_000, -5_000)).toBe(60_000);
    expect(resumedRoundMs(5_000, 1_000)).toBe(5_000);
  });

  it("starts a full round when this phone saw the round begin", () => {
    let now = 100_000;
    setLiveRoundStartedAt(null);
    const clock = createRoundClock({ durationMs: 60_000, now: () => now });
    now += 30_000;
    clock.start();
    expect(clock.remainingMs()).toBe(60_000);
    clock.stop();
  });
});

describe("splitFrameTime", () => {
  it("keeps a normal frame as one step", () => {
    expect(splitFrameTime(16)).toEqual([16]);
  });

  it("splits a slow frame into capped steps that add up to it", () => {
    const steps = splitFrameTime(120);
    expect(steps).toEqual([50, 50, 20]);
    expect(steps.every((step) => step <= MAX_MOVE_STEP_MS)).toBe(true);
  });

  it("drops a long stall so nothing jumps", () => {
    expect(sum(splitFrameTime(30_000))).toBe(MAX_CATCH_UP_MS);
  });

  it("handles no time and backward time", () => {
    expect(splitFrameTime(0)).toEqual([]);
    expect(splitFrameTime(-5)).toEqual([]);
  });
});

describe("createRoundClock", () => {
  let time = 0;
  const now = () => time;

  beforeEach(() => {
    time = 1_000;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not count before start", () => {
    const clock = createRoundClock({ durationMs: 60_000, now });
    time += 5_000;
    const frame = clock.tick(time);
    expect(frame).toEqual({ stepsMs: [], remainingMs: 60_000, isOver: false });
    clock.stop();
  });

  it("follows real time on a slow phone while movement stays capped", () => {
    const onExpire = vi.fn();
    const clock = createRoundClock({ durationMs: 60_000, onExpire, now });
    clock.start();
    clock.tick(time);

    // 8 frames per second, a slow phone under load.
    let moved = 0;
    let frame = clock.tick(time);
    for (let i = 0; i < 480; i++) {
      time += 125;
      frame = clock.tick(time);
      expect(frame.stepsMs.every((step) => step <= MAX_MOVE_STEP_MS)).toBe(true);
      moved += sum(frame.stepsMs);
    }

    expect(frame.remainingMs).toBe(0);
    expect(frame.isOver).toBe(true);
    expect(moved).toBe(60_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
    clock.stop();
  });

  it("ends on time in a hidden tab with no frames at all", () => {
    const onExpire = vi.fn();
    const clock = createRoundClock({ durationMs: 60_000, onExpire, now });
    clock.start();
    clock.tick(time);

    time += 59_000;
    vi.advanceTimersByTime(59_000);
    expect(onExpire).not.toHaveBeenCalled();

    time += 1_000;
    vi.advanceTimersByTime(1_000);
    expect(onExpire).toHaveBeenCalledTimes(1);

    time += 5_000;
    vi.advanceTimersByTime(5_000);
    clock.tick(time);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("gives no jump when a hidden tab comes back with time left", () => {
    const clock = createRoundClock({ durationMs: 60_000, now });
    clock.start();
    clock.tick(time);
    time += 30_000;
    const frame = clock.tick(time);
    expect(frame.remainingMs).toBe(30_000);
    expect(sum(frame.stepsMs)).toBe(MAX_CATCH_UP_MS);
    clock.stop();
  });

  it("stays quiet after stop", () => {
    const onExpire = vi.fn();
    const clock = createRoundClock({ durationMs: 1_000, onExpire, now });
    clock.start();
    clock.stop();
    time += 5_000;
    vi.advanceTimersByTime(5_000);
    clock.tick(time);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("ignores a second start", () => {
    const clock = createRoundClock({ durationMs: 10_000, now });
    clock.start();
    time += 4_000;
    clock.start();
    expect(clock.remainingMs()).toBe(6_000);
    clock.stop();
  });
});
