import type { Difficulty } from '@/store/useGameStore'

export type VillageGuardianDifficulty = Difficulty

export type DifficultyConfig = {
  name: string
  wordCount: number
  timer: number
  monsterSpeed: number
}

export type OpponentType = 'bandits' | 'goblins' | 'dragons'

export const GAME_WIDTH = 390
export const GAME_HEIGHT = 700

export const VILLAGE_GUARDIAN_CONFIG = {
  arenaWidth: 390,
  arenaHeight: 700,

  knightSpeed: 3,
  knightSize: 32,

  villagerSize: 28,
  trailSpacing: 32,

  monsterSize: 36,
  monsterSpeeds: {
    bandits: 1.5,
    goblins: 2.5,
    dragons: 3.5,
  },

  timerDurations: {
    easy: 30000,
    normal: 25000,
    hard: 20000,
    extreme: 15000,
  },

  wrongWordTimePenalty: 2000,

  xpPerCorrectWord: 1,
  accuracyBonusThreshold: 0.9,
  accuracyBonus: 2,
  speedBonusThreshold: 0.5,
  speedBonus: 1,
  survivalBonusThreshold: 3,
  survivalBonus: 1,
  maxXP: 10,

  initialLives: 3,
  invulnerabilityDuration: 1000,

  sanctuaryRadius: 40,
  sanctuaryPosition: { x: 195, y: 620 },

  maxMonsters: 4,
  monsterSpeedScalePerLevel: 0.12,

  difficulties: {
    easy: { name: 'Scout Party', wordCount: 4, timer: 30000, monsterSpeed: 1.5 },
    normal: { name: 'War Band', wordCount: 6, timer: 25000, monsterSpeed: 2.5 },
    hard: { name: 'Full Siege', wordCount: 8, timer: 20000, monsterSpeed: 3.5 },
    extreme: { name: 'Apocalypse', wordCount: 10, timer: 15000, monsterSpeed: 4.5 },
  },
}

export function getDifficultyConfig(difficulty: VillageGuardianDifficulty): DifficultyConfig {
  return VILLAGE_GUARDIAN_CONFIG.difficulties[difficulty] ?? VILLAGE_GUARDIAN_CONFIG.difficulties.normal
}

export function getTimerDuration(difficulty: VillageGuardianDifficulty): number {
  return VILLAGE_GUARDIAN_CONFIG.timerDurations[difficulty] ?? VILLAGE_GUARDIAN_CONFIG.timerDurations.normal
}

export function getMonsterSpeed(opponentType: OpponentType): number {
  return VILLAGE_GUARDIAN_CONFIG.monsterSpeeds[opponentType] ?? VILLAGE_GUARDIAN_CONFIG.monsterSpeeds.bandits
}
