// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const seen = vi.hoisted(() => ({ targets: [] as unknown[] }));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ animate }: { animate: unknown }) => {
      seen.targets.push(animate);
      return <div data-testid="sparkle-particle" />;
    },
  },
}));

const { SparkleBurst } = await import("./SparkleBurst");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SparkleBurst", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    seen.targets = [];
    vi.useFakeTimers();
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  it("keeps each particle's target between renders, so the animation is not restarted every frame", () => {
    const onComplete = () => undefined;
    act(() => root.render(<SparkleBurst x={10} y={20} onComplete={onComplete} />));
    const firstRender = [...seen.targets];
    seen.targets = [];
    act(() => root.render(<SparkleBurst x={10} y={20} onComplete={onComplete} />));

    expect(firstRender).toHaveLength(10);
    seen.targets.forEach((target, i) => expect(target).toBe(firstRender[i]));
  });

  it("is removed on time even while its parent re-renders every frame", () => {
    const onComplete = vi.fn();
    for (let frame = 0; frame < 40; frame++) {
      act(() => root.render(<SparkleBurst x={10} y={20} onComplete={() => onComplete()} />));
      act(() => vi.advanceTimersByTime(16));
    }
    act(() => vi.advanceTimersByTime(100));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
