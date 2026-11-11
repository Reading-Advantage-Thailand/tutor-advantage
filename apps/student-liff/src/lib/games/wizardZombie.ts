import { clampMoveVector } from "@/lib/games/moveVector";
import { pickDecoys } from "@/lib/games/pickDecoys";
import type { VocabularyItem } from "@/store/useGameStore";

export type Point = {
  x: number;
  y: number;
};

export type Entity = Point & {
  id: string;
  radius: number;
};

export type Player = Entity & {
  hp: number;
  maxHp: number;
  speed: number;
  shockwaveCharges: number;
  maxShockwaveCharges: number;
  invulnerabilityTime: number;
  /** Time left until a caught wizard is back. The wizard cannot move or be hit meanwhile. */
  caughtMs: number;
};

export type Zombie = Entity & {
  speed: number;
  damage: number;
  /** Shockwave slide: while this runs the zombie flies back instead of chasing. */
  pushMs?: number;
  pushVx?: number;
  pushVy?: number;
};

export type Orb = Entity & {
  word: string;
  translation: string;
  isCorrect: boolean;
};

export type Difficulty = "easy" | "medium" | "hard";

export type Arena = {
  width: number;
  height: number;
};

/** The pause after a wrong pick: the right meaning is on screen and everything waits. */
export type WrongPickReveal = {
  term: string;
  meaning: string;
  remainingMs: number;
};

export type LastPick = {
  term: string;
  meaning: string;
  isCorrect: boolean;
  /** True when this pick earned a point. */
  isFirstTry: boolean;
};

export type WizardZombieState = {
  status: "playing" | "gameover";
  difficulty: Difficulty;
  arena: Arena;
  player: Player;
  zombies: Zombie[];
  orbs: Orb[];
  targetWord: string;
  /** Words still to ask after the target. A missed word goes to the back and comes round again. */
  wordQueue: string[];
  /** Words whose right orb has been touched, on any try. */
  answeredWords: string[];
  /** Words that had a wrong pick. Finding one later earns no point. */
  missedWords: string[];
  /** Words found on the first try. This, and nothing else, is what the lesson records. */
  correctAnswers: number;
  /** Every orb touched, right or wrong. */
  totalAttempts: number;
  lastPick: LastPick | null;
  reveal: WrongPickReveal | null;
  /** New orbs cannot be picked until this runs out. */
  orbGraceMs: number;
  spawnTimer: number;
  difficultyMultiplier: number;
  gameTime: number;
};

export type WizardZombieConfig = {
  rng?: () => number;
  difficulty?: Difficulty;
  arena?: Arena;
};

/** The default arena. A live round on a phone gets one shaped to its screen (see wizardZombieLayout). */
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
/** The class's round on a phone, and the tutor's demo. */
export const ROUND_DURATION_MS = 60_000;
export const PLAYER_RADIUS = 20;
export const ZOMBIE_RADIUS = 15;
export const ORB_RADIUS = 25;
export const INITIAL_HP = 100;
export const MAX_SHOCKWAVE_CHARGES = 3;

/**
 * Balance, checked by wizardZombieBalance.test.ts: knowing the words must decide
 * the round. Zombies cost time, never points, and never end the round.
 */
export const MAX_LIVE_ZOMBIES = 7;
export const ZOMBIE_DAMAGE = 10;
export const INVULNERABILITY_DURATION = 1_000; // ms; with the damage above, 10 HP/s at most however many touch
export const CAUGHT_RESPAWN_MS = 2_000;
export const WRONG_PICK_PAUSE_MS = 1_500;
export const HP_PER_RIGHT_ANSWER = 10;
/** A right answer blasts away the zombies this close, so knowing words is what keeps a child safe. */
export const RIGHT_ANSWER_CLEAR_RADIUS = 170;

export const SHOCKWAVE_RADIUS = 250;
const SHOCKWAVE_PUSH_DISTANCE = 240;
const SHOCKWAVE_PUSH_MS = 320;

/** A new orb never appears this close to the wizard, and cannot be picked straight away. */
export const MIN_ORB_DISTANCE = 120;
export const ORB_GRACE_MS = 300;
/** Touching an orb means real overlap, not brushing past it. */
export const PICK_DISTANCE = PLAYER_RADIUS + ORB_RADIUS - 6;
/** Room left between a straight walk to one orb and every other orb. */
const CLEAR_PATH_MARGIN = 12;
const LAYOUT_TRIES = 24;

