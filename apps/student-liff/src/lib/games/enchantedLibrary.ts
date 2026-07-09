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
};

export type Book = Entity & {
  word: string;
  translation: string;
  isCorrect: boolean;
};

export type EnchantedLibraryState = {
  status: "playing" | "gameover" | "victory";
  player: Player;
  spirits: Spirit[];
  books: Book[];
  targetWord: string;
  mana: number;
  vocabularyProgress: Map<string, number>;
  totalWords: number;
  shieldActive: boolean;
  shieldTimer: number;
  gameTime: number;
  timeRemaining: number;
  spiritSpawnTimer: number;
  spiritSpeed: number;
  difficulty: Difficulty;
  maxSpirits: number;
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

export type EnchantedLibraryConfig = {
  rng?: () => number;
  vocabulary?: VocabularyItem[];
  difficulty?: Difficulty;
  masteryTarget?: number;
};

export type DirectionalInput = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  cast: boolean;
};

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const PLAYER_RADIUS = 20;
export const SPIRIT_RADIUS = 15;
export const BOOK_RADIUS = 25;
export const INITIAL_MANA = 50;
export const MAX_SHIELD_CHARGES = 3;
export const SHIELD_DURATION = 2000; // ms
export const SPIRIT_SPAWN_RATE_MS = 3000;
export const INITIAL_SPIRIT_SPEED = 5;
export const MAX_SPIRIT_SPEED = 25;
export const PREDICT_AHEAD_DISTANCE = 50; // pixels - tighter targeting
export const PLAYER_SPEED = 3;
export const MANA_GAIN_CORRECT = 10;
export const MANA_LOSS_INCORRECT = 5;
export const MANA_LOSS_SPIRIT_HIT = 10;
export const MIN_BOOK_SPAWN_DISTANCE = 150; // Minimum distance from player
export const GAME_DURATION_MS = 180000; // 3 minutes

export const createEnchantedLibraryState = (
  vocabulary: VocabularyItem[],
  { rng = Math.random, difficulty = "normal" }: EnchantedLibraryConfig = {},
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
  const books = spawnBooks(target, vocabulary, player, rng);

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
    totalWords: vocabulary.length,
    shieldActive: false,
    shieldTimer: 0,
    gameTime: 0,
    timeRemaining: GAME_DURATION_MS,
    spiritSpawnTimer: 0,
    spiritSpeed: initialSpiritSpeed,
    difficulty,
    maxSpirits: difficultyConfig.spiritCount,
  };
};

/**
 * Spawn 4 books: 1 correct answer, 3 decoys
 * Books are positioned randomly but away from player
 */
export const spawnBooks = (
  target: VocabularyItem,
  vocabulary: VocabularyItem[],
  player: Player,
  rng: () => number = Math.random,
): Book[] => {
  const books: Book[] = [];

  // Create correct book
  const correctBook: Book = {
    id: `book-correct`,
    word: target.term,
    translation: target.translation,
    isCorrect: true,
    radius: BOOK_RADIUS,
    x: 0, // Will be positioned
    y: 0,
  };
  books.push(correctBook);

  // Create 3 decoy books
  const decoys = vocabulary
    .filter((v) => v.term !== target.term)
    .sort(() => rng() - 0.5)
    .slice(0, 3);

  decoys.forEach((decoy, index) => {
    const decoyBook: Book = {
      id: `book-decoy-${index}`,
      word: decoy.term,
      translation: decoy.translation,
      isCorrect: false,
      radius: BOOK_RADIUS,
      x: 0,
      y: 0,
    };
    books.push(decoyBook);
  });

  // Position books randomly but away from player
  books.forEach((book) => {
    let validPosition = false;
    let attempts = 0;
    while (!validPosition && attempts < 20) {
      // Random position with padding from edges
      const padding = 50;
      const x = padding + rng() * (GAME_WIDTH - 2 * padding);
      const y = padding + rng() * (GAME_HEIGHT - 2 * padding);

      // Check distance from player
      const dx = x - player.x;
      const dy = y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Check distance from other books
      let tooCloseToBook = false;
      for (const otherBook of books) {
        if (otherBook === book) continue;
        // Books that haven't been placed yet have (0,0), ignore them
        if (otherBook.x === 0 && otherBook.y === 0) continue;

        const bdx = x - otherBook.x;
        const bdy = y - otherBook.y;
        const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
        if (bdist < BOOK_RADIUS * 3) {
          // Ensure some spread
          tooCloseToBook = true;
          break;
        }
      }

      if (dist > MIN_BOOK_SPAWN_DISTANCE && !tooCloseToBook) {
        book.x = x;
        book.y = y;
        validPosition = true;
      }
      attempts++;
    }

    // Fallback if placement fails (unlikely)
    if (!validPosition) {
      // Just place in a random corner not near player
      if (player.x < GAME_WIDTH / 2) book.x = GAME_WIDTH - 100;
      else book.x = 100;
      if (player.y < GAME_HEIGHT / 2) book.y = GAME_HEIGHT - 100;
      else book.y = 100;
    }
  });

  return books;
};

