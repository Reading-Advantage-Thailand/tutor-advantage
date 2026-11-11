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
  shieldCharges: number;
  maxShieldCharges: number;
  speed: number;
};

export type Spirit = Entity & {
  velocityX: number;
  velocityY: number;
  speed: number;
  bounced: boolean;
  hasHitPlayer: boolean;
  /** Time left on the warning. Until it runs out the ghost waits at the wall and cannot hurt. */
  warnMs: number;
};

export type Book = Entity & {
  word: string;
  translation: string;
  isCorrect: boolean;
};

/** The answer on screen after a pick. The world holds still so the child can read it. */
export type AnswerReveal = {
  kind: "correct" | "wrong";
  term: string;
  meaning: string;
};

/** What happened in one step, for sound and bursts. */
export type LibraryEvent =
  | { kind: "correct"; term: string; meaning: string; x: number; y: number }
  | { kind: "wrong"; term: string; meaning: string; x: number; y: number }
  | { kind: "hit" }
  | { kind: "exhausted" }
  | { kind: "shield" };

export type EnchantedLibraryState = {
  status: "playing" | "gameover" | "victory";
  player: Player;
  spirits: Spirit[];
  books: Book[];
  targetWord: string;
  mana: number;
  vocabularyProgress: Map<string, number>;
  /** Words where a wrong book was picked before the right one. */
  missedWords: Set<string>;
  totalWords: number;
  shieldActive: boolean;
  shieldTimer: number;
  gameTime: number;
  timeRemaining: number;
  spiritSpawnTimer: number;
  spiritSpeed: number;
  difficulty: Difficulty;
  maxSpirits: number;
  /** While above 0 the world holds still and `reveal` is on screen. The round's clock keeps running. */
  pauseMs: number;
  reveal: AnswerReveal | null;
  /** While above 0 the wizard cannot walk and no ghost can hit again. */
  stunMs: number;
  stunReason: "hit" | "exhausted" | null;
  events: LibraryEvent[];
};

export type Difficulty = "easy" | "normal" | "hard" | "extreme";

export type DifficultyConfig = {
  spiritCount: number;
  spiritSpeed: number;
  xpMultiplier: number;
};

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: { spiritCount: 1, spiritSpeed: 0.8, xpMultiplier: 1.0 },
  normal: { spiritCount: 1, spiritSpeed: 1.0, xpMultiplier: 1.5 },
  hard: { spiritCount: 2, spiritSpeed: 1.3, xpMultiplier: 2.0 },
  extreme: { spiritCount: 2, spiritSpeed: 1.6, xpMultiplier: 3.0 },
};

/** Where books may be placed, in map coordinates. */
export type BookArea = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type EnchantedLibraryConfig = {
  rng?: () => number;
  vocabulary?: VocabularyItem[];
  difficulty?: Difficulty;
  masteryTarget?: number;
  isTutorial?: boolean;
  tutorialMode?: boolean;
  /** The part of the map on screen for a player position, so a new board can be seen and compared. */
  bookArea?: (player: Point) => BookArea | null;
};

export type DirectionalInput = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  cast: boolean;
  /** The exact walking direction from the stick. Without it the four booleans decide. */
  dx?: number;
  dy?: number;
};

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const PLAYER_RADIUS = 20;
export const SPIRIT_RADIUS = 15;
export const BOOK_RADIUS = 25;
export const INITIAL_MANA = 50;
export const MAX_SHIELD_CHARGES = 3;
export const SHIELD_DURATION = 2000; // ms
/** One game step. All speeds below are map pixels per step, whatever the phone's frame rate. */
export const FIXED_STEP_MS = 1000 / 60;
/** No ghost until the child has had time to read the first word and its books. */
export const SPIRIT_GRACE_MS = 4000;
export const SPIRIT_SPAWN_RATE_MS = 4000;
/** How long the warning shows before a ghost sets off. */
export const SPIRIT_WARNING_MS = 1000;
export const INITIAL_SPIRIT_SPEED = 3.5;
export const MAX_SPIRIT_SPEED = 6.5;
export const SPIRIT_SPEED_GROWTH = 1.06;
/** A ghost is aimed up to this far beside the player, so standing still to read is not a sure hit. */
export const SPIRIT_AIM_SPREAD = 90;
const SPIRIT_MIN_SPAWN_DISTANCE = 220;
export const PREDICT_AHEAD_DISTANCE = 50; // pixels - tighter targeting
export const PLAYER_SPEED = 3;
export const MANA_GAIN_CORRECT = 10;
export const MANA_LOSS_INCORRECT = 5;
export const MANA_LOSS_SPIRIT_HIT = 10;
export const HIT_STUN_MS = 500;
/** Running out of mana costs time, never the round: only words decide the score. */
export const EXHAUSTED_STUN_MS = 1500;
export const MANA_REFILL = 30;
export const CORRECT_HOLD_MS = 900;
export const WRONG_HOLD_MIN_MS = 1800;
export const WRONG_HOLD_MAX_MS = 2800;
export const MIN_BOOK_SPAWN_DISTANCE = 150; // Minimum distance from player
const MIN_BOOK_SPAWN_DISTANCE_TIGHT = 105;
/** Far enough that a label is always nearer its own book than the next one. */
export const BOOK_SPACING = 130;
/** Two books closer than this on both axes would have overlapping labels. */
const LABEL_CLEAR_X = 170;
const LABEL_CLEAR_Y = 90;
const BOOK_EDGE_X = 85;
const BOOK_EDGE_TOP = 50;
const BOOK_EDGE_BOTTOM = 70;
export const GAME_DURATION_MS = 180000; // 3 minutes

