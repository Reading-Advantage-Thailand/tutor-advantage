import { describe, expect, it, vi } from "vitest";

vi.mock("../services/ReadingAdvantageDB", () => ({
  getArticleDetails: vi.fn(),
}));

import { redactArticleAnswers } from "./dashboardController";

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
