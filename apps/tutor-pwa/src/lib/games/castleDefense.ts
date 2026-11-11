import { clampMoveVector } from "@/lib/games/moveVector";
import { wordProgressPoints } from "@/lib/games/sentenceRound";

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
/** A word that is not next must really overlap the drawn orb to count as a wrong touch. */
export const WRONG_HIT_RADIUS = WORD_RADIUS - 5;
/**
 * Orbs out on the map at once: the next word and the few after it. A long sentence
 * then plays like a short one, because a field of 12 orbs leaves no straight path
 * between two words, and a child walking to the right word keeps bumping others.
 */
export const MAX_ORBS_IN_PLAY = 6;
/** Distance past the touch range that counts as having stepped off an orb. */
const TOUCH_RELEASE_MARGIN = 12;
/** After a wrong touch, bumping into another orb costs nothing for this long. */
export const WRONG_GRACE_MS = 700;
const BOUNCE_DISTANCE = 56;
const BOUNCE_MS = 220;
const BOUNCE_SPEED = BOUNCE_DISTANCE / BOUNCE_MS;
/** The tower builds itself this long after a sentence ends, so the round cannot get stuck. */
export const AUTO_BUILD_MS = 3_000;

// Where orbs may land. Centres this far apart leave a path for the wizard between them.
const ORB_MIN_X = GAME_WIDTH * 0.12;
const ORB_MAX_X = GAME_WIDTH * 0.88;
const ORB_MIN_Y = GAME_HEIGHT * 0.17;
const ORB_MAX_Y = GAME_HEIGHT * 0.8;
const ORB_MIN_GAP = 92;
const ORB_CLEAR_OF_PLAYER = 110;
const ORB_CLEAR_OF_SLOT = 80;

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
  /** The place in the sentence this orb filled. Differs from sentenceIndex for repeated words. */
  collectedAs?: number;
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
  thaiTranslation?: string;
  audioUrl?: string;
};

/** The last wrong touch. The screen reacts when this changes. */
export type WrongWordHit = {
  at: number;
  wordId: string;
  lostWord: boolean;
};

/** A short push away from a wrong word. Speeds are world units per ms. */
export type PlayerBounce = {
  dx: number;
  dy: number;
  remainingMs: number;
};