const NO_EVENTS: LibraryEvent[] = [];
const MAP_BOOK_AREA: BookArea = {
  minX: BOOK_EDGE_X,
  maxX: GAME_WIDTH - BOOK_EDGE_X,
  minY: BOOK_EDGE_TOP,
  maxY: GAME_HEIGHT - BOOK_EDGE_BOTTOM,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const createEnchantedLibraryState = (
  vocabulary: VocabularyItem[],
  { rng = Math.random, difficulty = "normal", bookArea }: EnchantedLibraryConfig = {},
): EnchantedLibraryState => {
  if (vocabulary.length === 0) {
    throw new Error("Vocabulary cannot be empty");
  }

  // Initialize vocabulary progress (each word needs to be collected 2x)
  const vocabularyProgress = new Map<string, number>();
  vocabulary.forEach((vocab) => {
    vocabularyProgress.set(vocab.term, 0);
  });

  // Select random target word
  const targetIndex = Math.floor(rng() * vocabulary.length);
  const target = vocabulary[targetIndex];

  // Create player at center
  const player: Player = {
    id: "player",
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
    radius: PLAYER_RADIUS,
    speed: 3,
    shieldCharges: MAX_SHIELD_CHARGES,
    maxShieldCharges: MAX_SHIELD_CHARGES,
  };

  // Spawn initial books (1 correct, 3 decoys)
  const books = spawnBooks(target, vocabulary, player, rng, bookArea?.(player));

  // Get difficulty configuration
  const difficultyConfig = DIFFICULTY_CONFIG[difficulty];
  const initialSpiritSpeed =
    INITIAL_SPIRIT_SPEED * difficultyConfig.spiritSpeed;

  return {
    status: "playing",
    player,
    spirits: [],
    books,
    targetWord: target.term,
    mana: INITIAL_MANA,
    vocabularyProgress,
    missedWords: new Set<string>(),
    totalWords: vocabulary.length,
    shieldActive: false,
    shieldTimer: 0,
    gameTime: 0,
    timeRemaining: GAME_DURATION_MS,
    spiritSpawnTimer: SPIRIT_GRACE_MS,
    spiritSpeed: initialSpiritSpeed,
    difficulty,
    maxSpirits: difficultyConfig.spiritCount,
    pauseMs: 0,
    reveal: null,
    stunMs: 0,
    stunReason: null,
    events: NO_EVENTS,
  };
};

const booksClash = (a: Point, b: Point) => {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.hypot(dx, dy) < BOOK_SPACING || (dx < LABEL_CLEAR_X && dy < LABEL_CLEAR_Y);
};

const intersectArea = (area: BookArea): BookArea | null => {
  const result = {
    minX: Math.max(area.minX, MAP_BOOK_AREA.minX),
    maxX: Math.min(area.maxX, MAP_BOOK_AREA.maxX),
    minY: Math.max(area.minY, MAP_BOOK_AREA.minY),
    maxY: Math.min(area.maxY, MAP_BOOK_AREA.maxY),
  };
  return result.minX < result.maxX && result.minY < result.maxY ? result : null;
};

/** One board: every book placed, or null when this area cannot hold them. */
const tryPlaceBooks = (
  count: number,
  player: Point,
  area: BookArea,
  minPlayerDistance: number,
  rng: () => number,
): Point[] | null => {
  for (let board = 0; board < 6; board++) {
    const placed: Point[] = [];
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 24; attempt++) {
        const spot = {
          x: area.minX + rng() * (area.maxX - area.minX),
          y: area.minY + rng() * (area.maxY - area.minY),
        };
        if (
          Math.hypot(spot.x - player.x, spot.y - player.y) > minPlayerDistance &&
          !placed.some((other) => booksClash(spot, other))
        ) {
          placed.push(spot);
          break;
        }
      }
    }
    if (placed.length === count) return placed;
  }
  return null;
};

