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
    expect(entries.map((entry) => entry.rank)).toEqual([1, 2, 3, 4]);
    expect(entries.map((entry) => entry.score)).toEqual([42, 42, 10, 0]);
    expect(entries.filter((entry) => entry.isMe)).toHaveLength(1);
  });

  it("reports the student's rank and score", () => {
    expect(rankParticipants(people, "a")).toMatchObject({ myRank: 3, myScore: 10 });
  });

  it("returns rank 0 when the student is not listed", () => {
    expect(rankParticipants(people, "zzz")).toMatchObject({ myRank: 0, myScore: 0 });
    expect(rankParticipants([], "me")).toEqual({ entries: [], myRank: 0, myScore: 0 });
  });

  it("does not mutate the input", () => {
    rankParticipants(people, "me");
    expect(people.map((p) => p.studentId)).toEqual(["a", "me", "b", "c"]);
  });
});
