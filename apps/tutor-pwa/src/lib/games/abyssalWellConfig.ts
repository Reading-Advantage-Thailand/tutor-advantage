export type AbyssalWellDifficulty = 'easy' | 'medium' | 'hard'

export type DifficultyConfig = {
  name: string
  wordCount: number
}

export type CreatureType = 'goblin-scout' | 'cave-spider' | 'shadow-demon'

export const ABYSSAL_WELL_CONFIG = {
  gameWidth: 390,
  gameHeight: 700,
  lanes: 8,
  rimRadius: 120,
  wellDepth: 5,

  player: {
    fireRate: 300,
    projectileSpeed: 400,
    radius: 18,
  },

  enemy: {
    baseSpeed: 50,
    spawnInterval: 2000,
    radius: 20,
    wordOrbRadius: 25,
  },

  creatureSpeeds: {
    'goblin-scout': 50,
    'cave-spider': 70,
    'shadow-demon': 90,
  },

  difficulties: {
    easy: { name: 'Shallow Well', wordCount: 4 },
    medium: { name: 'Deep Chasm', wordCount: 5 },
    hard: { name: 'Abyss', wordCount: 6 },
  },

  lives: 3,
}

export function getDifficultyConfig(difficulty: AbyssalWellDifficulty): DifficultyConfig {
  return ABYSSAL_WELL_CONFIG.difficulties[difficulty] ?? ABYSSAL_WELL_CONFIG.difficulties.medium
}

export function getCreatureSpeed(creatureType: CreatureType): number {
  return ABYSSAL_WELL_CONFIG.creatureSpeeds[creatureType] ?? ABYSSAL_WELL_CONFIG.creatureSpeeds['cave-spider']
}
