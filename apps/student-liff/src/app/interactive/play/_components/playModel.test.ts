import { describe, expect, it } from "vitest";
import { LESSON_PHASE } from "../../../../lib/lessonPhases";
import { getVotingDeck, isLookAtScreenPhase, MCQ_PHASES } from "./playModel";

describe("isLookAtScreenPhase", () => {
  it("matches the passive phases only (reading has its own flag UI)", () => {
    expect([1, 4, 5, 6].every(isLookAtScreenPhase)).toBe(true);
    expect(isLookAtScreenPhase(LESSON_PHASE.READ_ARTICLE)).toBe(false);
    expect(isLookAtScreenPhase(LESSON_PHASE.FLASHCARDS)).toBe(false);
    expect(isLookAtScreenPhase(0)).toBe(false);
  });
});

describe("MCQ_PHASES", () => {
  it("lists the four A/B/C/D phases", () => {
    expect(MCQ_PHASES).toEqual([7, 9, 11, 12]);
  });
});

describe("getVotingDeck", () => {
  it("offers only playable games and flags the coming-soon ones", () => {
    const vocab = getVotingDeck("vocabulary");
    expect(vocab.games.length).toBeGreaterThan(0);
    expect(vocab.games.every((game) => game.enabled !== false && game.category === "vocabulary")).toBe(true);
    expect(vocab.games.map((game) => game.id)).toContain("dragon-flight");
    expect(vocab.hasMore).toBe(true);
  });

  it("is empty without a category", () => {
    expect(getVotingDeck(null)).toEqual({ games: [], hasMore: false });
  });
});
