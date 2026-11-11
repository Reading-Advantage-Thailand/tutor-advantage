// @vitest-environment jsdom
// In its own file because images, once loaded, stay cached for the whole module.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RuneMatchGame } from "./RuneMatchGame";
import * as runeMatchLib from "../../../../lib/games/runeMatch";

vi.mock("react-konva", () => ({
  Stage: ({ children }: any) => <div>{children}</div>,
  Layer: ({ children }: any) => <div>{children}</div>,
  Group: ({ children }: any) => <div>{children}</div>,
  Rect: () => <div />,
  Circle: () => <div />,
  Text: () => <span />,
  Image: () => <div />,
}));

const WORDS: any[] = [
  { id: "1", term: "cat", translation: "แมว" },
  { id: "2", term: "dog", translation: "สุนัข" },
];

describe("RuneMatchGame while images load", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
    window.HTMLElement.prototype.getBoundingClientRect = () =>
      ({ width: 390, height: 844, top: 0, left: 0, bottom: 844, right: 390, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps the clock stopped until the board can be seen", async () => {
    let finishLoading = () => {};
    const pending: (() => void)[] = [];
    class SlowImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_val: string) {
        pending.push(() => this.onload?.());
      }
    }
    globalThis.Image = SlowImage as any;
    finishLoading = () => pending.splice(0).forEach((done) => done());
    const advance = vi.spyOn(runeMatchLib, "advanceTime");
    const onComplete = vi.fn();

    await act(async () => {
      root.render(<RuneMatchGame vocabulary={WORDS} disableAutoFullscreen onComplete={onComplete} />);
    });
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    // Seconds of waiting have not spent any of the round, and no score was sent.
    expect(advance).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();

    await act(async () => {
      finishLoading();
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(advance).toHaveBeenCalled();
    const lastCall = advance.mock.calls[advance.mock.calls.length - 1];
    expect(lastCall[2]).toBeGreaterThan(58_000);
  });
});
