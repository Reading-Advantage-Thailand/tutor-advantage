import { describe, expect, it } from "vitest";
import {
  countCorrect,
  getMcqOptions,
  getParagraphs,
  getReviewAnswers,
  getWordAudio,
  getWordText,
  getWordThai,
  isMcq,
  optionLetter,
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
