import type { VocabularyItem } from "@/store/useGameStore";
import { pickDecoys } from "./pickDecoys";
import { calculateXP } from "./xp";

export type GateSide = "left" | "right";

export type DragonFlightRound = {
  term: string;
  correctTranslation: string;
  /** Empty when the lesson has no other meaning to offer: that side then shows nothing. */
  decoyTranslation: string;
  correctSide: GateSide;
};

export type DragonFlightState = {
  status: "running" | "boss";
  durationMs: number;
  elapsedMs: number;
  attempts: number;
  correctAnswers: number;
  dragonCount: number;
  round: DragonFlightRound;
};

export type DragonFlightResults = {
  accuracy: number;
  bossPower: number;
  victory: boolean;
  xp: number;
  correctAnswers: number;
  totalAttempts: number;
  dragonCount: number;
  timeTaken: number; // Time taken in seconds
  /** Time actually played, so a slow download does not show as a slow round. */
  durationMs: number;
  /** How long the game wants the screen for its finish after handing this result over. */
  outroMs?: number;
  /** Words to read again, shown to the student after the round. */
  review?: { heading: string; missed: { term: string; meaning: string }[] };
  difficulty: "easy" | "normal" | "hard" | "extreme";
};

type DragonFlightConfig = {
  durationMs?: number;
  rng?: () => number;
};

type DragonFlightResultInput = {
  correctAnswers: number;
  totalAttempts: number;
  dragonCount: number;
  difficulty: "easy" | "normal" | "hard" | "extreme";
};

const DEFAULT_DURATION_MS = 30000;

/** A gate's whole trip. The round lasts this long per word, so even a slow reader reaches every word. */
export const MS_PER_WORD = 5000;
/** Gates after every word has been asked move a little faster. */
export const MS_PER_BONUS_GATE = 4000;
/** An unanswered gate closes here, leaving time on screen to show the right answer. */
export const GATE_CLOSES_AT = 0.85;
/** After an answer the gate rushes past the dragon in this time, never slower than its normal trip. */
export const CORRECT_REVEAL_MS = 900;
export const WRONG_REVEAL_MS = 1600;

const BOSS_ENTER_MS = 600;
const BOSS_FIGHT_MAX_MS = 2000;
const BOSS_FIGHT_MIN_MS = 900;
const BOSS_FIGHT_MS_PER_DRAGON = 150;

const pickIndex = (rng: () => number, max: number) =>
  Math.min(max - 1, Math.floor(rng() * max));

const getGateSide = (rng: () => number): GateSide =>
  rng() < 0.5 ? "left" : "right";

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** One question: the word, its meaning and a wrong meaning that reads differently. */
export const createGateRound = (
  item: VocabularyItem,
  pool: readonly VocabularyItem[],
  rng: () => number = Math.random,
): DragonFlightRound => {
  const [decoy] = pickDecoys(item, pool, 1, rng);
  return {
    term: item.term,
    correctTranslation: item.translation,
    decoyTranslation: decoy?.translation ?? "",
    correctSide: getGateSide(rng),
  };
};

const createRandomRound = (
  vocabulary: VocabularyItem[],
  rng: () => number,
): DragonFlightRound => {
  if (vocabulary.length === 0) {
    return {
      term: "",
      correctTranslation: "",
      decoyTranslation: "",
      correctSide: "left",
    };
  }
  return createGateRound(vocabulary[pickIndex(rng, vocabulary.length)], vocabulary, rng);
};

export type GateQueueEntry = {
  item: VocabularyItem;
  round: DragonFlightRound;
  bonus: boolean;
  /** Which word of the round this is, from 1. Bonus gates carry 0. */
  wordNumber: number;
};

export type GateQueue = {
  next(): GateQueueEntry | null;
  /** Asks this word again once every word has had its turn. */
  review(item: VocabularyItem): void;
};

/**
 * The order of the gates. Every word comes up once and only those gates score.
 * Time left after that goes to extra gates, words the student missed first.
 * They earn dragons but no points, so a fast student keeps playing without
 * changing the score rule, and the round still ends with the class.
 */
