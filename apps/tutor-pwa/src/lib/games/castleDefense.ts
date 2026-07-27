// Game world dimensions (MUST match Wizard vs Zombie)
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const TILE_SIZE = 50;

// Player constants
export const PLAYER_RADIUS = 20;
export const PLAYER_SPEED = 3;

// Enemy constants
export const ENEMY_SOLDIER_RADIUS = 12;
export const ENEMY_SOLDIER_HP = 40;
export const ENEMY_SOLDIER_SPEED = 0.8;

export const ENEMY_TANK_RADIUS = 18;
export const ENEMY_TANK_HP = 120;
export const ENEMY_TANK_SPEED = 0.7;

export const ENEMY_BOSS_RADIUS = 25;
export const ENEMY_BOSS_HP = 360;
export const ENEMY_BOSS_SPEED = 0.6;

// Tower constants
export const TOWER_RANGE = 150;
export const TOWER_FIRE_RATE_MS = 1000;
export const TOWER_DAMAGE = 10;

// Projectile constants
export const PROJECTILE_RADIUS = 5;
export const PROJECTILE_SPEED = 8;

// Word orb constants
export const WORD_RADIUS = 25;

// Base constants
export const BASE_HP = 100;
export const BASE_RADIUS = 40;

// Timing constants (CRITICAL - must match Wizard)
export const GAME_TICK_MS = 50;
export const SPAWN_RATE_MS = 2000;
export const MAX_ENEMIES = 15;

export const WAVE_CONFIGS = [
  { wave: 1, soldiers: 10, tanks: 0, bosses: 0 },
  { wave: 2, soldiers: 8, tanks: 4, bosses: 0 },
  { wave: 3, soldiers: 10, tanks: 5, bosses: 1 },
  { wave: 4, soldiers: 12, tanks: 8, bosses: 1 },
  { wave: 5, soldiers: 15, tanks: 10, bosses: 2 },
  { wave: 6, soldiers: 20, tanks: 12, bosses: 3 },
];

export type MapConfig = {
  wave: number;
  path: Waypoint[];
  towerSlots: TowerSlot[];
  basePosition: { x: number; y: number };
};

// Animation timing
export const ANIMATION_FRAME_MS = 150;

// --- Types ---

// Base entity type (same pattern as Wizard)
export type Entity = {
  id: string;
  x: number;
  y: number;
  radius: number;
};

// Player type
export type Player = Entity & {
  speed: number;
  inventory: string[]; // collected word translations
};

// Enemy types
export type EnemyType = "soldier" | "tank" | "boss";

export type Enemy = Entity & {
  type: EnemyType;
  hp: number;
  maxHp: number;
  speed: number;
  waypointIndex: number;
};

// Tower types
export type Tower = Entity & {
  isActive: boolean;
  targetWord: string;
  range: number;
  lastFired: number;
  damage: number;
};

export type TowerSlot = Entity & {
  targetWord: string;
};

// Projectile type
export type Projectile = Entity & {
  targetId: string;
  speed: number;
  damage: number;
};

// Word orb type
export type Word = Entity & {
  term: string;
  translation: string;
  isCorrect: boolean;
  isCollected: boolean;
  sentenceIndex?: number;
};

// Base type
export type Base = {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
};

// Waypoint for enemy path
export type Waypoint = {
  x: number;
  y: number;
};

// Main game state type
export type SentenceItem = {
  term: string;
  translation: string;
};

export type CastleDefenseState = {
  status: "playing" | "gameover" | "victory";
  difficulty: "easy" | "medium" | "hard";
  player: Player;
  enemies: Enemy[];
  towers: Tower[];
  towerSlots: TowerSlot[];
  projectiles: Projectile[];
  words: Word[];
  base: Base;
  path: Waypoint[];
  score: number;
  wave: number;
  spawnTimer: number;
  gameTime: number;
  targetWord: string;
  currentSentenceThai: string;
  currentSentenceEnglish: string;
  sentenceWords: string[];
  collectedWordIndices: number[];
  sentenceCompleted: boolean;
  enemiesSpawnedThisWave: number;
  enemiesKilledThisWave: number;
  totalEnemiesThisWave: number;
  waveCompleteTimer: number;
  waveMessage: string | null;
  wavesCompleted: number;
  totalEnemiesDefeated: number;
  correctWordCollections: number;
  incorrectWordCollections: number;
  completedSentences: number;
  maxSentences: number;
  durationMs: number;
  usedSentenceTerms: string[];
  grassMap: number[][];
};

// Input state type (matches Wizard)
export type InputState = {
  dx: number;
  dy: number;
  drop?: boolean;
};

// Road tile info type
export type RoadInfo = {
  type: "EW" | "NS" | "CORNER";
  rotation: number;
};

// --- Factory Functions ---

// Helper to generate unique IDs
const generateId = (): string =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const pickRandomSentence = (
  vocabulary: SentenceItem[],
  currentTerm?: string,
  usedTerms: string[] = [],
  random: () => number = Math.random,
): SentenceItem => {
  if (vocabulary.length === 0) {
    return { term: "", translation: "" };
  }
  const used = new Set(usedTerms.filter(Boolean));
  let pool = vocabulary.filter((item) => !used.has(item.term));
  if (pool.length === 0) {
    pool = vocabulary;
  }
  if (currentTerm && vocabulary.length > 1) {
    const filtered = pool.filter((item) => item.term !== currentTerm);
    if (filtered.length > 0) {
      pool = filtered;
    }
  }
  const index = Math.floor(random() * pool.length);
  return pool[index] ?? pool[0];
};

