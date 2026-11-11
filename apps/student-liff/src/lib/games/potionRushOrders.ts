/**
 * Order rules for Potion Rush, used by the student game and the tutor demo.
 *
 * Belt words are never tracked as stock. What the belt should offer is worked
 * out from what the waiting customers still need, so a word that was trashed,
 * rolled off or rejected simply comes round again.
 */

export type OrderRequest = { term: string };
export type OrderCustomer = { state: string; patience: number; request: OrderRequest };
export type OrderCauldron = { state: string; currentWords: string[] };

const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const SENTENCE_START_CAPITAL = /^\p{Lu}[^\p{Lu}]*$/u;

/** What decides if two words are the same word: no capitals, no punctuation at the ends. */
export const wordKey = (word: string) => word.replace(EDGE_PUNCTUATION, "").toLowerCase();

/** The words of an order. A token with no letter or digit in it ("-") is not a word to brew. */
export const orderWords = (term: string) =>
  term
    .trim()
    .split(/\s+/)
    .filter((word) => wordKey(word) !== "");

/**
 * The label on the belt. A period or a sentence-start capital would give away
 * the word's place in the sentence, so the belt shows neither. "I" and names in
 * the middle of a sentence keep their capitals.
 */
export function beltLabel(word: string, isFirstWord: boolean): string {
  const bare = word.replace(EDGE_PUNCTUATION, "");
  if (!isFirstWord || /^I\b/.test(bare) || !SENTENCE_START_CAPITAL.test(bare)) return bare;
  return bare.charAt(0).toLowerCase() + bare.slice(1);
}

const PATIENCE_SECONDS_PER_WORD = 7;
const MIN_PATIENCE_SECONDS = 25;

/** How long a customer waits. A longer sentence gets longer. */
export const patienceForOrder = (term: string) =>
  Math.max(MIN_PATIENCE_SECONDS, orderWords(term).length * PATIENCE_SECONDS_PER_WORD);

export type NeededWord = { word: string; isFirstWord: boolean };

function wordsLeft(customer: OrderCustomer, cauldron: OrderCauldron | undefined): NeededWord[] {
  const placed = cauldron?.state === "BREWING" ? cauldron.currentWords.length : 0;
  return orderWords(customer.request.term)
    .slice(placed)
    .map((word, index) => ({ word, isFirstWord: placed + index === 0 }));
}

/** How many words the waiting customers still need in total. */
export function countWordsNeeded(
  customers: readonly (OrderCustomer | null)[],
  cauldrons: readonly OrderCauldron[],
): number {
  return customers.reduce(
    (sum, customer, slot) => (customer?.state === "WAITING" ? sum + wordsLeft(customer, cauldrons[slot]).length : sum),
    0,
  );
}

export type WordSupply = {
  /** Words someone needs right now that are not on the belt. */
  nextWords: NeededWord[];
  /** Later words of the waiting orders that are not on the belt. */
  laterWords: NeededWord[];
};

/** What is missing from the belt (held words count as on the belt). */
export function wordsMissingFromBelt(
  customers: readonly (OrderCustomer | null)[],
  cauldrons: readonly OrderCauldron[],
  beltWords: readonly string[],
): WordSupply {
  const onBelt = new Map<string, number>();
  beltWords.forEach((word) => onBelt.set(wordKey(word), (onBelt.get(wordKey(word)) ?? 0) + 1));
  const takeFromBelt = (word: string) => {
    const left = onBelt.get(wordKey(word)) ?? 0;
    if (left > 0) onBelt.set(wordKey(word), left - 1);
    return left > 0;
  };

  const orders = customers.flatMap((customer, slot) =>
    customer?.state === "WAITING" ? [wordsLeft(customer, cauldrons[slot])] : [],
  );
  // The words needed right now take the belt's copies first.
  const nextWords = orders.flatMap((order) => order.slice(0, 1)).filter((needed) => !takeFromBelt(needed.word));
  const laterWords = orders.flatMap((order) => order.slice(1)).filter((needed) => !takeFromBelt(needed.word));
  return { nextWords, laterWords };
}

