import { describe, expect, it } from "vitest";
import { getSessionAnswerKind, isGameResultAnswerText } from "./sessionAnswerKind";

describe("isGameResultAnswerText", () => {
  it("detects stored game result JSON", () => {
    expect(isGameResultAnswerText('{"gameId":"dragon-flight","score":0,"correct":0,"total":5}')).toBe(true);
    expect(isGameResultAnswerText('  {"score":120}  ')).toBe(true);
  });

  it("rejects plain answers, bad JSON and unrelated JSON", () => {
    expect(isGameResultAnswerText("ตัวเลือก B: By the window")).toBe(false);
    expect(isGameResultAnswerText('{"gameId":')).toBe(false);
    expect(isGameResultAnswerText("[1,2]")).toBe(false);
    expect(isGameResultAnswerText('{"foo":1}')).toBe(false);
    expect(isGameResultAnswerText(null)).toBe(false);
    expect(isGameResultAnswerText("")).toBe(false);
  });
});

describe("getSessionAnswerKind", () => {
  it("tags unscored game result rows as game", () => {
    expect(getSessionAnswerKind({ answerText: '{"gameId":"dragon-flight","score":0}', isCorrect: null })).toBe("game");
  });

  it("keeps scored rows and plain unscored answers as questions", () => {
    expect(getSessionAnswerKind({ answerText: '{"gameId":"dragon-flight"}', isCorrect: true })).toBe("question");
    expect(getSessionAnswerKind({ answerText: "I like dogs", isCorrect: null })).toBe("question");
    expect(getSessionAnswerKind({ answerText: "B: cat", isCorrect: false })).toBe("question");
  });
});
