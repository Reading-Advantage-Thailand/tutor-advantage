// Live-lesson game results are stored as a SessionAnswer (see
// websockets/lessonHandler.ts `submit_game_result`): `answerText` holds
// JSON.stringify(result), `isCorrect` is null and `questionText` is the game
// id. The storage format stays as is; API responses tag those rows with
// `kind: "game"` so clients render them as a game row and leave them out of
// correct/total counts.

export type SessionAnswerKind = "game" | "question";

const GAME_RESULT_KEYS = ["gameId", "score", "correct", "total", "durationMs"];

/** True when `answerText` is a stored game result object (tolerates bad JSON). */
export function isGameResultAnswerText(answerText: string | null | undefined): boolean {
  const text = answerText?.trim();
  if (!text || !text.startsWith("{")) return false;
  try {
    const parsed: unknown = JSON.parse(text);
    return (
      !!parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      GAME_RESULT_KEYS.some((key) => key in (parsed as Record<string, unknown>))
    );
  } catch {
    return false;
  }
}

export function getSessionAnswerKind(answer: {
  answerText?: string | null;
  isCorrect?: boolean | null;
}): SessionAnswerKind {
  return answer.isCorrect == null && isGameResultAnswerText(answer.answerText) ? "game" : "question";
}
