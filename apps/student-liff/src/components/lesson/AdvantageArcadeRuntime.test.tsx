// @vitest-environment jsdom
import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type GameProps = { vocabulary?: { term: string }[]; onComplete: (result: object) => void };

const games = vi.hoisted(() => ({ lastProps: null as unknown, mounted: 0 }));

vi.mock("./gameRegistry", () => {
  const FakeGame = (props: GameProps) => {
    games.lastProps = props;
    games.mounted++;
    return <div data-testid="fake-game" />;
  };
  const ArcadeGames = new Proxy({}, { get: () => FakeGame });
  return {
    ArcadeGames,
    GameErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    isGameLoaded: () => true,
    preloadGame: () => Promise.resolve(true),
    resolveGameId: (gameId: string) => gameId,
  };
});

const { AdvantageArcadeRuntime } = await import("./AdvantageArcadeRuntime");
const { createRoundClock } = await import("@/lib/games/roundClock");
const Runtime = AdvantageArcadeRuntime as ComponentType<Parameters<typeof AdvantageArcadeRuntime>[0]>;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const WORDS = {
  words: [
    { vocabulary: "sun", definition: { th: "พระอาทิตย์" } },
    { vocabulary: "moon", definition: { th: "พระจันทร์" } },
  ],
};

describe("AdvantageArcadeRuntime", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onComplete = vi.fn();

  const render = (articleData: object | null, gameId = "wizard-vs-zombie", category: "vocabulary" | "sentence" = "vocabulary") =>
    act(() => {
      root.render(
        <Runtime gameId={gameId} category={category} articleData={articleData} autoStart={false} onComplete={onComplete} />,
      );
    });

  const finishRound = (result: object) =>
    act(() => {
      (games.lastProps as GameProps).onComplete(result);
    });

  beforeEach(() => {
    onComplete.mockClear();
    games.mounted = 0;
    games.lastProps = null;
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("shows the round's result, then hands it over", () => {
    render(WORDS);
    finishRound({ correctAnswers: 7, totalAttempts: 10 });

    expect(container.textContent).toContain("จบเกมแล้ว");
    expect(container.textContent).toContain("ตอบถูก 7 จาก 10");
    expect(container.querySelector('[data-testid="arcade-round-end"]')?.textContent).toContain("7คะแนน");
    expect(onComplete).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(3_000));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatchObject({ score: 7, correct: 7, total: 10 });
  });

  it("hands the result over at once when the student leaves during the pause", () => {
    render(WORDS);
    finishRound({ correctAnswers: 3, totalAttempts: 10 });
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    visibility.mockRestore();
    expect(onComplete).toHaveBeenCalledTimes(1);

    act(() => void vi.advanceTimersByTime(10_000));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("hands the result over at once when the round ends with the page already in the background", () => {
    render(WORDS);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    finishRound({ correctAnswers: 3, totalAttempts: 10 });
    visibility.mockRestore();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatchObject({ score: 3, correct: 3, total: 10 });
  });

  it("hands the result over when the screen goes away during the pause", () => {
    render(WORDS);
    finishRound({ correctAnswers: 3, totalAttempts: 10 });
    act(() => root.unmount());
    expect(onComplete).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });

  it("lets a game play its own finish before the end screen, on a real timer", () => {
    render(WORDS);
    finishRound({ correctAnswers: 3, totalAttempts: 10, outroMs: 3_000 });
    expect(container.querySelector('[data-testid="fake-game"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="arcade-round-end"]')).toBeNull();

    act(() => void vi.advanceTimersByTime(3_000));
    expect(container.querySelector('[data-testid="fake-game"]')).toBeNull();
    expect(container.querySelector('[data-testid="arcade-round-end"]')).not.toBeNull();
    expect(onComplete).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(3_000));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatchObject({ score: 3, correct: 3, total: 10 });
  });

  it("keeps the score safe during a game's finish when the student leaves", () => {
    render(WORDS);
    finishRound({ correctAnswers: 3, totalAttempts: 10, outroMs: 3_000 });
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    visibility.mockRestore();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("keeps the score safe during a game's finish when the screen goes away", () => {
    render(WORDS);
    finishRound({ correctAnswers: 3, totalAttempts: 10, outroMs: 3_000 });
    act(() => root.unmount());
    expect(onComplete).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });

  it("does not let a game hold the class up with a long finish", () => {
    render(WORDS);
    finishRound({ correctAnswers: 3, totalAttempts: 10, outroMs: 60_000 });
    act(() => void vi.advanceTimersByTime(7_000));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("counts only the first finish", () => {
    render(WORDS);
    finishRound({ correctAnswers: 3, totalAttempts: 10 });
    finishRound({ correctAnswers: 9, totalAttempts: 10 });
    act(() => void vi.advanceTimersByTime(3_000));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0].correct).toBe(3);
  });

  it("says so and hands back 0 for a lesson with no words, without starting a game", () => {
    render({ words: [] });
    expect(games.mounted).toBe(0);
    expect(container.textContent).toContain("ยังไม่มีคำศัพท์");
    act(() => void vi.advanceTimersByTime(6_000));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toEqual({ score: 0, correct: 0, total: 0, durationMs: 0 });
  });

  it("does the same for one word, or words that all mean the same", () => {
    render({ words: [{ vocabulary: "idiom", translation: "สำนวน" }, { vocabulary: "expression", translation: "สำนวน" }] });
    expect(games.mounted).toBe(0);
    expect(container.textContent).toContain("ยังไม่มีคำศัพท์");
  });

  it("does the same for a sentence game with no sentences", () => {
    render(null, "castle-defense", "sentence");
    expect(games.mounted).toBe(0);
    expect(container.textContent).toContain("ยังไม่มีประโยค");
  });

  describe("when the tutor ends the round for the class", () => {
    const renderClosing = (roundClosed: boolean, onRoundUnplayed = vi.fn()) =>
      act(() => {
        root.render(
          <Runtime
            gameId="wizard-vs-zombie"
            category="vocabulary"
            articleData={WORDS}
            autoStart={false}
            roundClosed={roundClosed}
            onRoundUnplayed={onRoundUnplayed}
            onComplete={onComplete}
          />,
        );
      });

    it("ends a running round and hands in the points so far at once", () => {
      renderClosing(false);
      // The game ends its round the usual way when its clock runs out.
      const clock = createRoundClock({
        durationMs: 60_000,
        onExpire: () => (games.lastProps as GameProps).onComplete({ correctAnswers: 4, totalAttempts: 6 }),
      });
      clock.start();

      renderClosing(true);
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete.mock.calls[0][0]).toMatchObject({ score: 4, correct: 4, total: 6 });

      act(() => void vi.advanceTimersByTime(10_000));
      expect(onComplete).toHaveBeenCalledTimes(1);
      clock.stop();
    });

    it("hands in a result already on the end screen without waiting out the pause", () => {
      renderClosing(false);
      finishRound({ correctAnswers: 5, totalAttempts: 10 });
      expect(onComplete).not.toHaveBeenCalled();

      renderClosing(true);
      expect(onComplete).toHaveBeenCalledTimes(1);
      act(() => void vi.advanceTimersByTime(10_000));
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("says there is nothing to hand in when this phone's round never started", () => {
      const onRoundUnplayed = vi.fn();
      renderClosing(false, onRoundUnplayed);
      renderClosing(true, onRoundUnplayed);
      expect(onRoundUnplayed).not.toHaveBeenCalled();
      act(() => void vi.advanceTimersByTime(2_000));
      expect(onRoundUnplayed).toHaveBeenCalledTimes(1);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it("waits for a game already in its own end pause, then hands its result in at once", () => {
      const onRoundUnplayed = vi.fn();
      renderClosing(false, onRoundUnplayed);
      // Like Rune Match: the clock is stopped and the result follows 1.2 s later.
      renderClosing(true, onRoundUnplayed);
      act(() => void vi.advanceTimersByTime(1_200));
      finishRound({ correctAnswers: 7, totalAttempts: 10 });
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete.mock.calls[0][0]).toMatchObject({ score: 7, correct: 7, total: 10 });

      act(() => void vi.advanceTimersByTime(10_000));
      expect(onRoundUnplayed).not.toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("never reports more play time than the game was on screen", () => {
      renderClosing(false);
      act(() => void vi.advanceTimersByTime(20_000));
      vi.setSystemTime(Date.now());
      finishRound({ correctAnswers: 2, totalAttempts: 10, durationMs: 60_000 });
      act(() => void vi.advanceTimersByTime(3_000));
      expect(onComplete.mock.calls[0][0].durationMs).toBeLessThanOrEqual(20_000);
    });
  });

  it("plays thin lessons with their own words only", () => {
    render(WORDS);
    expect(games.mounted).toBeGreaterThan(0);
    expect((games.lastProps as GameProps).vocabulary?.map((word) => word.term)).toEqual(["sun", "moon"]);
  });
});