export type WaveResult = {
  wave: number;
  /** Enemies reached the castle during this wave. */
  breached: boolean;
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
  /** gameTime when the current sentence was finished. */
  sentenceCompletedAt: number | null;
  /** Orbs the wizard is standing on. Each does nothing until the wizard steps off it. */
  touchingWordIds: string[];
  lastWrongHit: WrongWordHit | null;
  /** The wizard has already bumped a wrong word since its last right one. */
  bumpedSinceLastWord: boolean;
  wrongGraceUntil: number;
  bounce: PlayerBounce | null;
  enemiesSpawnedThisWave: number;
  enemiesKilledThisWave: number;
  totalEnemiesThisWave: number;
  waveCompleteTimer: number;
  waveResult: WaveResult | null;
  waveStartHp: number;
  wavesCompleted: number;
  totalEnemiesDefeated: number;
  correctWordCollections: number;
  incorrectWordCollections: number;
  completedSentences: number;
  maxSentences: number;
  /** Words that earn full marks; null keeps the old whole-sentence score. */
  wordBudget: number | null;
  /** Words earned in sentences the round has moved past. */
  bankedWords: number;
  /** Furthest word reached in the current sentence; a wrong touch does not lower it. */
  sentenceHighMark: number;
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

/**
 * The next sentence, in round order: the least used one that is not on screen.
 * The round is shuffled once up front, so students given the same round get the
 * same sentences in the same order.
 */
const pickNextSentence = (
  vocabulary: SentenceItem[],
  currentTerm?: string,
  usedTerms: string[] = [],
): SentenceItem => {
  if (vocabulary.length === 0) {
    return { term: "", translation: "" };
  }
  const notCurrent = vocabulary.filter((item) => item.term !== currentTerm);
  const pool = notCurrent.length > 0 ? notCurrent : vocabulary;
  const timesUsed = (term: string) => usedTerms.filter((used) => used === term).length;
  return pool.reduce((best, item) => (timesUsed(item.term) < timesUsed(best.term) ? item : best));
};

/** The same order for the same list, so everyone in a class plays the same sentences. */
export function shuffleForClass<T extends { term: string }>(items: T[]): T[] {
  let hash = 2166136261;
  for (const item of items) {
    for (let i = 0; i < item.term.length; i++) {
      hash = Math.imul(hash ^ item.term.charCodeAt(i), 16777619);
    }
  }
  const random = () => {
    hash = (hash + 0x6d2b79f5) | 0;
    let t = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return shuffled(items, random);
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

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
  options: { difficulty: "easy" | "medium" | "hard"; maxSentences?: number; durationMs?: number; wordBudget?: number } = {
    difficulty: "medium",
  },
): CastleDefenseState {
  // Pick a random target word
  const targetItem =
    vocabulary.length > 0
      ? vocabulary[Math.floor(Math.random() * vocabulary.length)]
      : { term: "default", translation: "default" };

  const firstSentence = pickNextSentence(vocabulary);
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

  const player: Player = {
    id: "player",
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 100,
    radius: PLAYER_RADIUS,
    speed: PLAYER_SPEED,
    inventory: [],
  };

  return {
    status: "playing",
    difficulty: options.difficulty,
    player,
    enemies: [],
    towers: [],
    towerSlots,
    projectiles: [],
    words: spawnSentenceWords(firstSentence.term, Math.random, orbKeepOuts(player, towerSlots)),
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
    sentenceCompletedAt: null,
    touchingWordIds: [],
    lastWrongHit: null,
    bumpedSinceLastWord: false,
    wrongGraceUntil: 0,
    bounce: null,
    enemiesSpawnedThisWave: 0,
    enemiesKilledThisWave: 0,
    totalEnemiesThisWave:
      WAVE_CONFIGS[0].soldiers + WAVE_CONFIGS[0].tanks + WAVE_CONFIGS[0].bosses,
    waveCompleteTimer: 0,
    waveResult: null,
    waveStartHp: baseHp,
    wavesCompleted: 0,
    totalEnemiesDefeated: 0,
    correctWordCollections: 0,
    incorrectWordCollections: 0,
    completedSentences: 0,
    maxSentences,
    wordBudget: options.wordBudget ?? null,
    bankedWords: 0,
    sentenceHighMark: 0,
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
  // Every direction walks at the same speed.
  const { dx: moveX, dy: moveY } = clampMoveVector(input.dx, input.dy);

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
  return String(sentence ?? "")
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

export type OrbKeepOut = { x: number; y: number; clearance: number };

/** Spots an orb must stay away from: the wizard, and the rings the wizard has to walk to. */
export function orbKeepOuts(
  player: { x: number; y: number },
  towerSlots: { x: number; y: number }[],
): OrbKeepOut[] {
  return [
    { x: player.x, y: player.y, clearance: ORB_CLEAR_OF_PLAYER },
    ...towerSlots.map((slot) => ({ x: slot.x, y: slot.y, clearance: ORB_CLEAR_OF_SLOT })),
  ];
}

// Spawn word orbs for a full sentence. Which word lands in which cell is random,
// so the layout never gives away the order and the student has to read.
export function spawnSentenceWords(
  sentence: string,
  random: () => number = Math.random,
  keepOuts: OrbKeepOut[] = [],
): Word[] {
  const sentenceWords = parseSentenceWords(sentence);
  const count = Math.max(sentenceWords.length, 1);
  const width = ORB_MAX_X - ORB_MIN_X;
  const height = ORB_MAX_Y - ORB_MIN_Y;
  const columns = Math.ceil(Math.sqrt((count * width) / height));
  const rows = Math.max(2, Math.ceil(count / columns));
  const cellW = width / columns;
  const cellH = height / rows;
  const cells = shuffled(
    Array.from({ length: columns * rows }, (_, cell) => cell),
    random,
  ).slice(0, sentenceWords.length);
  const spots = cells.map((cell) => ({
    x: ORB_MIN_X + cellW * ((cell % columns) + 0.5) + (random() - 0.5) * cellW * 0.3,
    y: ORB_MIN_Y + cellH * (Math.floor(cell / columns) + 0.5) + (random() - 0.5) * cellH * 0.3,
  }));
  separateOrbs(spots, keepOuts, random);

  return sentenceWords.map((word, index) => ({
    id: generateId(),
    x: spots[index].x,
    y: spots[index].y,
    radius: Math.max(WORD_RADIUS, Math.min(42, 18 + word.length * 4)),
    term: word,
    translation: word,
    isCorrect: true,
    isCollected: false,
    sentenceIndex: index,
  }));
}

/** Pushes orbs apart and off the keep-outs. A crowded sentence gets as close to that as the space allows. */
function separateOrbs(
  spots: { x: number; y: number }[],
  keepOuts: OrbKeepOut[],
  random: () => number,
) {
  const angleBetween = (dx: number, dy: number) => (dx === 0 && dy === 0 ? random() * Math.PI * 2 : Math.atan2(dy, dx));

  for (let pass = 0; pass < 24; pass++) {
    let moved = 0;
    for (let i = 0; i < spots.length; i++) {
      const spot = spots[i];
      for (let j = i + 1; j < spots.length; j++) {
        const other = spots[j];
        const dx = spot.x - other.x;
        const dy = spot.y - other.y;
        const gap = ORB_MIN_GAP - Math.hypot(dx, dy);
        if (gap <= 0) continue;
        const angle = angleBetween(dx, dy);
        spot.x += (Math.cos(angle) * gap) / 2;
        spot.y += (Math.sin(angle) * gap) / 2;
        other.x -= (Math.cos(angle) * gap) / 2;
        other.y -= (Math.sin(angle) * gap) / 2;
        moved += gap;
      }
      for (const keepOut of keepOuts) {
        const dx = spot.x - keepOut.x;
        const dy = spot.y - keepOut.y;
        const gap = keepOut.clearance - Math.hypot(dx, dy);
        if (gap <= 0) continue;
        const angle = angleBetween(dx, dy);
        spot.x += Math.cos(angle) * gap;
        spot.y += Math.sin(angle) * gap;
        moved += gap;
      }
    }
    for (const spot of spots) {
      spot.x = Math.max(ORB_MIN_X, Math.min(ORB_MAX_X, spot.x));
      spot.y = Math.max(ORB_MIN_Y, Math.min(ORB_MAX_Y, spot.y));
    }
    if (moved < 0.5) break;
  }
}

/** The orbs out on the map now. The rest of the sentence waits its turn. */
export function wordsInPlay(
  words: Word[],
  sentenceWords: string[],
  collectedWordIndices: number[],
): Word[] {
  const waiting = words.filter((word) => !word.isCollected);
  const shown = waiting.slice(0, MAX_ORBS_IN_PLAY);
  const expected = sentenceWords[collectedWordIndices.length]?.toLowerCase();
  const isExpected = (word: Word) => word.term.toLowerCase() === expected;
  // Picking up later copies of a repeated word could push the next word out of the first few.
  if (expected && !shown.some(isExpected)) {
    const next = waiting.find(isExpected);
    if (next) shown[shown.length - 1] = next;
  }
  return shown;
}

/** How close the wizard must be for this orb to count: forgiving on the right word, strict on any other. */
const touchRadius = (word: Word, isNext: boolean) => (isNext ? word.radius : WRONG_HIT_RADIUS);

/**
 * What the wizard touched this tick. Any orb showing the next word counts, so the
 * second "the" is as good as the first. An orb in `touchingWordIds` does nothing
 * until the wizard has stepped off it, so one touch is one touch however long it lasts.
 */
export function collectWords(
  player: Player,
  words: Word[],
  sentenceWords: string[],
  collectedWordIndices: number[],
  options: { touchingWordIds?: string[]; allowWrongHit?: boolean } = {},
): {
  player: Player;
  words: Word[];
  collectedWord: Word | null;
  collectedWordIndices: number[];
  invalidCollection: boolean;
  touchingWordIds: string[];
} {
  const expectedIndex = collectedWordIndices.length;
  const expectedTerm = sentenceWords[expectedIndex]?.toLowerCase();
  const isNext = (word: Word) => word.term.toLowerCase() === expectedTerm;
  const distanceTo = (word: Word) => Math.hypot(player.x - word.x, player.y - word.y);
  const wasTouching = new Set(options.touchingWordIds ?? []);

  const stillTouching: Word[] = [];
  const newTouches: Word[] = [];
  for (const word of wordsInPlay(words, sentenceWords, collectedWordIndices)) {
    const reach = player.radius + touchRadius(word, isNext(word));
    if (wasTouching.has(word.id)) {
      if (distanceTo(word) < reach + TOUCH_RELEASE_MARGIN) stillTouching.push(word);
    } else if (distanceTo(word) < reach) {
      newTouches.push(word);
    }
  }
  const nearestFirst = (a: Word, b: Word) => distanceTo(a) - distanceTo(b);
  const right = newTouches.filter(isNext).sort(nearestFirst)[0];
  const wrong = right ? undefined : [...newTouches].sort(nearestFirst)[0];
  const countWrong = Boolean(wrong) && (options.allowWrongHit ?? true);
  const touchingWordIds = [...stillTouching, ...newTouches]
    .filter((word) => word !== right)
    .map((word) => word.id);

  if (right) {
    const nextWords = words.map((word) =>
      word === right ? { ...word, isCollected: true, collectedAs: expectedIndex } : word,
    );
    const nextIndices = [...collectedWordIndices, expectedIndex];
    // The orb that comes out next may land on the wizard, which is no mistake.
    const underWizard = wordsInPlay(nextWords, sentenceWords, nextIndices)
      .filter((word) => distanceTo(word) < player.radius + WRONG_HIT_RADIUS)
      .map((word) => word.id);
    return {
      // Add translation to inventory (legacy tower activation)
      player: { ...player, inventory: [...player.inventory, right.translation] },
      words: nextWords,
      collectedWord: right,
      collectedWordIndices: nextIndices,
      invalidCollection: false,
      touchingWordIds: [...new Set([...touchingWordIds, ...underWizard])],
    };
  }

  return {
    player,
    words,
    collectedWord: countWrong && wrong ? wrong : null,
    collectedWordIndices,
    invalidCollection: countWrong,
    touchingWordIds,
  };
}

/** A wrong touch costs the last word: its orb goes back on the map where it was. */
export function loseLastWord(words: Word[], collectedWordIndices: number[]) {
  const lastIndex = collectedWordIndices.length - 1;
  if (lastIndex < 0) return { words, collectedWordIndices, returnedWord: null };
  const returnedWord = words.find((word) => word.isCollected && word.collectedAs === lastIndex) ?? null;
  return {
    words: words.map((word) =>
      word === returnedWord ? { ...word, isCollected: false, collectedAs: undefined } : word,
    ),
    collectedWordIndices: collectedWordIndices.slice(0, lastIndex),
    returnedWord,
  };
}

const hasTowerAt = (towers: Tower[], slot: TowerSlot) =>
  towers.some((tower) => tower.id === `tower-${slot.id}`);

/** The closest ring without a tower. */
export function nearestFreeSlot(
  towerSlots: TowerSlot[],
  towers: Tower[],
  from: { x: number; y: number },
): TowerSlot | null {
  let nearest: TowerSlot | null = null;
  let nearestDistance = Infinity;
  for (const slot of towerSlots) {
    if (hasTowerAt(towers, slot)) continue;
    const distance = Math.hypot(slot.x - from.x, slot.y - from.y);
    if (distance < nearestDistance) {
      nearest = slot;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** Moves the round to the next sentence, banking the words of the finished one. */
function startNextSentence(state: CastleDefenseState, vocabulary: SentenceItem[]): CastleDefenseState {
  const nextSentence = pickNextSentence(
    vocabulary,
    state.currentSentenceEnglish,
    state.usedSentenceTerms,
  );
  return {
    ...state,
    player: {
      ...state.player,
      inventory: [],
    },
    currentSentenceThai: nextSentence.translation,
    currentSentenceEnglish: nextSentence.term,
    sentenceWords: parseSentenceWords(nextSentence.term),
    collectedWordIndices: [],
    sentenceCompleted: false,
    sentenceCompletedAt: null,
    touchingWordIds: [],
    bumpedSinceLastWord: false,
    bankedWords:
      state.bankedWords +
      Math.max(state.sentenceHighMark, state.collectedWordIndices.length),
    sentenceHighMark: 0,
    words: spawnSentenceWords(nextSentence.term, Math.random, orbKeepOuts(state.player, state.towerSlots)),
    usedSentenceTerms: nextSentence.term
      ? [...state.usedSentenceTerms, nextSentence.term]
      : state.usedSentenceTerms,
  };
}

// Build a tower at a specific slot and consume the completed sentence
export function buildTowerAtSlot(
  state: CastleDefenseState,
  slotId: string,
  vocabulary: SentenceItem[],
): CastleDefenseState {
  const slot = state.towerSlots.find((candidate) => candidate.id === slotId);
  if (!slot || hasTowerAt(state.towers, slot)) {
    return state;
  }

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
    ...startNextSentence(state, vocabulary),
    towers: [...state.towers, newTower],
  };
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

/** Moves the wizard one tick: a bounce from a wrong word takes over from the stick for a moment. */
function stepPlayer(state: CastleDefenseState, dt: number, input: InputState) {
  const { bounce } = state;
  if (!bounce) return { player: movePlayer(state.player, input, dt), bounce: null };
  const { player } = state;
  const stepMs = Math.min(dt, bounce.remainingMs);
  const remainingMs = bounce.remainingMs - dt;
  return {
    player: {
      ...player,
      x: Math.max(player.radius, Math.min(GAME_WIDTH - player.radius, player.x + bounce.dx * stepMs)),
      y: Math.max(player.radius, Math.min(GAME_HEIGHT - player.radius, player.y + bounce.dy * stepMs)),
    },
    bounce: remainingMs > 0 ? { ...bounce, remainingMs } : null,
  };
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
  const step = stepPlayer(state, dt, input);

  // 3. Collect words
  const collection = collectWords(
    step.player,
    state.words,
    state.sentenceWords,
    state.collectedWordIndices,
    { touchingWordIds: state.touchingWordIds, allowWrongHit: gameTime >= state.wrongGraceUntil },
  );
  let next: CastleDefenseState = {
    ...state,
    gameTime,
    player: collection.player,
    bounce: step.bounce,
    words: collection.words,
    collectedWordIndices: collection.collectedWordIndices,
    touchingWordIds: collection.touchingWordIds,
  };

  if (collection.invalidCollection && collection.collectedWord) {
    next = applyWrongTouch(next, collection.collectedWord);
  } else if (collection.collectedWord) {
    next.correctWordCollections += 1;
    next.bumpedSinceLastWord = false;
  }
  next.sentenceHighMark = Math.max(next.sentenceHighMark, next.collectedWordIndices.length);

  let roundWon = false;
  if (!next.sentenceCompleted && isSentenceComplete(next.collectedWordIndices, next.sentenceWords.length)) {
    next.sentenceCompleted = true;
    next.sentenceCompletedAt = gameTime;
    next.completedSentences += 1;
    // With a word budget, only words or the clock end the round.
    roundWon = next.wordBudget === null && next.completedSentences >= next.maxSentences;
  }

  // 4. A finished sentence becomes a tower: walk onto a ring, press BUILD, or wait a moment.
  if (next.sentenceCompleted) {
    const slot = nearestFreeSlot(next.towerSlots, next.towers, next.player);
    if (!slot) {
      // Every ring has a tower: nothing to build, so the next sentence comes at once.
      next = startNextSentence(next, vocabulary);
    } else if (
      inRange(next.player.x, next.player.y, slot.x, slot.y, 50) ||
      input.drop ||
      gameTime - (next.sentenceCompletedAt ?? gameTime) >= AUTO_BUILD_MS
    ) {
      next = buildTowerAtSlot(next, slot.id, vocabulary);
    }
  }

  // 5. Move enemies
  let enemies = next.enemies.map((e) => moveEnemy(e, next.path, dt));

  // 6. Check base damage from enemies reaching end
  const enemiesCountBeforeBase = enemies.length;
  const baseDamage = checkBaseDamage(enemies, next.base, next.path);
  enemies = baseDamage.enemies;
  const base = baseDamage.base;
  const enemiesReachedBase = enemiesCountBeforeBase - enemies.length;

  // 7. Update towers (shoot at enemies)
  const towerUpdate = updateTowers(next.towers, enemies, next.projectiles, gameTime);

  // 8. Update projectiles (move and damage enemies)
  const projectileUpdate = updateProjectiles(towerUpdate.projectiles, enemies, dt);
  enemies = projectileUpdate.enemies;

  // 9. Track enemy stats (score comes from words or sentences only)
  const totalEnemiesGone = next.enemies.length - enemies.length;
  const enemiesKilledByTower = Math.max(0, totalEnemiesGone - enemiesReachedBase);

  // Lesson rounds score words, so a long sentence still earns what was finished.
  // Without a word budget, the score is completed sentences (1 pt each, max 10).
  const wordProgress = next.bankedWords + next.sentenceHighMark;
  const score =
    next.wordBudget === null
      ? Math.min(10, next.completedSentences)
      : wordProgressPoints(wordProgress, next.wordBudget);
  if (next.wordBudget !== null && wordProgress >= next.wordBudget) {
    roundWon = true;
  }

  next = {
    ...next,
    enemies,
    base,
    towers: towerUpdate.towers,
    projectiles: projectileUpdate.projectiles,
    score,
    spawnTimer: next.spawnTimer + dt,
    enemiesKilledThisWave: next.enemiesKilledThisWave + enemiesKilledByTower,
    totalEnemiesDefeated: next.totalEnemiesDefeated + enemiesKilledByTower,
  };

  if (roundWon) {
    return { ...next, status: "victory" };
  }

  // 10. Game over
  if (gameTime >= next.durationMs) {
    return { ...next, status: "victory" };
  }
  if (base.hp <= 0) {
    return { ...next, status: "gameover" };
  }

  return advanceWave(next, dt);
}

/**
 * Bounces the wizard off the word and starts the short grace period. One bump per
 * word only costs that moment, because a thumb on a stick bumps orbs by accident.
 * Bumping again takes back the last word, so trying every orb in turn gets nowhere.
 */
function applyWrongTouch(state: CastleDefenseState, hit: Word): CastleDefenseState {
  const { player } = state;
  const lost = state.bumpedSinceLastWord
    ? loseLastWord(state.words, state.collectedWordIndices)
    : { words: state.words, collectedWordIndices: state.collectedWordIndices, returnedWord: null };
  const distance = Math.hypot(player.x - hit.x, player.y - hit.y);
  const awayX = distance > 0 ? (player.x - hit.x) / distance : 0;
  const awayY = distance > 0 ? (player.y - hit.y) / distance : -1;
  const returned = lost.returnedWord;
  const standingOnReturned =
    returned && Math.hypot(player.x - returned.x, player.y - returned.y) < player.radius + returned.radius;

  return {
    ...state,
    words: lost.words,
    collectedWordIndices: lost.collectedWordIndices,
    incorrectWordCollections: state.incorrectWordCollections + 1,
    bumpedSinceLastWord: true,
    player: returned ? { ...player, inventory: player.inventory.slice(0, -1) } : player,
    touchingWordIds: standingOnReturned ? [...state.touchingWordIds, returned.id] : state.touchingWordIds,
    bounce: { dx: awayX * BOUNCE_SPEED, dy: awayY * BOUNCE_SPEED, remainingMs: BOUNCE_MS },
    wrongGraceUntil: state.gameTime + WRONG_GRACE_MS,
    lastWrongHit: { at: state.gameTime, wordId: hit.id, lostWord: Boolean(returned) },
  };
}

/** Spawns this wave's enemies and starts the next wave. The map, the towers and the sentence all stay. */
function advanceWave(state: CastleDefenseState, dt: number): CastleDefenseState {
  let { enemies, enemiesSpawnedThisWave, spawnTimer, waveCompleteTimer, waveResult } = state;
  const waveCleared = () => isWaveComplete({ ...state, enemies, enemiesSpawnedThisWave });

  if (waveCleared() && waveCompleteTimer <= 0) {
    waveCompleteTimer = 2000;
    waveResult = { wave: state.wave, breached: state.base.hp < state.waveStartHp };
  }
  if (waveCompleteTimer > 0) {
    waveCompleteTimer = Math.max(0, waveCompleteTimer - dt);
  }

  if (
    waveCompleteTimer <= 0 &&
    spawnTimer >= SPAWN_RATE_MS &&
    enemies.length < MAX_ENEMIES &&
    enemiesSpawnedThisWave < state.totalEnemiesThisWave
  ) {
    enemies = [
      ...enemies,
      spawnEnemy(state.path, state.wave, Math.random, WAVE_CONFIGS[state.wave - 1], enemiesSpawnedThisWave),
    ];
    enemiesSpawnedThisWave += 1;
    spawnTimer = 0;
  }

  if (waveCompleteTimer === 0 && waveResult && waveCleared()) {
    if (state.wave >= WAVE_CONFIGS.length) {
      return {
        ...state,
        status: "victory",
        waveCompleteTimer: 0,
        waveResult: null,
        wavesCompleted: state.wavesCompleted + 1,
      };
    }
    const nextConfig = WAVE_CONFIGS[state.wave];
    return {
      ...state,
      wave: state.wave + 1,
      spawnTimer: 0,
      enemiesSpawnedThisWave: 0,
      enemiesKilledThisWave: 0,
      totalEnemiesThisWave: nextConfig.soldiers + nextConfig.tanks + nextConfig.bosses,
      waveCompleteTimer: 0,
      waveResult: null,
      waveStartHp: state.base.hp,
      wavesCompleted: state.wavesCompleted + 1,
    };
  }

  return { ...state, enemies, enemiesSpawnedThisWave, spawnTimer, waveCompleteTimer, waveResult };
}

/** What the student should hear for this frame's change, if anything. */
export type CastleCue = "word" | "wrong" | "sentence" | "tower";

export function castleCue(previous: CastleDefenseState, next: CastleDefenseState): CastleCue | null {
  if (next.towers.length > previous.towers.length) return "tower";
  if (next.completedSentences > previous.completedSentences) return "sentence";
  if (next.lastWrongHit && next.lastWrongHit !== previous.lastWrongHit) return "wrong";
  if (next.correctWordCollections > previous.correctWordCollections) return "word";
  return null;
}

/** Words earned this round: earlier sentences plus the furthest point in the current one. */
export const getCastleWordProgress = (state: CastleDefenseState) =>
  state.bankedWords + state.sentenceHighMark;

// ---------------------------------------------------------------------------
// Camera / viewport fitting
// ---------------------------------------------------------------------------

/**
 * How the 800x600 board is mapped onto the game's container.
 * - "cover": fill the width and follow the player (phones, real play).
 * - "contain": letterbox the whole board inside the container (presenter demo).
 */
export type CastleDefenseCameraFit = "cover" | "contain";

export type CastleDefenseCamera = { x: number; y: number; scale: number };

/** Zoom floor for play: orbs stay at least 40 px wide on a phone. */
const COVER_MIN_SCALE = 0.8;

/**
 * Pure camera transform for the Konva layer. The result always keeps the
 * board's aspect ratio (uniform scale). Both modes keep the board in the band
 * between `insetTop` (HUD) and `insetBottom` (controls or overlay chrome):
 * - "contain" shows the whole board there (insets capped at 40% and 25%).
 * - "cover" zooms by width, not height, because a phone in portrait would
 *   otherwise show a third of the map. A board shorter than the band sits in its
 *   middle. A taller one scrolls with the player, so every spot can reach the band.
 */
export function computeCastleDefenseCamera(
  view: { width: number; height: number },
  focus: { x: number; y: number },
  options: { fit?: CastleDefenseCameraFit; insetTop?: number; insetBottom?: number } = {},
): CastleDefenseCamera {
  const { width, height } = view;
  if (width <= 0 || height <= 0) return { x: 0, y: 0, scale: 1 };

  if (options.fit === "contain") {
    const insetTop = Math.max(0, Math.min(options.insetTop ?? 0, height * 0.4));
    const insetBottom = Math.max(0, Math.min(options.insetBottom ?? 0, height * 0.25));
    const availableHeight = height - insetTop - insetBottom;
    const scale = Math.min(width / GAME_WIDTH, availableHeight / GAME_HEIGHT);
    return {
      x: (width - GAME_WIDTH * scale) / 2,
      y: insetTop + (availableHeight - GAME_HEIGHT * scale) / 2,
      scale,
    };
  }

  const insetTop = Math.max(0, Math.min(options.insetTop ?? 0, height * 0.6));
  const insetBottom = Math.max(0, Math.min(options.insetBottom ?? 0, height * 0.3));
  const band = Math.max(1, height - insetTop - insetBottom);
  const scale = Math.max(width / GAME_WIDTH, COVER_MIN_SCALE);
  const boardWidth = GAME_WIDTH * scale;
  const boardHeight = GAME_HEIGHT * scale;
  const x =
    boardWidth <= width
      ? (width - boardWidth) / 2
      : Math.max(width - boardWidth, Math.min(0, width / 2 - focus.x * scale));
  const y =
    boardHeight <= band
      ? insetTop + (band - boardHeight) / 2
      : Math.max(insetTop + band - boardHeight, Math.min(insetTop, insetTop + band / 2 - focus.y * scale));
  return { x, y, scale };
}

// ---------------------------------------------------------------------------
// Chips for words the camera cannot show
// ---------------------------------------------------------------------------

export type EdgeChipSide = "left" | "right" | "top" | "bottom";

export type EdgeChip = {
  id: string;
  label: string;
  side: EdgeChipSide;
  /** Container pixels of the chip's point on the edge. */
  x: number;
  y: number;
};

const EDGE_CHIP_ROW_PX = 26;
const EDGE_CHIP_CHAR_PX = 8;
const EDGE_CHIP_PADDING_PX = 34;

/**
 * One chip per off-screen word, with its text and direction, nearest few per
 * side. Every word gets a chip the same way, so chips show where words are and
 * never which one is next: the student still has to read the sentence.
 */
export function edgeChipsForWords(
  words: Pick<Word, "id" | "x" | "y" | "term" | "isCollected">[],
  player: { x: number; y: number },
  camera: CastleDefenseCamera,
  view: { width: number; height: number },
  options: {
    insetTop?: number;
    insetBottom?: number;
    chipBottomLimit?: number;
    maxPerSide?: number;
    /** Screen areas the controls cover. A word behind them cannot be read either. */
    covered?: { x: number; y: number; width: number; height: number }[];
  } = {},
): EdgeChip[] {
  const top = options.insetTop ?? 0;
  const bottom = view.height - (options.insetBottom ?? 0);
  const chipBottom = Math.min(bottom, options.chipBottomLimit ?? bottom);
  const maxPerSide = options.maxPerSide ?? 3;

  const bySide = new Map<EdgeChipSide, (EdgeChip & { distance: number })[]>();
  for (const word of words) {
    if (word.isCollected) continue;
    const sx = camera.x + word.x * camera.scale;
    const sy = camera.y + word.y * camera.scale;
    const beyond: [EdgeChipSide, number][] = [
      ["left", -sx],
      ["right", sx - view.width],
      ["top", top - sy],
      ["bottom", sy - bottom],
    ];
    const [outSide, overshoot] = beyond.reduce((most, entry) => (entry[1] > most[1] ? entry : most));
    const cover = options.covered?.find(
      (area) => sx >= area.x && sx <= area.x + area.width && sy >= area.y && sy <= area.y + area.height,
    );
    if (overshoot <= 0 && !cover) continue;
    const side: EdgeChipSide = overshoot > 0 || !cover ? outSide : cover.x < view.width / 2 ? "left" : "right";
    const chip = {
      id: word.id,
      label: word.term,
      side,
      x: Math.max(0, Math.min(view.width, sx)),
      y: Math.max(top, Math.min(chipBottom, sy)),
      distance: Math.hypot(word.x - player.x, word.y - player.y),
    };
    bySide.set(side, [...(bySide.get(side) ?? []), chip]);
  }

  const chips: EdgeChip[] = [];
  for (const [side, sideChips] of bySide) {
    const nearest = [...sideChips].sort((a, b) => a.distance - b.distance).slice(0, maxPerSide);
    const stacksVertically = side === "left" || side === "right";
    const along = (chip: EdgeChip) => (stacksVertically ? chip.y : chip.x);
    const sizeOf = (chip: EdgeChip) =>
      stacksVertically ? EDGE_CHIP_ROW_PX : chip.label.length * EDGE_CHIP_CHAR_PX + EDGE_CHIP_PADDING_PX;
    const low = stacksVertically ? top + EDGE_CHIP_ROW_PX / 2 : 0;
    const high = stacksVertically ? chipBottom - EDGE_CHIP_ROW_PX / 2 : view.width;

    // Spread the chips along the edge so they never cover each other.
    const placed = nearest.sort((a, b) => along(a) - along(b));
    let previousEnd = low;
    const positions = placed.map((chip) => {
      const size = sizeOf(chip);
      const position = Math.max(along(chip), previousEnd + size / 2);
      previousEnd = position + size / 2;
      return position;
    });
    let nextStart = high;
    for (let i = placed.length - 1; i >= 0; i--) {
      const size = sizeOf(placed[i]);
      positions[i] = Math.min(positions[i], nextStart - size / 2);
      nextStart = positions[i] - size / 2;
    }

    placed.forEach((chip, i) => {
      chips.push({
        id: chip.id,
        label: chip.label,
        side,
        x: stacksVertically ? (side === "left" ? 0 : view.width) : positions[i],
        y: stacksVertically ? positions[i] : side === "top" ? top : bottom,
      });
    });
  }
  return chips;
}