// Default path from top-left to bottom-right (U-shape)
export const DEFAULT_PATH: Waypoint[] = [
  { x: 75, y: 75 },
  { x: 75, y: 525 },
  { x: 725, y: 525 },
  { x: 725, y: 75 },
];

// Default tower slots
const DEFAULT_TOWER_SLOTS: TowerSlot[] = [
  { id: "slot-1", x: 175, y: 425, radius: 30, targetWord: "" },
  { id: "slot-2", x: 325, y: 425, radius: 30, targetWord: "" },
  { id: "slot-3", x: 475, y: 425, radius: 30, targetWord: "" },
  { id: "slot-4", x: 625, y: 425, radius: 30, targetWord: "" },
  { id: "slot-5", x: 175, y: 175, radius: 30, targetWord: "" },
  { id: "slot-6", x: 625, y: 175, radius: 30, targetWord: "" },
];

export const MAP_CONFIGS: MapConfig[] = [
  {
    wave: 1,
    path: [
      { x: 75, y: 75 },
      { x: 75, y: 525 },
      { x: 725, y: 525 },
      { x: 725, y: 75 },
    ],
    towerSlots: [
      { id: "w1-slot-1", x: 175, y: 425, radius: 30, targetWord: "" },
      { id: "w1-slot-2", x: 325, y: 425, radius: 30, targetWord: "" },
      { id: "w1-slot-3", x: 475, y: 425, radius: 30, targetWord: "" },
      { id: "w1-slot-4", x: 625, y: 425, radius: 30, targetWord: "" },
      { id: "w1-slot-5", x: 175, y: 175, radius: 30, targetWord: "" },
    ],
    basePosition: { x: 725, y: 75 },
  },
  {
    wave: 2,
    path: [
      { x: 75, y: 275 },
      { x: 525, y: 275 },
      { x: 525, y: 75 },
      { x: 725, y: 75 },
      { x: 725, y: 525 },
    ],
    towerSlots: [
      { id: "w2-slot-1", x: 175, y: 175, radius: 30, targetWord: "" },
      { id: "w2-slot-2", x: 375, y: 175, radius: 30, targetWord: "" },
      { id: "w2-slot-3", x: 625, y: 175, radius: 30, targetWord: "" },
      { id: "w2-slot-4", x: 375, y: 425, radius: 30, targetWord: "" },
      { id: "w2-slot-5", x: 625, y: 425, radius: 30, targetWord: "" },
    ],
    basePosition: { x: 725, y: 525 },
  },
  {
    wave: 3,
    path: [
      { x: 75, y: 75 },
      { x: 725, y: 75 },
      { x: 725, y: 275 },
      { x: 175, y: 275 },
      { x: 175, y: 525 },
      { x: 725, y: 525 },
    ],
    towerSlots: [
      { id: "w3-slot-1", x: 325, y: 175, radius: 30, targetWord: "" },
      { id: "w3-slot-2", x: 575, y: 175, radius: 30, targetWord: "" },
      { id: "w3-slot-3", x: 325, y: 375, radius: 30, targetWord: "" },
      { id: "w3-slot-4", x: 575, y: 375, radius: 30, targetWord: "" },
      { id: "w3-slot-5", x: 325, y: 475, radius: 30, targetWord: "" },
    ],
    basePosition: { x: 725, y: 525 },
  },
  {
    wave: 4,
    path: [
      { x: 725, y: 75 },
      { x: 725, y: 525 },
      { x: 275, y: 525 },
      { x: 275, y: 275 },
      { x: 525, y: 275 },
      { x: 525, y: 375 },
    ],
    towerSlots: [
      { id: "w4-slot-1", x: 625, y: 175, radius: 30, targetWord: "" },
      { id: "w4-slot-2", x: 425, y: 175, radius: 30, targetWord: "" },
      { id: "w4-slot-3", x: 175, y: 375, radius: 30, targetWord: "" },
      { id: "w4-slot-4", x: 375, y: 475, radius: 30, targetWord: "" },
      { id: "w4-slot-5", x: 575, y: 475, radius: 30, targetWord: "" },
    ],
    basePosition: { x: 525, y: 375 },
  },
  {
    wave: 5,
    path: [
      { x: 75, y: 525 },
      { x: 75, y: 175 },
      { x: 375, y: 175 },
      { x: 375, y: 525 },
      { x: 725, y: 525 },
    ],
    towerSlots: [
      { id: "w5-slot-1", x: 175, y: 375, radius: 30, targetWord: "" },
      { id: "w5-slot-2", x: 325, y: 275, radius: 30, targetWord: "" },
      { id: "w5-slot-3", x: 475, y: 375, radius: 30, targetWord: "" },
      { id: "w5-slot-4", x: 625, y: 275, radius: 30, targetWord: "" },
      { id: "w5-slot-5", x: 525, y: 475, radius: 30, targetWord: "" },
    ],
    basePosition: { x: 725, y: 525 },
  },
  {
    wave: 6,
    path: [
      { x: 75, y: 375 },
      { x: 725, y: 375 },
    ],
    towerSlots: [
      { id: "w6-slot-1", x: 325, y: 275, radius: 30, targetWord: "" },
      { id: "w6-slot-2", x: 325, y: 475, radius: 30, targetWord: "" },
      { id: "w6-slot-3", x: 525, y: 275, radius: 30, targetWord: "" },
      { id: "w6-slot-4", x: 525, y: 475, radius: 30, targetWord: "" },
      { id: "w6-slot-5", x: 425, y: 325, radius: 30, targetWord: "" },
    ],
    basePosition: { x: 725, y: 375 },
  },
];

