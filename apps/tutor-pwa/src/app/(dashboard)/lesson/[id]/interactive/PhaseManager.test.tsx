// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// The presenter's heavy stages are not what these tests are about.
vi.mock("@/components/lesson/teachingGameRegistry", () => ({
  TeachingGameStage: () => null,
  isTeachingGameId: () => false,
  preloadTeachingGame: () => Promise.resolve(),
  LazyFlashcardTeachingGame: () => null,
}));
vi.mock("./ArticleDisplay", () => ({ ArticleDisplay: () => null }));
vi.mock("./presenter/useLessonAudio", () => ({
  useLessonAudio: () => ({ fallbackText: null, presentationArticleData: undefined }),
}));
vi.mock("@/lib/sounds", () => ({ playSound: vi.fn() }));
vi.mock("./presenter/confetti", () => ({ fireConfetti: vi.fn() }));

import { PhaseManager } from "./PhaseManager";
import type { GamePhaseState, Participant } from "@/lib/lesson-types";

const student = (studentId: string, name: string, extra: Partial<Participant> = {}): Participant => ({ studentId, name, score: 0, ...extra });

const result = (studentId: string, score = 3) => ({
  studentId,
  name: studentId,
  gameId: "dragon-flight",
  score,
  correct: score,
  total: 10,
  submittedAt: 1,
});

const game = (overrides: Partial<GamePhaseState>): GamePhaseState => ({
  phase: 10,
  category: "vocabulary",
  status: "playing",
  votes: {},
  selectedGameId: "dragon-flight",
  results: {},
  ...overrides,
});

describe("PhaseManager during a game", () => {
  let container: HTMLDivElement;
  let root: Root;
  const changePhase = vi.fn(() => Promise.resolve(true));
  const endGame = vi.fn();
  const onFinishSession = vi.fn();

  const renderPresenter = (gameState: GamePhaseState | null, participants: Participant[], currentPhase = 10) => {
    act(() => {
      root.render(
        <PhaseManager
          currentPhase={currentPhase}
          participants={participants}
          totalAnswered={Object.keys(gameState?.results || {}).length}
          allAnsweredData={[]}
          changePhase={changePhase}
          syncActiveSentence={vi.fn()}
          startGameVote={vi.fn()}
          lockGameVote={vi.fn()}
          startGameIntro={vi.fn()}
          advanceGameIntro={vi.fn()}
          endGame={endGame}
          onFinishSession={onFinishSession}
          sessionData={{ sessionId: "s1", currentPhase, gameState }}
        />,
      );
    });
    act(() => {
      vi.advanceTimersByTime(1100);
    });
  };

  const button = (name: RegExp) =>
    Array.from(container.querySelectorAll("button")).find((b) => name.test(b.textContent || "") || name.test(b.getAttribute("aria-label") || ""));
  const primary = () => container.querySelector<HTMLButtonElement>('[data-lesson-action="primary"]')!;
  const click = (element: Element | undefined) => {
    act(() => {
      element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    changePhase.mockClear();
    endGame.mockClear();
    onFinishSession.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not let a kicked student's result stand in for someone still playing", () => {
    // ก submitted and was kicked; ข submitted; ค is still playing.
    renderPresenter(
      game({ results: { kicked: result("kicked"), b: result("b") } }),
      [student("b", "น้องบี"), student("c", "น้องซี")],
    );

    expect(primary().disabled).toBe(true);
    expect(primary().textContent).toContain("รอ น้องซี");
    expect(container.textContent).toContain("1/2");
  });

  it("enables Next when the server says the game is over, even with no results", () => {
    renderPresenter(game({ status: "results" }), [student("a", "น้องเอ")]);

    // Ended before everyone handed in: phones still playing get a moment to send what they have.
    expect(primary().disabled).toBe(true);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(primary().disabled).toBe(false);
    expect(primary().textContent).toContain("ถัดไป");
  });

  it("enables Next after the usual second once everyone has handed in", () => {
    renderPresenter(game({ status: "results", results: { a: result("a") } }), [student("a", "น้องเอ")]);

    expect(primary().disabled).toBe(false);
  });

  it("does not enable Next from the answered count during a game", () => {
    // totalAnswered counts every result, including a kicked student's.
    renderPresenter(game({ results: { kicked: result("kicked"), other: result("other") } }), [student("a", "น้องเอ"), student("b", "น้องบี")]);

    expect(primary().disabled).toBe(true);
  });

  it("ends a game only on the second tap", () => {
    renderPresenter(game({}), [student("a", "น้องเอ")]);

    const end = button(/จบเกมเลย \(0\/1\)/);
    expect(end).toBeTruthy();
    click(end);
    expect(endGame).not.toHaveBeenCalled();

    const armed = button(/กดอีกครั้งเพื่อจบเกม/);
    expect(armed).toBeTruthy();
    click(armed);
    expect(endGame).toHaveBeenCalledTimes(1);
  });

  it("forgets a first tap on End game after a few seconds", () => {
    renderPresenter(game({}), [student("a", "น้องเอ")]);

    click(button(/จบเกมเลย/));
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(button(/กดอีกครั้งเพื่อจบเกม/)).toBeUndefined();
    expect(button(/จบเกมเลย/)).toBeTruthy();
  });

  it("names the student whose phone dropped, and says so on the roster", () => {
    renderPresenter(game({}), [student("a", "น้องเอ"), student("b", "น้องบี", { offlineSince: 1 })]);

    expect(primary().textContent).toContain("รอ น้องบี");
    expect(container.textContent).toContain("หลุดการเชื่อมต่อ");
  });

  it("asks before finishing a lesson that is not over", () => {
    renderPresenter(game({}), [student("a", "น้องเอ")]);

    click(button(/จบคาบเรียน/));
    expect(onFinishSession).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alertdialog"]')?.textContent).toContain("10/18");

    click(button(/สอนต่อ/));
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onFinishSession).not.toHaveBeenCalled();

    click(button(/จบคาบเรียน/));
    const dialog = container.querySelector('[role="alertdialog"]')!;
    click(Array.from(dialog.querySelectorAll("button")).find((b) => /จบคาบเรียน/.test(b.textContent || "")));
    expect(onFinishSession).toHaveBeenCalledTimes(1);
  });

  it("finishes straight away on the last phase", () => {
    renderPresenter(null, [student("a", "น้องเอ")], 18);

    click(button(/จบคาบเรียน/));
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onFinishSession).toHaveBeenCalledTimes(1);
  });

  it("asks before going back to the lobby", () => {
    renderPresenter(game({}), [student("a", "น้องเอ")]);

    click(button(/กลับสู่ Lobby/));
    expect(changePhase).not.toHaveBeenCalled();
    const dialog = container.querySelector('[role="alertdialog"]')!;
    expect(dialog.textContent).toContain("เริ่มนับใหม่");
    click(Array.from(dialog.querySelectorAll("button")).find((b) => /กลับสู่ Lobby/.test(b.textContent || "")));
    expect(changePhase).toHaveBeenCalledWith(0);
  });

  it("asks before Previous only while a game is running", () => {
    renderPresenter(game({}), [student("a", "น้องเอ")]);
    click(button(/ก่อนหน้า|ย้อนกลับ/));
    expect(changePhase).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();
    click(button(/สอนต่อ/));

    renderPresenter(game({ status: "results" }), [student("a", "น้องเอ")]);
    click(button(/ก่อนหน้า|ย้อนกลับ/));
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(changePhase).toHaveBeenCalledWith(9);
  });
});
