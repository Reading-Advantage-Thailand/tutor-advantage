/**
 * Wrong answers for a word game.
 *
 * Real lessons have two words with one Thai meaning (idiom and expression are
 * both สำนวน), so choosing decoys by word alone can show the right answer twice
 * and mark one of them wrong. Use this instead of any "other words" filter:
 *
 *   const decoys = pickDecoys(target, vocabulary, 3);
 *
 * It returns FEWER than asked for when the lesson is small, possibly none. Show
 * that many options. Never pad with the target or with words from outside the
 * lesson. The lesson runtime does not start a word game unless at least two
 * different meanings exist, so a live round always has one decoy.
 */

type WordLike = { term: string; translation: string };

/** Two labels that normalise the same read the same to a child. */
export function normalizeMeaning(text: string | null | undefined): string {
  return String(text ?? "")
    .normalize("NFC")
    .replace(/[\s​]+/g, "")
    .replace(/^[.,;:!?'"“”‘’()[\]]+|[.,;:!?'"“”‘’()[\]]+$/g, "")
    .toLowerCase();
}

function shuffled<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Up to `count` words from `pool`, each with a meaning unlike the target's and unlike each other's. */
export function pickDecoys<T extends WordLike>(
  target: WordLike,
  pool: readonly T[],
  count: number,
  rng: () => number = Math.random,
): T[] {
  const targetTerm = normalizeMeaning(target.term);
  const usedMeanings = new Set([normalizeMeaning(target.translation)]);
  const decoys: T[] = [];
  for (const word of shuffled([...pool], rng)) {
    if (decoys.length >= count) break;
    const meaning = normalizeMeaning(word.translation);
    if (!meaning || usedMeanings.has(meaning) || normalizeMeaning(word.term) === targetTerm) continue;
    usedMeanings.add(meaning);
    decoys.push(word);
  }
  return decoys;
}

/** How many different meanings a word list holds. A choice needs at least 2. */
export function countDistinctMeanings(words: readonly WordLike[]): number {
  return new Set(words.map((word) => normalizeMeaning(word.translation)).filter(Boolean)).size;
}
