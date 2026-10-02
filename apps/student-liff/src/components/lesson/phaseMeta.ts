// One source of truth for how a lesson phase is shown to students (name,
// emoji, colour), used by the live lesson, lesson history and the reader.
// Relative imports only: vitest maps "@" to another app.
import { t, type I18nKey } from "../../lib/i18n";
import { LESSON_PHASE, TOTAL_LESSON_PHASES } from "../../lib/lessonPhases";
import type { IconTileTone } from "../mobile/IconTile";

export interface PhaseMeta {
  phase: number;
  /** Kid-friendly Thai name, e.g. "ตอบคำถามจับใจความ". */
  label: string;
  emoji: string;
  tone: IconTileTone;
  /** What to do now (look-at-screen phases only). */
  tip: string | null;
}

const PHASES: Record<number, { name: I18nKey; emoji: string; tone: IconTileTone; tip?: I18nKey }> = {
  [LESSON_PHASE.LAUNCH]: { name: "interactivePlay.phaseName1", emoji: "📖", tone: "purple", tip: "interactivePlay.phaseTip1" },
  [LESSON_PHASE.FLASHCARDS]: { name: "interactivePlay.phaseName2", emoji: "🃏", tone: "purple", tip: "interactivePlay.phaseTip2" },
  [LESSON_PHASE.READ_ARTICLE]: { name: "interactivePlay.phaseName3", emoji: "👀", tone: "blue", tip: "interactivePlay.phaseTip3" },
  [LESSON_PHASE.VOCABULARY_CONTEXT]: { name: "interactivePlay.phaseName4", emoji: "🔍", tone: "amber", tip: "interactivePlay.phaseTip4" },
  [LESSON_PHASE.DEEP_READING]: { name: "interactivePlay.phaseName5", emoji: "🧠", tone: "brand", tip: "interactivePlay.phaseTip5" },
  [LESSON_PHASE.KEY_SENTENCES]: { name: "interactivePlay.phaseName6", emoji: "⭐", tone: "pink", tip: "interactivePlay.phaseTip6" },
  [LESSON_PHASE.COMPREHENSION]: { name: "interactivePlay.phaseName7", emoji: "❓", tone: "blue" },
  [LESSON_PHASE.GUIDED_RESPONSE]: { name: "interactivePlay.phaseName8", emoji: "✏️", tone: "purple" },
  [LESSON_PHASE.VOCABULARY_PRACTICE]: { name: "interactivePlay.phaseName9", emoji: "🔤", tone: "amber" },
  [LESSON_PHASE.VOCABULARY_GAME]: { name: "interactivePlay.phaseName10", emoji: "🎮", tone: "purple" },
  [LESSON_PHASE.SENTENCE_PRACTICE]: { name: "interactivePlay.phaseName11", emoji: "🧩", tone: "blue" },
  [LESSON_PHASE.SENTENCE_ORDER]: { name: "interactivePlay.phaseName12", emoji: "🔀", tone: "brand" },
  [LESSON_PHASE.GUIDED_WRITING]: { name: "interactivePlay.phaseName13", emoji: "✍️", tone: "blue" },
  [LESSON_PHASE.SENTENCE_GAME]: { name: "interactivePlay.phaseName14", emoji: "🎮", tone: "pink" },
  [LESSON_PHASE.LANGUAGE_QUESTIONS]: { name: "interactivePlay.phaseName15", emoji: "💬", tone: "purple" },
  [LESSON_PHASE.REFLECTION]: { name: "interactivePlay.phaseName16", emoji: "📝", tone: "amber" },
  [LESSON_PHASE.PAIR_CONVERSATION]: { name: "interactivePlay.phaseName17", emoji: "🗣️", tone: "pink" },
  [LESSON_PHASE.WRAP_UP]: { name: "interactivePlay.phaseName18", emoji: "🏆", tone: "amber" },
};

/** Phase presentation; unknown phases get a neutral "ขั้นที่ n" entry. */
export function getPhaseMeta(phase: number): PhaseMeta {
  const entry = PHASES[phase];
  if (!entry) {
    return { phase, label: formatPhaseStep(phase), emoji: "📘", tone: "neutral", tip: null };
  }
  return { phase, label: t(entry.name), emoji: entry.emoji, tone: entry.tone, tip: entry.tip ? t(entry.tip) : null };
}

/** "ขั้นที่ 7/18" for known phases, "ขั้นที่ 7" otherwise. */
export function formatPhaseStep(phase: number): string {
  const prefix = t("interactivePlay.phaseStepPrefix");
  return phase >= 1 && phase <= TOTAL_LESSON_PHASES ? `${prefix} ${phase}/${TOTAL_LESSON_PHASES}` : `${prefix} ${phase}`;
}

/** Lesson progress 0–100 for the live-lesson top bar. */
export function getPhaseProgress(phase: number): number {
  if (!Number.isFinite(phase) || phase <= 0) return 0;
  return Math.min(100, Math.round((phase / TOTAL_LESSON_PHASES) * 100));
}
