// Keep these phase ids aligned with the shared lesson flow used by the tutor
// surface and learning-service. Phase 2 is the vocabulary flashcard mission.
export const LESSON_PHASE = {
  LAUNCH: 1,
  FLASHCARDS: 2,
  READ_ARTICLE: 3,
  VOCABULARY_CONTEXT: 4,
  DEEP_READING: 5,
  KEY_SENTENCES: 6,
  COMPREHENSION: 7,
  GUIDED_RESPONSE: 8,
  VOCABULARY_PRACTICE: 9,
  VOCABULARY_GAME: 10,
  SENTENCE_PRACTICE: 11,
  SENTENCE_ORDER: 12,
  GUIDED_WRITING: 13,
  SENTENCE_GAME: 14,
  LANGUAGE_QUESTIONS: 15,
  REFLECTION: 16,
  PAIR_CONVERSATION: 17,
  WRAP_UP: 18,
} as const;

export const TOTAL_LESSON_PHASES = LESSON_PHASE.WRAP_UP;

export const GAME_PHASES: number[] = [
  LESSON_PHASE.VOCABULARY_GAME,
  LESSON_PHASE.SENTENCE_GAME,
];