/**
 * Returns road tile information for a given grid coordinate.
 */
export function getRoadTileInfo(
  gridX: number,
  gridY: number,
  path: Waypoint[] = DEFAULT_PATH,
): RoadInfo | null {
  const worldX = gridX * TILE_SIZE + TILE_SIZE / 2;
  const worldY = gridY * TILE_SIZE + TILE_SIZE / 2;

  // 1. Identify if this point is on any path segment
  let segmentIndex = -1;
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];

    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    if (worldX >= minX && worldX <= maxX && worldY >= minY && worldY <= maxY) {
      segmentIndex = i;
    }
  }

  if (segmentIndex === -1) return null;

  // 2. Check if it's a corner
  const cornerIndex = path.findIndex((p) => p.x === worldX && p.y === worldY);

  if (cornerIndex !== -1 && cornerIndex > 0 && cornerIndex < path.length - 1) {
    const prev = path[cornerIndex - 1];
    const curr = path[cornerIndex];
    const next = path[cornerIndex + 1];

    const dx1 = Math.sign(prev.x - curr.x);
    const dy1 = Math.sign(prev.y - curr.y);
    const dx2 = Math.sign(next.x - curr.x);
    const dy2 = Math.sign(next.y - curr.y);

    const dirs = new Set([`${dx1},${dy1}`, `${dx2},${dy2}`]);

    if (dirs.has("-1,0") && dirs.has("0,1"))
      return { type: "CORNER", rotation: 0 };
    if (dirs.has("0,-1") && dirs.has("-1,0"))
      return { type: "CORNER", rotation: 90 };
    if (dirs.has("1,0") && dirs.has("0,-1"))
      return { type: "CORNER", rotation: 180 };
    if (dirs.has("0,1") && dirs.has("1,0"))
      return { type: "CORNER", rotation: 270 };

    return { type: "CORNER", rotation: 0 };
  }

  // 3. If not corner, it's straight
  const p1 = path[segmentIndex];
  const p2 = path[segmentIndex + 1];

  if (p1.x === p2.x) return { type: "NS", rotation: 0 };
  return { type: "EW", rotation: 0 };
}

// Create initial game state
export function createCastleDefenseState(
  vocabulary: SentenceItem[],
  options: { difficulty: "easy" | "medium" | "hard"; maxSentences?: number; durationMs?: number } = {
    difficulty: "medium",
  },
): CastleDefenseState {
  // Pick a random target word
  const targetItem =
    vocabulary.length > 0
      ? vocabulary[Math.floor(Math.random() * vocabulary.length)]
      : { term: "default", translation: "default" };

  const firstSentence = pickRandomSentence(vocabulary);
  const sentenceWords = parseSentenceWords(firstSentence.term);
  const maxSentences = Math.max(1, Math.min(options.maxSentences ?? 10, vocabulary.length || 1));

  const mapConfig = MAP_CONFIGS[0] || {
    path: DEFAULT_PATH,
    towerSlots: DEFAULT_TOWER_SLOTS,
    basePosition: { x: 725, y: 75 },
  };

  // Difficulty modifiers
  let baseHp = BASE_HP;
  if (options.difficulty === "easy") baseHp = 150;
  if (options.difficulty === "hard") baseHp = 80;

  const towerSlots = mapConfig.towerSlots.map((slot, i) => ({
    ...slot,
    targetWord: vocabulary[i % vocabulary.length]?.translation || "word",
  }));

  return {
    status: "playing",
    difficulty: options.difficulty,
    player: {
      id: "player",
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 100,
      radius: PLAYER_RADIUS,
      speed: PLAYER_SPEED,
      inventory: [],
    },
    enemies: [],
    towers: [],
    towerSlots,
    projectiles: [],
    words: spawnSentenceWords(firstSentence.term),
    base: {
      x: mapConfig.basePosition.x,
      y: mapConfig.basePosition.y,
      hp: baseHp,
      maxHp: baseHp,
      radius: BASE_RADIUS,
    },
    path: mapConfig.path,
    score: 0,
    wave: 1,
    spawnTimer: 0,
    gameTime: 0,
    targetWord: targetItem.translation,
    currentSentenceThai: firstSentence.translation,
    currentSentenceEnglish: firstSentence.term,
    sentenceWords,
    collectedWordIndices: [],
    sentenceCompleted: false,
    enemiesSpawnedThisWave: 0,
    enemiesKilledThisWave: 0,
    totalEnemiesThisWave:
      WAVE_CONFIGS[0].soldiers + WAVE_CONFIGS[0].tanks + WAVE_CONFIGS[0].bosses,
    waveCompleteTimer: 0,
    waveMessage: null,
    wavesCompleted: 0,
    totalEnemiesDefeated: 0,
    correctWordCollections: 0,
    incorrectWordCollections: 0,
    completedSentences: 0,
    maxSentences,
    durationMs: options.durationMs ?? 60_000,
    usedSentenceTerms: firstSentence.term ? [firstSentence.term] : [],
    grassMap: Array.from({ length: 12 }, () =>
      Array.from({ length: 16 }, () => Math.floor(Math.random() * 4)),
    ),
  };
}

// --- Game Logic Functions ---

