export const BASE_ENEMY_HEALTH = 100
export const BASE_XP_CAP = 10
export const BASE_ENEMY_DAMAGE_MIN = 6
export const BASE_ENEMY_DAMAGE_MAX = 10

/**
 * Scales enemy health from the base value using the selection multiplier.
 */
export function scaleEnemyHealth(multiplier: number, baseHealth: number = BASE_ENEMY_HEALTH): number {
  return Math.round(baseHealth * multiplier)
}

/**
 * Scales a base XP value using the selection multiplier.
 */
export function scaleBattleXp(baseXp: number, multiplier: number): number {
  return Math.round(baseXp * multiplier)
}

/**
 * Returns the scaled enemy damage range based on the selection multiplier.
 */
export function getEnemyDamageRange(multiplier: number): { min: number; max: number } {
  const scaledMax = Math.round(BASE_ENEMY_DAMAGE_MAX * multiplier)
  return {
    min: BASE_ENEMY_DAMAGE_MIN,
    max: Math.max(BASE_ENEMY_DAMAGE_MIN, scaledMax),
  }
}

/**
 * Rolls a random enemy damage value within the scaled range.
 */
export function rollEnemyDamage(multiplier: number, rng: () => number = Math.random): number {
  const range = getEnemyDamageRange(multiplier)
  const span = range.max - range.min + 1
  return Math.floor(rng() * span) + range.min
}