/** Last resort: the spots furthest from everything, so books never land on top of each other. */
const placeBooksApart = (count: number, player: Point, rng: () => number): Point[] => {
  const placed: Point[] = [];
  for (let i = 0; i < count; i++) {
    let best: Point | null = null;
    let bestRoom = -1;
    for (let attempt = 0; attempt < 40; attempt++) {
      const spot = {
        x: MAP_BOOK_AREA.minX + rng() * (MAP_BOOK_AREA.maxX - MAP_BOOK_AREA.minX),
        y: MAP_BOOK_AREA.minY + rng() * (MAP_BOOK_AREA.maxY - MAP_BOOK_AREA.minY),
      };
      const room = Math.min(
        Math.hypot(spot.x - player.x, spot.y - player.y),
        ...placed.map((other) => Math.hypot(spot.x - other.x, spot.y - other.y)),
      );
      if (room > bestRoom) {
        bestRoom = room;
        best = spot;
      }
    }
    placed.push(best ?? { x: MAP_BOOK_AREA.minX, y: MAP_BOOK_AREA.minY });
  }
  return placed;
};

/**
 * Spawn up to 4 books: 1 correct answer and decoys that read differently from it.
 * Books go where the child can see them when `area` allows it, away from the player.
 */
export const spawnBooks = (
  target: VocabularyItem,
  vocabulary: VocabularyItem[],
  player: Player,
  rng: () => number = Math.random,
  area?: BookArea | null,
): Book[] => {
  const books: Book[] = [
    {
      id: `book-correct`,
      word: target.term,
      translation: target.translation,
      isCorrect: true,
      radius: BOOK_RADIUS,
      x: 0,
      y: 0,
    },
    ...pickDecoys(target, vocabulary, 3, rng).map((decoy, index) => ({
      id: `book-decoy-${index}`,
      word: decoy.term,
      translation: decoy.translation,
      isCorrect: false,
      radius: BOOK_RADIUS,
      x: 0,
      y: 0,
    })),
  ];

  const inView = area ? intersectArea(area) : null;
  const spots =
    (inView && tryPlaceBooks(books.length, player, inView, MIN_BOOK_SPAWN_DISTANCE, rng)) ||
    (inView && tryPlaceBooks(books.length, player, inView, MIN_BOOK_SPAWN_DISTANCE_TIGHT, rng)) ||
    tryPlaceBooks(books.length, player, MAP_BOOK_AREA, MIN_BOOK_SPAWN_DISTANCE, rng) ||
    placeBooksApart(books.length, player, rng);

  return books.map((book, index) => ({ ...book, ...spots[index] }));
};

/** Lays the current word's board out again, for when the screen size becomes known. */
export const replaceBoard = (
  state: EnchantedLibraryState,
  vocabulary: VocabularyItem[],
  { rng = Math.random, bookArea }: EnchantedLibraryConfig = {},
): EnchantedLibraryState => {
  const target = vocabulary.find((word) => word.term === state.targetWord);
  if (!target) return state;
  return { ...state, books: spawnBooks(target, vocabulary, state.player, rng, bookArea?.(state.player)) };
};

/**
 * Spawn a new spirit at a wall. It shows a warning first and sets off later
 * (see launchSpirit). Only spawns if timer is ready and below the ghost limit.
 */