/** The next word for the belt, or null when everything needed is already out there. */
export function pickBeltWord(
  supply: WordSupply,
  preferNextWord: boolean,
  random: () => number = Math.random,
): NeededWord | null {
  const choices =
    preferNextWord && supply.nextWords.length > 0 ? supply.nextWords : [...supply.nextWords, ...supply.laterWords];
  if (choices.length === 0) return null;
  return choices[Math.floor(random() * choices.length)];
}

/**
 * The next customer's sentence: not one already at the counter, and one the
 * round has not used yet while there are any left.
 */
export function pickOrderSentence<T extends OrderRequest>(
  sentences: readonly T[],
  activeTerms: readonly string[],
  usedTerms: readonly string[],
  random: () => number = Math.random,
): T | null {
  const fresh = sentences.filter((item) => !activeTerms.includes(item.term) && !usedTerms.includes(item.term));
  const notActive = sentences.filter((item) => !activeTerms.includes(item.term));
  const choices = fresh.length > 0 ? fresh : notActive.length > 0 ? notActive : sentences;
  if (choices.length === 0) return null;
  return choices[Math.floor(random() * choices.length)];
}

/**
 * Which customer the order banner shows. It stays put while its customer is
 * waiting or is being served, and otherwise moves to whoever will leave first.
 */
export function pickFocusSlot(current: number, customers: readonly (OrderCustomer | null)[]): number {
  const state = customers[current]?.state;
  if (state === "WAITING" || state === "LEAVING_HAPPY") return current;
  let best = current;
  let least = Infinity;
  customers.forEach((customer, slot) => {
    if (customer?.state === "WAITING" && customer.patience < least) {
      least = customer.patience;
      best = slot;
    }
  });
  return best;
}

const LONG_WORD_CHARS = 8;
const PX_PER_CHAR = 9;

/** Seconds until the next word, leaving room when a long label just went out. */
export function nextWordDelay(baseSeconds: number, word: string, beltSpeed: number): number {
  const extraPx = Math.max(0, word.length - LONG_WORD_CHARS) * PX_PER_CHAR;
  return baseSeconds + extraPx / Math.max(beltSpeed, 1);
}

const BELT_GAP = 100;

/**
 * Where a word goes back on the belt. The belt kept moving while it was being
 * dragged, so it may land on another word: it moves up to the next free place.
 */
export function freeBeltX(x: number, otherXs: readonly number[]): number {
  let free = x;
  [...otherXs]
    .sort((a, b) => a - b)
    .forEach((other) => {
      if (Math.abs(free - other) < BELT_GAP) free = other + BELT_GAP;
    });
  return free;
}

export type DropZoneLayout = { trashX: number; trashY: number };
export type DropPoint = { x: number; y: number };
export type DropZone =
  | { kind: "trash" }
  | { kind: "hold"; slot: number }
  | { kind: "belt" }
  | { kind: "pot"; slot: number }
  | { kind: "none" };

// Scene heights: customers and pots down to the pots' feet, then the hold slots,
// the trash, and the belt. A customer stands for the pot under them.
const POT_ZONE_TOP = 100;
const POT_ZONE_BOTTOM = 460;
const HOLD_ZONE_BOTTOM = 565;
const BELT_ZONE_TOP = 670;
const TRASH_RADIUS = 55;

function zoneAt(point: DropPoint, sceneWidth: number, layout: DropZoneLayout): DropZone {
  const slot = Math.min(2, Math.max(0, Math.floor(point.x / (sceneWidth / 3))));
  if (Math.hypot(point.x - layout.trashX, point.y - layout.trashY) < TRASH_RADIUS) return { kind: "trash" };
  if (point.y >= BELT_ZONE_TOP) return { kind: "belt" };
  if (point.y > POT_ZONE_BOTTOM && point.y < HOLD_ZONE_BOTTOM) return { kind: "hold", slot };
  if (point.y > POT_ZONE_TOP && point.y <= POT_ZONE_BOTTOM) return { kind: "pot", slot };
  return { kind: "none" };
}

/**
 * Where a dragged word lands. The word as drawn decides, since that is what the
 * child looks at. The finger counts only when the word itself is over nothing.
 */
export function resolveDropZone(
  itemCentre: DropPoint,
  finger: DropPoint,
  sceneWidth: number,
  layout: DropZoneLayout,
): DropZone {
  const drawn = zoneAt(itemCentre, sceneWidth, layout);
  return drawn.kind === "none" ? zoneAt(finger, sceneWidth, layout) : drawn;
}
