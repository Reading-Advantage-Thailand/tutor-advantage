// Pure helpers for the lesson result detail page.
// Relative imports only: vitest maps "@" to another app.
import { getGameRowView, isGameAnswer, parseGameResultAnswer, type GameRowView } from "../../../../../lib/gameResultAnswer";
import { t } from "../../../../../lib/i18n";

export { parseGameResultAnswer };

export interface DetailAnswerLike {
  question?: string | null;
  answer?: string | null;
  isCorrect?: boolean | null;
  score?: number | null;
  /** "game" for live-lesson game results (newer API responses). */
  kind?: string | null;
}

/** Game name + "ได้ N คะแนน" when the row is a live-lesson game result, else null. */
export function getDetailGameRow(a: DetailAnswerLike): GameRowView | null {
  if (!isGameAnswer({ answerText: a.answer, isCorrect: a.isCorrect, kind: a.kind })) return null;
  return getGameRowView({ answerText: a.answer, questionText: a.question, score: a.score });
}

export interface AnswerChoice {
  /** "A"–"D" when the answer was a multiple-choice option, else null. */
  label: string | null;
  /** Answer text without the "ตัวเลือก B:" / "B:" prefix. */
  text: string;
}

/**
 * Splits a stored answer such as "ตัวเลือก B: By the window" or "B: …" into
 * its option letter and text (same patterns as before). Empty answers become
 * "ไม่ได้ระบุ".
 */
export function parseAnswerChoice(answer: string | null | undefined): AnswerChoice {
  const rawAnswer = answer || t("lessonHistory.unspecified");
  const match =
    rawAnswer.match(new RegExp(`^${t("lessonHistory.optionPrefix")}\\s+([A-Z]):\\s*(.+)$`, "i")) ||
    rawAnswer.match(/^([A-D])\s*:\s*(.+)$/i);
  return match ? { label: match[1].toUpperCase(), text: match[2] } : { label: null, text: rawAnswer };
}

/** 404/403 from the API means the result is gone or not ours (show "not found", not "retry"). */
export function isNotFoundError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return status === 404 || status === 403;
}