export const spawnSpirit = (
  state: EnchantedLibraryState,
  {
    rng = Math.random,
  }: {
    rng?: () => number;
  } = {},
): EnchantedLibraryState => {
  // Don't spawn if timer not ready
  if (state.spiritSpawnTimer > 0) {
    return state;
  }

  // Don't spawn if max spirits reached
  if (state.spirits.length >= state.maxSpirits) {
    return state;
  }

  // Choose a random wall, not right beside the player
  let spawnX = 0;
  let spawnY = 0;
  for (let attempt = 0; attempt < 6; attempt++) {
    const wall = Math.floor(rng() * 4); // 0=top, 1=right, 2=bottom, 3=left
    switch (wall) {
      case 0: // Top wall
        spawnX = rng() * GAME_WIDTH;
        spawnY = 0;
        break;
      case 1: // Right wall
        spawnX = GAME_WIDTH;
        spawnY = rng() * GAME_HEIGHT;
        break;
      case 2: // Bottom wall
        spawnX = rng() * GAME_WIDTH;
        spawnY = GAME_HEIGHT;
        break;
      default: // Left wall
        spawnX = 0;
        spawnY = rng() * GAME_HEIGHT;
        break;
    }
    if (Math.hypot(spawnX - state.player.x, spawnY - state.player.y) >= SPIRIT_MIN_SPAWN_DISTANCE) break;
  }

  const newSpirit: Spirit = {
    id: `spirit-${Math.round(state.gameTime)}-${state.spirits.length}`,
    x: spawnX,
    y: spawnY,
    radius: SPIRIT_RADIUS,
    velocityX: 0,
    velocityY: 0,
    speed: state.spiritSpeed,
    bounced: false,
    hasHitPlayer: false,
    warnMs: SPIRIT_WARNING_MS,
  };

  // Each ghost is a little faster than the last, capped at max
  const nextSpiritSpeed = Math.min(MAX_SPIRIT_SPEED, state.spiritSpeed * SPIRIT_SPEED_GROWTH);

  return {
    ...state,
    spirits: [...state.spirits, newSpirit],
    spiritSpawnTimer: SPIRIT_SPAWN_RATE_MS,
    spiritSpeed: nextSpiritSpeed,
  };
};

/** Sets a warned ghost off toward the player's path, aimed a little to one side. */
const launchSpirit = (
  spirit: Spirit,
  player: Point,
  playerVelocityX: number,
  playerVelocityY: number,
  rng: () => number,
): Spirit => {
  const predictedX = player.x + playerVelocityX * PREDICT_AHEAD_DISTANCE;
  const predictedY = player.y + playerVelocityY * PREDICT_AHEAD_DISTANCE;
  const toPlayerX = predictedX - spirit.x;
  const toPlayerY = predictedY - spirit.y;
  const toPlayer = Math.hypot(toPlayerX, toPlayerY) || 1;
  const miss = (rng() * 2 - 1) * SPIRIT_AIM_SPREAD;
  const aimX = toPlayerX - (toPlayerY / toPlayer) * miss;
  const aimY = toPlayerY + (toPlayerX / toPlayer) * miss;
  const aim = Math.hypot(aimX, aimY) || 1;
  return {
    ...spirit,
    warnMs: 0,
    velocityX: (aimX / aim) * spirit.speed,
    velocityY: (aimY / aim) * spirit.speed,
  };
};

/**
 * Count down warnings, move launched spirits and remove those that leave the map.
 */
export const updateSpirits = (
  state: EnchantedLibraryState,
  dt: number = FIXED_STEP_MS,
  {
    rng = Math.random,
    playerVelocityX = 0,
    playerVelocityY = 0,
  }: { rng?: () => number; playerVelocityX?: number; playerVelocityY?: number } = {},
): EnchantedLibraryState => {
  const updatedSpirits = state.spirits.map((spirit) => {
    if (spirit.warnMs > 0) {
      const warnMs = Math.max(0, spirit.warnMs - dt);
      return warnMs > 0
        ? { ...spirit, warnMs }
        : launchSpirit(spirit, state.player, playerVelocityX, playerVelocityY, rng);
    }
    return {
      ...spirit,
      x: spirit.x + spirit.velocityX,
      y: spirit.y + spirit.velocityY,
    };
  });

  // Remove spirits that are off-screen
  const onScreenSpirits = updatedSpirits.filter((spirit) => {
    return (
      spirit.x >= -SPIRIT_RADIUS &&
      spirit.x <= GAME_WIDTH + SPIRIT_RADIUS &&
      spirit.y >= -SPIRIT_RADIUS &&
      spirit.y <= GAME_HEIGHT + SPIRIT_RADIUS
    );
  });

  // Speed increase is now handled in spawnSpirit
  return {
    ...state,
    spirits: onScreenSpirits,
  };
};

const wrongHoldMs = (meaning: string) =>
  clamp(1500 + meaning.length * 20, WRONG_HOLD_MIN_MS, WRONG_HOLD_MAX_MS);

/**
 * Check for collisions between player and books.
 * Any pick shows the word with its meaning while the world holds. The next word
 * comes when the hold ends (finishAnswerHold).
 */
