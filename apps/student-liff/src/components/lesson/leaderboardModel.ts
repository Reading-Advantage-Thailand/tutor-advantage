// Live-lesson ranking shared by every live leaderboard (MCQ phases, "ถามคำถามภาษา",
// final results) and the wrap-up screen.
//
// Rules:
// - highest score first (missing / invalid score = 0); equal scores keep the
//   server order;
// - competition ranking ("1224"): equal scores share a rank and the next rank
//   skips, e.g. 42, 42, 10 → 1, 1, 3;
// - medals (top three) only go to players who actually scored (> 0) — if
//   everyone has 0, nobody gets a medal.

export interface RankedEntry<T> {
  participant: T;
  /** Shared competition rank (1-based). */
  rank: number;
  score: number;
  isMe: boolean;
  /** True when another player has the same score (and so the same rank). */
  tied: boolean;
  /** True when this row earns a podium medal (rank 1–3 with a score > 0). */
  medal: boolean;
}

export interface LessonRanking<T> {
  entries: RankedEntry<T>[];
  /** The current student's shared rank, or 0 when they are not in the list. */
  myRank: number;
  /** The current student's score (0 when not ranked). */
  myScore: number;
  /** Whether the current student's rank is shared with someone else. */
  myTied: boolean;
  /** Whether the current student earns a podium medal. */
  myMedal: boolean;
  /** Number of ranked players. */
  total: number;
  /** Nobody has scored yet (every score is 0, or the list is empty). */
  noScores: boolean;
  /** Two or more players and they all have the same score. */
  allTied: boolean;
}

export const MEDAL_RANKS = 3;

function normaliseScore(score: unknown): number {
  return typeof score === "number" && Number.isFinite(score) ? score : 0;
}

/** Medals only for the podium and only when the player actually scored. */
export function earnsMedal(rank: number, score: number): boolean {
  return rank >= 1 && rank <= MEDAL_RANKS && score > 0;
}

export function rankParticipants<T extends { studentId: string; score?: number }>(
  participants: T[],
  studentId: string,
): LessonRanking<T> {
  // Array.prototype.sort is stable, so ties keep the server order.
  const sorted = [...participants].sort((a, b) => normaliseScore(b.score) - normaliseScore(a.score));
  const scores = sorted.map((participant) => normaliseScore(participant.score));
  const counts = new Map<number, number>();
  for (const score of scores) counts.set(score, (counts.get(score) ?? 0) + 1);

  let rank = 0;
  const entries = sorted.map((participant, index) => {
    const score = scores[index];
    if (index === 0 || score !== scores[index - 1]) rank = index + 1;
    return {
      participant,
      rank,
      score,
      isMe: participant.studentId === studentId,
      tied: (counts.get(score) ?? 0) > 1,
      medal: earnsMedal(rank, score),
    };
  });

  const mine = entries.find((entry) => entry.isMe);
  return {
    entries,
    myRank: mine?.rank ?? 0,
    myScore: mine?.score ?? 0,
    myTied: mine?.tied ?? false,
    myMedal: mine?.medal ?? false,
    total: entries.length,
    noScores: entries.every((entry) => entry.score <= 0),
    allTied: entries.length > 1 && counts.size === 1,
  };
}
