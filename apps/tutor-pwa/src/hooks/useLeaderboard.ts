import { useState, useCallback, useEffect } from 'react'
import {
  LEADERBOARD_KEY,
  MAX_SESSIONS,
  createEmptyLeaderboard,
  deserializeLeaderboard,
  serializeLeaderboard,
  generateSessionId,
  type LeaderboardState,
  type SessionRecord,
  type GameHighScore,
} from '../types/leaderboard'

function loadFromStorage(): LeaderboardState {
  if (typeof window === 'undefined') return createEmptyLeaderboard()
  try {
    const raw = window.localStorage.getItem(LEADERBOARD_KEY)
    if (!raw) return createEmptyLeaderboard()
    return deserializeLeaderboard(raw)
  } catch {
    return createEmptyLeaderboard()
  }
}

function saveToStorage(state: LeaderboardState): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LEADERBOARD_KEY, serializeLeaderboard(state))
}

export function useLeaderboard() {
  const [state, setState] = useState<LeaderboardState>(() => loadFromStorage())

  useEffect(() => {
    saveToStorage(state)
  }, [state])

  const recordSession = useCallback(
    (gameId: string, gameName: string, score: number, xp: number, accuracy: number): SessionRecord => {
      const session: SessionRecord = {
        id: generateSessionId(),
        gameId,
        gameName,
        score,
        xp,
        accuracy,
        timestamp: Date.now(),
      }

      setState((prev) => {
        const newSessions = [session, ...prev.sessions].slice(0, MAX_SESSIONS)

        const existingHighScore = prev.highScores[gameId]
        const updatedHighScore: GameHighScore = existingHighScore
          ? {
              gameId,
              gameName,
              bestScore: Math.max(existingHighScore.bestScore, score),
              bestXp: Math.max(existingHighScore.bestXp, xp),
              lastPlayed: session.timestamp,
            }
          : {
              gameId,
              gameName,
              bestScore: score,
              bestXp: xp,
              lastPlayed: session.timestamp,
            }

        const newHighScores = {
          ...prev.highScores,
          [gameId]: updatedHighScore,
        }

        return {
          sessions: newSessions,
          highScores: newHighScores,
          totalXp: prev.totalXp + xp,
        }
      })

      return session
    },
    []
  )

  const clearHistory = useCallback(() => {
    setState(createEmptyLeaderboard())
  }, [])

  const getLeaderboard = useCallback((): LeaderboardState => {
    return state
  }, [state])

  return {
    recordSession,
    clearHistory,
    getLeaderboard,
  }
}