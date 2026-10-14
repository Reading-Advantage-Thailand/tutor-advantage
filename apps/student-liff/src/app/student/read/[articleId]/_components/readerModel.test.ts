import { describe, expect, it } from "vitest";
import {
  countCorrect,
  getMcqOptions,
  getParagraphs,
  getReviewAnswers,
  getReviewGameRow,
  getWordAudio,
  getWordText,
  getWordThai,
  isMcq,
  optionLetter,
  parseGameResultAnswer,
} from "./readerModel";

describe("word helpers", () => {
  it("reads the word from any of its fields", () => {
    expect(getWordText({ vocabulary: "airport" })).toBe("airport");
    expect(getWordText({ word: "plane" })).toBe("plane");
    expect(getWordText({ text: "city" })).toBe("city");
    expect(getWordText({})).toBe("");
  });

  it("prefers the Thai definition, then the translation", () => {
    expect(getWordThai({ definition: { th: "สนามบิน" }, translation: "x" })).toBe("สนามบิน");
    expect(getWordThai({ translation: "เมือง" })).toBe("เมือง");
    expect(getWordThai({})).toBe("");
  });

  it("finds an audio URL in either spelling", () => {
    expect(getWordAudio({ audioUrl: "https://a" })).toBe("https://a");
    expect(getWordAudio({ audio_url: "https://b" })).toBe("https://b");
    expect(getWordAudio({})).toBeUndefined();
  });
});

describe("questions", () => {
  it("reads options from the map or the numbered fields", () => {
    expect(getMcqOptions({ id: "1", question: "q", answer: "b", options: { a: "A1", b: "B1" } })).toEqual(["A1", "B1"]);
    expect(getMcqOptions({ id: "1", question: "q", answer: "b", option1: "x", option3: "z" })).toEqual(["x", "z"]);
  });

  it("tells MCQs from short-answer questions", () => {
    expect(isMcq({ id: "1", question: "q", answer: "a", options: {} })).toBe(true);
    expect(isMcq({ id: "1", question: "q", answer: "a", option1: "x" })).toBe(true);
    expect(isMcq({ id: "2", question: "q", answer: "a" })).toBe(false);
  });

  it("letters options from A", () => {
    expect([0, 1, 2, 3].map(optionLetter)).toEqual(["A", "B", "C", "D"]);
  });
});

describe("getParagraphs", () => {
  it("splits the passage on blank lines and drops empties", () => {
    expect(getParagraphs({ passage: "One.\n\nTwo.\n\n\n\nThree." })).toEqual(["One.", "Two.", "Three."]);
  });

  it("falls back to the summary", () => {
    expect(getParagraphs({ summary: "Short summary" })).toEqual(["Short summary"]);
    expect(getParagraphs({})).toEqual([]);
  });
});

describe("review answers", () => {
  const answers = [
    { phase: 7, questionText: "Q1", isCorrect: true, score: 10 },
    { phase: 8, questionText: "", isCorrect: false, score: 0 },
    { phase: 9, questionText: "Q3", isCorrect: false, score: 2 },
  ];

  it("keeps only answers with a question", () => {
    expect(getReviewAnswers(answers).map((a) => a.phase)).toEqual([7, 9]);
    expect(getReviewAnswers(null)).toEqual([]);
  });

  it("counts correct answers over all answers", () => {
    expect(countCorrect(answers)).toEqual({ correct: 1, total: 3 });
    expect(countCorrect(undefined)).toEqual({ correct: 0, total: 0 });
  });
});

describe("game result rows", () => {
  const gameRow = {
    phase: 6,
    questionText: "dragon-flight",
    answerText: '{"gameId":"dragon-flight","score":0,"correct":0,"total":5}',
    isCorrect: null,
    score: 120,
  };

  it("re-exports the tolerant parser", () => {
    expect(parseGameResultAnswer(gameRow.answerText)?.gameId).toBe("dragon-flight");
    expect(parseGameResultAnswer("{oops")).toBeNull();
  });

  it("shows game rows by name and score instead of raw JSON", () => {
    expect(getReviewGameRow(gameRow)).toEqual({ name: "Dragon Flight", scoreText: "ได้ 120 คะแนน" });
    expect(getReviewGameRow({ phase: 7, questionText: "Q", answerText: "B: cat", isCorrect: true, score: 10 })).toBeNull();
  });

  it("leaves game and unscored rows out of the correct count", () => {
    const answers = [
      gameRow,
      { phase: 7, questionText: "Q1", answerText: "A: dog", isCorrect: true, score: 10 },
      { phase: 8, questionText: "Q2", answerText: "B: cat", isCorrect: false, score: 0 },
      { phase: 9, questionText: "Q3", answerText: "free text", isCorrect: null, score: 0 },
      { phase: 10, questionText: "Q4", answerText: "x", isCorrect: true, score: 5, kind: "game" },
    ];
    expect(countCorrect(answers)).toEqual({ correct: 1, total: 2 });
    // Still listed in the review (with a question), just not counted.
    expect(getReviewAnswers(answers)).toHaveLength(5);
  });
});
