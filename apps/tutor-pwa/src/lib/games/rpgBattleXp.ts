interface RpgBattleXpInput {
  playerHealth: number
  playerMaxHealth: number
  turnsTaken: number
  maxTurns: number
  longestStreak: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function calculateRpgBattleXp({
  playerHealth,
  playerMaxHealth,
  turnsTaken,
  maxTurns,
  longestStreak,
}: RpgBattleXpInput): number {
  const safeMaxHealth = Math.max(1, playerMaxHealth)
  const safeMaxTurns = Math.max(1, maxTurns)
  const healthRatio = clamp(playerHealth / safeMaxHealth, 0, 1)
  const turnEfficiency = clamp(1 - (Math.max(1, turnsTaken) - 1) / safeMaxTurns, 0, 1)
  const streakBoost = clamp(longestStreak / 10, 0, 1) * 0.2

  const efficiencyScore = healthRatio * 0.6 + turnEfficiency * 0.4
  const normalizedScore = clamp(efficiencyScore + streakBoost, 0, 1)
  const xp = Math.round(1 + normalizedScore * 9)

  return clamp(xp, 1, 10)
}
