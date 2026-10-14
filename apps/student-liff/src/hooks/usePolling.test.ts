// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { usePolling, type UsePollingOptions, type UsePollingResult } from "./usePolling";

let container: HTMLDivElement;
let root: Root;
let api: UsePollingResult | null = null;

function PollingProbe({ fn, options }: { fn: () => unknown; options: UsePollingOptions }) {
  api = usePolling(fn, options);
  return null;
}

async function render(fn: () => unknown, options: UsePollingOptions) {
  await act(async () => {
    root.render(React.createElement(PollingProbe, { fn, options }));
  });
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  api = null;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("usePolling", () => {
  it("runs immediately, then every interval after each run completes", async () => {
    const fn = vi.fn();
    await render(fn, { interval: 1000 });
    expect(fn).toHaveBeenCalledTimes(1);

    await advance(999);
    expect(fn).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fn).toHaveBeenCalledTimes(2);
    await advance(1000);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("waits one interval first when immediate is false", async () => {
    const fn = vi.fn();
    await render(fn, { interval: 500, immediate: false });
    expect(fn).not.toHaveBeenCalled();

    await advance(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("never overlaps: the next run is scheduled after a slow run settles", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fn = vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      inFlight -= 1;
    });

    await render(fn, { interval: 1000 });
    await advance(2999);
    expect(fn).toHaveBeenCalledTimes(1);

    await advance(1); // first run settles at t=3000, next scheduled for t=4000
    await advance(999);
    expect(fn).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(maxInFlight).toBe(1);
  });

  it("keeps polling after a run throws", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    await render(fn, { interval: 1000 });

    await advance(1000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("pauses while hidden and runs immediately when visible again", async () => {
    const fn = vi.fn();
    await render(fn, { interval: 1000 });
    expect(fn).toHaveBeenCalledTimes(1);

    await act(async () => setVisibility("hidden"));
    await advance(10_000);
    expect(fn).toHaveBeenCalledTimes(1);

    await act(async () => setVisibility("visible"));
    expect(fn).toHaveBeenCalledTimes(2);
    await advance(1000);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not start while hidden when pauseWhenHidden is on", async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    const fn = vi.fn();
    await render(fn, { interval: 1000 });
    await advance(5000);
    expect(fn).not.toHaveBeenCalled();

    await act(async () => setVisibility("visible"));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("keeps polling in the background when pauseWhenHidden is false", async () => {
    const fn = vi.fn();
    await render(fn, { interval: 1000, pauseWhenHidden: false });
    await act(async () => setVisibility("hidden"));

    await advance(2000);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("stops when disabled and on unmount", async () => {
    const fn = vi.fn();
    await render(fn, { interval: 1000 });
    await render(fn, { interval: 1000, enabled: false });
    await advance(5000);
    expect(fn).toHaveBeenCalledTimes(1);

    await render(fn, { interval: 1000, enabled: true });
    expect(fn).toHaveBeenCalledTimes(2);

    await act(async () => root.unmount());
    await advance(5000);
    expect(fn).toHaveBeenCalledTimes(2);
    root = createRoot(container);
  });

  it("runNow runs immediately and restarts the interval", async () => {
    const fn = vi.fn();
    await render(fn, { interval: 1000 });
    await advance(600);

    await act(async () => { await api!.runNow(); });
    expect(fn).toHaveBeenCalledTimes(2);

    await advance(999);
    expect(fn).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("runNow during a run queues exactly one follow-up run", async () => {
    let release: () => void = () => {};
    const fn = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    await render(fn, { interval: 1000 });
    expect(fn).toHaveBeenCalledTimes(1);

    let done = false;
    const first = api!.runNow().then(() => { done = true; });
    void api!.runNow();
    await act(async () => { release(); });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(done).toBe(false);

    await act(async () => { release(); await first; });
    expect(done).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("uses the latest fn and applies a new interval to the pending wait", async () => {
    const first = vi.fn();
    const second = vi.fn();
    await render(first, { interval: 10_000 });
    await render(second, { interval: 1000 });

    await advance(1000);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("never overlaps across a disable/enable toggle: the new chain waits for the in-flight run", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fn = vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      inFlight -= 1;
    });

    await render(fn, { interval: 1000 });
    await advance(1000);
    await render(fn, { interval: 1000, enabled: false });
    await advance(500);
    await render(fn, { interval: 1000, enabled: true });
    // Re-enabled at t=1500 while the first run lasts until t=3000.
    expect(fn).toHaveBeenCalledTimes(1);

    await advance(1500);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(maxInFlight).toBe(1);
  });

  it("drops a run that was still waiting when polling stopped", async () => {
    let release: () => void = () => {};
    const fn = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));

    await render(fn, { interval: 1000 });
    await render(fn, { interval: 1000, enabled: false });
    await render(fn, { interval: 1000, enabled: true }); // waits behind the first run
    await act(async () => root.unmount());
    await act(async () => { release(); });
    await advance(5000);

    expect(fn).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });

  it("runNow while disabled waits for a run that is still in flight", async () => {
    let release: () => void = () => {};
    let inFlight = 0;
    let maxInFlight = 0;
    const fn = vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise<void>((resolve) => { release = resolve; });
      inFlight -= 1;
    });

    await render(fn, { interval: 1000 });
    await render(fn, { interval: 1000, enabled: false });
    const manual = api!.runNow();
    expect(fn).toHaveBeenCalledTimes(1);

    await act(async () => { release(); });
    expect(fn).toHaveBeenCalledTimes(2);
    await act(async () => { release(); await manual; });
    expect(maxInFlight).toBe(1);
  });

  it("runNow still runs once while disabled", async () => {
    const fn = vi.fn();
    await render(fn, { interval: 1000, enabled: false });

    await act(async () => { await api!.runNow(); });
    expect(fn).toHaveBeenCalledTimes(1);
    await advance(5000);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