// Move player based on input (same pattern as Wizard)
export function movePlayer(
  player: Player,
  input: InputState,
  dt: number,
): Player {
  // Normalize diagonal movement (prevent faster diagonal speed)
  let moveX = input.dx;
  let moveY = input.dy;
  if (moveX !== 0 && moveY !== 0) {
    const invSqrt2 = 0.70710678118; // 1 / sqrt(2)
    moveX *= invSqrt2;
    moveY *= invSqrt2;
  }

  // Calculate speed factor (normalize to 60fps equivalent)
  const speedFactor = dt / 16.6;

  // Calculate new position
  let newX = player.x + moveX * player.speed * speedFactor;
  let newY = player.y + moveY * player.speed * speedFactor;

  // Clamp to game bounds
  newX = Math.max(player.radius, Math.min(GAME_WIDTH - player.radius, newX));
  newY = Math.max(player.radius, Math.min(GAME_HEIGHT - player.radius, newY));

  return {
    ...player,
    x: newX,
    y: newY,
  };
}

// Create a new enemy at spawn point
export function spawnEnemy(
  path: Waypoint[],
  wave: number,
  random: () => number = Math.random,
  waveConfig?: { soldiers: number; tanks: number; bosses: number },
  enemiesSpawnedThisWave: number = 0,
): Enemy {
  let type: EnemyType;
  let hp: number;
  let speed: number;
  let radius: number;

  if (waveConfig) {
    const bossStart = waveConfig.soldiers + waveConfig.tanks;
    if (enemiesSpawnedThisWave >= bossStart) {
      type = "boss";
      hp = ENEMY_BOSS_HP;
      speed = ENEMY_BOSS_SPEED;
      radius = ENEMY_BOSS_RADIUS;
    } else if (enemiesSpawnedThisWave >= waveConfig.soldiers) {
      type = "tank";
      hp = ENEMY_TANK_HP;
      speed = ENEMY_TANK_SPEED;
      radius = ENEMY_TANK_RADIUS;
    } else {
      type = "soldier";
      hp = ENEMY_SOLDIER_HP;
      speed = ENEMY_SOLDIER_SPEED;
      radius = ENEMY_SOLDIER_RADIUS;
    }
  } else {
    // Determine enemy type based on wave and randomness (legacy behavior)
    const roll = random();
    if (wave >= 5 && roll < 0.1) {
      // Boss: 10% chance after wave 5
      type = "boss";
      hp = ENEMY_BOSS_HP;
      speed = ENEMY_BOSS_SPEED;
      radius = ENEMY_BOSS_RADIUS;
    } else if (wave >= 2 && roll < 0.3) {
      // Tank: 30% chance after wave 2
      type = "tank";
      hp = ENEMY_TANK_HP;
      speed = ENEMY_TANK_SPEED;
      radius = ENEMY_TANK_RADIUS;
    } else {
      // Soldier: default
      type = "soldier";
      hp = ENEMY_SOLDIER_HP;
      speed = ENEMY_SOLDIER_SPEED;
      radius = ENEMY_SOLDIER_RADIUS;
    }
  }

  // Spawn at first waypoint (off-screen)
  const spawnPoint = path[0] || { x: 0, y: GAME_HEIGHT / 2 };

  return {
    id: generateId(),
    x: spawnPoint.x,
    y: spawnPoint.y,
    radius,
    type,
    hp,
    maxHp: hp,
    speed,
    waypointIndex: 0,
  };
}

// Move enemy along path toward next waypoint
export function moveEnemy(enemy: Enemy, path: Waypoint[], dt: number): Enemy {
  // If no path or at end, don't move
  if (path.length === 0 || enemy.waypointIndex >= path.length) {
    return enemy;
  }

  const target = path[enemy.waypointIndex];
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Check if reached waypoint
  if (distance < 5) {
    // Move to next waypoint
    return {
      ...enemy,
      waypointIndex: enemy.waypointIndex + 1,
    };
  }

  // Calculate speed factor
  const speedFactor = dt / 16.6;

  // Normalize and apply movement
  const moveX = (dx / distance) * enemy.speed * speedFactor;
  const moveY = (dy / distance) * enemy.speed * speedFactor;

  return {
    ...enemy,
    x: enemy.x + moveX,
    y: enemy.y + moveY,
  };
}

// Check if two circles collide
export function circlesCollide(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
): boolean {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < r1 + r2;
}

// Check if point is within range of another point
export function inRange(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  range: number,
): boolean {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy < range * range;
}

// Parse an English sentence into individual words
export function parseSentenceWords(sentence: string): string[] {
  return sentence
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ""))
    .filter((word) => word.length > 0);
}

export function calculateCastleDefenseXP(state: CastleDefenseState): number {
  const totalAttempts = state.correctWordCollections + state.incorrectWordCollections;
  if (totalAttempts === 0) return 0;

  const accuracy = state.correctWordCollections / totalAttempts;
  const baseXP = Math.min(5, state.correctWordCollections);

  let bonus = 0;
  if (accuracy === 1 && state.correctWordCollections > 0) bonus += 2; // Perfect accuracy bonus
  if (state.base.hp / state.base.maxHp >= 0.5) bonus += 1; // Survival bonus
  if (state.gameTime < 120000) bonus += 1; // Speed bonus (under 2 min)
  if (state.wavesCompleted >= 3) bonus += 1; // Wave progression bonus

  return Math.min(10, baseXP + bonus);
}

// Validate sequential word collection based on sentence order
export function validateWordCollection(
  collectedIndices: number[],
  nextWordIndex: number,
  allWords: string[],
): boolean {
  if (nextWordIndex < 0 || nextWordIndex >= allWords.length) {
    return false;
  }

  if (collectedIndices.includes(nextWordIndex)) {
    return false;
  }

  const expectedIndex = collectedIndices.length;
  return nextWordIndex === expectedIndex;
}

