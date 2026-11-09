import { describe, expect, it } from "vitest";

import {
  checkBookCollisions,
  countFirstTryWords,
  createEnchantedLibraryState,
  type EnchantedLibraryState,
} from "./enchantedLibrary";

const vocabulary = [
  { id: "1", term: "sun", translation: "พระอาทิตย์" },
  { id: "2", term: "moon", translation: "พระจันทร์" },
  { id: "3", term: "star", translation: "ดาว" },
  { id: "4", term: "sky", translation: "ท้องฟ้า" },
];

function pick(state: EnchantedLibraryState, correct: boolean) {
  const book = state.books.find((b) => b.isCorrect === correct);
  if (!book) throw new Error("no such book");
  return checkBookCollisions(
    { ...state, player: { ...state.player, x: book.x, y: book.y } },
    vocabulary,
  );
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
    expect(state.targetWord).toBe(target);
    expect(state.missedWords.has(target)).toBe(true);

    state = pick(state, true);
    expect(state.vocabularyProgress.get(target)).toBe(1);
    expect(countFirstTryWords(state)).toBe(0);
  });

  it("does not take back a word the student already found when it comes round again", () => {
    let state = createEnchantedLibraryState(vocabulary);
    const target = state.targetWord;
    state = pick(state, true);
    state = pick({ ...state, targetWord: target }, false);
    expect(state.missedWords.has(target)).toBe(false);
    expect(countFirstTryWords(state)).toBe(1);
  });

  it("scores nothing when nothing was answered", () => {
    expect(countFirstTryWords(createEnchantedLibraryState(vocabulary))).toBe(0);
  });
});
