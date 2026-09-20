// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RuneMatchGame } from "./RuneMatchGame";
import * as runeMatchLib from "../../../../lib/games/runeMatch";
import type { VocabularyItem } from "../../../../store/useGameStore";

vi.mock("react-konva", () => ({
  Stage: ({ children }: any) => <div data-testid="konva-stage">{children}</div>,
  Layer: ({ children }: any) => <div data-testid="konva-layer">{children}</div>,
  Group: ({ children, onClick }: any) => (
    <div data-testid="konva-group" onClick={onClick}>
      {children}
    </div>
  ),
  Rect: (props: any) => <div data-testid="konva-rect" {...props} />,
  Circle: (props: any) => <div data-testid="konva-circle" {...props} />,
  Line: (props: any) => <div data-testid="konva-line" {...props} />,
  Text: (props: any) => <span data-testid="konva-text">{props.text}</span>,
  Image: (props: any) => <div data-testid="konva-image" {...props} />,
}));

const mockVocabulary: any[] = [
  { id: "1", word: "cat", meaning: "แมว", term: "cat", translation: "แมว" },
  { id: "2", word: "dog", meaning: "สุนัข", term: "dog", translation: "สุนัข" },
  { id: "3", word: "sun", meaning: "พระอาทิตย์", term: "sun", translation: "พระอาทิตย์" },
  { id: "4", word: "moon", meaning: "พระจันทร์", term: "moon", translation: "พระจันทร์" },
];

describe("RuneMatchGame flow and performance tests", () => {
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

    // Mock Image loading
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      _src = "";
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          this.onload?.();
        }, 10);
      }
    }
    globalThis.Image = MockImage as any;

    window.HTMLElement.prototype.getBoundingClientRect = () => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  const waitForGameReady = async () => {
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        vi.advanceTimersByTime(100);
        await Promise.resolve();
      });
    }
  };

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calls onComplete when victory occurs and disableAutoFullscreen is true", async () => {
    const onComplete = vi.fn();

    await act(async () => {
      root.render(
        <RuneMatchGame
          vocabulary={mockVocabulary}
          disableAutoFullscreen={true}
          restartOnComplete={false}
          onComplete={onComplete}
        />
      );
    });

    await waitForGameReady();

    // The game is already in 'playing' status with Goblin.
    // Advance time until 60 seconds expire (defeat by duration)
    await act(async () => {
      // 60 seconds in 50ms ticks
      vi.advanceTimersByTime(60_100);
    });

    // onComplete MUST have been called despite disableAutoFullscreen being true!
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        monsterType: "goblin",
      })
    );
  });

  it("does NOT call onComplete and auto-restarts when restartOnComplete is true", async () => {
    const onComplete = vi.fn();

    await act(async () => {
      root.render(
        <RuneMatchGame
          vocabulary={mockVocabulary}
          disableAutoFullscreen={true}
          restartOnComplete={true}
          onComplete={onComplete}
        />
      );
    });

    await waitForGameReady();

    // Advance 60 seconds so duration runs out
    await act(async () => {
      vi.advanceTimersByTime(60_100);
    });

    // onComplete should NOT be called because restartOnComplete is true
    expect(onComplete).not.toHaveBeenCalled();

    // After 1.5s restart delay, the game should auto-restart
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("does NOT calculate findPossibleMoves every tick when not in tutorialMode", async () => {
    const spy = vi.spyOn(runeMatchLib, "findPossibleMoves");

    await act(async () => {
      root.render(
        <RuneMatchGame
          vocabulary={mockVocabulary}
          tutorialMode={false}
          onComplete={() => {}}
        />
      );
    });

    await waitForGameReady();

    const callsBeforeTicks = spy.mock.calls.length;

    // Advance through 100 game ticks (5 seconds)
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // In regular gameplay, findPossibleMoves must NOT be called on every tick!
    // Previously it called findPossibleMoves on EVERY tick because targetTutorialMove
    // ran unconditionally without checking tutorialMode.
    const callsDuringTicks = spy.mock.calls.length - callsBeforeTicks;
    expect(callsDuringTicks).toBe(0);
  });
});