// Check if sentence is complete based on collected indices
export function isSentenceComplete(
  collectedIndices: number[],
  totalWords: number,
): boolean {
  if (totalWords <= 0) {
    return false;
  }
  return collectedIndices.length >= totalWords;
}

// Spawn word orbs for a full sentence
export function spawnSentenceWords(
  sentence: string,
  random: () => number = Math.random,
): Word[] {
  const sentenceWords = parseSentenceWords(sentence);
  const count = Math.max(sentenceWords.length, 1);
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const minX = GAME_WIDTH * 0.16;
  const maxX = GAME_WIDTH * 0.84;
  const minY = GAME_HEIGHT * 0.22;
  const maxY = GAME_HEIGHT * 0.72;
  const cellW = (maxX - minX) / columns;
  const cellH = (maxY - minY) / rows;

  return sentenceWords.map((word, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const radius = Math.max(WORD_RADIUS, Math.min(42, 18 + word.length * 4));
    const jitterX = (random() - 0.5) * Math.max(0, cellW - radius * 2) * 0.45;
    const jitterY = (random() - 0.5) * Math.max(0, cellH - radius * 2) * 0.45;
    const x = minX + cellW * (col + 0.5) + jitterX;
    const y = minY + cellH * (row + 0.5) + jitterY;

    return {
      id: generateId(),
      x: Math.max(radius, Math.min(GAME_WIDTH - radius, x)),
      y: Math.max(radius, Math.min(GAME_HEIGHT - radius, y)),
      radius,
      term: word,
      translation: word,
      isCorrect: true,
      isCollected: false,
      sentenceIndex: index,
    };
  });
}

// Check if player collects any words
export function collectWords(
  player: Player,
  words: Word[],
  sentenceWords: string[],
  collectedWordIndices: number[],
): {
  player: Player;
  words: Word[];
  collectedWord: Word | null;
  collectedWordIndices: number[];
  invalidCollection: boolean;
} {
  let collectedWord: Word | null = null;
  let invalidCollection = false;
  const newInventory = [...player.inventory];
  let updatedCollectedIndices = [...collectedWordIndices];

  const newWords = words.map((word) => {
    if (word.isCollected) return word;

    if (
      circlesCollide(
        player.x,
        player.y,
        player.radius,
        word.x,
        word.y,
        word.radius,
      )
    ) {
      collectedWord = word;
      const wordIndex = word.sentenceIndex ?? -1;
      if (
        validateWordCollection(
          updatedCollectedIndices,
          wordIndex,
          sentenceWords,
        )
      ) {
        updatedCollectedIndices = [...updatedCollectedIndices, wordIndex];
        // Add translation to inventory (legacy tower activation)
        newInventory.push(word.translation);
        return { ...word, isCollected: true };
      }
      invalidCollection = true;
      return word;
    }

    return word;
  });

  return {
    player: { ...player, inventory: newInventory },
    words: newWords,
    collectedWord,
    collectedWordIndices: updatedCollectedIndices,
    invalidCollection,
  };
}

// Reset sentence progress after incorrect word collection
export function resetSentenceProgress(
  state: CastleDefenseState,
): CastleDefenseState {
  return {
    ...state,
    player: {
      ...state.player,
      inventory: [],
    },
    collectedWordIndices: [],
    sentenceCompleted: false,
    words: spawnSentenceWords(state.currentSentenceEnglish),
  };
}

// Determine if player can build a tower (sentence complete + near an empty slot)
export function canBuildTower(state: CastleDefenseState): boolean {
  if (!state.sentenceCompleted) {
    return false;
  }

  return state.towerSlots.some((slot) => {
    const hasTower = state.towers.some(
      (tower) => tower.id === `tower-${slot.id}`,
    );
    if (hasTower) return false;
    return inRange(state.player.x, state.player.y, slot.x, slot.y, 50);
  });
}

// Build a tower at a specific slot and consume the completed sentence
export function buildTowerAtSlot(
  state: CastleDefenseState,
  slotId: string,
  vocabulary: SentenceItem[],
): CastleDefenseState {
  const slot = state.towerSlots.find((candidate) => candidate.id === slotId);
  if (!slot) {
    return state;
  }

  if (state.towers.some((tower) => tower.id === `tower-${slot.id}`)) {
    return state;
  }

  const nextSentence = pickRandomSentence(
    vocabulary,
    state.currentSentenceEnglish,
    state.usedSentenceTerms,
  );
  const nextSentenceWords = parseSentenceWords(nextSentence.term);
  const nextWords = spawnSentenceWords(nextSentence.term);

  const newTower: Tower = {
    id: `tower-${slot.id}`,
    x: slot.x,
    y: slot.y,
    radius: 30,
    isActive: true,
    targetWord: slot.targetWord,
    range: TOWER_RANGE,
    lastFired: 0,
    damage: TOWER_DAMAGE,
  };

  return {
    ...state,
    player: {
      ...state.player,
      inventory: [],
    },
    currentSentenceThai: nextSentence.translation,
    currentSentenceEnglish: nextSentence.term,
    sentenceWords: nextSentenceWords,
    collectedWordIndices: [],
    sentenceCompleted: false,
    words: nextWords,
    towers: [...state.towers, newTower],
    usedSentenceTerms: nextSentence.term
      ? [...state.usedSentenceTerms, nextSentence.term]
      : state.usedSentenceTerms,
  };
}