/**
 * Spawn a new spirit that moves toward predicted player position
 * Only spawns if timer is ready and no spirit exists
 */
export const spawnSpirit = (
  state: EnchantedLibraryState,
  {
    rng = Math.random,
    playerVelocityX = 0,
    playerVelocityY = 0,
  }: {
    rng?: () => number;
    playerVelocityX?: number;
    playerVelocityY?: number;
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

  // Calculate predicted player position
  const predictedPlayerX =
    state.player.x + playerVelocityX * PREDICT_AHEAD_DISTANCE;
  const predictedPlayerY =
    state.player.y + playerVelocityY * PREDICT_AHEAD_DISTANCE;

  // Choose random wall to spawn from
  const wall = Math.floor(rng() * 4); // 0=top, 1=right, 2=bottom, 3=left
  let spawnX = 0;
  let spawnY = 0;

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
    case 3: // Left wall
      spawnX = 0;
      spawnY = rng() * GAME_HEIGHT;
      break;
  }

  // Calculate velocity toward predicted position
  const dx = predictedPlayerX - spawnX;
  const dy = predictedPlayerY - spawnY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Normalize to spirit speed
  const velocityX = (dx / distance) * state.spiritSpeed;
  const velocityY = (dy / distance) * state.spiritSpeed;

  const newSpirit: Spirit = {
    id: `spirit-${Date.now()}`,
    x: spawnX,
    y: spawnY,
    radius: SPIRIT_RADIUS,
    velocityX,
    velocityY,
    speed: state.spiritSpeed,
    bounced: false,
    hasHitPlayer: false,
  };

  // Increase spirit speed by 15% for next spawn, capped at max
  const nextSpiritSpeed = Math.min(MAX_SPIRIT_SPEED, state.spiritSpeed * 1.15);

  return {
    ...state,
    spirits: [...state.spirits, newSpirit],
    spiritSpawnTimer: SPIRIT_SPAWN_RATE_MS,
    spiritSpeed: nextSpiritSpeed,
  };
};

/**
 * Update spirit positions and remove spirits that exit the screen
 * Also handles progressive difficulty (speed increase over time)
 */
