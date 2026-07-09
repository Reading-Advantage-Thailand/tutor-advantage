import type { Difficulty } from '@/store/useGameStore'
import { SPELLWEAVERS_RUN_CONFIG, GAME_HEIGHT, getDifficultyConfig } from './spellweaversRunConfig'

export type SentenceItem = {
  term: string
  translation: string
}

export type Lane = 'left' | 'center' | 'right'

export type GameStatus = 'start' | 'playing' | 'victory' | 'defeat'

export type WordOrb = {
  id: string
  word: string
  orderIndex: number
  lane: Lane
  y: number
  collected: boolean
}

export type SpellweaversRunState = {
  status: GameStatus
  difficulty: Difficulty
  mana: number
  score: number
  combo: number
  collectedWords: string[]
  targetIndex: number
  orbs: WordOrb[]
  currentSentence: SentenceItem
  words: string[]
  correctAnswers: number
  totalAttempts: number
  sentencesCompleted: number
  gameTime: number
  spawnTimer: number
}

export type SpellweaversRunConfig = {
  difficulty?: Difficulty
  rng?: () => number
}

const generateId = () => Math.random().toString(36).substring(2, 9)

const getLaneFromRng = (rng: () => number): Lane => {
  const roll = rng()
  if (roll < 0.33) return 'left'
  if (roll < 0.66) return 'center'
  return 'right'
}

export function createSpellweaversRunState(
  vocabulary: SentenceItem[],
  config: SpellweaversRunConfig = {}
): SpellweaversRunState {
  if (vocabulary.length === 0) {
    throw new Error('Vocabulary cannot be empty')
  }

  const rng = config.rng ?? Math.random
  const difficulty = config.difficulty ?? 'normal'

  const sentenceIndex = Math.floor(rng() * vocabulary.length)
  const currentSentence = vocabulary[sentenceIndex]
  const words = currentSentence.term.split(' ')

  return {
    status: 'playing',
    difficulty,
    mana: SPELLWEAVERS_RUN_CONFIG.initialMana,
    score: 0,
    combo: 0,
    collectedWords: [],
    targetIndex: 0,
    orbs: [],
    currentSentence,
    words,
    correctAnswers: 0,
    totalAttempts: 0,
    sentencesCompleted: 0,
    gameTime: 0,
    spawnTimer: 0,
  }
}

export function spawnOrb(
  state: SpellweaversRunState,
  wordIndex: number,
  lane?: Lane,
  rng: () => number = Math.random
): SpellweaversRunState {
  if (state.status !== 'playing') return state
  if (wordIndex < 0 || wordIndex >= state.words.length) return state

  const assignedLane = lane ?? getLaneFromRng(rng)
  const orb: WordOrb = {
    id: generateId(),
    word: state.words[wordIndex],
    orderIndex: wordIndex,
    lane: assignedLane,
    y: SPELLWEAVERS_RUN_CONFIG.scrollHeight / 2,
    collected: false,
  }

  return {
    ...state,
    orbs: [...state.orbs, orb],
  }
}

export function tickSpellweaversRun(
  state: SpellweaversRunState,
  vocabulary: SentenceItem[],
  deltaMs: number,
  rng: () => number = Math.random
): SpellweaversRunState {
  if (state.status !== 'playing') return state

  const diffConfig = getDifficultyConfig(state.difficulty)
  const scrollSpeed = diffConfig.scrollSpeed
  const spawnInterval = diffConfig.spawnInterval

  let newState = { ...state }
  newState.gameTime += deltaMs
  newState.spawnTimer += deltaMs

  const pixelsPerMs = scrollSpeed / 1000
  newState.orbs = state.orbs
    .map(orb => ({
      ...orb,
      y: orb.y + pixelsPerMs * deltaMs,
    }))
    .filter(orb => orb.y <= GAME_HEIGHT + SPELLWEAVERS_RUN_CONFIG.collectionZoneHeight)

  if (newState.spawnTimer >= spawnInterval && newState.orbs.length < state.words.length) {
    const spawnedWords = new Set(newState.orbs.map(o => o.orderIndex))
    let nextWordIndex = -1
    for (let i = 0; i < state.words.length; i++) {
      if (!spawnedWords.has(i)) {
        nextWordIndex = i
        break
      }
    }
    if (nextWordIndex >= 0) {
      newState = spawnOrb(newState, nextWordIndex, undefined, rng)
      newState.spawnTimer = 0
    }
  }

  if (newState.mana <= 0) {
    newState.status = 'defeat'
  }

  return newState
}

export function collectOrb(
  state: SpellweaversRunState,
  lane: Lane
): SpellweaversRunState {
  if (state.status !== 'playing') return state

  const collectionZoneTop = GAME_HEIGHT - SPELLWEAVERS_RUN_CONFIG.collectionZoneHeight
  const collectionZoneBottom = GAME_HEIGHT

  const orbInLane = state.orbs.find(
    orb => orb.lane === lane &&
      !orb.collected &&
      orb.y >= collectionZoneTop &&
      orb.y <= collectionZoneBottom
  )

  if (!orbInLane) return state

  const targetWord = state.words[state.targetIndex]
  const isCorrect = orbInLane.word === targetWord

  const newOrbs = state.orbs.filter(o => o.id !== orbInLane.id)
  const newTotalAttempts = state.totalAttempts + 1

  if (isCorrect) {
    const newCollectedWords = [...state.collectedWords, orbInLane.word]
    const newTargetIndex = state.targetIndex + 1
    const newCombo = state.combo + 1
    const newScore = state.score + 10 + Math.floor(state.combo * SPELLWEAVERS_RUN_CONFIG.comboMultiplier * 10)
    const newCorrectAnswers = state.correctAnswers + 1

    const allWordsCollected = newTargetIndex >= state.words.length

    return {
      ...state,
      orbs: newOrbs,
      collectedWords: newCollectedWords,
      targetIndex: newTargetIndex,
      combo: newCombo,
      score: newScore,
      correctAnswers: newCorrectAnswers,
      totalAttempts: newTotalAttempts,
      status: allWordsCollected ? 'victory' : 'playing',
      sentencesCompleted: allWordsCollected ? state.sentencesCompleted + 1 : state.sentencesCompleted,
    }
  } else {
    const newMana = Math.max(0, state.mana - SPELLWEAVERS_RUN_CONFIG.wrongWordPenalty)

    return {
      ...state,
      orbs: newOrbs,
      mana: newMana,
      combo: 0,
      totalAttempts: newTotalAttempts,
      status: newMana <= 0 ? 'defeat' : 'playing',
    }
  }
}

export function calculateSpellweaversRunXP(
  state: SpellweaversRunState,
  totalCorrect: number,
  totalAttempts: number
): number {
  if (totalAttempts === 0) return 0

  const accuracy = totalCorrect / totalAttempts
  const baseXP = Math.min(5, totalCorrect)

  let bonus = 0
  if (accuracy === 1 && totalCorrect > 0) bonus += 2 // Perfect accuracy bonus
  if (state.mana / SPELLWEAVERS_RUN_CONFIG.initialMana >= 0.5) bonus += 1 // Survival bonus
  if (state.gameTime < 120000) bonus += 1 // Speed bonus (under 2 min)
  if (state.sentencesCompleted >= 1) bonus += 1 // Progression bonus

  return Math.min(10, baseXP + bonus)
}
