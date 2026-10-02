// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Confetti } from "./Confetti";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

const canvases = () => document.querySelectorAll("canvas[data-celebrate]");

describe("Confetti", () => {
  let container: HTMLDivElement;
  let root: Root;
  let vibrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // jsdom has no 2D canvas; a stub context is enough to mount/unmount.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement) {
        return new Proxy({ canvas: this }, { get: (t, k) => (k in t ? t[k as "canvas"] : () => {}) });
      } as unknown as HTMLCanvasElement["getContext"],
    );
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("adds one non-interactive canvas on mount and removes it on unmount", () => {
    setReducedMotion(false);
    act(() => root.render(<Confetti intensity="big" />));
    expect(canvases()).toHaveLength(1);
    const canvas = canvases()[0] as HTMLCanvasElement;
    expect(canvas.style.pointerEvents).toBe("none");
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
    expect(vibrate).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    expect(canvases()).toHaveLength(0);
    root = createRoot(container);
  });

  it("does not re-fire on re-render, only when the fire key changes", () => {
    setReducedMotion(false);
    act(() => root.render(<Confetti fire={0} intensity="small" />));
    expect(canvases()).toHaveLength(0);
    act(() => root.render(<Confetti fire={1} intensity="small" />));
    act(() => root.render(<Confetti fire={1} intensity="medium" />));
    expect(vibrate).toHaveBeenCalledTimes(1);
    act(() => root.render(<Confetti fire={2} intensity="small" />));
    expect(vibrate).toHaveBeenCalledTimes(2);
    expect(canvases()).toHaveLength(1);
  });

  it("renders nothing with prefers-reduced-motion", () => {
    setReducedMotion(true);
    act(() => root.render(<Confetti />));
    expect(canvases()).toHaveLength(0);
    expect(vibrate).not.toHaveBeenCalled();
  });
});
