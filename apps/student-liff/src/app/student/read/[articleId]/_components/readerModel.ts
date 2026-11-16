// Pure helpers for the article reader (/student/read/[articleId]).
// Relative imports only: vitest maps "@" to another app.
import { getGameRowView, isGameAnswer, isScoredAnswer, parseGameResultAnswer, type GameRowView } from "../../../../../lib/gameResultAnswer";
import { getNeutralRowView, type NeutralRowView } from "../../../../../lib/lessonAnswerRows";

export { parseGameResultAnswer };

export interface ArticleWord {
  vocabulary?: string;
  word?: string;
  text?: string;
  definition?: { th?: string };
  translation?: string;
  audioUrl?: string;
  audio_url?: string;
}

export interface MCQ {
  id: string;
  question: string;
  option1?: string;
  option2?: string;
  option3?: string;
  option4?: string;
  options?: Record<string, string>;
  answer: string;
}

export interface SAQ {
  id: string;
  question: string;
  answer: string;
}

export interface SessionAnswer {
  phase: number;
  questionText?: string;
  answerText?: string;
  correctAnswer?: string;
  isCorrect?: boolean | null;
  score: number;
  aiFeedback?: string;
  /** "game" for live-lesson game results (newer API responses). */
  kind?: string;
}

export function getWordText(w: ArticleWord): string {
  return w.vocabulary ?? w.word ?? w.text ?? "";
}

export function getWordThai(w: ArticleWord): string {
  return w.definition?.th ?? w.translation ?? "";
}

export function getWordAudio(w: ArticleWord): string | undefined {
  return w.audioUrl ?? w.audio_url;
}

export function getMcqOptions(q: MCQ): string[] {
  if (q.options) return Object.values(q.options);
  return [q.option1, q.option2, q.option3, q.option4].filter(Boolean) as string[];
}

/** MCQ when it carries options (same check as before), otherwise a short-answer question. */
export function isMcq(q: MCQ | SAQ): q is MCQ {
  return "option1" in q || "options" in q;
}

/** Article body as paragraphs (passage, else summary), split on blank lines. */
export function getParagraphs(article: { passage?: string; summary?: string }): string[] {
  return (article.passage ?? article.summary ?? "").split("\n\n").filter(Boolean);
}

/** Only answers with a question are shown in review mode. */
export function getReviewAnswers(answers: SessionAnswer[] | null | undefined): SessionAnswer[] {
  return (answers ?? []).filter((a) => a.questionText);
}

/**
 * "ตอบถูก x/y ข้อ" counts for the review banner. Game results and other
 * unscored rows (isCorrect null) are not questions, so they are left out; so are the step-15 question to AI and the step-16 reflection, which have no right or wrong answer.
 */
export function countCorrect(answers: SessionAnswer[] | null | undefined): { correct: number; total: number } {
  const scored = (answers ?? []).filter((a) => isScoredAnswer(a) && getReviewNeutralRow(a) === null);
  return { correct: scored.filter((a) => a.isCorrect === true).length, total: scored.length };
}

/** Game name + "ได้ N คะแนน" when the row is a live-lesson game result, else null. */
export function getReviewGameRow(answer: SessionAnswer): GameRowView | null {
  return isGameAnswer(answer) ? getGameRowView(answer) : null;
}

/**
 * Step-15 language question / step-16 reflection: Thai heading and neutral
 * labels instead of the stored sentinel and a "ถูก" verdict. Null otherwise.
 */
export function getReviewNeutralRow(answer: SessionAnswer): NeutralRowView | null {
  return getNeutralRowView({ phase: answer.phase, question: answer.questionText, answer: answer.answerText });
}

/** Option letter: A, B, C… */
export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}
