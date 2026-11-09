import { describe, expect, it } from "vitest";

import {
  advanceCastleDefenseTime,
  createCastleDefenseState,
  getCastleWordProgress,
  type CastleDefenseState,
} from "./castleDefense";

const sentences = [
  { term: "one two three four", translation: "a" },
  { term: "five six seven eight", translation: "b" },
];
const IDLE = { dx: 0, dy: 0 };

const newRound = (wordBudget?: number) =>
  createCastleDefenseState(sentences, { difficulty: "medium", durationMs: 60_000, wordBudget });

/** One tick with the wizard standing on the word at this position in the sentence. */
function touchWord(state: CastleDefenseState, sentenceIndex: number) {
  const word = state.words.find((w) => w.sentenceIndex === sentenceIndex);
  if (!word) throw new Error(`no word ${sentenceIndex}`);
  return advanceCastleDefenseTime(
    { ...state, player: { ...state.player, x: word.x, y: word.y } },
    16,
    IDLE,
    sentences,
  );
}

describe("Castle Defense word score", () => {
  it("earns points for each word in order", () => {
    let state = touchWord(newRound(8), 0);
    expect(getCastleWordProgress(state)).toBe(1);
    expect(state.score).toBe(1);

    state = touchWord(state, 1);
    expect(getCastleWordProgress(state)).toBe(2);
    expect(state.score).toBe(3);
  });

  it("keeps earned words after a wrong touch and does not pay for them again", () => {
    let state = touchWord(touchWord(newRound(8), 0), 1);
    state = touchWord(state, 3);
    expect(state.collectedWordIndices).toEqual([]);
    expect(getCastleWordProgress(state)).toBe(2);

    state = touchWord(state, 0);
    expect(getCastleWordProgress(state)).toBe(2);
  });

  it("ends the round as a win at the word budget", () => {
    let state = touchWord(newRound(3), 0);
    state = touchWord(state, 1);
    expect(state.status).toBe("playing");
    state = touchWord(state, 2);
    expect(state.status).toBe("victory");
    expect(state.score).toBe(10);
  });

  it("carries words over when a tower moves the round to the next sentence", () => {
    let state = newRound(8);
    for (const index of [0, 1, 2, 3]) state = touchWord(state, index);
    expect(state.sentenceCompleted).toBe(true);

    const slot = state.towerSlots[0];
    state = advanceCastleDefenseTime(
      { ...state, player: { ...state.player, x: slot.x, y: slot.y } },
      16,
      IDLE,
      sentences,
    );
    expect(state.towers).toHaveLength(1);
    expect(state.usedSentenceTerms).toHaveLength(2);
    expect(state.collectedWordIndices).toEqual([]);
    expect(state.bankedWords).toBe(4);
    expect(state.sentenceHighMark).toBe(0);
    expect(state.score).toBe(5);
  });

  it("does not end a budget round on the number of sentences finished", () => {
    let state = createCastleDefenseState(sentences.slice(0, 1), {
      difficulty: "medium",
      durationMs: 60_000,
      maxSentences: 1,
      wordBudget: 8,
    });
    for (const index of [0, 1, 2, 3]) state = touchWord(state, index);
    expect(state.completedSentences).toBe(1);
    expect(state.status).toBe("playing");
    expect(state.score).toBe(5);
  });

  it("still scores whole sentences for the tutor demo, which sets no budget", () => {
    let state = newRound();
    for (const index of [0, 1, 2]) state = touchWord(state, index);
    expect(state.score).toBe(0);
    state = touchWord(state, 3);
    expect(state.score).toBe(1);
  });
});
