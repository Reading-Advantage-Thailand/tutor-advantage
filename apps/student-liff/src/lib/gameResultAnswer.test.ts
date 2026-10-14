import { describe, expect, it } from "vitest";
import {
  formatGameScore,
  getGameDisplayName,
  getGameRowView,
  isGameAnswer,
  isScoredAnswer,
  parseGameResultAnswer,
  titleCaseGameId,
} from "./gameResultAnswer";

describe("parseGameResultAnswer", () => {
  it("parses a stored game result", () => {
    expect(parseGameResultAnswer('{"gameId":"dragon-flight","score":120,"correct":4,"total":5,"durationMs":60000}')).toEqual({
      gameId: "dragon-flight",
      score: 120,
      correct: 4,
      total: 5,
      durationMs: 60000,
    });
  });

  it("accepts results without a game id and ignores bad field types", () => {
    expect(parseGameResultAnswer('{"score":"lots","total":3}')).toEqual({
      gameId: null,
      score: undefined,
      correct: undefined,
      total: 3,
      durationMs: undefined,
    });
  });

  it("returns null for plain answers, bad JSON and unrelated JSON", () => {
    expect(parseGameResultAnswer("B: By the window")).toBeNull();
    expect(parseGameResultAnswer('{"gameId":"dragon')).toBeNull();
    expect(parseGameResultAnswer("[1,2,3]")).toBeNull();
    expect(parseGameResultAnswer('{"foo":"bar"}')).toBeNull();
    expect(parseGameResultAnswer("null")).toBeNull();
    expect(parseGameResultAnswer("")).toBeNull();
    expect(parseGameResultAnswer(undefined)).toBeNull();
  });
});

describe("game row detection", () => {
  const game = '{"gameId":"dragon-flight","score":0}';

  it("flags unscored game result rows and API-tagged rows", () => {
    expect(isGameAnswer({ answerText: game, isCorrect: null })).toBe(true);
    expect(isGameAnswer({ answerText: game })).toBe(true);
    expect(isGameAnswer({ answerText: "anything", isCorrect: null, kind: "game" })).toBe(true);
  });

  it("leaves real answers alone", () => {
    expect(isGameAnswer({ answerText: game, isCorrect: true })).toBe(false);
    expect(isGameAnswer({ answerText: "I like cats", isCorrect: null })).toBe(false);
  });

  it("only counts rows with a true/false verdict", () => {
    expect(isScoredAnswer({ answerText: "A: cat", isCorrect: false })).toBe(true);
    expect(isScoredAnswer({ answerText: "A: cat", isCorrect: true, kind: "game" })).toBe(false);
    expect(isScoredAnswer({ answerText: game, isCorrect: null })).toBe(false);
    expect(isScoredAnswer({ answerText: "free text", isCorrect: null })).toBe(false);
  });
});

describe("game display", () => {
  it("uses the live-lesson game list, else title-cases the id", () => {
    expect(getGameDisplayName("dragon-flight")).toBe("Dragon Flight");
    expect(getGameDisplayName("alchemists-synthesis")).toBe("Alchemist's Synthesis");
    expect(getGameDisplayName("super_word-blast")).toBe("Super Word Blast");
    expect(getGameDisplayName(null)).toBe("เกมในห้องเรียน");
    expect(titleCaseGameId("rune-match")).toBe("Rune Match");
  });

  it("formats the score", () => {
    expect(formatGameScore(120)).toBe("ได้ 120 คะแนน");
    expect(formatGameScore(undefined)).toBe("ได้ 0 คะแนน");
  });

  it("prefers the row score and falls back to the question text for the game id", () => {
    expect(getGameRowView({ answerText: '{"gameId":"rune-match","score":999}', score: 120 })).toEqual({
      name: "Rune Match",
      scoreText: "ได้ 120 คะแนน",
    });
    expect(getGameRowView({ answerText: '{"score":40}', questionText: "potion-rush" })).toEqual({
      name: "Potion Rush",
      scoreText: "ได้ 40 คะแนน",
    });
  });
});