export function loadMapForWave(wave: number): MapConfig {
  return MAP_CONFIGS.find((config) => config.wave === wave) || MAP_CONFIGS[0];
}

// Check if the current wave is complete
export function isWaveComplete(state: CastleDefenseState): boolean {
  return (
    state.enemiesSpawnedThisWave >= state.totalEnemiesThisWave &&
    state.enemies.length === 0
  );
}

// Check if player can activate a tower slot
export function checkTowerActivation(
  player: Player,
  towerSlots: TowerSlot[],
  towers: Tower[],
): { player: Player; towers: Tower[]; activated: boolean } {
  // Check if player is near any inactive tower slot
  for (const slot of towerSlots) {
    // Skip if tower already exists at this slot
    if (towers.some((t) => t.id === `tower-${slot.id}`)) {
      continue;
    }

    // Check if player is close enough
    if (!inRange(player.x, player.y, slot.x, slot.y, 50)) {
      continue;
    }

    // Check if player has the required word in inventory
    const wordIndex = player.inventory.indexOf(slot.targetWord);
    if (wordIndex === -1) {
      continue;
    }

    // Activate tower: remove word from inventory and create tower
    const newInventory = [...player.inventory];
    newInventory.splice(wordIndex, 1);

    const newTower: Tower = {
      id: `tower-${slot.id}`,
      x: slot.x,
      y: slot.y,
      radius: 30,
      isActive: true,
      targetWord: slot.targetWord,
      range: TOWER_RANGE,
      lastFired: 0,
      damage: TOWER_DAMAGE,
    };

    return {
      player: { ...player, inventory: newInventory },
      towers: [...towers, newTower],
      activated: true,
    };
  }

  return { player, towers, activated: false };
}

// Update towers and create projectiles
export function updateTowers(
  towers: Tower[],
  enemies: Enemy[],
  projectiles: Projectile[],
  gameTime: number,
): { towers: Tower[]; projectiles: Projectile[] } {
  const newProjectiles = [...projectiles];
  const newTowers = towers.map((tower) => {
    if (!tower.isActive) return tower;

    // Check cooldown
    if (gameTime - tower.lastFired < TOWER_FIRE_RATE_MS) {
      return tower;
    }

    // Find closest enemy in range
    let closestEnemy: Enemy | null = null;
    let closestDistance = Infinity;

    for (const enemy of enemies) {
      if (inRange(tower.x, tower.y, enemy.x, enemy.y, tower.range)) {
        const dx = tower.x - enemy.x;
        const dy = tower.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestEnemy = enemy;
        }
      }
    }

    // Fire at closest enemy
    if (closestEnemy) {
      newProjectiles.push({
        id: generateId(),
        x: tower.x,
        y: tower.y,
        radius: PROJECTILE_RADIUS,
        targetId: closestEnemy.id,
        speed: PROJECTILE_SPEED,
        damage: tower.damage,
      });
      return { ...tower, lastFired: gameTime };
    }

    return tower;
  });

  return { towers: newTowers, projectiles: newProjectiles };
}

// Move projectiles and check for hits
export function updateProjectiles(
  projectiles: Projectile[],
  enemies: Enemy[],
  dt: number,
): { projectiles: Projectile[]; enemies: Enemy[]; hits: string[] } {
  const speedFactor = dt / 16.6;
  const hits: string[] = [];
  let updatedEnemies = [...enemies];

  const updatedProjectiles = projectiles
    .map((projectile) => {
      // Find target enemy
      const target = updatedEnemies.find((e) => e.id === projectile.targetId);
      if (!target) {
        // Target died, remove projectile
        return null;
      }

      // Move toward target
      const dx = target.x - projectile.x;
      const dy = target.y - projectile.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check collision
      if (distance < projectile.radius + target.radius) {
        // Hit! Damage enemy
        hits.push(target.id);
        updatedEnemies = updatedEnemies.map((e) => {
          if (e.id === target.id) {
            return { ...e, hp: e.hp - projectile.damage };
          }
          return e;
        });
        return null; // Remove projectile
      }

      // Move projectile
      const moveX = (dx / distance) * projectile.speed * speedFactor;
      const moveY = (dy / distance) * projectile.speed * speedFactor;

      return {
        ...projectile,
        x: projectile.x + moveX,
        y: projectile.y + moveY,
      };
    })
    .filter((p): p is Projectile => p !== null);

  // Remove dead enemies
  updatedEnemies = updatedEnemies.filter((e) => e.hp > 0);

  return { projectiles: updatedProjectiles, enemies: updatedEnemies, hits };
}

// Check if enemies reached the base
export function checkBaseDamage(
  enemies: Enemy[],
  base: Base,
  path: Waypoint[],
): { enemies: Enemy[]; base: Base; damage: number } {
  let totalDamage = 0;

  // Enemies that reached end of path damage the base
  const remainingEnemies = enemies.filter((enemy) => {
    // Check if enemy reached end of path
    if (enemy.waypointIndex >= path.length) {
      // Damage based on enemy type
      const damage =
        enemy.type === "boss" ? 30 : enemy.type === "tank" ? 15 : 10;
      totalDamage += damage;
      return false; // Remove enemy
    }
    return true;
  });

  return {
    enemies: remainingEnemies,
    base: { ...base, hp: Math.max(0, base.hp - totalDamage) },
    damage: totalDamage,
  };
}

