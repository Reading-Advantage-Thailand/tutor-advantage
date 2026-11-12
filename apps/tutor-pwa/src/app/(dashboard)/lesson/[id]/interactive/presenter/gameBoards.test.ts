import { describe, expect, it, vi } from "vitest";

// The stage pulls in every teaching game; these tests only need its pure helpers.
vi.mock("@/components/lesson/teachingGameRegistry", () => ({
  TeachingGameStage: () => null,
  isTeachingGameId: () => false,
}));

import { gameRoundMs, rankGameResults, rankGameVotes } from "./GamePhaseStage";

describe("rankGameVotes", () => {
  it("names the server's winner when a tie would otherwise go to catalogue order", () => {
    const votes = { a: "rune-match", b: "dragon-flight" };

    const { leadingGame, isTie } = rankGameVotes("vocabulary", votes, [], "rune-match");

    expect(leadingGame?.id).toBe("rune-match");
    expect(isTie).toBe(true);
  });

  it("falls back to catalogue order without a server, as in rehearsal", () => {
    expect(rankGameVotes("vocabulary", { a: "rune-match", b: "dragon-flight" }, []).leadingGame?.id).toBe("dragon-flight");
  });

  it("is not a tie with a clear winner or with no votes", () => {
    expect(rankGameVotes("vocabulary", { a: "rune-match", b: "rune-match", c: "dragon-flight" }, [], "rune-match").isTie).toBe(false);
    const empty = rankGameVotes("vocabulary", {}, [], "dragon-flight");
    expect(empty.isTie).toBe(false);
    expect(empty.leadingGame?.id).toBe("dragon-flight");
    expect(empty.leadingGame?.count).toBe(0);
  });
});

describe("rankGameResults", () => {
  it("gives equal scores the same place", () => {
    const ranked = rankGameResults([{ score: 5 }, { score: 7 }, { score: 5 }, { score: 2 }]);
    expect(ranked.map((r) => [r.score, r.rank])).toEqual([[7, 1], [5, 2], [5, 2], [2, 4]]);
  });

  it("gives no place to a score of zero", () => {
    const ranked = rankGameResults([{ score: 0 }, { score: 0 }]);
    expect(ranked.map((r) => r.rank)).toEqual([null, null]);
  });
});

// The monitor counts down the round the phones play.
describe("gameRoundMs", () => {
  it("is one minute for every game but Dragon Flight", () => {
    expect(gameRoundMs("wizard-vs-zombie", 12)).toBe(60_000);
    expect(gameRoundMs("potion-rush", 3)).toBe(60_000);
    expect(gameRoundMs(undefined, 0)).toBe(60_000);
  });

  it("gives Dragon Flight five seconds a word, up to ten words", () => {
    expect(gameRoundMs("dragon-flight", 2)).toBe(10_000);
    expect(gameRoundMs("dragon-flight", 10)).toBe(50_000);
    expect(gameRoundMs("dragon-flight", 30)).toBe(50_000);
    expect(gameRoundMs("dragon-flight", 0)).toBe(5_000);
  });
});