export function createGateQueue(
  words: readonly VocabularyItem[],
  pool: readonly VocabularyItem[] = words,
  rng: () => number = Math.random,
): GateQueue {
  const firstPass = shuffled(words, rng);
  const reviewWords: VocabularyItem[] = [];
  let extraWords: VocabularyItem[] = [];
  let wordNumber = 0;
  let lastItem: VocabularyItem | null = null;

  const nextExtra = (): VocabularyItem => {
    if (extraWords.length === 0) extraWords = shuffled(words, rng);
    const next = extraWords.shift() as VocabularyItem;
    if (next !== lastItem || words.length < 2) return next;
    if (extraWords.length === 0) extraWords = shuffled(words, rng).filter((word) => word !== next);
    const other = extraWords.shift() as VocabularyItem;
    extraWords.push(next);
    return other;
  };

  return {
    next() {
      if (words.length === 0) return null;
      const first = firstPass.shift();
      const item = first ?? reviewWords.shift() ?? nextExtra();
      lastItem = item;
      if (first) wordNumber += 1;
      return {
        item,
        round: createGateRound(item, pool, rng),
        bonus: !first,
        wordNumber: first ? wordNumber : 0,
      };
    },
    review(item) {
      if (!reviewWords.includes(item)) reviewWords.push(item);
    },
  };
}

export type GateOutcome = "correct" | "incorrect" | "missed";

export type DragonGate = GateQueueEntry & {
  id: string;
  /** 0 is just above the screen, 1 is just below it. Independent of screen size, so a rotation loses nothing. */
  progress: number;
  /** Progress per millisecond. */
  speed: number;
  /** Where the gate was when it was answered or closed. Its labels stay there to be read. */
  settledAt: number | null;
  picked: GateSide | null;
  outcome: GateOutcome | null;
};

export const startGate = (entry: GateQueueEntry, id: string): DragonGate => ({
  ...entry,
  id,
  progress: 0,
  speed: 1 / (entry.bonus ? MS_PER_BONUS_GATE : MS_PER_WORD),
  settledAt: null,
  picked: null,
  outcome: null,
});

/** Moves a gate. An unanswered gate that reaches GATE_CLOSES_AT comes back with outcome "missed". */
export const stepGate = (gate: DragonGate, stepMs: number): DragonGate => {
  const progress = gate.progress + gate.speed * Math.max(stepMs, 0);
  if (gate.outcome || progress < GATE_CLOSES_AT) return { ...gate, progress };
  return { ...gate, progress, outcome: "missed", settledAt: GATE_CLOSES_AT };
};

export const isGateGone = (gate: DragonGate) => gate.progress >= 1;

/**
 * Answers a gate, or returns null when it cannot be answered: already answered,
 * closed, or still above the screen with its labels hidden (`opensAt`).
 */
export const answerGate = (
  gate: DragonGate,
  side: GateSide,
  opensAt: number = 0,
): DragonGate | null => {
  if (gate.outcome || gate.progress < opensAt) return null;
  const outcome: GateOutcome = side === gate.round.correctSide ? "correct" : "incorrect";
  const revealMs = outcome === "correct" ? CORRECT_REVEAL_MS : WRONG_REVEAL_MS;
  return {
    ...gate,
    outcome,
    picked: side,
    settledAt: gate.progress,
    speed: Math.max(gate.speed, (1 - gate.progress) / revealMs),
  };
};

/** A gate's top edge on this stage. */
export const gateYAt = (progress: number, gateHeight: number, stageHeight: number) =>
  -gateHeight + progress * (stageHeight + 2 * gateHeight);

/** The progress at which a gate has fully come into view and its labels show. */
export const gateOpensAt = (gateHeight: number, stageHeight: number) =>
  gateHeight / (stageHeight + 2 * gateHeight);