export const checkBookCollisions = (
  state: EnchantedLibraryState,
  config: EnchantedLibraryConfig = {},
): EnchantedLibraryState => {
  if (state.pauseMs > 0) return state;

  // The tutorial's scripted walk crosses other books on its way: a demo never gets one wrong.
  const canPick = (book: Book) => book.isCorrect || !(config.isTutorial || config.tutorialMode);
  const picked = state.books.find(
    (book) =>
      canPick(book) &&
      Math.hypot(state.player.x - book.x, state.player.y - book.y) <
        state.player.radius + book.radius,
  );
  if (!picked) return state;

  const correctBook = state.books.find((book) => book.isCorrect) ?? picked;
  const meaning = correctBook.translation;
  const event = { term: state.targetWord, meaning, x: picked.x, y: picked.y };

  if (picked.isCorrect) {
    // Correct book: +10 mana, +1 shield charge, increment progress
    const newProgress = new Map(state.vocabularyProgress);
    newProgress.set(state.targetWord, (newProgress.get(state.targetWord) || 0) + 1);
    return {
      ...state,
      mana: state.mana + MANA_GAIN_CORRECT,
      vocabularyProgress: newProgress,
      player: {
        ...state.player,
        shieldCharges: Math.min(state.player.maxShieldCharges, state.player.shieldCharges + 1),
      },
      pauseMs: CORRECT_HOLD_MS,
      reveal: { kind: "correct", term: state.targetWord, meaning },
      events: [...state.events, { kind: "correct", ...event }],
    };
  }

  // Incorrect book: -5 mana, no shield charge, and this word no longer counts as known
  const alreadyFound = (state.vocabularyProgress.get(state.targetWord) || 0) > 0;
  return {
    ...state,
    mana: Math.max(0, state.mana - MANA_LOSS_INCORRECT),
    missedWords: alreadyFound
      ? state.missedWords
      : new Set(state.missedWords).add(state.targetWord),
    pauseMs: wrongHoldMs(meaning),
    reveal: { kind: "wrong", term: state.targetWord, meaning },
    events: [...state.events, { kind: "wrong", ...event }],
  };
};

/**
 * Select next target word from vocabulary. A missed word goes to the back of the
 * queue: words not yet tried come first, and the same word never comes twice
 * running while another is left.
 */
export const selectNextTargetWord = (
  state: EnchantedLibraryState,
  vocabulary: VocabularyItem[],
  { rng = Math.random, masteryTarget = 2 }: EnchantedLibraryConfig = {},
): string => {
  const targetCount = Math.max(1, masteryTarget);
  const incompleteWords = vocabulary.filter((vocab) => {
    const progress = state.vocabularyProgress.get(vocab.term) || 0;
    return progress < targetCount;
  });

  if (incompleteWords.length === 0) {
    // All words collected, pick random word
    const randomIndex = Math.floor(rng() * vocabulary.length);
    return vocabulary[randomIndex].term;
  }

  const notCurrent = incompleteWords.filter((vocab) => vocab.term !== state.targetWord);
  const fresh = notCurrent.filter((vocab) => !state.missedWords.has(vocab.term));
  const pool = fresh.length > 0 ? fresh : notCurrent.length > 0 ? notCurrent : incompleteWords;
  return pool[Math.floor(rng() * pool.length)].term;
};

/**
 * Check if all vocabulary words have been collected 2x each
 * Returns true if victory condition is met
 */
export const checkVictoryCondition = (
  state: EnchantedLibraryState,
  masteryTarget = 2,
): boolean => {
  // Check if all words have been collected 2x
  for (const [, count] of state.vocabularyProgress.entries()) {
    if (count < masteryTarget) {
      return false;
    }
  }
  return true;
};

/** The hold after a pick has ended: finish the round, or bring the next word and its books. */
export const finishAnswerHold = (
  state: EnchantedLibraryState,
  config: EnchantedLibraryConfig = {},
): EnchantedLibraryState => {
  const cleared: EnchantedLibraryState = { ...state, pauseMs: 0, reveal: null };
  if (checkVictoryCondition(cleared, config.masteryTarget ?? 2)) {
    return { ...cleared, status: "victory" };
  }
  const vocabulary = config.vocabulary ?? [];
  if (vocabulary.length === 0) return cleared;
  const targetWord = selectNextTargetWord(cleared, vocabulary, config);
  return replaceBoard({ ...cleared, targetWord }, vocabulary, config);
};

/**
 * Activate shield if player has charges available
 * Consumes 1 charge and sets shield active for SHIELD_DURATION
 */
export const activateShield = (
  state: EnchantedLibraryState,
): EnchantedLibraryState => {
  // Don't activate if already active
  if (state.shieldActive) {
    return state;
  }

  // Don't activate if no charges
  if (state.player.shieldCharges <= 0) {
    return state;
  }

  // Activate shield
  return {
    ...state,
    shieldActive: true,
    shieldTimer: SHIELD_DURATION,
    player: {
      ...state.player,
      shieldCharges: state.player.shieldCharges - 1,
    },
    events: [...state.events, { kind: "shield" }],
  };
};

