import { describe, expect, it } from "vitest";
import {
  buildComprehensionQuestion,
  buildFillBlankQuestion,
  buildSentenceOrderQuestion,
  buildVocabularyQuestion,
  seededShuffle,
  summariseAiScores,
  summariseChoiceAnswers,
  type QuestionAudioLookup,
} from "./questionModels";

const audio: QuestionAudioLookup = {
  getManifestQuestion: () => undefined,
  getManifestQuestionByText: () => undefined,
  getSentenceAudioUrl: () => undefined,
  getWordAudioUrl: (text) => (text === "borrow" ? "https://audio/borrow.mp3" : undefined),
  normaliseOptionAudioUrls: (urls) => urls,
};

const article = {
  id: "a1",
  title: "T",
  content: { words: [], sentences: [], comprehensionQuestions: [] },
  words: [
    { vocabulary: "neighbour", definition: { th: "เพื่อนบ้าน" } },
    { vocabulary: "borrow", definition: { th: "ยืม" } },
    { vocabulary: "wooden", definition: { th: "ทำจากไม้" } },
    { vocabulary: "library", definition: { th: "ห้องสมุด" } },
  ],
  sentences: [{ sentences: "Mina lives on Maple Street." }, { sentences: "She builds a small wooden box." }],
  multipleChoiceQuestions: [
    { question: "Who borrows the first book?", options: { a: "An old man", b: "A teacher", c: "A girl", d: "A postman" }, answer: "An old man" },
  ],
} as any;

describe("seededShuffle", () => {
  it("is a deterministic permutation shared with the backend", () => {
    const input = ["A", "B", "C", "D"];
    const first = seededShuffle(input, "session-1_phase7_Q");
    expect(seededShuffle(input, "session-1_phase7_Q")).toEqual(first);
    expect([...first].sort()).toEqual(input);
    expect(input).toEqual(["A", "B", "C", "D"]);
    // Golden value: the student app and learning-service use the same algorithm.
    expect(seededShuffle(["w", "x", "y", "z"], "abc")).toEqual(["z", "w", "x", "y"]);
    expect(seededShuffle([1, 2, 3, 4, 5], "seed")).toEqual([3, 1, 2, 4, 5]);
  });

  it("returns a copy unchanged without a seed", () => {
    expect(seededShuffle([1, 2, 3], "")).toEqual([1, 2, 3]);
  });
});

describe("question builders", () => {
  const ctx = { articleData: article, sessionId: "s-1", phaseSelectedIndices: {}, audio };

  it("maps the comprehension answer to the shuffled label", () => {
    const model = buildComprehensionQuestion(ctx);
    expect(model.question).toBe("Who borrows the first book?");
    expect(Object.keys(model.options)).toEqual(["A", "B", "C", "D"]);
    expect(model.options[model.correct]).toBe("An old man");
  });

  it("builds vocabulary meaning options with the Thai translation as the key", () => {
    const model = buildVocabularyQuestion(ctx);
    expect(model.kind).toBe("choice");
    if (model.kind !== "choice") return;
    expect(model.options[model.correct]).toBe("เพื่อนบ้าน");
    expect(new Set(Object.values(model.options)).size).toBe(4);
    expect(model.audio.speakQuestion).toBe(false);
  });

  it("needs four words for the vocabulary phase", () => {
    const model = buildVocabularyQuestion({ ...ctx, articleData: { ...article, words: article.words.slice(0, 3) } });
    expect(model.kind).toBe("empty");
  });

  it("blanks the last word of the key sentence", () => {
    const model = buildFillBlankQuestion(ctx);
    if (model.kind !== "choice") throw new Error("expected choice");
    expect(model.question).toContain("Mina lives on Maple _____");
    expect(model.options[model.correct]).toBe("Street");
  });

  it("keeps the original sentence as the correct ordering", () => {
    const model = buildSentenceOrderQuestion(ctx);
    if (model.kind !== "choice") throw new Error("expected choice");
    expect(model.options[model.correct]).toBe("Mina lives on Maple Street.");
    expect(model.question).toContain(" / ");
  });
});

describe("summaries", () => {
  it("counts choice answers and accuracy", () => {
    const summary = summariseChoiceAnswers(["A", "B", "A", null], "A");
    expect(summary.correctCount).toBe(2);
    expect(summary.wrongCount).toBe(2);
    expect(summary.accuracy).toBe(50);
    expect(summary.counts.find((c) => c.key === "A")?.count).toBe(2);
  });

  it("buckets AI scores", () => {
    expect(summariseAiScores([4.5, 3, 1, 0])).toEqual({ excellent: 1, good: 1, improve: 2, average: 2.125 });
    expect(summariseAiScores([]).average).toBe(0);
  });
});
