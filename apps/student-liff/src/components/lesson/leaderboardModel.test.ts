import { describe, expect, it } from "vitest";
import { rankParticipants } from "./leaderboardModel";

const people = [
  { studentId: "a", score: 10 },
  { studentId: "me", score: 42 },
  { studentId: "b" },
  { studentId: "c", score: 42 },
];

describe("rankParticipants", () => {
  it("sorts by score (missing = 0), keeping the server order for ties", () => {
    const { entries } = rankParticipants(people, "me");
    expect(entries.map((entry) => entry.participant.studentId)).toEqual(["me", "c", "a", "b"]);
    expect(entries.map((entry) => entry.rank)).toEqual([1, 1, 3, 4]);
    expect(entries.map((entry) => entry.score)).toEqual([42, 42, 10, 0]);
    expect(entries.filter((entry) => entry.isMe)).toHaveLength(1);
  });

  it("reports the student's rank and score", () => {
    expect(rankParticipants(people, "a")).toMatchObject({ myRank: 3, myScore: 10 });
  });

  it("returns rank 0 when the student is not listed", () => {
    expect(rankParticipants(people, "zzz")).toMatchObject({ myRank: 0, myScore: 0 });
    expect(rankParticipants([], "me")).toMatchObject({ entries: [], myRank: 0, myScore: 0, total: 0, noScores: true, allTied: false });
  });

  it("uses competition ranking: equal scores share a rank, the next rank skips", () => {
    const list = [
      { studentId: "a", score: 5 },
      { studentId: "b", score: 9 },
      { studentId: "c", score: 5 },
      { studentId: "d", score: 5 },
      { studentId: "e", score: 1 },
    ];
    const { entries } = rankParticipants(list, "c");
    expect(entries.map((entry) => entry.participant.studentId)).toEqual(["b", "a", "c", "d", "e"]);
    expect(entries.map((entry) => entry.rank)).toEqual([1, 2, 2, 2, 5]);
    expect(entries.map((entry) => entry.tied)).toEqual([false, true, true, true, false]);
  });

  it("gives the student their shared rank", () => {
    const result = rankParticipants(people, "c");
    expect(result).toMatchObject({ myRank: 1, myScore: 42, myTied: true, myMedal: true });
  });

  it("awards medals only to podium players who scored", () => {
    const list = [
      { studentId: "a", score: 30 },
      { studentId: "b", score: 20 },
      { studentId: "c", score: 0 },
      { studentId: "d", score: 0 },
    ];
    const { entries } = rankParticipants(list, "c");
    expect(entries.map((entry) => entry.medal)).toEqual([true, true, false, false]);
    expect(rankParticipants(list, "c")).toMatchObject({ myRank: 3, myMedal: false, noScores: false, allTied: false });
  });

  it("gives nobody a medal when everyone has 0 points", () => {
    const list = [{ studentId: "a", score: 0 }, { studentId: "b" }, { studentId: "c", score: 0 }];
    const result = rankParticipants(list, "b");
    expect(result.entries.map((entry) => entry.rank)).toEqual([1, 1, 1]);
    expect(result.entries.some((entry) => entry.medal)).toBe(false);
    expect(result).toMatchObject({ myRank: 1, myMedal: false, noScores: true, allTied: true, total: 3 });
  });

  it("detects a class where everyone tied with a real score", () => {
    const list = [{ studentId: "a", score: 10 }, { studentId: "b", score: 10 }];
    const result = rankParticipants(list, "a");
    expect(result.entries.map((entry) => entry.rank)).toEqual([1, 1]);
    expect(result.entries.every((entry) => entry.medal)).toBe(true);
    expect(result).toMatchObject({ allTied: true, noScores: false, myTied: true });
  });

  it("does not treat a single player as all tied, and treats NaN as 0", () => {
    expect(rankParticipants([{ studentId: "a", score: 3 }], "a")).toMatchObject({ allTied: false, myMedal: true, myTied: false });
    const result = rankParticipants([{ studentId: "a", score: Number.NaN }, { studentId: "b", score: 1 }], "a");
    expect(result).toMatchObject({ myRank: 2, myScore: 0, myMedal: false });
  });

  it("does not mutate the input", () => {
    rankParticipants(people, "me");
    expect(people.map((p) => p.studentId)).toEqual(["a", "me", "b", "c"]);
  });
});
