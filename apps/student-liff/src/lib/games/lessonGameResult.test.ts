import { describe, expect, it } from "vitest";

import { toLessonGameResult } from "./lessonGameResult";

describe("toLessonGameResult", () => {
  it("gives 1 point per correct answer, whatever the game's own score says", () => {
    expect(toLessonGameResult({ correctAnswers: 3, totalAttempts: 10, xp: 0 }, 1000)).toMatchObject({ score: 3, correct: 3, total: 10 });
    expect(toLessonGameResult({ correctAnswers: 4, totalAttempts: 10, score: 40 }, 1000).score).toBe(4);
    expect(toLessonGameResult({ correctAnswers: 0, totalAttempts: 10, xp: 1 }, 1000).score).toBe(0);
  });

  it("never gives more than 10 points", () => {
    expect(toLessonGameResult({ correctAnswers: 24, totalAttempts: 24 }, 1000).score).toBe(10);
  });

  it("keeps counts inside what the server accepts", () => {
    expect(toLessonGameResult({ correctAnswers: 4, totalAttempts: 240 }, 1000)).toMatchObject({ correct: 4, total: 100 });
    expect(toLessonGameResult({ correctAnswers: 120, totalAttempts: 240 }, 1000)).toMatchObject({ correct: 100, total: 100 });
    expect(toLessonGameResult({ correctAnswers: 7, totalAttempts: 5 }, 1000)).toMatchObject({ correct: 5, total: 5 });
  });

  it("records nothing correct when a game reports no count at all", () => {
    expect(toLessonGameResult({}, 1000)).toMatchObject({ score: 0, correct: 0, total: 1 });
  });

  it("falls back to accuracy and elapsed time", () => {
    expect(toLessonGameResult({ accuracy: 0.5, totalAttempts: 10 }, 1234)).toMatchObject({ correct: 5, durationMs: 1234 });
    expect(toLessonGameResult({ correctWords: 2, total: 4, durationMs: 60000.4 }, 1).durationMs).toBe(60000);
  });
});