// Spawn words on the map
export function spawnWords(
  vocabulary: SentenceItem[],
  targetWord: string,
  random: () => number = Math.random,
): Word[] {
  if (vocabulary.length === 0) return [];

  const words: Word[] = [];
  const correctItem = vocabulary.find((v) => v.translation === targetWord);

  // Spawn 4 words: 1 correct + 3 distractors
  if (correctItem) {
    // Correct word
    words.push({
      id: generateId(),
      x: 100 + random() * (GAME_WIDTH - 200),
      y: 100 + random() * (GAME_HEIGHT - 200),
      radius: WORD_RADIUS,
      term: correctItem.term,
      translation: correctItem.translation,
      isCorrect: true,
      isCollected: false,
    });
  }

  // Distractors
  const distractors = vocabulary.filter((v) => v.translation !== targetWord);
  for (let i = 0; i < 3 && i < distractors.length; i++) {
    const distractor = distractors[Math.floor(random() * distractors.length)];
    words.push({
      id: generateId(),
      x: 100 + random() * (GAME_WIDTH - 200),
      y: 100 + random() * (GAME_HEIGHT - 200),
      radius: WORD_RADIUS,
      term: distractor.term,
      translation: distractor.translation,
      isCorrect: false,
      isCollected: false,
    });
  }

  return words;
}

