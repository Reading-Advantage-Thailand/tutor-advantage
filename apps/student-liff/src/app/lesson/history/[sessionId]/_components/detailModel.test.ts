import { describe, expect, it } from "vitest";
import {
  getDetailGameRow,
  getDetailRowKind,
  getNeutralRowView,
  isNotFoundError,
  parseAnswerChoice,
  parseGameResultAnswer,
} from "./detailModel";

describe("parseAnswerChoice", () => {
  it("reads the Thai option prefix", () => {
    expect(parseAnswerChoice("ตัวเลือก B: By the window")).toEqual({ label: "B", text: "By the window" });
    expect(parseAnswerChoice("ตัวเลือก a: door")).toEqual({ label: "A", text: "door" });
  });

  it("reads a bare letter prefix", () => {
    expect(parseAnswerChoice("C : At the back")).toEqual({ label: "C", text: "At the back" });
  });

  it("keeps free-text answers as they are", () => {
    expect(parseAnswerChoice("She likes planes")).toEqual({ label: null, text: "She likes planes" });
    expect(parseAnswerChoice("E: not an option")).toEqual({ label: null, text: "E: not an option" });
  });

  it("labels empty answers", () => {
    expect(parseAnswerChoice("")).toEqual({ label: null, text: "ไม่ได้ระบุ" });
    expect(parseAnswerChoice(undefined).text).toBe("ไม่ได้ระบุ");
  });
});

describe("isNotFoundError", () => {
  it("treats 404 and 403 as not found", () => {
    expect(isNotFoundError({ status: 404 })).toBe(true);
    expect(isNotFoundError({ status: 403 })).toBe(true);
  });

  it("treats everything else as a retryable error", () => {
    expect(isNotFoundError({ status: 500 })).toBe(false);
    expect(isNotFoundError(new Error("Failed to fetch"))).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
  });
});

describe("getDetailGameRow", () => {
  it("turns a stored game result into a game row", () => {
    const row = { question: "dragon-flight", answer: '{"gameId":"dragon-flight","score":0}', isCorrect: null, score: 120 };
    expect(parseGameResultAnswer(row.answer)?.gameId).toBe("dragon-flight");
    expect(getDetailGameRow(row)).toEqual({ name: "Dragon Flight", scoreText: "ได้ 120 คะแนน" });
  });

  it("trusts the API kind tag", () => {
    expect(getDetailGameRow({ question: "castle-defense", answer: "{}", isCorrect: null, score: 3, kind: "game" })).toEqual({
      name: "Castle Defense",
      scoreText: "ได้ 3 คะแนน",
    });
  });

  it("ignores normal answers and bad JSON", () => {
    expect(getDetailGameRow({ question: "Q", answer: "ตัวเลือก B: door", isCorrect: false, score: 0 })).toBeNull();
    expect(getDetailGameRow({ question: "Q", answer: '{"gameId":', isCorrect: null, score: 0 })).toBeNull();
  });
});

describe("getDetailRowKind", () => {
  it("reads the sentinel first and the phase only when there is no question text", () => {
    expect(getDetailRowKind({ phase: 3, question: "Language question" })).toBe("languageQuestion");
    expect(getDetailRowKind({ phase: 15, question: "" })).toBe("languageQuestion");
    expect(getDetailRowKind({ phase: 16, question: "คำถามข้อที่ 16" })).toBe("reflection");
    expect(getDetailRowKind({ phase: 15, question: "What is a noun?" })).toBe("answer");
    expect(getDetailRowKind({ phase: 8, question: "Why?" })).toBe("answer");
  });

  it("keeps old phase-15 game rows (Aug 2026 numbering) as ordinary rows", () => {
    const old = { phase: 15, question: "potion-rush", answer: '{"gameId":"potion-rush","score":6}', isCorrect: true };
    expect(getDetailRowKind(old)).toBe("answer");
    expect(getNeutralRowView(old)).toBeNull();
    expect(getDetailRowKind({ phase: 15, question: "คำถามข้อที่ 15", answer: '{"gameId":"potion-rush","score":6}' })).toBe("answer");
  });

  it("falls back to the stored sentinel question for old rows", () => {
    expect(getDetailRowKind({ question: "Language question" })).toBe("languageQuestion");
    expect(getDetailRowKind({ phase: null, question: "Lesson reflection" })).toBe("reflection");
    expect(getDetailRowKind({ question: "language question" })).toBe("answer");
  });
});

describe("getNeutralRowView", () => {
  it("is null for ordinary question rows", () => {
    expect(getNeutralRowView({ phase: 7, question: "Q", answer: "A", isCorrect: true })).toBeNull();
  });

  it("gives the language question a Thai heading and neutral labels", () => {
    expect(getNeutralRowView({ phase: 15, question: "Language question", answer: "a กับ an ต่างกันยังไง", isCorrect: true })).toEqual({
      kind: "languageQuestion",
      title: "คำถามภาษาที่ถาม AI",
      answerLabel: "คำถามของคุณ",
      answerText: "a กับ an ต่างกันยังไง",
      answered: true,
      aiLabel: "คำตอบจาก AI",
    });
  });

  it("says no question was asked when the learner skipped", () => {
    const view = getNeutralRowView({ phase: 15, question: "Language question", answer: "  " });
    expect(view?.answerText).toBe("ไม่ได้ถามคำถาม");
    expect(view?.answered).toBe(false);
  });

  it("gives the reflection a Thai heading and no verdict wording", () => {
    const view = getNeutralRowView({ question: "Lesson reflection", answer: "ความเข้าใจ: 4 · ความพยายาม: 5", isCorrect: true });
    expect(view).toMatchObject({ kind: "reflection", title: "แบบสรุปการเรียนรู้", answerLabel: "คำตอบของคุณ", answered: true });
    expect(view?.answerText).toBe("ความเข้าใจ: 4 · ความพยายาม: 5");
  });
});
