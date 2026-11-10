/** Why the round ended and the words to read again. Shown to the student; never sent to the server. */
export type RoundReview = {
  heading: string;
  missed: { term: string; meaning: string }[];
};

/** What a game hands to the lesson runtime. Games report counts; the rule below sets the points. */
export type ArcadeResult = {
  score?: number;
  xp?: number;
  accuracy?: number;
  correctAnswers?: number;
  totalAttempts?: number;
  correctWords?: number;
  total?: number;
  durationMs?: number;
  review?: RoundReview;
  /** Keep the game on screen this long for its own finish. The result is already safe meanwhile. */
  outroMs?: number;
};

export type LessonGameResult = {
  score: number;
  correct: number;
  total: number;
  durationMs: number;
  review?: RoundReview;
};

const MAX_GAME_POINTS = 10;
// LessonSessionService bounds correct and total to this.
const MAX_RESULT_COUNT = 100;

/**
 * One rule for every game: 1 correct answer = 1 point, at most 10. A game's own
 * score or xp is a display value and never reaches the lesson leaderboard.
 */
export function toLessonGameResult(result: ArcadeResult, elapsedMs: number): LessonGameResult {
  const total = Math.min(Math.max(result.totalAttempts ?? result.total ?? 1, 1), MAX_RESULT_COUNT);
  const accuracyCount = typeof result.accuracy === "number" ? result.accuracy * total : 0;
  const reported = result.correctAnswers ?? result.correctWords ?? accuracyCount;
  const correct = Math.min(Math.max(Math.round(reported), 0), total);

  return {
    score: Math.min(correct, MAX_GAME_POINTS),
    correct,
    total: Math.round(total),
    durationMs: Math.max(0, Math.round(result.durationMs ?? elapsedMs)),
    ...(result.review ? { review: result.review } : {}),
  };
}
