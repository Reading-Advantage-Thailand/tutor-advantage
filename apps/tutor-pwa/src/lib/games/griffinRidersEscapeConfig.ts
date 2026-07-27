export const GAME_WIDTH = 390
export const GAME_HEIGHT = 844

export const GRIFFIN_RIDERS_ESCAPE_CONFIG = {
  laneWidth: 120,
  horizonY: 200,
  playerY: 700,
  initialLives: 3,
  baseSpeed: 0.005, // Z-decrement per ms
  spawnInterval: 2000, // ms between gate waves
  
  laneX: {
    left: -120,
    center: 0,
    right: 120
  },
  
  difficulties: {
    easy: { speedMult: 0.8, obstacleFreq: 0.1, maxWords: 4, spawnInterval: 2500 },
    normal: { speedMult: 1.0, obstacleFreq: 0.2, maxWords: 6, spawnInterval: 2000 },
    hard: { speedMult: 1.3, obstacleFreq: 0.4, maxWords: 8, spawnInterval: 1500 }
  }
}

export type GriffinRiderDifficultyConfig = typeof GRIFFIN_RIDERS_ESCAPE_CONFIG.difficulties.normal

export function getDifficultyConfig(difficulty: string): GriffinRiderDifficultyConfig {
  switch (difficulty) {
    case 'easy':
      return GRIFFIN_RIDERS_ESCAPE_CONFIG.difficulties.easy
    case 'hard':
      return GRIFFIN_RIDERS_ESCAPE_CONFIG.difficulties.hard
    default:
      return GRIFFIN_RIDERS_ESCAPE_CONFIG.difficulties.normal
  }
}
