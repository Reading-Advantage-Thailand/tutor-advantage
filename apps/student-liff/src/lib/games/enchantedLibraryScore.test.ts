import { describe, expect, it } from "vitest";

import {
  calculateEnchantedLibraryXP,
  checkBookCollisions,
  countFirstTryWords,
  createEnchantedLibraryState,
  finishAnswerHold,
  listReviewWords,
  type EnchantedLibraryState,
} from "./enchantedLibrary";

const vocabulary = [
  { id: "1", term: "sun", translation: "พระอาทิตย์" },
  { id: "2", term: "moon", translation: "พระจันทร์" },
  { id: "3", term: "star", translation: "ดาว" },
  { id: "4", term: "sky", translation: "ท้องฟ้า" },
];
const config = { vocabulary, masteryTarget: 1 };

function pick(state: EnchantedLibraryState, correct: boolean) {
  const book = state.books.find((b) => b.isCorrect === correct);
  if (!book) throw new Error("no such book");
  return checkBookCollisions({ ...state, player: { ...state.player, x: book.x, y: book.y } });
}

describe("Enchanted Library first-try score", () => {
  it("counts a word found on the first try", () => {
    const state = pick(createEnchantedLibraryState(vocabulary), true);
    expect(countFirstTryWords(state)).toBe(1);
  });

  it("does not count a word found after picking a wrong book", () => {
    let state = createEnchantedLibraryState(vocabulary);
    const target = state.targetWord;
    state = pick(state, false);
    expect(state.missedWords.has(target)).toBe(true);

    state = pick({ ...finishAnswerHold(state, config), targetWord: target }, true);
    expect(state.vocabularyProgress.get(target)).toBe(1);
    expect(countFirstTryWords(state)).toBe(0);
  });

  it("does not take back a word the student already found when it comes round again", () => {
    let state = createEnchantedLibraryState(vocabulary);
    const target = state.targetWord;
    state = finishAnswerHold(pick(state, true), { vocabulary, masteryTarget: 2 });
    state = pick({ ...state, targetWord: target }, false);
    expect(state.missedWords.has(target)).toBe(false);
    expect(countFirstTryWords(state)).toBe(1);
  });

  it("scores nothing when nothing was answered", () => {
    expect(countFirstTryWords(createEnchantedLibraryState(vocabulary))).toBe(0);
  });

  it("gives no display XP for doing nothing", () => {
    const idle = createEnchantedLibraryState(vocabulary);
    expect(calculateEnchantedLibraryXP(idle, 0, vocabulary.length)).toBe(0);
  });

  it("lists every word not known on the first try for the review", () => {
    let state = createEnchantedLibraryState(vocabulary);
    const missed = state.targetWord;
    state = finishAnswerHold(pick(state, false), config);
    const known = state.targetWord;
    state = pick(state, true);

    const review = listReviewWords(state, vocabulary).map((word) => word.term);
    expect(review).toContain(missed);
    expect(review).not.toContain(known);
    expect(review).toHaveLength(vocabulary.length - 1);
  });
});