/**
 * Where the answer labels go: just under the gate, but kept below the top bar and
 * above the arrows so a label never leaves the screen or covers a control.
 */
export const gateLabelTopAt = ({
  gateY,
  gateHeight,
  hudBottom,
  arrowsTop,
  labelHeight,
}: {
  gateY: number;
  gateHeight: number;
  hudBottom: number;
  arrowsTop: number;
  labelHeight: number;
}) => {
  const lowest = arrowsTop - labelHeight - 8;
  return Math.max(hudBottom + 4, Math.min(gateY + gateHeight + 8, lowest));
};

export const applyGateAnswer = (
  state: DragonFlightState,
  {
    correct,
    bonus = false,
    penalty = 1,
    gameOverOnMiss = false,
  }: { correct: boolean; bonus?: boolean; penalty?: number; gameOverOnMiss?: boolean },
): DragonFlightState => {
  if (state.status !== "running") return state;
  const attempts = state.attempts + 1;
  if (correct) {
    return {
      ...state,
      attempts,
      correctAnswers: state.correctAnswers + (bonus ? 0 : 1),
      dragonCount: state.dragonCount + 1,
    };
  }
  if (gameOverOnMiss) return { ...state, attempts, dragonCount: 0, status: "boss" };
  return { ...state, attempts, dragonCount: Math.max(1, state.dragonCount - penalty) };
};

export const createDragonFlightState = (
  vocabulary: VocabularyItem[],
  {
    durationMs = DEFAULT_DURATION_MS,
    rng = Math.random,
  }: DragonFlightConfig = {}
): DragonFlightState => ({
  status: "running",
  durationMs,
  elapsedMs: 0,
  attempts: 0,
  correctAnswers: 0,
  dragonCount: 1,
  round: createRandomRound(vocabulary, rng),
});

export const setDragonFlightTimeLeft = (
  state: DragonFlightState,
  remainingMs: number,
): DragonFlightState => {
  if (state.status !== "running") return state;
  return {
    ...state,
    elapsedMs: Math.min(Math.max(state.durationMs - remainingMs, 0), state.durationMs),
  };
};

export const endDragonFlightRound = (state: DragonFlightState): DragonFlightState => {
  if (state.status !== "running") return state;
  return { ...state, elapsedMs: state.durationMs, status: "boss" };
};

/** Boss finish timing: more dragons bring the boss down sooner, and it always falls. */
export const bossFightTiming = (dragonCount: number) => {
  const fightMs = Math.max(
    BOSS_FIGHT_MIN_MS,
    BOSS_FIGHT_MAX_MS - BOSS_FIGHT_MS_PER_DRAGON * Math.max(dragonCount - 1, 0),
  );
  return { enterMs: BOSS_ENTER_MS, fightMs };
};

/** Boss health from 1 to 0, `elapsedMs` after the boss phase began. */
export const bossHealthAt = (elapsedMs: number, dragonCount: number) => {
  const { enterMs, fightMs } = bossFightTiming(dragonCount);
  return Math.min(1, Math.max(0, 1 - (elapsedMs - enterMs) / fightMs));
};

export const calculateBossPower = (totalAttempts: number): number =>
  Math.max(3, Math.ceil(totalAttempts * 0.6));

export const getDragonFlightResults = (
  {
    correctAnswers,
    totalAttempts,
    dragonCount,
    difficulty,
  }: DragonFlightResultInput,
  elapsedMs: number = 0
): DragonFlightResults => {
  const accuracy = totalAttempts > 0 ? correctAnswers / totalAttempts : 0;
  const bossPower = calculateBossPower(totalAttempts);
  const victory = dragonCount >= bossPower;
  const xp = calculateXP(0, correctAnswers, totalAttempts);
  const timeTaken = Math.floor(elapsedMs / 1000); // Convert to seconds

  return {
    accuracy,
    bossPower,
    victory,
    xp,
    correctAnswers,
    totalAttempts,
    dragonCount,
    timeTaken,
    durationMs: Math.round(elapsedMs),
    difficulty,
  };
};
