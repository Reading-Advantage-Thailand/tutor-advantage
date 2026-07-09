import type { Difficulty } from '@/store/useGameStore'

export type StormCastleTowerDifficulty = Difficulty

export type DifficultyConfig = {
  name: string
  wordCount: number
  hazardSpeedMult: number
}

export type GuardType = 'lazy-guard' | 'alert-sentry' | 'elite-watchman'

export const STORM_CASTLE_TOWER_CONFIG = {
  gameWidth: 390,
  gameHeight: 700,
  columns: 4,
  cellSize: 60,
  
  player: {
    moveSpeed: 150,
    lives: 3,
    radius: 20,
  },
  
  window: {
    width: 50,
    height: 45,
    spacing: 10,
  },
  
  hazards: {
    oilInterval: 3000,
    rockInterval: 4000,
    shutterWarning: 2000,
    oilWidth: 40,
    rockRadius: 15,
  },
  
  guardSpeeds: {
    'lazy-guard': 0.6,
    'alert-sentry': 1.0,
    'elite-watchman': 1.5,
  },
  
  difficulties: {
    easy: { name: "Squire's Tower", wordCount: 4, hazardSpeedMult: 0.7 },
    normal: { name: "Knight's Keep", wordCount: 5, hazardSpeedMult: 1.0 },
    hard: { name: "Lord's Citadel", wordCount: 6, hazardSpeedMult: 1.3 },
    extreme: { name: "Lord's Citadel", wordCount: 7, hazardSpeedMult: 1.5 },
  },
  
  xp: {
    perCorrectWord: 1,
    accuracyBonus: 2,
    maxXP: 10,
  },
}

export function getDifficultyConfig(difficulty: StormCastleTowerDifficulty): DifficultyConfig {
  return STORM_CASTLE_TOWER_CONFIG.difficulties[difficulty] ?? STORM_CASTLE_TOWER_CONFIG.difficulties.normal
}

export function getGuardSpeedMult(guardType: GuardType): number {
  return STORM_CASTLE_TOWER_CONFIG.guardSpeeds[guardType] ?? STORM_CASTLE_TOWER_CONFIG.guardSpeeds['alert-sentry']
}
