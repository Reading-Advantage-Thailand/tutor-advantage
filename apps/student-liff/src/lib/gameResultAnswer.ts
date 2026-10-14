// Pure helpers for live-lesson game results stored as a SessionAnswer.
// learning-service `submit_game_result` persists them with
// `answerText: JSON.stringify(result)` (e.g. {"gameId":"dragon-flight","score":120}),
// `isCorrect: null` and `questionText` = the game id. They are not questions:
// show them as a game row and leave them out of correct/total counts.
// Relative imports only: vitest maps "@" to another app.
import { t } from "./i18n";
import { getGameById } from "./liveLessonGames";

export interface GameResultAnswer {
  gameId: string | null;
  score?: number;
  correct?: number;
  total?: number;
  durationMs?: number;
}

const RESULT_KEYS = ["gameId", "score", "correct", "total", "durationMs"] as const;

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Parses a stored game result (`{"gameId":…,"score":…}`). Returns null for
 * anything else: plain answers, bad JSON, arrays or objects without a game
 * result field.
 */
export function parseGameResultAnswer(answerText: string | null | undefined): GameResultAnswer | null {
  const text = answerText?.trim();
  if (!text || !text.startsWith("{")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (!RESULT_KEYS.some((key) => key in record)) return null;
  const gameId = typeof record.gameId === "string" && record.gameId.trim() ? record.gameId.trim() : null;
  return {
    gameId,
    score: finiteNumber(record.score),
    correct: finiteNumber(record.correct),
    total: finiteNumber(record.total),
    durationMs: finiteNumber(record.durationMs),
  };
}

export interface AnswerLike {
  answerText?: string | null;
  isCorrect?: boolean | null;
  /** Set by newer learning-service responses. */
  kind?: string | null;
}

/** A game result row: flagged by the API, or an unscored row holding a game result. */
export function isGameAnswer(answer: AnswerLike): boolean {
  if (answer.kind === "game") return true;
  return answer.isCorrect == null && parseGameResultAnswer(answer.answerText) !== null;
}

/** Only rows with a real true/false verdict count towards "ตอบถูก x/y". */
export function isScoredAnswer(answer: AnswerLike): boolean {
  return typeof answer.isCorrect === "boolean" && !isGameAnswer(answer);
}

/** "dragon-flight" → "Dragon Flight" (fallback when the id is not in the game list). */
export function titleCaseGameId(gameId: string): string {
  return gameId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Display name from the live-lesson game list, else the title-cased id, else a generic label. */
export function getGameDisplayName(gameId: string | null | undefined): string {
  const id = gameId?.trim();
  if (!id) return t("gameResult.fallbackName");
  return getGameById(id)?.title ?? (titleCaseGameId(id) || t("gameResult.fallbackName"));
}

/** "ได้ 120 คะแนน" */
export function formatGameScore(score: number | null | undefined): string {
  const value = typeof score === "number" && Number.isFinite(score) ? score : 0;
  return `${t("gameResult.scorePrefix")} ${value} ${t("gameResult.pointsUnit")}`;
}

export interface GameRowView {
  name: string;
  scoreText: string;
}

/**
 * View data for a game row. The row score (bounded by the server) wins over
 * the client-reported score in the JSON; the game id falls back to the
 * question text, which the server sets to the selected game id.
 */
export function getGameRowView(answer: {
  answerText?: string | null;
  questionText?: string | null;
  score?: number | null;
}): GameRowView {
  const result = parseGameResultAnswer(answer.answerText);
  const gameId = result?.gameId ?? answer.questionText ?? null;
  const score = typeof answer.score === "number" ? answer.score : result?.score;
  return { name: getGameDisplayName(gameId), scoreText: formatGameScore(score) };
}
