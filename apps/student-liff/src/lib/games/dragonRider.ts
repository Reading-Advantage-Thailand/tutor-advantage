import type { VocabularyItem } from '@/store/useGameStore'
import { calculateXP } from './xp'

export type GateSide = 'left' | 'right'

export type DragonRiderRound = {
  term: string
  correctTranslation: string
  decoyTranslation: string
  correctSide: GateSide
}

export type DragonRiderState = {
  status: 'running' | 'boss'
  durationMs: number
  elapsedMs: number
  attempts: number
  correctAnswers: number
  dragonCount: number
  round: DragonRiderRound
}

export type DragonRiderResults = {
  accuracy: number
  bossPower: number
  victory: boolean
  xp: number
  correctAnswers: number
  totalAttempts: number
  dragonCount: number
}

type DragonRiderConfig = {
  durationMs?: number
  rng?: () => number
}

type DragonRiderResultInput = {
  correctAnswers: number
  totalAttempts: number
  dragonCount: number
}

const DEFAULT_DURATION_MS = 150000

const pickIndex = (rng: () => number, max: number) => Math.min(max - 1, Math.floor(rng() * max))

const getGateSide = (rng: () => number): GateSide => (rng() < 0.5 ? 'left' : 'right')

const createGateRound = (vocabulary: VocabularyItem[], rng: () => number): DragonRiderRound => {
  if (vocabulary.length === 0) {
    return {
      term: '',
      correctTranslation: '',
      decoyTranslation: '',
      correctSide: 'left',
    }
  }

  const correctIndex = pickIndex(rng, vocabulary.length)
  let decoyIndex = pickIndex(rng, vocabulary.length)
  if (decoyIndex === correctIndex && vocabulary.length > 1) {
    decoyIndex = (correctIndex + 1) % vocabulary.length
  }

  const correctItem = vocabulary[correctIndex]
  const decoyItem = vocabulary[decoyIndex]

  return {
    term: correctItem.term,
    correctTranslation: correctItem.translation,
    decoyTranslation: decoyItem.translation,
    correctSide: getGateSide(rng),
  }
}

export const createDragonRiderState = (
  vocabulary: VocabularyItem[],
  { durationMs = DEFAULT_DURATION_MS, rng = Math.random }: DragonRiderConfig = {}
): DragonRiderState => ({
  status: 'running',
  durationMs,
  elapsedMs: 0,
  attempts: 0,
  correctAnswers: 0,
  dragonCount: 1,
  round: createGateRound(vocabulary, rng),
})

export const selectGate = (
  state: DragonRiderState,
  side: GateSide,
  vocabulary: VocabularyItem[],
  rng: () => number = Math.random
): DragonRiderState => {
  if (state.status !== 'running') return state

  const isCorrect = side === state.round.correctSide
  const nextDragonCount = isCorrect
    ? state.dragonCount + 1
    : Math.max(1, state.dragonCount - 1)

  return {
    ...state,
    attempts: state.attempts + 1,
    correctAnswers: state.correctAnswers + (isCorrect ? 1 : 0),
    dragonCount: nextDragonCount,
    round: createGateRound(vocabulary, rng),
  }
}

export const advanceDragonRiderTime = (
  state: DragonRiderState,
  deltaMs: number
): DragonRiderState => {
  if (state.status !== 'running') return state

  const nextElapsed = Math.min(state.elapsedMs + deltaMs, state.durationMs)
  const nextStatus = nextElapsed >= state.durationMs ? 'boss' : 'running'

  return {
    ...state,
    elapsedMs: nextElapsed,
    status: nextStatus,
  }
}

export const calculateBossPower = (totalAttempts: number): number =>
  Math.max(3, Math.ceil(totalAttempts * 0.75))

export const getDragonRiderResults = ({
  correctAnswers,
  totalAttempts,
  dragonCount,
}: DragonRiderResultInput): DragonRiderResults => {
  const accuracy = totalAttempts > 0 ? correctAnswers / totalAttempts : 0
  const bossPower = calculateBossPower(totalAttempts)
  const victory = dragonCount >= bossPower
  const xp = calculateXP(0, correctAnswers, totalAttempts)

  return {
    accuracy,
    bossPower,
    victory,
    xp,
    correctAnswers,
    totalAttempts,
    dragonCount,
  }
}
