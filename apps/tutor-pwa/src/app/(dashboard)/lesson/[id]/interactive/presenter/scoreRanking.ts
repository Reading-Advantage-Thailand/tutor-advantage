/**
 * Class ranking by score, the same rule as the student app
 * (apps/student-liff/src/components/lesson/leaderboardModel.ts):
 * - highest score first (a missing or invalid score counts as 0); equal
 *   scores keep the server order (Array.prototype.sort is stable);
 * - competition ranking ("1224"): equal scores share a place and the next
 *   place skips, e.g. 14, 7, 7 → 1, 2, 2 and 7, 7, 5 → 1, 1, 3.
 */
export interface ScoreRanked<T> {
  item: T;
  /** The score used for ranking (0 when missing or invalid). */
  score: number;
  /** Shared competition place, 1-based. */
  rank: number;
}

export function normaliseScore(score: unknown): number {
  return typeof score === "number" && Number.isFinite(score) ? score : 0;
}

export function rankByScore<T extends { score?: number | null }>(items: readonly T[]): ScoreRanked<T>[] {
  const sorted = [...items].sort((a, b) => normaliseScore(b.score) - normaliseScore(a.score));
  let rank = 0;
  let previous: number | null = null;
  return sorted.map((item, index) => {
    const score = normaliseScore(item.score);
    if (previous === null || score !== previous) rank = index + 1;
    previous = score;
    return { item, score, rank };
  });
}
