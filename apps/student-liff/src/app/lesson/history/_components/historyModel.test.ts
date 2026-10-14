import { describe, expect, it } from "vitest";
import { groupHistoryByDay, summarizeHistory, type HistoryItem } from "./historyModel";

const item = (sessionId: string, date: string, score: number, rank: number): HistoryItem => ({
  sessionId,
  date,
  score,
  rank,
  totalParticipants: 4,
  articleTitle: `Article ${sessionId}`,
  tutorName: "Tutor",
});

// Local-time timestamps so grouping does not depend on the test machine's zone.
const day = (y: number, m: number, d: number, h: number) => new Date(y, m - 1, d, h).toISOString();

describe("groupHistoryByDay", () => {
  it("groups sessions of the same local day and keeps the server order", () => {
    const items = [
      item("a", day(2026, 9, 29, 16), 10, 1),
      item("b", day(2026, 9, 29, 9), 20, 2),
      item("c", day(2026, 9, 22, 9), 30, 3),
    ];
    const groups = groupHistoryByDay(items);
    expect(groups.map((g) => g.dayKey)).toEqual(["2026-09-29", "2026-09-22"]);
    expect(groups[0].items.map((i) => i.sessionId)).toEqual(["a", "b"]);
    expect(groups[1].items.map((i) => i.sessionId)).toEqual(["c"]);
  });

  it("returns no groups for an empty list", () => {
    expect(groupHistoryByDay([])).toEqual([]);
  });
});

describe("summarizeHistory", () => {
  it("counts lessons, sums scores and finds the best rank", () => {
    expect(
      summarizeHistory([item("a", day(2026, 9, 29, 9), 85, 3), item("b", day(2026, 9, 28, 9), 15, 1), item("c", day(2026, 9, 27, 9), 0, 0)]),
    ).toEqual({ lessons: 3, totalScore: 100, bestRank: 1 });
  });

  it("has no best rank when no session was ranked", () => {
    expect(summarizeHistory([item("a", day(2026, 9, 29, 9), 5, 0)])).toEqual({ lessons: 1, totalScore: 5, bestRank: null });
    expect(summarizeHistory([])).toEqual({ lessons: 0, totalScore: 0, bestRank: null });
  });
});
