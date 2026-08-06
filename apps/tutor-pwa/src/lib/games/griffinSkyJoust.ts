import type { GriffinSkyJoustDifficulty, GriffinSkyJoustDifficultySettings } from './griffinSkyJoustConfig'
import {
  GRIFFIN_SKY_JOUST_CONFIG,
  getDifficultySettings,
} from "./griffinSkyJoustConfig";

export interface SentenceItem {
  term: string;
  translation: string;
  id?: string;
}

export type Entity = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type Player = Entity & {
  hp: number;
  maxHp: number;
  invincibleUntil: number;
  radius: number;
};

export type EnemyKnight = Entity & {
  id: string;
  word: string;
  wordIndex: number;
  radius: number;
  color: string;
};

export type GriffinSkyJoustState = {
  status: "start" | "playing" | "victory" | "defeat";
  player: Player;
  enemies: EnemyKnight[];
  currentSentence: SentenceItem;
  words: string[];
  targetIndex: number;
  score: number;
  gameTime: number;
  totalAttempts: number;
  correctAnswers: number;
  difficulty: GriffinSkyJoustDifficulty;
};

export type GriffinSkyJoustConfig = {
  difficulty?: GriffinSkyJoustDifficulty;
  rng?: () => number;
};

export function createGriffinSkyJoustState(
  vocabulary: SentenceItem[],
  config: GriffinSkyJoustConfig = {}
): GriffinSkyJoustState {
  if (vocabulary.length === 0) {
    throw new Error("Vocabulary cannot be empty");
  }

  const difficulty = config.difficulty || "medium";
  const rng = config.rng || Math.random;
  const settings = getDifficultySettings(difficulty);

  const sentenceIndex = Math.floor(rng() * vocabulary.length);
  const currentSentence = vocabulary[sentenceIndex];
  const words = currentSentence.term.split(" ");

  const player: Player = {
    x: GRIFFIN_SKY_JOUST_CONFIG.gameWidth / 2,
    y: GRIFFIN_SKY_JOUST_CONFIG.gameHeight - 100,
    vx: 0,
    vy: 0,
    hp: settings.initialHp,
    maxHp: settings.initialHp,
    invincibleUntil: 0,
    radius: GRIFFIN_SKY_JOUST_CONFIG.player.radius,
  };

  const enemies = createEnemies(words, settings, rng);

  return {
    status: "start",
    player,
    enemies,
    currentSentence,
    words,
    targetIndex: 0,
    score: 0,
    gameTime: 0,
    totalAttempts: 0,
    correctAnswers: 0,
    difficulty,
  };
}

function createEnemies(
  words: string[],
  settings: GriffinSkyJoustDifficultySettings,
  rng: () => number
): EnemyKnight[] {
  return words.map((word, index) => {
    const x =
      GRIFFIN_SKY_JOUST_CONFIG.enemy.spawnMargin +
      rng() *
        (GRIFFIN_SKY_JOUST_CONFIG.gameWidth -
          GRIFFIN_SKY_JOUST_CONFIG.enemy.spawnMargin * 2);
    const y =
      GRIFFIN_SKY_JOUST_CONFIG.layout.topMargin +
      rng() * (GRIFFIN_SKY_JOUST_CONFIG.gameHeight / 2);
    
    return {
      id: `enemy-${index}-${Math.random().toString(36).substr(2, 9)}`,
      x,
      y,
      vx: (rng() > 0.5 ? 1 : -1) * settings.enemySpeed,
      vy: 0,
      word,
      wordIndex: index,
      radius: GRIFFIN_SKY_JOUST_CONFIG.enemy.radius,
      color: index === 0 ? "#fbbf24" : "#64748b", // Highlight first word
    };
  });
}