const BASE_SPAWN_RATE_MS = 1_400;
const FIRST_ZOMBIE_DELAY_MS = 1_500;
const GATE_MARGIN = 40;
const MIN_GATE_DISTANCE = 220;
const OFF_ARENA_LIMIT = 60;

export const DIFFICULTY_MODIFIERS: Record<
  Difficulty,
  { speed: number; spawnRate: number }
> = {
  easy: { speed: 0.8, spawnRate: 1.2 },
  medium: { speed: 1.0, spawnRate: 1.0 },
  hard: { speed: 1.2, spawnRate: 0.8 },
};

const normalizeTerm = (term: string) => term.trim().toLowerCase();

/** A word listed twice is one word: the round must be able to reach 10 out of 10. */
export function uniqueWords<T extends { term: string }>(words: readonly T[]): T[] {
  const seen = new Set<string>();
  return words.filter((word) => {
    const key = normalizeTerm(word.term);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const createWizardZombieState = (
  vocabulary: VocabularyItem[],
  { rng = Math.random, difficulty = "medium", arena = { width: GAME_WIDTH, height: GAME_HEIGHT } }: WizardZombieConfig = {},
): WizardZombieState => {
  if (vocabulary.length === 0) {
    throw new Error("Vocabulary cannot be empty");
  }

  const words = shuffled(uniqueWords(vocabulary), rng);
  const target = words[0];

  const player: Player = {
    id: "player",
    x: arena.width / 2,
    y: arena.height / 2,
    radius: PLAYER_RADIUS,
    hp: INITIAL_HP,
    maxHp: INITIAL_HP,
    speed: 3,
    shockwaveCharges: 0,
    maxShockwaveCharges: MAX_SHOCKWAVE_CHARGES,
    invulnerabilityTime: 0,
    caughtMs: 0,
  };

  return {
    status: "playing",
    difficulty,
    arena,
    player,
    zombies: [],
    orbs: spawnOrbs(target, vocabulary, rng, arena, player),
    targetWord: target.term,
    wordQueue: words.slice(1).map((word) => word.term),
    answeredWords: [],
    missedWords: [],
    correctAnswers: 0,
    totalAttempts: 0,
    lastPick: null,
    reveal: null,
    orbGraceMs: ORB_GRACE_MS,
    spawnTimer: -FIRST_ZOMBIE_DELAY_MS,
    difficultyMultiplier: 1,
    gameTime: 0,
  };
};

export type InputState = {
  dx: number; // -1, 0, 1
  dy: number; // -1, 0, 1
  cast?: boolean;
};

export const advanceWizardZombieTime = (
  state: WizardZombieState,
  dt: number,
  input: InputState = { dx: 0, dy: 0, cast: false },
  vocabulary: VocabularyItem[] = [],
  rng: () => number = Math.random,
): WizardZombieState => {
  const gameTime = state.gameTime + dt;

  // Time stops while the right meaning is on screen, so a child reads instead of running.
  if (state.reveal) {
    const remainingMs = state.reveal.remainingMs - dt;
    if (remainingMs > 0) {
      return { ...state, gameTime, reveal: { ...state.reveal, remainingMs } };
    }
    return askNextWord({ ...state, gameTime, reveal: null }, vocabulary, rng);
  }

  if (state.player.caughtMs > 0) {
    const caughtMs = state.player.caughtMs - dt;
    if (caughtMs > 0) {
      const waiting = { ...state, gameTime, player: { ...state.player, caughtMs } };
      return updateZombies(waiting, dt, rng);
    }
    return respawnPlayer({ ...state, gameTime });
  }

  // Every direction walks at the same speed.
  const { dx: moveX, dy: moveY } = clampMoveVector(input.dx, input.dy);
  const speedFactor = dt / 16.6;
  const distance = state.player.speed * speedFactor;

  const nextPlayer: Player = {
    ...state.player,
    x: Math.max(PLAYER_RADIUS, Math.min(state.arena.width - PLAYER_RADIUS, state.player.x + moveX * distance)),
    y: Math.max(PLAYER_RADIUS, Math.min(state.arena.height - PLAYER_RADIUS, state.player.y + moveY * distance)),
  };

  let nextZombies = state.zombies;
  if (input.cast && state.player.shockwaveCharges > 0) {
    nextPlayer.shockwaveCharges -= 1;
    nextZombies = pushZombiesAway(nextZombies, nextPlayer, SHOCKWAVE_RADIUS);
  }

  const withZombies = updateZombies(
    { ...state, gameTime, player: nextPlayer, zombies: nextZombies },
    dt,
    rng,
  );
  return checkCollisions(withZombies, dt, vocabulary, rng);
};

function pushZombiesAway(zombies: Zombie[], from: Point, radius: number): Zombie[] {
  return zombies.map((zombie) => {
    const dx = zombie.x - from.x;
    const dy = zombie.y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= radius) return zombie;
    const angle = Math.atan2(dy, dx);
    const speed = SHOCKWAVE_PUSH_DISTANCE / SHOCKWAVE_PUSH_MS;
    return {
      ...zombie,
      pushMs: SHOCKWAVE_PUSH_MS,
      pushVx: Math.cos(angle) * speed,
      pushVy: Math.sin(angle) * speed,
    };
  });
}

function respawnPlayer(state: WizardZombieState): WizardZombieState {
  const player: Player = {
    ...state.player,
    hp: state.player.maxHp,
    caughtMs: 0,
    invulnerabilityTime: INVULNERABILITY_DURATION * 2,
  };
  return { ...state, player, zombies: pushZombiesAway(state.zombies, player, SHOCKWAVE_RADIUS) };
}

/** Moves on after a wrong pick: the missed word goes to the back of the line. */
function askNextWord(
  state: WizardZombieState,
  vocabulary: VocabularyItem[],
  rng: () => number,
): WizardZombieState {
  const line = [...state.wordQueue, state.targetWord];
  const nextTerm = line[0];
  const next = vocabulary.find((word) => word.term === nextTerm);
  if (!next) return { ...state, status: "gameover" };
  return {
    ...state,
    targetWord: next.term,
    wordQueue: line.slice(1),
    orbs: spawnOrbs(next, vocabulary, rng, state.arena, state.player),
    orbGraceMs: ORB_GRACE_MS,
  };
}

function findTouchedOrb(player: Player, orbs: Orb[]): Orb | null {
  return orbs.find((orb) => Math.hypot(player.x - orb.x, player.y - orb.y) < PICK_DISTANCE) ?? null;
}

function checkCollisions(
  state: WizardZombieState,
  dt: number,
  vocabulary: VocabularyItem[],
  rng: () => number,
): WizardZombieState {
  let next: WizardZombieState = state;
  let player = state.player;
  if (player.invulnerabilityTime > 0) {
    player = { ...player, invulnerabilityTime: Math.max(0, player.invulnerabilityTime - dt) };
    next = { ...next, player };
  }
  if (next.orbGraceMs > 0) {
    next = { ...next, orbGraceMs: Math.max(0, next.orbGraceMs - dt) };
  }

  const touched = next.orbGraceMs > 0 ? null : findTouchedOrb(player, next.orbs);
  if (touched) {
    next = touched.isCorrect
      ? pickRightOrb(next, touched, vocabulary, rng)
      : pickWrongOrb(next);
    player = next.player;
  }

  if (next.status !== "playing" || next.reveal || player.invulnerabilityTime > 0) return next;

  const biter = next.zombies.find(
    (zombie) => Math.hypot(player.x - zombie.x, player.y - zombie.y) < player.radius + zombie.radius,
  );
  if (!biter) return next;

  const hp = Math.max(0, player.hp - biter.damage);
  return {
    ...next,
    player: {
      ...player,
      hp,
      invulnerabilityTime: INVULNERABILITY_DURATION,
      caughtMs: hp <= 0 ? CAUGHT_RESPAWN_MS : 0,
    },
  };
}

function pickRightOrb(
  state: WizardZombieState,
  orb: Orb,
  vocabulary: VocabularyItem[],
  rng: () => number,
): WizardZombieState {
  const isFirstTry = !state.missedWords.includes(state.targetWord);
  const player: Player = {
    ...state.player,
    hp: Math.min(state.player.maxHp, state.player.hp + HP_PER_RIGHT_ANSWER),
    shockwaveCharges: Math.min(state.player.maxShockwaveCharges, state.player.shockwaveCharges + 1),
  };
  const answered: WizardZombieState = {
    ...state,
    player,
    zombies: state.zombies.filter(
      (zombie) => Math.hypot(player.x - zombie.x, player.y - zombie.y) >= RIGHT_ANSWER_CLEAR_RADIUS,
    ),
    answeredWords: [...state.answeredWords, state.targetWord],
    correctAnswers: state.correctAnswers + (isFirstTry ? 1 : 0),
    totalAttempts: state.totalAttempts + 1,
    lastPick: { term: state.targetWord, meaning: orb.translation, isCorrect: true, isFirstTry },
  };

  const [nextTerm, ...rest] = state.wordQueue;
  const nextWord = vocabulary.find((word) => word.term === nextTerm);
  if (!nextWord) return { ...answered, status: "gameover" };
  return {
    ...answered,
    targetWord: nextWord.term,
    wordQueue: rest,
    orbs: spawnOrbs(nextWord, vocabulary, rng, state.arena, player),
    orbGraceMs: ORB_GRACE_MS,
  };
}

function pickWrongOrb(state: WizardZombieState): WizardZombieState {
  const rightOrb = state.orbs.find((orb) => orb.isCorrect);
  const meaning = rightOrb?.translation ?? "";
  return {
    ...state,
    missedWords: state.missedWords.includes(state.targetWord)
      ? state.missedWords
      : [...state.missedWords, state.targetWord],
    totalAttempts: state.totalAttempts + 1,
    lastPick: { term: state.targetWord, meaning, isCorrect: false, isFirstTry: false },
    reveal: { term: state.targetWord, meaning, remainingMs: WRONG_PICK_PAUSE_MS },
    orbs: [],
  };
}

export type WizardZombieRoundEnd = "all-words" | "time";

export type WizardZombieRoundReview = {
  heading: string;
  /** Words that earned no point this round, to read once more. */
  missed: { term: string; meaning: string }[];
};

/** Why the round ended and which words to look at again, for the student's result card. */
export function buildRoundReview(
  state: Pick<WizardZombieState, "correctAnswers" | "missedWords" | "answeredWords">,
  words: readonly { term: string; translation: string }[],
  reason: WizardZombieRoundEnd,
): WizardZombieRoundReview {
  const missed = words
    .filter((word) => state.missedWords.includes(word.term) || !state.answeredWords.includes(word.term))
    .map((word) => ({ term: word.term, meaning: word.translation }));
  let heading = "หมดเวลา";
  if (reason === "all-words") heading = missed.length === 0 ? "เก่งมาก! ถูกครบทุกคำ" : "เก็บครบทุกคำแล้ว";
  return { heading, missed };
}

/** Where zombies come in: around the arena's edge, never right beside the wizard. */
function pickGate(arena: Arena, player: Point, rng: () => number): Point {
  const { width: w, height: h } = arena;
  const m = GATE_MARGIN;
  const gates: Point[] = [
    { x: w / 2, y: -m },
    { x: w / 2, y: h + m },
    { x: -m, y: h / 2 },
    { x: w + m, y: h / 2 },
    { x: -m, y: -m },
    { x: w + m, y: -m },
    { x: -m, y: h + m },
    { x: w + m, y: h + m },
  ];
  const far = gates.filter((gate) => Math.hypot(gate.x - player.x, gate.y - player.y) >= MIN_GATE_DISTANCE);
  const usable = far.length > 0 ? far : gates;
  return usable[Math.floor(rng() * usable.length)];
}

function updateZombies(
  state: WizardZombieState,
  dt: number,
  rng: () => number,
): WizardZombieState {
  const { difficulty, arena, player } = state;
  let { zombies, spawnTimer } = state;
  spawnTimer += dt;

  const modifiers = DIFFICULTY_MODIFIERS[difficulty] || DIFFICULTY_MODIFIERS.medium;
  const spawnRate = BASE_SPAWN_RATE_MS * modifiers.spawnRate;

  if (spawnTimer >= spawnRate) {
    spawnTimer = 0;
    if (zombies.length < MAX_LIVE_ZOMBIES) {
      const gate = pickGate(arena, player, rng);
      zombies = [
        ...zombies,
        {
          id: `zombie-${Math.round(state.gameTime)}-${rng()}`,
          x: gate.x,
          y: gate.y,
          radius: ZOMBIE_RADIUS,
          speed: (1.5 + state.difficultyMultiplier * 0.1) * modifiers.speed,
          damage: ZOMBIE_DAMAGE,
        },
      ];
    }
  }

  const speedFactor = dt / 16.6;
  const nextZombies = zombies.map((zombie) => {
    if (zombie.pushMs && zombie.pushMs > 0) {
      const step = Math.min(dt, zombie.pushMs);
      return {
        ...zombie,
        x: Math.max(-OFF_ARENA_LIMIT, Math.min(arena.width + OFF_ARENA_LIMIT, zombie.x + (zombie.pushVx ?? 0) * step)),
        y: Math.max(-OFF_ARENA_LIMIT, Math.min(arena.height + OFF_ARENA_LIMIT, zombie.y + (zombie.pushVy ?? 0) * step)),
        pushMs: zombie.pushMs - step,
      };
    }

    // Noise on the direction makes them shamble instead of marching in a line.
    const dx = player.x - zombie.x + (rng() - 0.5) * 200;
    const dy = player.y - zombie.y + (rng() - 0.5) * 200;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return zombie;

    return {
      ...zombie,
      x: zombie.x + (dx / dist) * zombie.speed * speedFactor,
      y: zombie.y + (dy / dist) * zombie.speed * speedFactor,
    };
  });

  return { ...state, zombies: nextZombies, spawnTimer };
}

/** The four parts of the arena. One orb and its label stay inside one part, so labels never overlap. */
export function orbCell(arena: Arena, point: Point) {
  const width = arena.width / 2;
  const height = arena.height / 2;
  const x = point.x < width ? 0 : width;
  const y = point.y < height ? 0 : height;
  return { x, y, width, height };
}

/** How close a straight walk from the wizard to `orb` comes to `other`. */
function distanceToWalk(from: Point, orb: Point, other: Point): number {
  const dx = orb.x - from.x;
  const dy = orb.y - from.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((other.x - from.x) * dx + (other.y - from.y) * dy) / lengthSquared));
  return Math.hypot(from.x + t * dx - other.x, from.y + t * dy - other.y);
}

