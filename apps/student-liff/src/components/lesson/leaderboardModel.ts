// Live-lesson ranking shared by the live leaderboard and the wrap-up screen.
// Same rules as before: highest score first (missing score = 0), ties keep the
// server order, rank = position + 1.

export interface RankedEntry<T> {
  participant: T;
  rank: number;
  score: number;
  isMe: boolean;
}

export interface LessonRanking<T> {
  entries: RankedEntry<T>[];
  /** The current student's rank, or 0 when they are not in the list. */
  myRank: number;
  /** The current student's score (0 when not ranked). */
  myScore: number;
}

export function rankParticipants<T extends { studentId: string; score?: number }>(
  participants: T[],
  studentId: string,
): LessonRanking<T> {
  const sorted = [...participants].sort((a, b) => (b.score || 0) - (a.score || 0));
  const entries = sorted.map((participant, index) => ({
    participant,
    rank: index + 1,
    score: participant.score || 0,
    isMe: participant.studentId === studentId,
  }));
  const mine = entries.find((entry) => entry.isMe);
  return { entries, myRank: mine?.rank ?? 0, myScore: mine?.score ?? 0 };
}