// Main game tick function (SAME PATTERN AS WIZARD VS ZOMBIE)
export function advanceCastleDefenseTime(
  state: CastleDefenseState,
  dt: number,
  input: InputState,
  vocabulary: SentenceItem[],
): CastleDefenseState {
  if (state.status !== "playing") {
    return state;
  }

  // 1. Update game time
  const gameTime = state.gameTime + dt;

  // 2. Move player
  let player = movePlayer(state.player, input, dt);

  let currentSentenceEnglish = state.currentSentenceEnglish;
  let currentSentenceThai = state.currentSentenceThai;
  let sentenceWords = state.sentenceWords;

  // 3. Collect words
  let words = state.words;
  const collection = collectWords(
    player,
    words,
    sentenceWords,
    state.collectedWordIndices,
  );
  player = collection.player;
  words = collection.words;
  let collectedWordIndices = collection.collectedWordIndices;
  let sentenceCompleted = state.sentenceCompleted;
  let correctWordCollections = state.correctWordCollections;
  let incorrectWordCollections = state.incorrectWordCollections;
  let completedSentences = state.completedSentences;

  if (collection.collectedWord) {
    if (collection.invalidCollection) {
      incorrectWordCollections += 1;
    } else {
      correctWordCollections += 1;
    }
  }

  if (collection.invalidCollection) {
    const resetState = resetSentenceProgress({
      ...state,
      player,
      words,
      collectedWordIndices,
    });
    player = resetState.player;
    words = resetState.words;
    collectedWordIndices = resetState.collectedWordIndices;
    sentenceCompleted = resetState.sentenceCompleted;
  }

  // 4. Check tower activation (sentence-complete flow)
  let towers = state.towers;
  if (
    canBuildTower({
      ...state,
      player,
      towers,
      words,
      collectedWordIndices,
      sentenceCompleted,
    })
  ) {
    const buildSlot = state.towerSlots.find((slot) => {
      const hasTower = towers.some((tower) => tower.id === `tower-${slot.id}`);
      if (hasTower) return false;
      return inRange(player.x, player.y, slot.x, slot.y, 50);
    });

    if (buildSlot) {
      const buildState = buildTowerAtSlot(
        {
          ...state,
          player,
          towers,
          words,
          collectedWordIndices,
          sentenceCompleted,
        },
        buildSlot.id,
        vocabulary,
      );

      player = buildState.player;
      towers = buildState.towers;
      words = buildState.words;
      collectedWordIndices = buildState.collectedWordIndices;
      sentenceCompleted = buildState.sentenceCompleted;
      currentSentenceEnglish = buildState.currentSentenceEnglish;
      currentSentenceThai = buildState.currentSentenceThai;
      sentenceWords = buildState.sentenceWords;
      completedSentences = buildState.completedSentences;
    }
  }

  // 5. Move enemies
  let enemies = state.enemies.map((e) => moveEnemy(e, state.path, dt));

  // 6. Check base damage from enemies reaching end
  const enemiesCountBeforeBase = enemies.length;
  const baseDamage = checkBaseDamage(enemies, state.base, state.path);
  enemies = baseDamage.enemies;
  const base = baseDamage.base;
  const enemiesReachedBase = enemiesCountBeforeBase - enemies.length;

  // 7. Update towers (shoot at enemies)
  let projectiles = state.projectiles;
  const towerUpdate = updateTowers(towers, enemies, projectiles, gameTime);
  towers = towerUpdate.towers;
  projectiles = towerUpdate.projectiles;

  // 8. Update projectiles (move and damage enemies)
  const projectileUpdate = updateProjectiles(projectiles, enemies, dt);
  projectiles = projectileUpdate.projectiles;
  enemies = projectileUpdate.enemies;

  // 9. Track enemy stats (score comes from sentences only)
  const totalEnemiesGone = state.enemies.length - enemies.length;
  const enemiesKilledByTower = Math.max(0, totalEnemiesGone - enemiesReachedBase);
  const totalEnemiesDefeated = state.totalEnemiesDefeated + enemiesKilledByTower;
  let spawnTimer = state.spawnTimer + dt;
  let enemiesSpawnedThisWave = state.enemiesSpawnedThisWave;
  const enemiesKilledThisWave = state.enemiesKilledThisWave + enemiesKilledByTower;
  const waveConfig = WAVE_CONFIGS[state.wave - 1];
  let waveCompleteTimer = state.waveCompleteTimer;
  let waveMessage = state.waveMessage;
  const wavesCompleted = state.wavesCompleted;

  // Score = number of completed sentences (1 pt each, max 10)
  let score = Math.min(10, completedSentences);

  if (isSentenceComplete(collectedWordIndices, sentenceWords.length)) {
    if (!sentenceCompleted) {
      sentenceCompleted = true;
      completedSentences += 1;
      score = Math.min(10, completedSentences);
      if (completedSentences >= state.maxSentences) {
        return {
          ...state,
          status: "victory",
          player,
          enemies,
          towers,
          projectiles,
          words,
          currentSentenceThai,
          currentSentenceEnglish,
          sentenceWords,
          collectedWordIndices,
          sentenceCompleted,
          base,
          score,
          spawnTimer: state.spawnTimer,
          enemiesSpawnedThisWave,
          enemiesKilledThisWave,
          gameTime,
          waveCompleteTimer,
          waveMessage,
          wavesCompleted,
          totalEnemiesDefeated,
          correctWordCollections,
          incorrectWordCollections,
          completedSentences,
        };
      }
    }
  }

  // 10. Wave complete / spawn / transition
  if (isWaveComplete({ ...state, enemies, enemiesSpawnedThisWave })) {
    if (waveCompleteTimer <= 0) {
      waveCompleteTimer = 2000;
      waveMessage = `Wave ${state.wave} Complete`;
    }
  }

  if (waveCompleteTimer > 0) {
    waveCompleteTimer = Math.max(0, waveCompleteTimer - dt);
  }

  if (
    waveCompleteTimer <= 0 &&
    spawnTimer >= SPAWN_RATE_MS &&
    enemies.length < MAX_ENEMIES
  ) {
    if (enemiesSpawnedThisWave < state.totalEnemiesThisWave) {
      enemies = [
        ...enemies,
        spawnEnemy(
          state.path,
          state.wave,
          Math.random,
          waveConfig,
          enemiesSpawnedThisWave,
        ),
      ];
      enemiesSpawnedThisWave += 1;
      spawnTimer = 0;
    }
  }

  if (
    waveCompleteTimer === 0 &&
    waveMessage &&
    isWaveComplete({ ...state, enemies, enemiesSpawnedThisWave })
  ) {
    if (state.wave < WAVE_CONFIGS.length) {
      const nextWave = state.wave + 1;
      const nextConfig = WAVE_CONFIGS[nextWave - 1];
      const mapConfig = loadMapForWave(nextWave);
      const nextSentence = pickRandomSentence(
        vocabulary,
        state.currentSentenceEnglish,
        state.usedSentenceTerms,
      );
      const nextSentenceWords = parseSentenceWords(nextSentence.term);
      const nextTowerSlots = mapConfig.towerSlots.map((slot, i) => ({
        ...slot,
        targetWord: vocabulary[i % vocabulary.length]?.translation || "word",
      }));
      return {
        ...state,
        wave: nextWave,
        enemies,
        towers: [],
        projectiles: [],
        words: spawnSentenceWords(nextSentence.term),
        base: {
          ...base,
          x: mapConfig.basePosition.x,
          y: mapConfig.basePosition.y,
        },
        path: mapConfig.path,
        towerSlots: nextTowerSlots,
        score,
        spawnTimer: 0,
        gameTime,
        currentSentenceThai: nextSentence.translation,
        currentSentenceEnglish: nextSentence.term,
        sentenceWords: nextSentenceWords,
        collectedWordIndices: [],
        sentenceCompleted: false,
        enemiesSpawnedThisWave: 0,
        enemiesKilledThisWave: 0,
        totalEnemiesThisWave:
          nextConfig.soldiers + nextConfig.tanks + nextConfig.bosses,
        waveCompleteTimer: 0,
        waveMessage: null,
        player,
        wavesCompleted: wavesCompleted + 1,
        totalEnemiesDefeated,
        correctWordCollections,
        incorrectWordCollections,
        usedSentenceTerms: nextSentence.term
          ? [...state.usedSentenceTerms, nextSentence.term]
          : state.usedSentenceTerms,
      };
    }
    return {
      ...state,
      status: "victory",
      waveCompleteTimer: 0,
      waveMessage: null,
      enemies,
      towers,
      projectiles,
      words,
      base,
      score,
      spawnTimer,
      gameTime,
      collectedWordIndices,
      sentenceCompleted,
      enemiesSpawnedThisWave,
      enemiesKilledThisWave,
      wavesCompleted: wavesCompleted + 1,
      totalEnemiesDefeated,
      correctWordCollections,
      incorrectWordCollections,
      completedSentences,
    };
  }

  // 11. Check game over
  let status: CastleDefenseState["status"] = state.status;
  if (gameTime >= state.durationMs) {
    status = "victory";
  } else if (base.hp <= 0) {
    status = "gameover";
  }

  return {
    ...state,
    status,
    player,
    enemies,
    towers,
    projectiles,
    words,
    currentSentenceThai,
    currentSentenceEnglish,
    sentenceWords,
    collectedWordIndices,
    sentenceCompleted,
    base,
    score,
    spawnTimer,
    enemiesSpawnedThisWave,
    enemiesKilledThisWave,
    gameTime,
    waveCompleteTimer,
    waveMessage,
    wavesCompleted,
    totalEnemiesDefeated,
    correctWordCollections,
    incorrectWordCollections,
    completedSentences,
  };
}