/** How unfair a layout is: an orb too close to start from, or standing in the way of another. */
function layoutProblems(positions: Point[], player: Point): number {
  let problems = 0;
  positions.forEach((orb, i) => {
    if (Math.hypot(orb.x - player.x, orb.y - player.y) < MIN_ORB_DISTANCE) problems += 2;
    positions.forEach((other, j) => {
      if (i !== j && distanceToWalk(player, orb, other) < PICK_DISTANCE + CLEAR_PATH_MARGIN) problems += 1;
    });
  });
  return problems;
}

function spawnOrbs(
  target: VocabularyItem,
  vocabulary: VocabularyItem[],
  rng: () => number,
  arena: Arena,
  player: Point,
): Orb[] {
  // Fewer words means fewer orbs: never a wrong orb that reads the same as the right one.
  const decoys = pickDecoys(target, vocabulary, 3, rng);
  const words = [target, ...decoys];

  const cellWidth = arena.width / 2;
  const cellHeight = arena.height / 2;
  const cells = [
    { x: 0, y: 0 },
    { x: cellWidth, y: 0 },
    { x: 0, y: cellHeight },
    { x: cellWidth, y: cellHeight },
  ];

  // Orbs sit in the middle of their part of the arena, which leaves room for the label.
  const randomLayout = () => {
    const order = shuffled(cells, rng);
    return words.map((_, i) => ({
      x: order[i].x + cellWidth * (0.28 + rng() * 0.44),
      y: order[i].y + cellHeight * (0.28 + rng() * 0.44),
    }));
  };

  let positions = randomLayout();
  let problems = layoutProblems(positions, player);
  for (let attempt = 0; attempt < LAYOUT_TRIES && problems > 0; attempt++) {
    const candidate = randomLayout();
    const candidateProblems = layoutProblems(candidate, player);
    if (candidateProblems < problems) {
      positions = candidate;
      problems = candidateProblems;
    }
  }

  return words.map((word, i) => ({
    id: `orb-${i}-${rng()}`,
    x: positions[i].x,
    y: positions[i].y,
    radius: ORB_RADIUS,
    word: word.term,
    translation: word.translation,
    isCorrect: i === 0,
  }));
}