export function tickGriffinSkyJoust(
  state: GriffinSkyJoustState,
  dt: number
): GriffinSkyJoustState {
  if (state.status !== "playing") return state;

  const dtSec = dt / 1000;
  const settings = getDifficultySettings(state.difficulty);
  const nextTime = state.gameTime + dt;

  let nextState = { ...state, gameTime: nextTime };

  // 1. Apply Physics to Player
  const { vx } = nextState.player;
  let { x, y, vy } = nextState.player;
  
  vy += settings.gravity * dtSec;
  vy = Math.min(vy, settings.maxVY);
  
  x += vx * dtSec;
  y += vy * dtSec;
  
  // Wrap around horizontally
  if (x < 0) x += GRIFFIN_SKY_JOUST_CONFIG.gameWidth;
  if (x > GRIFFIN_SKY_JOUST_CONFIG.gameWidth) x -= GRIFFIN_SKY_JOUST_CONFIG.gameWidth;
  
  // Constrain Y
  if (y < 50) {
    y = 50;
    vy = 0;
  }
  if (y > GRIFFIN_SKY_JOUST_CONFIG.gameHeight - 50) {
    y = GRIFFIN_SKY_JOUST_CONFIG.gameHeight - 50;
    vy = 0;
  }

  nextState.player = { ...nextState.player, x, y, vx, vy };

  // 2. Move Enemies
  nextState.enemies = nextState.enemies.map(enemy => {
    let ex = enemy.x + enemy.vx * dtSec;
    let evx = enemy.vx;
    
    if (ex < GRIFFIN_SKY_JOUST_CONFIG.enemy.radius || ex > GRIFFIN_SKY_JOUST_CONFIG.gameWidth - GRIFFIN_SKY_JOUST_CONFIG.enemy.radius) {
      evx = -evx;
      ex = enemy.x + evx * dtSec;
    }
    
    return { ...enemy, x: ex, vx: evx };
  });

  // 3. Collision Detection
  nextState = checkCollisions(nextState);

  return nextState;
}

function checkCollisions(state: GriffinSkyJoustState): GriffinSkyJoustState {
  const { player, enemies, targetIndex, words } = state;
  const isInvincible = state.gameTime < player.invincibleUntil;
  
  if (isInvincible) return state;

  const nextState = { ...state };
  let hitEnemyId: string | null = null;

  for (const enemy of enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < player.radius + enemy.radius) {
      // Collision!
      const isAbove = player.y < enemy.y - enemy.radius * 0.5;
      
      if (isAbove) {
        // Strike from above!
        if (enemy.wordIndex === targetIndex) {
          // Success!
          nextState.correctAnswers++;
          nextState.totalAttempts++;
          nextState.score += 100;
          nextState.targetIndex++;
          hitEnemyId = enemy.id;
          
          if (nextState.targetIndex >= words.length) {
            nextState.status = "victory";
          }
        } else {
          // Wrong word but above
          nextState.player.hp--;
          nextState.totalAttempts++;
          nextState.player.invincibleUntil = state.gameTime + GRIFFIN_SKY_JOUST_CONFIG.player.invincibilityDuration;
          // Knockback
          nextState.player.vy = GRIFFIN_SKY_JOUST_CONFIG.player.knockback.y;
        }
      } else {
        // Struck from below or side
        nextState.player.hp--;
        nextState.player.invincibleUntil = state.gameTime + GRIFFIN_SKY_JOUST_CONFIG.player.invincibilityDuration;
        // Knockback
        nextState.player.vy = GRIFFIN_SKY_JOUST_CONFIG.player.knockback.y;
      }
      
      if (nextState.player.hp <= 0) {
        nextState.status = "defeat";
      }
      break; 
    }
  }

  if (hitEnemyId) {
    nextState.enemies = nextState.enemies.filter(e => e.id !== hitEnemyId);
  }

  return nextState;
}

export function flap(state: GriffinSkyJoustState, horizontalDirection: -1 | 0 | 1): GriffinSkyJoustState {
  if (state.status !== "playing") return state;
  
  const settings = getDifficultySettings(state.difficulty);
  
  return {
    ...state,
    player: {
      ...state.player,
      vy: settings.flapImpulse,
      vx: horizontalDirection * settings.horizontalSpeed,
    },
  };
}

export function startGame(state: GriffinSkyJoustState): GriffinSkyJoustState {
  return {
    ...state,
    status: "playing",
  };
}

export function calculateXP(state: GriffinSkyJoustState): number {
  const accuracy = state.totalAttempts > 0 ? state.correctAnswers / state.totalAttempts : 0;
  const survivalBonus = state.player.hp / state.player.maxHp >= 0.5 ? GRIFFIN_SKY_JOUST_CONFIG.xp.survivalBonus : 0;
  const accuracyBonus = accuracy === 1 ? GRIFFIN_SKY_JOUST_CONFIG.xp.accuracyBonus : 0;
  
  return Math.min(
    GRIFFIN_SKY_JOUST_CONFIG.xp.maxXP,
    state.correctAnswers * GRIFFIN_SKY_JOUST_CONFIG.xp.perWord + survivalBonus + accuracyBonus
  );
}
