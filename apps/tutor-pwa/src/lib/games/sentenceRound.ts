/** Most points one game can add to a lesson, the same in every game. */
export const MAX_GAME_POINTS = 10;

export const countSentenceWords = (sentence: string) =>
  sentence.trim().split(/\s+/).filter(Boolean).length;

/** Words finished so far as points out of MAX_GAME_POINTS. */
export function wordProgressPoints(words: number, wordBudget: number): number {
  if (wordBudget <= 0) return 0;
  return Math.min(MAX_GAME_POINTS, Math.round((MAX_GAME_POINTS * words) / wordBudget));
}

/**
 * The number of words a full-score round asks for, capped by what the round
 * holds. Pass the game's own word splitting: only those words can be earned.
 */
export function roundWordBudget(
  sentences: { term: string }[],
  targetWords: number,
  countWords: (term: string) => number,
): number {
  const available = sentences.reduce((sum, sentence) => sum + countWords(sentence.term), 0);
  return Math.min(targetWords, available);
}

/**
 * Sentences short enough to finish in a 60 second round. An article with too
 * few of them (C1 reading) falls back to its shortest sentences.
 */
export function pickShortSentences<T extends { term: string }>(
  items: T[],
  maxWords: number,
  minCount = 3,
): T[] {
  const short = items.filter((item) => countSentenceWords(item.term) <= maxWords);
  if (short.length >= minCount || short.length === items.length) return short;
  return [...items]
    .sort((a, b) => countSentenceWords(a.term) - countSentenceWords(b.term))
    .slice(0, minCount);
}
