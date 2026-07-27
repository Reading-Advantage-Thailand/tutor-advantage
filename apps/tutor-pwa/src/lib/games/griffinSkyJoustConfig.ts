export type GriffinSkyJoustDifficulty = 'easy' | 'medium' | 'hard';

export type GriffinSkyJoustDifficultySettings = {
  gravity: number;
  flapImpulse: number;
  horizontalSpeed: number;
  friction: number;
  maxVY: number;
  enemySpeed: number;
  initialHp: number;
  wordCount: number;
};

export const GRIFFIN_SKY_JOUST_CONFIG = {
  gameWidth: 390,
  gameHeight: 700,
  
  player: {
    radius: 20,
    invincibilityDuration: 1500,
    knockback: { x: 200, y: -200 },
  },
  
  enemy: {
    radius: 25,
    spawnMargin: 50,
  },
  
  layout: {
    hudHeight: 60,
    topMargin: 100,
  },

  xp: {
    perWord: 1,
    accuracyBonus: 2,
    survivalBonus: 2,
    maxXP: 10,
  },

  difficulties: {
    easy: {
      gravity: 600,
      flapImpulse: -300,
      horizontalSpeed: 120,
      friction: 0.99,
      maxVY: 500,
      enemySpeed: 60,
      initialHp: 5,
      wordCount: 4,
    },
    medium: {
      gravity: 800,
      flapImpulse: -350,
      horizontalSpeed: 150,
      friction: 0.98,
      maxVY: 600,
      enemySpeed: 100,
      initialHp: 3,
      wordCount: 5,
    },
    hard: {
      gravity: 1000,
      flapImpulse: -400,
      horizontalSpeed: 200,
      friction: 0.97,
      maxVY: 800,
      enemySpeed: 140,
      initialHp: 2,
      wordCount: 6,
    },
  },
};

export function getDifficultySettings(difficulty: GriffinSkyJoustDifficulty): GriffinSkyJoustDifficultySettings {
  return GRIFFIN_SKY_JOUST_CONFIG.difficulties[difficulty] || GRIFFIN_SKY_JOUST_CONFIG.difficulties.medium;
}