export const updateSpirits = (
  state: EnchantedLibraryState,
): EnchantedLibraryState => {
  // Update spirit positions
  const updatedSpirits = state.spirits.map((spirit) => ({
    ...spirit,
    x: spirit.x + spirit.velocityX,
    y: spirit.y + spirit.velocityY,
  }));

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

/**
 * Check for collisions between player and books
 * Handle mana changes, shield charge updates, and vocabulary progress
 */
export const checkBookCollisions = (
  state: EnchantedLibraryState,
  vocabulary: VocabularyItem[] = [],
  config: EnchantedLibraryConfig = {},
): EnchantedLibraryState => {
  let newState = state;
  let bookCollected = false;

  for (const book of state.books) {
    const dx = state.player.x - book.x;
    const dy = state.player.y - book.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const collisionDistance = state.player.radius + book.radius;

    if (distance < collisionDistance) {
      bookCollected = true;

      if (book.isCorrect) {
        // Correct book: +10 mana, +1 shield charge, increment progress
        const newMana = Math.max(0, newState.mana + MANA_GAIN_CORRECT);
        const newShieldCharges = Math.min(
          newState.player.maxShieldCharges,
          newState.player.shieldCharges + 1,
        );

        // Update vocabulary progress
        const currentProgress =
          newState.vocabularyProgress.get(state.targetWord) || 0;
        const newProgress = new Map(newState.vocabularyProgress);
        newProgress.set(state.targetWord, currentProgress + 1);

        newState = {
          ...newState,
          mana: newMana,
          vocabularyProgress: newProgress,
          player: {
            ...newState.player,
            shieldCharges: newShieldCharges,
          },
        };

        // Select next target word if vocabulary provided
        if (vocabulary.length > 0) {
          const nextWord = selectNextTargetWord(newState, vocabulary, config);
          newState = {
            ...newState,
            targetWord: nextWord,
          };
        }
      } else {
        // Incorrect book: -5 mana, no shield charge (min 0)
        newState = {
          ...newState,
          mana: Math.max(0, newState.mana - MANA_LOSS_INCORRECT),
        };
        // Target word stays the same (reshuffle)
      }

      break; // Only one book can be collected at a time
    }
  }

  // Spawn new books after collection
  if (bookCollected && vocabulary.length > 0) {
    const targetVocab = vocabulary.find((v) => v.term === newState.targetWord);
    if (targetVocab) {
      const newBooks = spawnBooks(
        targetVocab,
        vocabulary,
        newState.player,
        config.rng,
      );
      newState = {
        ...newState,
        books: newBooks,
      };
    }
  }

  return newState;
};

/**
 * Select next target word from vocabulary
 * Prefers words that haven't been collected 2x yet
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
    // All words collected 2x, pick random word
    const randomIndex = Math.floor(rng() * vocabulary.length);
    return vocabulary[randomIndex].term;
  }

  // Pick random incomplete word
  const randomIndex = Math.floor(rng() * incompleteWords.length);
  return incompleteWords[randomIndex].term;
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
  };
};

/**
 * Check for collisions between player and spirits
 * Handle mana loss (unless shield is active)
 * When shield active, bounces spirits using reflection physics
 */
export const checkSpiritCollisions = (
  state: EnchantedLibraryState,
): EnchantedLibraryState => {
  const updatedSpirits = [...state.spirits];
  let newMana = state.mana;

  for (let i = 0; i < updatedSpirits.length; i++) {
    const spirit = updatedSpirits[i];
    const dx = state.player.x - spirit.x;
    const dy = state.player.y - spirit.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const collisionDistance = state.player.radius + spirit.radius;

    if (distance < collisionDistance) {
      if (state.shieldActive) {
        // Shield is active: bounce the spirit using reflection physics
        // Calculate normal vector (from spirit to player center)
        const normalX = dx / distance;
        const normalY = dy / distance;

        // Calculate reflection: v' = v - 2 * (v · n) * n
        const dotProduct =
          spirit.velocityX * normalX + spirit.velocityY * normalY;
        const reflectedVelocityX = spirit.velocityX - 2 * dotProduct * normalX;
        const reflectedVelocityY = spirit.velocityY - 2 * dotProduct * normalY;

        // Update this spirit with new velocity
        updatedSpirits[i] = {
          ...spirit,
          velocityX: reflectedVelocityX,
          velocityY: reflectedVelocityY,
          bounced: true,
        };
      } else {
        // Shield inactive: spirit hits player
        if (!spirit.hasHitPlayer) {
          newMana = Math.max(0, newMana - MANA_LOSS_SPIRIT_HIT);
          updatedSpirits[i] = {
            ...spirit,
            hasHitPlayer: true,
          };
        }
      }
    }
  }

  return {
    ...state,
    spirits: updatedSpirits,
    mana: newMana,
  };
};

/**
 * Main game loop - advances game state by one time step
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

  // Update game time and time remaining
  let newState: EnchantedLibraryState = {
    ...state,
    gameTime: state.gameTime + dt,
    timeRemaining: Math.max(0, state.timeRemaining - dt),
  };

  // Check for game over conditions
  if (newState.mana <= 0) {
    return {
      ...newState,
      status: "gameover",
    };
  }

  if (newState.timeRemaining <= 0) {
    return {
      ...newState,
      status: "gameover",
    };
  }

  // Check shield activation input (cast button)
  if (input.cast) {
    newState = activateShield(newState);
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

  // Calculate player velocity from input
  let velocityX = 0;
  let velocityY = 0;

  if (input.left) velocityX -= 1;
  if (input.right) velocityX += 1;
  if (input.up) velocityY -= 1;
  if (input.down) velocityY += 1;

  // Normalize diagonal movement
  if (velocityX !== 0 && velocityY !== 0) {
    const magnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    velocityX /= magnitude;
    velocityY /= magnitude;
  }

  velocityX *= PLAYER_SPEED;
  velocityY *= PLAYER_SPEED;

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
    player: {
      ...newState.player,
      x: newPlayerX,
      y: newPlayerY,
    },
    spiritSpawnTimer: Math.max(0, newState.spiritSpawnTimer - dt),
  };

  // Check book collisions
  newState = checkBookCollisions(newState, config.vocabulary || [], config);

  // Update spirits
  newState = updateSpirits(newState);

  // Check spirit collisions (bounces when shield active, mana loss when not)
  newState = checkSpiritCollisions(newState);

  // Spawn new spirit if timer ready and below max
  if (
    newState.spiritSpawnTimer === 0 &&
    newState.spirits.length < newState.maxSpirits
  ) {
    newState = spawnSpirit(newState, {
      ...config,
      playerVelocityX: velocityX,
      playerVelocityY: velocityY,
    });
  }

  // Check victory condition
  if (checkVictoryCondition(newState, config.masteryTarget ?? 2)) {
    newState = {
      ...newState,
      status: "victory",
    };
  }

  return newState;
};

export function calculateEnchantedLibraryXP(
  state: EnchantedLibraryState,
  correctAnswers: number,
  totalAttempts: number,
): number {
  if (totalAttempts === 0) return 0;

  const accuracy = correctAnswers / totalAttempts;
  const baseXP = correctAnswers;

  let bonus = 0;
  if (accuracy === 1) bonus += 2;
  if (state.mana / INITIAL_MANA >= 0.5) bonus += 1;
  if (state.gameTime < 60000) bonus += 1;

  return Math.min(10, baseXP + bonus);
}
