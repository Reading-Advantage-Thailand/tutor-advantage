import { describe, expect, it, vi } from "vitest";

vi.mock("../services/ReadingAdvantageDB", () => ({
  getArticleDetails: vi.fn(),
}));

import { redactArticleAnswers, sessionBelongsToBookCycle } from "./dashboardController";

describe("student article payloads", () => {
  it("removes answer keys from pre-class questions without mutating source data", () => {
    const source = {
      title: "A lesson",
      multipleChoiceQuestions: [
        { question: "Q", answer: "A", correctAnswer: "A", options: { a: "A" } },
      ],
      shortAnswerQuestions: [
        { question: "Explain", answer: "Because", correct_answer: "Because" },
      ],
    };

    const safe = redactArticleAnswers(source);
    expect(safe.multipleChoiceQuestions[0]).toEqual({ question: "Q", options: { a: "A" } });
    expect(safe.shortAnswerQuestions[0]).toEqual({ question: "Explain" });
    expect(source.multipleChoiceQuestions[0].answer).toBe("A");
  });
});

describe("legacy lesson progress", () => {
  const firstCycle = { classBookCycleId: "cycle-1", bookId: "book-1", sequence: 1 };
  const secondCycle = { classBookCycleId: "cycle-2", bookId: "book-2", sequence: 2 };

  it("maps sessions created before book-cycle fields existed to the first book", () => {
    expect(sessionBelongsToBookCycle({ classBookCycleId: null, bookId: null }, firstCycle)).toBe(true);
    expect(sessionBelongsToBookCycle({ classBookCycleId: null, bookId: null }, secondCycle)).toBe(false);
  });

  it("prefers explicit cycle and book identifiers when present", () => {
    expect(sessionBelongsToBookCycle({ classBookCycleId: "cycle-2", bookId: null }, secondCycle)).toBe(true);
    expect(sessionBelongsToBookCycle({ classBookCycleId: "cycle-2", bookId: null }, firstCycle)).toBe(false);
    expect(sessionBelongsToBookCycle({ classBookCycleId: null, bookId: "book-2" }, secondCycle)).toBe(true);
  });
});
