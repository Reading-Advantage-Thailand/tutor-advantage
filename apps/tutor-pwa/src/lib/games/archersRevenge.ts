import type { VocabularyItem, Difficulty } from "@/store/useGameStore";
import {
  ARCHERS_REVENGE_CONFIG,
  getDifficultySettings,
} from "./archersRevengeConfig";

export type Enemy = {
  id: string;
  x: number;
  y: number;
  term: string;
  translation: string;
  shieldUp: boolean;
  row: number;
  column: number;
};

export type Arrow = {
  id: string;
  x: number;
  y: number;
  vy: number;
};

export type Projectile = {
  id: string;
  x: number;
  y: number;
  vy: number;
};

export type ArchersRevengeState = {
  status: "playing" | "victory" | "defeat";
  difficulty: Difficulty;
  hp: number;
  maxHp: number;
  score: number;
  combo: number;
  wave: number;
  targetWord: VocabularyItem;
  targetChangeTimer: number;
  enemies: Enemy[];
  arrows: Arrow[];
  enemyProjectiles: Projectile[];
  vocabulary: VocabularyItem[];
  playerX: number;
  lastFireTime: number;
  formationDirection: 1 | -1;
  gameTime: number;
  correctAnswers: number;
  totalAttempts: number;
  wrongAnswers: number;
};

export type ArchersRevengeResults = {
  score: number;
  accuracy: number;
  xp: number;
  correctAnswers: number;
  totalAttempts: number;
  wavesCompleted: number;
  timeTaken: number;
  difficulty: Difficulty;
};

export type ArchersRevengeConfig = {
  difficulty?: Difficulty;
  rng?: () => number;
};

const GAME_WIDTH = 390;
const GAME_HEIGHT = 844;

export { GAME_WIDTH, GAME_HEIGHT };

const generateId = () => Math.random().toString(36).substring(2, 9);

const createEnemyFormation = (
  vocabulary: VocabularyItem[],
  difficulty: Difficulty,
  rng: () => number
): { enemies: Enemy[]; targetIndex: number } => {
  const settings = getDifficultySettings(difficulty);
  const { columns, rows } = settings;
  const { enemySpacing, enemySize, formationTopMargin, formationMarginX } =
    ARCHERS_REVENGE_CONFIG.layout;

  const totalEnemies = columns * rows;

  // Use as many unique words as possible, repeat if needed
  const shuffledVocab: VocabularyItem[] = [];
  while (shuffledVocab.length < totalEnemies) {
    const batch = [...vocabulary].sort(() => rng() - 0.5);
    shuffledVocab.push(...batch);
  }
  
  // Choose one enemy from the bottom row as the target initially
  const bottomRow = rows - 1;
  const targetColumn = Math.floor(rng() * columns);
  const targetIndex = bottomRow * columns + targetColumn;

  const enemies: Enemy[] = [];
  const startX = formationMarginX + enemySize.width / 2;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const index = row * columns + col;
      const vocabItem = shuffledVocab[index];

      enemies.push({
        id: `enemy-${row}-${col}-${generateId()}`,
        x: startX + col * enemySpacing.x,
        y: formationTopMargin + row * enemySpacing.y,
        term: vocabItem.term,
        translation: vocabItem.translation,
        shieldUp: index !== targetIndex,
        row,
        column: col,
      });
    }
  }

  return { enemies, targetIndex };
};

export const createArchersRevengeState = (
  vocabulary: VocabularyItem[],
  { difficulty = "normal", rng = Math.random }: ArchersRevengeConfig = {}
): ArchersRevengeState => {
  if (vocabulary.length === 0) {
    throw new Error("Vocabulary cannot be empty");
  }

  const settings = getDifficultySettings(difficulty);
  const { enemies, targetIndex } = createEnemyFormation(
    vocabulary,
    difficulty,
    rng
  );

  const targetVocab = {
    term: enemies[targetIndex].term,
    translation: enemies[targetIndex].translation,
  };

  return {
    status: "playing",
    difficulty,
    hp: settings.playerHp,
    maxHp: settings.playerHp,
    score: 0,
    combo: 0,
    wave: 1,
    targetWord: targetVocab,
    targetChangeTimer: ARCHERS_REVENGE_CONFIG.targetChangeInterval?.[difficulty] || 7000,
    enemies,
    arrows: [],
    enemyProjectiles: [],
    vocabulary,
    playerX: GAME_WIDTH / 2,
    lastFireTime: -ARCHERS_REVENGE_CONFIG.arrow.fireRateMs,
    formationDirection: 1,
    gameTime: 0,
    correctAnswers: 0,
    totalAttempts: 0,
    wrongAnswers: 0,
  };
};

