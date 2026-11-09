import { describe, expect, it } from "vitest";

import { countSentenceWords, pickShortSentences, roundWordBudget, wordProgressPoints } from "./sentenceRound";

const sentence = (words: number) => ({ term: Array.from({ length: words }, (_, i) => `w${i}`).join(" ") });

describe("wordProgressPoints", () => {
  it("scales words to points out of 10", () => {
    expect(wordProgressPoints(0, 30)).toBe(0);
    expect(wordProgressPoints(15, 30)).toBe(5);
    expect(wordProgressPoints(30, 30)).toBe(10);
  });

  it("stays at 10 past the budget and at 0 without one", () => {
    expect(wordProgressPoints(45, 30)).toBe(10);
    expect(wordProgressPoints(5, 0)).toBe(0);
  });
});

describe("roundWordBudget", () => {
  it("caps the budget by the words the round holds", () => {
    expect(roundWordBudget([sentence(5), sentence(4)], 30, countSentenceWords)).toBe(9);
    expect(roundWordBudget([sentence(20), sentence(20)], 30, countSentenceWords)).toBe(30);
  });

  it("counts words the way the game splits them", () => {
    const withDash = { term: "Cats - and dogs" };
    expect(roundWordBudget([withDash], 30, countSentenceWords)).toBe(4);
    expect(roundWordBudget([withDash], 30, (term) => term.split(" ").filter((w) => /\w/.test(w)).length)).toBe(3);
  });
});

describe("pickShortSentences", () => {
  it("keeps only sentences within the limit", () => {
    const items = [sentence(4), sentence(20), sentence(8), sentence(6)];
    expect(pickShortSentences(items, 8)).toEqual([items[0], items[2], items[3]]);
  });

  it("falls back to the shortest sentences when too few are short", () => {
    const items = [sentence(30), sentence(15), sentence(20), sentence(25)];
    expect(pickShortSentences(items, 8).map((s) => s.term.split(" ").length)).toEqual([15, 20, 25]);
  });

  it("returns everything when an article has very few sentences", () => {
    const items = [sentence(2)];
    expect(pickShortSentences(items, 8)).toEqual(items);
  });
});
