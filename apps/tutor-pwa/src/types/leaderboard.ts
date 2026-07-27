export interface SessionRecord {
  id: string
  gameId: string
  gameName: string
  score: number
  xp: number
  accuracy: number
  timestamp: number
}

export interface GameHighScore {
  gameId: string
  gameName: string
  bestScore: number
  bestXp: number
  lastPlayed: number
}

export interface LeaderboardState {
  sessions: SessionRecord[]
  highScores: Record<string, GameHighScore>
  totalXp: number
}

export const LEADERBOARD_KEY = 'advantage-games-leaderboard'
export const MAX_SESSIONS = 20

export function createEmptyLeaderboard(): LeaderboardState {
  return {
    sessions: [],
    highScores: {},
    totalXp: 0,
  }
}

export function serializeLeaderboard(state: LeaderboardState): string {
  return JSON.stringify(state)
}

export function deserializeLeaderboard(json: string): LeaderboardState {
  try {
    const parsed = JSON.parse(json)
    if (typeof parsed.sessions === 'undefined' || typeof parsed.highScores === 'undefined' || typeof parsed.totalXp === 'undefined') {
      return createEmptyLeaderboard()
    }
    return parsed as LeaderboardState
  } catch {
    return createEmptyLeaderboard()
  }
}

export function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}