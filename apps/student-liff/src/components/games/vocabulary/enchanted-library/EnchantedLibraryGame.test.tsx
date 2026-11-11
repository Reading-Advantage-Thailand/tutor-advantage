// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  frames: [] as FrameRequestCallback[],
  sounds: [] as string[],
  vibrations: [] as number[],
}));

vi.mock("react-konva", () => {
  const Pass = () => null;
  return { Stage: Pass, Layer: Pass, Text: Pass, Group: Pass, Rect: Pass, Image: Pass, Circle: Pass };
});
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, initial: _i, animate: _a, transition: _t, ...rest }: Record<string, unknown>) => (
          <div {...(rest as object)}>{children as React.ReactNode}</div>
        ),
    },
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/games/gameAssetPreloader", () => {
  const image = { width: 300, height: 300, src: "sprite.webp" };
  return { getCachedGameImage: () => image, loadGameImage: () => new Promise(() => undefined) };
});
vi.mock("@/locales/client", () => ({ useScopedI18n: () => (key: string) => key }));
vi.mock("@/hooks/useSound", () => ({
  useSound: () => ({ playSound: (type: string) => harness.sounds.push(type) }),
}));
vi.mock("@/hooks/useAccessibilitySettings", () => ({
  useAccessibilitySettings: () => ({ getEffectiveTouchTarget: (size: number) => size }),
}));
vi.mock("@/components/ui/VirtualDPad", () => ({ VirtualDPad: () => <div data-testid="stick" /> }));
vi.mock("@/components/games/game/GameEndScreen", () => ({ GameEndScreen: () => null }));
vi.mock("@/components/games/game/GameStartScreen", () => ({ GameStartScreen: () => null }));
vi.mock("./RankingDisplay", () => ({ RankingDisplay: () => null }));

const { EnchantedLibraryGame } = await import("./EnchantedLibraryGame");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const WORDS = [
  { id: "1", term: "sun", translation: "พระอาทิตย์" },
  { id: "2", term: "moon", translation: "พระจันทร์" },
  { id: "3", term: "star", translation: "ดาว" },
  { id: "4", term: "sky", translation: "ท้องฟ้า" },
];

type GameProps = Partial<Parameters<typeof EnchantedLibraryGame>[0]>;

describe("EnchantedLibraryGame", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onComplete = vi.fn();

  const render = (props: GameProps = {}) =>
    act(() => {
      root.render(
        <EnchantedLibraryGame
          vocabulary={WORDS}
          difficulty="normal"
          onDifficultyChange={() => undefined}
          rankings={{ easy: [], normal: [], hard: [], extreme: [] }}
          autoStart
          restartOnComplete={false}
          onComplete={onComplete}
          {...props}
        />,
      );
    });

  /** Runs animation frames at this rate for this long of real time. */
  const play = (ms: number, frameMs = 1000 / 60) =>
    act(() => {
      for (let elapsed = 0; elapsed < ms; elapsed += frameMs) {
        vi.advanceTimersByTime(frameMs);
        const callbacks = harness.frames;
        harness.frames = [];
        callbacks.forEach((callback) => callback(performance.now()));
      }
    });

  const text = (testId: string) => container.querySelector(`[data-testid="${testId}"]`)?.textContent ?? "";
  const shield = () => container.querySelector<HTMLButtonElement>('[data-testid="shield-button"]');

  beforeEach(async () => {
    onComplete.mockClear();
    harness.frames = [];
    harness.sounds = [];
    harness.vibrations = [];
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance"],
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      harness.frames.push(callback);
      return harness.frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      harness.frames = [];
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 390,
      bottom: 844,
      width: 390,
      height: 844,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not restart the round when a reconnect hands over a copy of the same words", () => {
    render();
    play(3_000);
    const time = text("hud-time");
    const target = text("target-prompt");
    expect(time).toContain("0:57");

    render({ vocabulary: WORDS.map((word) => ({ ...word })) });
    play(100);

    expect(text("target-prompt")).toBe(target);
    expect(text("hud-time")).toContain("0:57");
  });

  it("starts a new round when the words really change", () => {
    render();
    play(3_000);
    render({
      vocabulary: [
        { id: "5", term: "rain", translation: "ฝน" },
        { id: "6", term: "wind", translation: "ลม" },
      ],
    });
    play(100);
    expect(text("hud-time")).toContain("1:00");
    play(3_000);
    expect(text("hud-time")).toContain("0:57");
  });

  it("ends the live round on real time even when no frame runs, and scores 0 for doing nothing", () => {
    render();
    play(500);
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatchObject({
      correctAnswers: 0,
      totalAttempts: WORDS.length,
      review: { heading: "หมดเวลา" },
    });
    expect(onComplete.mock.calls[0][0].review.missed).toHaveLength(WORDS.length);
  });

  it("keeps the same time and pace on a slow and a fast phone", () => {
    render();
    play(10_000, 1000 / 20);
    expect(text("hud-time")).toContain("0:50");
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("warns about the time only in the last 10 seconds", () => {
    const warning = () => container.querySelector('[data-testid="hud-time"]')?.className.includes("animate-pulse");
    render();
    play(45_000, 1000 / 30);
    expect(text("hud-time")).toMatch(/0:1[56]/);
    expect(warning()).toBe(false);
    play(6_000, 1000 / 30);
    expect(warning()).toBe(true);
  });

  it("runs no real deadline in a tutor demo, and the tutorial never reports a result", () => {
    render({ tutorialMode: true, restartOnComplete: true });
    play(1_000);
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("hides the Grimoire answer key in a live round and shows a found counter", () => {
    render();
    play(100);
    expect(container.querySelector('button[title]')).toBeNull();
    expect(text("hud-found")).toContain("พบแล้ว 0/4");
  });

  it("fires the shield on pointer down, once, with its own sound", () => {
    render();
    play(100);
    const before = text("hud-mana");
    act(() => {
      shield()?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
    });
    play(200);
    expect(harness.sounds).toEqual(["clinking"]);
    expect(text("hud-mana")).toBe(before);
    expect(container.textContent).not.toContain("My Grimoire");
  });

  it("warns about a ghost on screen before it can hit", () => {
    render();
    play(3_000);
    expect(container.querySelector('[data-testid="ghost-warning"]')).toBeNull();
    play(1_300);
    expect(container.querySelector('[data-testid="ghost-warning"]')).not.toBeNull();
  });
});

