// Pure helpers for the step-15 language question and step-16 reflection rows
// of a finished live lesson. Both have no right answer, so the lesson summary
// page and the article reader show them with a Thai heading and neutral labels
// instead of the stored English sentinel and a "ถูก" verdict.
// Relative imports only: vitest maps "@" to another app.
import { parseGameResultAnswer } from "./gameResultAnswer";
import { t } from "./i18n";
import { LESSON_PHASE } from "./lessonPhases";

/**
 * Question texts the client sends (and the backend stores) for the step-15
 * language question and the step-16 reflection. Every such row carries one.
 */
export const LANGUAGE_QUESTION_SENTINEL = "Language question";
export const REFLECTION_SENTINEL = "Lesson reflection";

/** learning-service fallback when a row has no question text ("คำถามข้อที่ 15"). */
const GENERIC_QUESTION = /^คำถามข้อที่\s*\d+$/;

/** "answer" = an ordinary question row with a right/wrong verdict. */
export type LessonRowKind = "languageQuestion" | "reflection" | "answer";

export interface LessonRowLike {
  phase?: number | null;
  question?: string | null;
  answer?: string | null;
  /** Ignored: both rows are stored with isCorrect true but have no verdict. */
  isCorrect?: boolean | null;
}

/**
 * The sentinel question decides. The phase number is used only when a row has
 * no usable question text: phases were renumbered more than once (in Aug 2026
 * phase 15 was a game), so an old phase-15 row with its own question text or
 * a game result is an ordinary row.
 */
export function getLessonRowKind(a: LessonRowLike): LessonRowKind {
  const question = a.question?.trim() ?? "";
  if (question === LANGUAGE_QUESTION_SENTINEL) return "languageQuestion";
  if (question === REFLECTION_SENTINEL) return "reflection";
  if (question && !GENERIC_QUESTION.test(question)) return "answer";
  if (parseGameResultAnswer(a.answer) !== null) return "answer";
  if (a.phase === LESSON_PHASE.LANGUAGE_QUESTIONS) return "languageQuestion";
  if (a.phase === LESSON_PHASE.REFLECTION) return "reflection";
  return "answer";
}

export interface NeutralRowView {
  kind: "languageQuestion" | "reflection";
  /** Thai heading shown instead of the stored sentinel. */
  title: string;
  /** Label over the learner's text (no right/wrong wording). */
  answerLabel: string;
  /** The learner's text, or the "nothing written" line. */
  answerText: string;
  /** False when the learner left it empty (shown muted). */
  answered: boolean;
  /** Label over the AI text. */
  aiLabel: string;
}

/**
 * View of the step-15 and step-16 rows, which have no right answer: Thai
 * heading, neutral labels. Null for every other row.
 */
export function getNeutralRowView(a: LessonRowLike): NeutralRowView | null {
  const kind = getLessonRowKind(a);
  if (kind === "answer") return null;
  const text = a.answer?.trim() ?? "";
  if (kind === "languageQuestion") {
    return {
      kind,
      title: t("lessonHistory.languageQuestionTitle"),
      answerLabel: t("lessonHistory.yourQuestion"),
      answerText: text || t("lessonHistory.noQuestionAsked"),
      answered: !!text,
      aiLabel: t("lessonHistory.aiAnswerLabel"),
    };
  }
  return {
    kind,
    title: t("lessonHistory.reflectionTitle"),
    answerLabel: t("lessonHistory.yourAnswer"),
    answerText: text || t("lessonHistory.unspecified"),
    answered: !!text,
    aiLabel: t("lessonHistory.aiFeedbackLabel"),
  };
}