/**
 * Check for collisions between player and spirits.
 * A hit costs mana and a short stun. With the shield up the spirit bounces away.
 */
export const checkSpiritCollisions = (
  state: EnchantedLibraryState,
  config: EnchantedLibraryConfig = {},
): EnchantedLibraryState => {
  const isTutorial = config.isTutorial || config.tutorialMode;
  const updatedSpirits = [...state.spirits];
  let newMana = state.mana;
  let stunMs = state.stunMs;
  let stunReason = state.stunReason;
  let events = state.events;

  for (let i = 0; i < updatedSpirits.length; i++) {
    const spirit = updatedSpirits[i];
    if (spirit.warnMs > 0 || spirit.bounced) continue;
    const dx = state.player.x - spirit.x;
    const dy = state.player.y - spirit.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const collisionDistance = state.player.radius + spirit.radius;

    if (distance < collisionDistance) {
      if (state.shieldActive || isTutorial) {
        // Shield active or tutorial mode: bounce the spirit harmlessly
        const normalX = dx / (distance || 1);
        const normalY = dy / (distance || 1);

        const dotProduct =
          spirit.velocityX * normalX + spirit.velocityY * normalY;
        const reflectedVelocityX = spirit.velocityX - 2 * dotProduct * normalX;
        const reflectedVelocityY = spirit.velocityY - 2 * dotProduct * normalY;

        updatedSpirits[i] = {
          ...spirit,
          velocityX: reflectedVelocityX,
          velocityY: reflectedVelocityY,
          bounced: true,
        };
      } else if (!spirit.hasHitPlayer && stunMs <= 0) {
        // Shield inactive: spirit hits player
        newMana = Math.max(0, newMana - MANA_LOSS_SPIRIT_HIT);
        stunMs = HIT_STUN_MS;
        stunReason = "hit";
        events = [...events, { kind: "hit" }];
        updatedSpirits[i] = {
          ...spirit,
          hasHitPlayer: true,
        };
      }
    }
  }

  return {
    ...state,
    spirits: updatedSpirits,
    mana: isTutorial ? INITIAL_MANA : newMana,
    stunMs,
    stunReason,
    events,
  };
};

/**
 * Main game loop - advances game state by one fixed step.
 * Only the clock or finding every word ends a round: mana 0 costs a rest, not the game.
 */
export const advanceEnchantedLibraryTime = (
  state: EnchantedLibraryState,
  input: DirectionalInput,
  dt: number,
  config: EnchantedLibraryConfig = {},
): EnchantedLibraryState => {
  if (state.status !== "playing") {
    return state;
  }

  const isTutorial = config.isTutorial || config.tutorialMode;

  // Update game time and time remaining
  let newState: EnchantedLibraryState = {
    ...state,
    events: NO_EVENTS,
    gameTime: state.gameTime + dt,
    timeRemaining: isTutorial ? 60000 : Math.max(0, state.timeRemaining - dt),
    mana: isTutorial ? INITIAL_MANA : state.mana,
  };

  // Check for game over (disabled during tutorial)
  if (!isTutorial && newState.timeRemaining <= 0) {
    return {
      ...newState,
      status: "gameover",
    };
  }

  // Check shield activation input (cast button)
  if (input.cast) {
    newState = activateShield(newState);
  }

  // The world holds still while the answer is on screen
  if (newState.pauseMs > 0) {
    const pauseMs = Math.max(0, newState.pauseMs - dt);
    return pauseMs > 0 ? { ...newState, pauseMs } : finishAnswerHold(newState, config);
  }

  // Update shield timer
  if (newState.shieldActive) {
    const newShieldTimer = Math.max(0, newState.shieldTimer - dt);
    newState = {
      ...newState,
      shieldTimer: newShieldTimer,
      shieldActive: newShieldTimer > 0,
    };
  }

  // A stunned wizard cannot walk
  const stunMs = Math.max(0, newState.stunMs - dt);
  const stunned = stunMs > 0;

  // Calculate player velocity from input
  const direction = stunned
    ? { dx: 0, dy: 0 }
    : clampMoveVector(
        input.dx ?? Number(input.right) - Number(input.left),
        input.dy ?? Number(input.down) - Number(input.up),
      );
  const velocityX = direction.dx * PLAYER_SPEED;
  const velocityY = direction.dy * PLAYER_SPEED;

  // Update player position
  let newPlayerX = newState.player.x + velocityX;
  let newPlayerY = newState.player.y + velocityY;

  // Clamp to boundaries
  newPlayerX = Math.max(
    newState.player.radius,
    Math.min(GAME_WIDTH - newState.player.radius, newPlayerX),
  );
  newPlayerY = Math.max(
    newState.player.radius,
    Math.min(GAME_HEIGHT - newState.player.radius, newPlayerY),
  );

  newState = {
    ...newState,
    stunMs,
    stunReason: stunned ? newState.stunReason : null,
    player: {
      ...newState.player,
      x: newPlayerX,
      y: newPlayerY,
    },
    spiritSpawnTimer: Math.max(0, newState.spiritSpawnTimer - dt),
  };

  // Check book collisions
  newState = checkBookCollisions(newState, config);

  // Update spirits
  newState = updateSpirits(newState, dt, {
    rng: config.rng,
    playerVelocityX: velocityX,
    playerVelocityY: velocityY,
  });

  // Check spirit collisions (bounces when shield active, mana loss when not)
  newState = checkSpiritCollisions(newState, config);

  // Spawn new spirit if timer ready and below max
  if (
    newState.spiritSpawnTimer === 0 &&
    newState.spirits.length < newState.maxSpirits
  ) {
    newState = spawnSpirit(newState, config);
  }

  // Out of mana: a longer rest, then carry on.
  if (!isTutorial && newState.mana <= 0) {
    newState = {
      ...newState,
      mana: MANA_REFILL,
      stunMs: EXHAUSTED_STUN_MS,
      stunReason: "exhausted",
      events: [...newState.events, { kind: "exhausted" }],
    };
  }

  return newState;
};

