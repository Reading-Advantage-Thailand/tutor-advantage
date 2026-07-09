import type { Difficulty } from '@/store/useGameStore'

export type ShadowGateDungeonDifficulty = Difficulty

export type DifficultyConfig = {
  name: string
  wordCount: number
}

export type CreatureType = 'goblin-scout' | 'orc-hunter' | 'shadow-dragon'

export const GAME_WIDTH = 390
export const GAME_HEIGHT = 700

export const SHADOW_GATE_DUNGEON_CONFIG = {
  arenaWidth: 390,
  arenaHeight: 700,
  gateWidth: 100,
  gateHeight: 60,

  playerSpeed: 200,
  playerRadius: 12,
  initialHealth: 100,
  invincibilityDuration: 1000,

  crystalRadius: 14,
  crystalSpawnMargin: 30,

  // Patrol speeds (px/s) — creature moves along patrol path
  creaturePatrolSpeeds: {
    'goblin-scout': 25,
    'orc-hunter': 35,
    'shadow-dragon': 50,
  },
  // Chase speeds (px/s) — creature speeds up when chasing player
  creatureSpeeds: {
    'goblin-scout': 60,
    'orc-hunter': 80,
    'shadow-dragon': 105,
  },
  creatureRadius: 14,

  // Stealth / patrol mechanics
  sightRadius: 75,         // player must stay beyond this to avoid detection
  chaseDuration: 1500,     // ms creature chases before returning to patrol
  patrolRadius: 70,        // radius of circular patrol path
  patrolCenterX: 195,      // center of patrol circle (game center X)
  patrolCenterY: 350,      // center of patrol circle (game center Y)

  wrongWordDamage: 20,
  creatureCollisionDamage: 25,

  xpPerCorrectWord: 1,
  accuracyBonus: 1,
  speedBonusThreshold: 30000,
  speedBonus: 1,
  survivalBonusThreshold: 50,
  survivalBonus: 1,
  maxXP: 10,

  difficulties: {
    easy: { name: 'Dark Cell', wordCount: 4 },
    normal: { name: 'Forgotten Crypt', wordCount: 5 },
    hard: { name: 'Abyssal Chamber', wordCount: 6 },
    extreme: { name: 'Abyssal Chamber', wordCount: 7 },
  },
}

export function getDifficultyConfig(difficulty: ShadowGateDungeonDifficulty): DifficultyConfig {
  return SHADOW_GATE_DUNGEON_CONFIG.difficulties[difficulty] ?? SHADOW_GATE_DUNGEON_CONFIG.difficulties.normal
}

export function getCreatureSpeed(creatureType: CreatureType): number {
  return SHADOW_GATE_DUNGEON_CONFIG.creatureSpeeds[creatureType] ?? SHADOW_GATE_DUNGEON_CONFIG.creatureSpeeds['orc-hunter']
}

export function getCreaturePatrolSpeed(creatureType: CreatureType): number {
  return SHADOW_GATE_DUNGEON_CONFIG.creaturePatrolSpeeds[creatureType] ?? SHADOW_GATE_DUNGEON_CONFIG.creaturePatrolSpeeds['orc-hunter']
}
