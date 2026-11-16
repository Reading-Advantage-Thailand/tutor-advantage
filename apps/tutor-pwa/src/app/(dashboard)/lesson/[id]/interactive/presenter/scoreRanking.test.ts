import { describe, expect, it } from "vitest";
import { normaliseScore, rankByScore } from "./scoreRanking";

const players = (...scores: Array<number | null | undefined>) =>
  scores.map((score, index) => ({ studentId: `s${index}`, score }));

const ranks = (...scores: Array<number | null | undefined>) =>
  rankByScore(players(...scores)).map(({ item, score, rank }) => [item.studentId, score, rank]);

describe("rankByScore (competition ranking, same as the student app)", () => {
  it("numbers distinct scores 1, 2, 3", () => {
    expect(ranks(5, 14, 7)).toEqual([
      ["s1", 14, 1],
      ["s2", 7, 2],
      ["s0", 5, 3],
    ]);
  });

  it("shares a place for a tie in the middle and skips nothing before it", () => {
    expect(ranks(14, 7, 7).map(([, , rank]) => rank)).toEqual([1, 2, 2]);
    expect(ranks(9, 7, 7, 3).map(([, , rank]) => rank)).toEqual([1, 2, 2, 4]);
  });

  it("shares first place for a tie at the top and skips the next place", () => {
    expect(ranks(7, 7, 5).map(([, , rank]) => rank)).toEqual([1, 1, 3]);
  });

  it("gives everyone place 1 when all scores are equal", () => {
    expect(ranks(4, 4, 4, 4).map(([, , rank]) => rank)).toEqual([1, 1, 1, 1]);
    expect(ranks(0, 0, 0).map(([, , rank]) => rank)).toEqual([1, 1, 1]);
  });

  it("keeps the server order inside a tie", () => {
    expect(ranks(3, 8, 3, 8).map(([id]) => id)).toEqual(["s1", "s3", "s0", "s2"]);
  });

  it("works with fewer than three players and with none", () => {
    expect(ranks(2, 6)).toEqual([
      ["s1", 6, 1],
      ["s0", 2, 2],
    ]);
    expect(ranks(5)).toEqual([["s0", 5, 1]]);
    expect(rankByScore([])).toEqual([]);
  });

  it("counts a missing or invalid score as 0", () => {
    expect(ranks(undefined, 3, null, Number.NaN)).toEqual([
      ["s1", 3, 1],
      ["s0", 0, 2],
      ["s2", 0, 2],
      ["s3", 0, 2],
    ]);
    expect(normaliseScore("7")).toBe(0);
    expect(normaliseScore(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("does not change the input order", () => {
    const input = players(1, 9);
    rankByScore(input);
    expect(input.map((p) => p.studentId)).toEqual(["s0", "s1"]);
  });
});