/**
 * Turns the real time since the last step into whole game steps, so a 30, 60 or
 * 120 Hz phone walks at the same speed. Keep `leftoverMs` for the next frame.
 */
export function takeFixedSteps(elapsedMs: number): { steps: number; leftoverMs: number } {
  const steps = Math.floor((elapsedMs + 1e-6) / FIXED_STEP_MS);
  return { steps, leftoverMs: Math.max(0, elapsedMs - steps * FIXED_STEP_MS) };
}

/** Words the student knew: found on the first try, so trying every book earns nothing. */
export function countFirstTryWords(state: EnchantedLibraryState): number {
  return Array.from(state.vocabularyProgress.entries()).filter(
    ([word, count]) => count >= 1 && !state.missedWords.has(word),
  ).length;
}

export function countFoundWords(state: EnchantedLibraryState): number {
  return Array.from(state.vocabularyProgress.values()).filter((count) => count >= 1).length;
}

/** Words to go over after the round: everything not found on the first try. */
export function listReviewWords(
  state: EnchantedLibraryState,
  vocabulary: VocabularyItem[],
): { term: string; meaning: string }[] {
  return vocabulary
    .filter((word) => (state.vocabularyProgress.get(word.term) || 0) < 1 || state.missedWords.has(word.term))
    .map(({ term, translation }) => ({ term, meaning: translation }));
}

export function calculateEnchantedLibraryXP(
  state: EnchantedLibraryState,
  correctAnswers: number,
  totalAttempts: number,
): number {
  if (totalAttempts === 0 || correctAnswers === 0) return 0;

  const accuracy = correctAnswers / totalAttempts;
  const baseXP = correctAnswers;

  let bonus = 0;
  if (accuracy === 1) bonus += 2;
  if (state.mana / INITIAL_MANA >= 0.5) bonus += 1;
  if (state.gameTime < 60000) bonus += 1;

  return Math.min(10, baseXP + bonus);
}

// --- Camera and screen layout -------------------------------------------------

export type ViewSize = { width: number; height: number };
export type LibraryInsets = { top: number; bottom: number };
export type LibraryCamera = { x: number; y: number; scale: number };
export type ScreenRect = { left: number; top: number; right: number; bottom: number };

/** Map pixels a phone should show across its short side, so every phone in a class sees the same game. */
const PHONE_VIEW_MAP_PX = 480;
const PHONE_ZOOM_MIN = 0.75;
const PHONE_ZOOM_MAX = 0.9;
/** Longest label width on screen. Labels keep their on-screen size whatever the zoom. */
export const BOOK_LABEL_WIDTH_PX = 150;
export const BOOK_LABEL_HEIGHT_PX = 66;
/** Gap between a book's centre and its label, in map pixels: the label touches its book. */
export const BOOK_LABEL_OFFSET = BOOK_RADIUS + 2;
/** A landscape phone has the stick and Shield at the sides of the map. */
const LANDSCAPE_CONTROLS_CLEAR_PX = 150;