export const fireArrow = (state: ArchersRevengeState, x: number): ArchersRevengeState => {
  if (state.status !== "playing") return state;
  
  const now = state.gameTime;
  if (now - state.lastFireTime < ARCHERS_REVENGE_CONFIG.arrow.fireRateMs) {
    return state;
  }

  const newArrow: Arrow = {
    id: `arrow-${generateId()}`,
    x,
    y: ARCHERS_REVENGE_CONFIG.layout.playerY - 20,
    vy: -ARCHERS_REVENGE_CONFIG.arrow.speed,
  };

  return {
    ...state,
    arrows: [...state.arrows, newArrow],
    lastFireTime: now,
    playerX: x,
  };
};

export const tickArchersRevenge = (
  state: ArchersRevengeState,
  dt: number // delta time in ms
): ArchersRevengeState => {
  if (state.status !== "playing") return state;

  const dtSec = dt / 1000;
  const settings = getDifficultySettings(state.difficulty);
  const { enemySize } = ARCHERS_REVENGE_CONFIG.layout;

  const nextState = { ...state, gameTime: state.gameTime + dt };

  // 1. Update Target Change Timer
  nextState.targetChangeTimer -= dt;
  if (nextState.targetChangeTimer <= 0) {
    // Change target to another random enemy
    const aliveEnemies = nextState.enemies;
    if (aliveEnemies.length > 0) {
      const newTargetIndex = Math.floor(Math.random() * aliveEnemies.length);
      const newTarget = aliveEnemies[newTargetIndex];
      
      nextState.targetWord = { term: newTarget.term, translation: newTarget.translation };
      nextState.enemies = aliveEnemies.map((e, idx) => ({
        ...e,
        shieldUp: idx !== newTargetIndex,
      }));
    }
    nextState.targetChangeTimer = ARCHERS_REVENGE_CONFIG.targetChangeInterval?.[state.difficulty] || 7000;
  }

  // 2. Move Enemies
  let moveX = settings.enemySpeed * dtSec * state.formationDirection;
  const moveY = settings.descendSpeed * dtSec;
  
  const minX = Math.min(...nextState.enemies.map(e => e.x)) - enemySize.width / 2;
  const maxX = Math.max(...nextState.enemies.map(e => e.x)) + enemySize.width / 2;
  
  let newDirection = state.formationDirection;
  if (maxX + moveX > GAME_WIDTH - 10 || minX + moveX < 10) {
    newDirection = -state.formationDirection as (1 | -1);
    moveX = 0; // Don't move horizontally this tick if changing direction
  }

  nextState.formationDirection = newDirection;
  nextState.enemies = nextState.enemies.map(e => ({
    ...e,
    x: e.x + moveX,
    y: e.y + moveY,
  }));

  // Check if enemies reached bottom
  if (Math.max(...nextState.enemies.map(e => e.y)) > ARCHERS_REVENGE_CONFIG.layout.playerY - 40) {
    return { ...nextState, status: "defeat" };
  }

  // 3. Move Arrows
  nextState.arrows = nextState.arrows
    .map(a => ({ ...a, y: a.y + a.vy * dtSec }))
    .filter(a => a.y > 0);

  // 4. Move Enemy Projectiles
  nextState.enemyProjectiles = nextState.enemyProjectiles
    .map(p => ({ ...p, y: p.y + p.vy * dtSec }))
    .filter(p => p.y < GAME_HEIGHT);

  // 5. Collision Detection: Arrow vs Enemy
  const hitEnemies = new Set<string>();
  const hitArrows = new Set<string>();
  const newProjectiles: Projectile[] = [];

  for (const arrow of nextState.arrows) {
    for (const enemy of nextState.enemies) {
      const dx = Math.abs(arrow.x - enemy.x);
      const dy = Math.abs(arrow.y - enemy.y);
      
      if (dx < enemySize.width / 2 && dy < enemySize.height / 2) {
        hitArrows.add(arrow.id);
        
        if (!enemy.shieldUp) {
          hitEnemies.add(enemy.id);
          nextState.score += ARCHERS_REVENGE_CONFIG.scoring.basePointsPerEnemy * (1 + nextState.combo * ARCHERS_REVENGE_CONFIG.scoring.comboMultiplier);
          nextState.combo += 1;
          nextState.correctAnswers += 1;
          nextState.totalAttempts += 1;
        } else {
          // Retaliate
          newProjectiles.push({
            id: `proj-${generateId()}`,
            x: enemy.x,
            y: enemy.y + 20,
            vy: ARCHERS_REVENGE_CONFIG.enemy.projectileSpeed,
          });
          nextState.combo = 0;
          nextState.totalAttempts += 1;
          nextState.wrongAnswers += 1;
        }
        break; // Arrow hit one enemy
      }
    }
  }

  nextState.arrows = nextState.arrows.filter(a => !hitArrows.has(a.id));
  nextState.enemies = nextState.enemies.filter(e => !hitEnemies.has(e.id));
  nextState.enemyProjectiles = [...nextState.enemyProjectiles, ...newProjectiles];

  // If correct enemy destroyed, pick a new one
  if (hitEnemies.size > 0) {
    if (nextState.enemies.length === 0) {
      // Wave complete
      return nextWave(nextState);
    } else {
      const newTargetIndex = Math.floor(Math.random() * nextState.enemies.length);
      const newTarget = nextState.enemies[newTargetIndex];
      nextState.targetWord = { term: newTarget.term, translation: newTarget.translation };
      nextState.enemies = nextState.enemies.map((e, idx) => ({
        ...e,
        shieldUp: idx !== newTargetIndex,
      }));
      nextState.targetChangeTimer = ARCHERS_REVENGE_CONFIG.targetChangeInterval?.[state.difficulty] || 7000;
    }
  }

  // 6. Collision Detection: Projectile vs Player
  const hitProjectiles = new Set<string>();
  const playerWidth = 40;
  const playerHeight = 40;
  const playerY = ARCHERS_REVENGE_CONFIG.layout.playerY;

  for (const proj of nextState.enemyProjectiles) {
    const dx = Math.abs(proj.x - nextState.playerX);
    const dy = Math.abs(proj.y - playerY);
    
    if (dx < playerWidth / 2 && dy < playerHeight / 2) {
      hitProjectiles.add(proj.id);
      nextState.hp -= 1;
      nextState.combo = 0;
    }
  }

  nextState.enemyProjectiles = nextState.enemyProjectiles.filter(p => !hitProjectiles.has(p.id));

  if (nextState.hp <= 0) {
    nextState.status = "defeat";
  }

  return nextState;
};

const nextWave = (state: ArchersRevengeState): ArchersRevengeState => {
  const nextWaveNum = state.wave + 1;
  const { enemies, targetIndex } = createEnemyFormation(
    state.vocabulary,
    state.difficulty,
    Math.random
  );

  const targetVocab = {
    term: enemies[targetIndex].term,
    translation: enemies[targetIndex].translation,
  };

  return {
    ...state,
    wave: nextWaveNum,
    enemies,
    targetWord: targetVocab,
    targetChangeTimer: ARCHERS_REVENGE_CONFIG.targetChangeInterval?.[state.difficulty] || 7000,
    arrows: [],
    enemyProjectiles: [],
    formationDirection: 1,
  };
};

export const calculateXP = (state: ArchersRevengeState): number => {
  const baseXP = state.score / 10;
  const accuracy = state.totalAttempts > 0 ? state.correctAnswers / state.totalAttempts : 0;
  const speedBonus = Math.max(0, 1 - state.gameTime / 60000);
  const survivalBonus = state.hp / state.maxHp;
  const rawXP = Math.floor(baseXP * (0.5 + accuracy) + speedBonus * 5 + survivalBonus * 5);
  return Math.max(1, Math.min(10, rawXP));
};
