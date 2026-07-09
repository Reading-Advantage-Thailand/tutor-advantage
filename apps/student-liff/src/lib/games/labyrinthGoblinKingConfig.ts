import type { Difficulty } from '@/store/useGameStore'

export type LabyrinthDifficulty = Difficulty

export type LabyrinthDifficultyConfig = {
  name: string
  wordCount: number
  lives: number
  goblinCount: number
}

export type GoblinType = 'scout' | 'warrior' | 'elite'

export const GAME_WIDTH = 390
export const GAME_HEIGHT = 700

export const LABYRINTH_CONFIG = {
  arenaWidth: 390,
  arenaHeight: 700,

  tileSize: 32,
  mazeCols: 11,
  mazeRows: 15,

  playerSpeed: 3,
  playerSize: 28,

  goblinSize: 28,
  goblinSpeeds: {
    scout: 1.5,
    warrior: 2,
    elite: 2.5,
  },

  orbSize: 24,

  heroicAuraDuration: 6000,

  difficulties: {
    easy: { name: 'Small Dungeon', wordCount: 4, lives: 3, goblinCount: 2 },
    normal: { name: 'Medium Dungeon', wordCount: 5, lives: 3, goblinCount: 3 },
    hard: { name: 'Large Dungeon', wordCount: 6, lives: 2, goblinCount: 4 },
    extreme: { name: 'Abyss', wordCount: 7, lives: 2, goblinCount: 5 },
  },

  xpPerCorrectWord: 1,
  xpPerGoblinEaten: 1,
  maxXP: 10,

  invulnerabilityDuration: 1000,
  chaseRange: 100,
}

export function getDifficultyConfig(difficulty: LabyrinthDifficulty): LabyrinthDifficultyConfig {
  return LABYRINTH_CONFIG.difficulties[difficulty] ?? LABYRINTH_CONFIG.difficulties.normal
}

export function getGoblinSpeed(goblinType: GoblinType): number {
  return LABYRINTH_CONFIG.goblinSpeeds[goblinType] ?? LABYRINTH_CONFIG.goblinSpeeds.scout
}