export function libraryZoom(view: ViewSize): number {
  const contain = Math.min(view.width / GAME_WIDTH, view.height / GAME_HEIGHT);
  const phone = clamp(Math.min(view.width, view.height) / PHONE_VIEW_MAP_PX, PHONE_ZOOM_MIN, PHONE_ZOOM_MAX);
  return Math.max(contain, phone);
}

const wholeMapFits = (view: ViewSize, scale: number) =>
  GAME_WIDTH * scale <= view.width + 0.5 && GAME_HEIGHT * scale <= view.height + 0.5;

/**
 * Screen bands the map should stay clear of: the HUD above and the controls below.
 * A portrait phone has them across its whole width. A landscape phone has them at
 * the sides of the map, so only the word at the top needs room.
 */
export function libraryInsets(view: ViewSize, { fullscreen = false }: { fullscreen?: boolean } = {}): LibraryInsets {
  if (wholeMapFits(view, libraryZoom(view))) return { top: 0, bottom: 0 };
  return view.width > view.height
    ? { top: 64, bottom: 16 }
    : { top: 130, bottom: fullscreen ? 256 : 156 };
}

/** Follows the player, stopping at the map's edges. A map that fits its band is centred in it. */
export function computeLibraryCamera(view: ViewSize, player: Point, insets: LibraryInsets): LibraryCamera {
  const scale = libraryZoom(view);
  const mapWidth = GAME_WIDTH * scale;
  const mapHeight = GAME_HEIGHT * scale;
  const bandHeight = view.height - insets.top - insets.bottom;

  const x =
    mapWidth <= view.width
      ? (view.width - mapWidth) / 2
      : clamp(view.width / 2 - player.x * scale, view.width - mapWidth, 0);
  const y =
    mapHeight <= bandHeight
      ? insets.top + (bandHeight - mapHeight) / 2
      : clamp(view.height / 2 - player.y * scale, view.height - mapHeight - insets.bottom, insets.top);

  return { x, y, scale };
}

/** The part of the map a new board can use so every book and label starts on screen, clear of the HUD and controls. */
export function libraryBookArea(view: ViewSize, player: Point, insets: LibraryInsets): BookArea {
  const camera = computeLibraryCamera(view, player, insets);
  const sideControls = view.width > view.height && !wholeMapFits(view, camera.scale);
  const marginX = (BOOK_LABEL_WIDTH_PX / 2 + 6 + (sideControls ? LANDSCAPE_CONTROLS_CLEAR_PX : 0)) / camera.scale;
  return {
    minX: -camera.x / camera.scale + marginX,
    maxX: (view.width - camera.x) / camera.scale - marginX,
    minY: (insets.top - camera.y) / camera.scale + BOOK_RADIUS + 4,
    maxY: (view.height - insets.bottom - camera.y - BOOK_LABEL_HEIGHT_PX) / camera.scale - BOOK_LABEL_OFFSET,
  };
}

export const rectsOverlap = (a: ScreenRect, b: ScreenRect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/**
 * Places chips near the screen point they stand for: inside the screen, off the
 * HUD and controls, and never on top of each other. Returns each chip's top-left.
 */
export function placeEdgeChips<T extends { id: string; x: number; y: number }>(
  points: T[],
  view: ViewSize,
  blocked: ScreenRect[],
  size: { width: number; height: number },
  edge = 4,
): (T & { left: number; top: number })[] {
  const taken = [...blocked];
  const maxLeft = Math.max(edge, view.width - size.width - edge);
  const maxTop = Math.max(edge, view.height - size.height - edge);
  const rectAt = (left: number, top: number): ScreenRect => ({
    left,
    top,
    right: left + size.width,
    bottom: top + size.height,
  });
  const isFree = (left: number, top: number) => !taken.some((rect) => rectsOverlap(rectAt(left, top), rect));

  return [...points]
    .sort((a, b) => a.y - b.y)
    .map((point) => {
      const left = clamp(point.x - size.width / 2, edge, maxLeft);
      const top = clamp(point.y - size.height / 2, edge, maxTop);
      let spot = { left, top };
      search: for (let offset = 0; offset <= view.height + view.width; offset += 6) {
        const candidates = [
          { left, top: top + offset },
          { left, top: top - offset },
          { left: left + offset, top },
          { left: left - offset, top },
        ];
        for (const candidate of candidates) {
          if (candidate.top < edge || candidate.top > maxTop || candidate.left < edge || candidate.left > maxLeft) continue;
          if (isFree(candidate.left, candidate.top)) {
            spot = candidate;
            break search;
          }
        }
      }
      taken.push(rectAt(spot.left, spot.top));
      return { ...point, ...spot };
    });
}
