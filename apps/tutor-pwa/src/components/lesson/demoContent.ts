import { orderWords } from "@/lib/games/potionRushOrders";

/** An order the class can watch being finished inside the demo's minute. */
export const DEMO_ORDER_MAX_WORDS = 10;
const DEMO_MIN_ORDERS = 3;

/**
 * The sentences a Potion Rush demo deals as orders: the lesson's short ones.
 * A C1 lesson's 30-word sentence cannot be brewed in a minute, so a demo of it
 * never reaches a finished potion. With too few short sentences, the shortest
 * few are used, so every lesson still has a demo.
 */
export function demoOrders<T extends { term: string }>(sentences: readonly T[]): T[] {
  const withWords = sentences.filter((sentence) => orderWords(sentence.term).length > 0);
  const short = withWords.filter((sentence) => orderWords(sentence.term).length <= DEMO_ORDER_MAX_WORDS);
  if (short.length >= DEMO_MIN_ORDERS) return short;
  return [...withWords]
    .sort((a, b) => orderWords(a.term).length - orderWords(b.term).length)
    .slice(0, Math.max(DEMO_MIN_ORDERS, short.length));
}

const WALKTHROUGH_MIN_WORDS = 4;
const WALKTHROUGH_MAX_WORDS = 7;

/**
 * The sentences the tutorial may walk through. Two words do not show putting a
 * sentence in order, and a long one takes the class a minute of drags.
 */
export function walkthroughOrders<T extends { term: string }>(sentences: readonly T[]): T[] {
  const fit = sentences.filter((sentence) => {
    const words = orderWords(sentence.term).length;
    return words >= WALKTHROUGH_MIN_WORDS && words <= WALKTHROUGH_MAX_WORDS;
  });
  return fit.length > 0 ? fit : [...sentences];
}
