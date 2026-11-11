// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RuneMatchGame } from "./RuneMatchGame";
import * as runeMatchLib from "../../../../lib/games/runeMatch";

vi.mock("react-konva", () => ({
  Stage: ({ children }: any) => <div data-testid="konva-stage">{children}</div>,
  Layer: ({ children }: any) => <div data-testid="konva-layer">{children}</div>,
  Group: ({ children, onClick, onTap }: any) => (
    <div data-testid="konva-group" onClick={onClick ?? onTap}>
      {children}
    </div>
  ),
  Rect: () => <div data-testid="konva-rect" />,
  Circle: () => <div data-testid="konva-circle" />,
  Line: () => <div data-testid="konva-line" />,
  Text: (props: any) => <span data-testid="konva-text">{props.text}</span>,
  Image: () => <div data-testid="konva-image" />,
}));

const mockVocabulary: any[] = [
  { id: "1", word: "cat", meaning: "แมว", term: "cat", translation: "แมว" },
  { id: "2", word: "dog", meaning: "สุนัข", term: "dog", translation: "สุนัข" },
  { id: "3", word: "sun", meaning: "พระอาทิตย์", term: "sun", translation: "พระอาทิตย์" },
  { id: "4", word: "moon", meaning: "พระจันทร์", term: "moon", translation: "พระจันทร์" },
];

/** The end of a round stays on screen this long before the score moves on. */
const HOLD_MS = 1_200;

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

  const playOutTheClock = async () => {
    await act(async () => {
      vi.advanceTimersByTime(60_100);
    });
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

  const renderLive = async (onComplete: (result: any) => void, vocabulary = mockVocabulary) => {
    await act(async () => {
      root.render(
        <RuneMatchGame
          vocabulary={vocabulary}
          disableAutoFullscreen={true}
          restartOnComplete={false}
          onComplete={onComplete}
        />,
      );
    });
  };

  it("calls onComplete after the end of the round is shown", async () => {
    const onComplete = vi.fn();
    await renderLive(onComplete);
    await waitForGameReady();
    await playOutTheClock();

    // Time is up and "หมดเวลา!" is on screen, but the score has not moved on yet.
    expect(onComplete).not.toHaveBeenCalled();
    expect(container.textContent).toContain("หมดเวลา!");

    await act(async () => {
      vi.advanceTimersByTime(HOLD_MS);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        monsterType: "goblin",
        score: 0,
        correctAnswers: 0,
        totalAttempts: 10,
      }),
    );
  });

  it("reports play time without the moment on screen", async () => {
    const onComplete = vi.fn();
    await renderLive(onComplete);
    await waitForGameReady();
    await playOutTheClock();
    await act(async () => {
      vi.advanceTimersByTime(HOLD_MS);
    });
    const { durationMs } = onComplete.mock.calls[0][0];
    expect(durationMs).toBeGreaterThanOrEqual(59_500);
    expect(durationMs).toBeLessThan(61_000);
  });

  it("hands the score over at once if the game is removed during the end moment", async () => {
    const onComplete = vi.fn();
    await renderLive(onComplete);
    await waitForGameReady();
    await playOutTheClock();
    expect(onComplete).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    expect(onComplete).toHaveBeenCalledTimes(1);

    // afterEach unmounts again.
    root = createRoot(container);
  });

  it("keeps the round when a reconnect hands over the same words in a new list", async () => {
    const createState = vi.spyOn(runeMatchLib, "createRuneMatchState");
    const onComplete = vi.fn();
    await renderLive(onComplete);
    await waitForGameReady();
    expect(createState).toHaveBeenCalledTimes(1);

    await renderLive(
      onComplete,
      mockVocabulary.map((item) => ({ ...item })),
    );
    await waitForGameReady();
    expect(createState).toHaveBeenCalledTimes(1);

    // Different words are a new round.
    await renderLive(onComplete, [...mockVocabulary, { id: "5", term: "tree", translation: "ต้นไม้" }]);
    await waitForGameReady();
    expect(createState).toHaveBeenCalledTimes(2);
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
        />,
      );
    });

    await waitForGameReady();
    await playOutTheClock();
    expect(onComplete).not.toHaveBeenCalled();

    // After 1.5s restart delay, the game should auto-restart
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("หมดเวลา!");
  });

  it("does NOT calculate findPossibleMoves every tick when not in tutorialMode", async () => {
    const spy = vi.spyOn(runeMatchLib, "findPossibleMoves");

    await act(async () => {
      root.render(
        <RuneMatchGame
          vocabulary={mockVocabulary}
          tutorialMode={false}
          onComplete={() => {}}
        />,
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

  it("offers only the two skills that do something", async () => {
    await act(async () => {
      root.render(<RuneMatchGame vocabulary={mockVocabulary} disableAutoFullscreen onComplete={() => {}} />);
    });
    await waitForGameReady();
    expect(container.textContent).toContain("สลับกระดาน");
    expect(container.textContent).toContain("คำใบ้");
    expect(container.textContent).not.toContain("ระเบิด");
    expect(container.textContent).not.toContain("แช่แข็ง");
    expect(container.textContent).not.toContain("คำเป้าหมาย");
  });

  it("states the rule on screen before the first tap", async () => {
    await act(async () => {
      root.render(<RuneMatchGame vocabulary={mockVocabulary} disableAutoFullscreen onComplete={() => {}} />);
    });
    await waitForGameReady();
    const noSpaces = (text: string) => text.replace(/\s+/g, "");
    expect(noSpaces(container.textContent ?? "")).toContain(noSpaces(runeMatchLib.RUNE_RULE_LINES.join("")));
  });
});
