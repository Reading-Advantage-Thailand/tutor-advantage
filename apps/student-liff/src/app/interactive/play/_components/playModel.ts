// Pure view-model helpers for the live lesson chrome (no scoring logic here:
// the answer/question strings sent to the server stay in the page handlers).
// Relative imports only: vitest maps "@" to another app.
import { LESSON_PHASE } from "../../../../lib/lessonPhases";
import {
  getEnabledGamesByCategory,
  getGamesByCategory,
  type LiveLessonGame,
  type LiveLessonGameCategory,
} from "../../../../lib/liveLessonGames";

/** Passive phases where the student mainly looks at the tutor's screen. */
const LOOK_AT_SCREEN_PHASES: number[] = [
  LESSON_PHASE.LAUNCH,
  LESSON_PHASE.VOCABULARY_CONTEXT,
  LESSON_PHASE.DEEP_READING,
  LESSON_PHASE.KEY_SENTENCES,
];

/** Same list as before: reading (phase 3) has its own tap-to-flag UI. */
export function isLookAtScreenPhase(phase: number): boolean {
  return LOOK_AT_SCREEN_PHASES.includes(phase);
}

/** A/B/C/D answer phases: comprehension, vocabulary, fill-in, sentence order. */
export const MCQ_PHASES: number[] = [
  LESSON_PHASE.COMPREHENSION,
  LESSON_PHASE.VOCABULARY_PRACTICE,
  LESSON_PHASE.SENTENCE_PRACTICE,
  LESSON_PHASE.SENTENCE_ORDER,
];

/**
 * Games a student can vote for: only the playable ones, plus whether more
 * (disabled, "coming soon") games exist in the category for a single teaser tile.
 */
export function getVotingDeck(category?: LiveLessonGameCategory | null): { games: LiveLessonGame[]; hasMore: boolean } {
  const games = getEnabledGamesByCategory(category);
  return { games, hasMore: getGamesByCategory(category).length > games.length };
}
