import type { Difficulty } from '@/store/useGameStore'

export type RuneForgeChamberDifficulty = Difficulty

export type DifficultyConfig = {
  name: string
  wordCount: number
  timer: number
  circleSpeed: number
}

export type RuneType = 'common-stone' | 'rare-crystal' | 'void-essence'

export const GAME_WIDTH = 390
export const GAME_HEIGHT = 700

export const RUNE_FORGE_CHAMBER_CONFIG = {
  arenaWidth: 390,
  arenaHeight: 700,
  runeStoneRadius: 80,

  circleRadius: 35,
  circleOrbitRadius: 200,
  circleSpeed: 0.5,
  minTouchTarget: 44,

  timerDurations: {
    easy: 15000,
    normal: 12000,
    hard: 10000,
    extreme: 8000,
  },

  initialHealth: 100,
  wrongWordDamage: 15,

  xpPerCorrectWord: 1,
  accuracyBonus: 2,
  speedBonusThreshold: 0.25,
  speedBonus: 1,
  survivalBonusThreshold: 50,
  survivalBonus: 1,
  maxXP: 10,

  difficulties: {
    easy: { name: 'Apprentice', wordCount: 4, timer: 15000, circleSpeed: 0.3 },
    normal: { name: 'Journeyman', wordCount: 6, timer: 12000, circleSpeed: 0.5 },
    hard: { name: 'Master', wordCount: 8, timer: 10000, circleSpeed: 0.7 },
    extreme: { name: 'Grandmaster', wordCount: 10, timer: 8000, circleSpeed: 0.9 },
  },
}

export function getDifficultyConfig(difficulty: RuneForgeChamberDifficulty): DifficultyConfig {
  return RUNE_FORGE_CHAMBER_CONFIG.difficulties[difficulty] ?? RUNE_FORGE_CHAMBER_CONFIG.difficulties.normal
}

export function getTimerDuration(difficulty: RuneForgeChamberDifficulty): number {
  return RUNE_FORGE_CHAMBER_CONFIG.timerDurations[difficulty] ?? RUNE_FORGE_CHAMBER_CONFIG.timerDurations.normal
}
