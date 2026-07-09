import type { VocabularyItem } from '@/store/useGameStore'
import type { Difficulty } from '@/store/useGameStore'
import type { RuneType } from './runeForgeChamberConfig'
import { RUNE_FORGE_CHAMBER_CONFIG, getDifficultyConfig, GAME_WIDTH, GAME_HEIGHT } from './runeForgeChamberConfig'

export type GameStatus = 'start' | 'playing' | 'defeat'

export type Position = {
  x: number
  y: number
}

export type WordCircle = {
  id: string
  word: string
  orderIndex: number
  angle: number
  orbitRadius: number
  selected: boolean
}

export type RuneStone = {
  centerX: number
  centerY: number
  radius: number
}

export type Player = {
  health: number
}

export type RuneForgeChamberState = {
  status: GameStatus
  difficulty: Difficulty
  runeType: RuneType
  level: number
  vocabulary: VocabularyItem[]
  player: Player
  runeStone: RuneStone
  circles: WordCircle[]
  currentSentence: VocabularyItem
  words: string[]
  collectedWords: string[]
  targetIndex: number
  correctAnswers: number
  wrongAnswers: number
  timer: number
  maxTimer: number
  gameTime: number
  circleAngle: number
}

export type RuneForgeChamberConfig = {
  difficulty?: Difficulty
  runeType?: RuneType
  rng?: () => number
}

const generateId = () => Math.random().toString(36).substring(2, 9)

export function createRuneForgeChamberState(
  vocabulary: VocabularyItem[],
  config: RuneForgeChamberConfig = {}
): RuneForgeChamberState {
  if (vocabulary.length === 0) {
    throw new Error('Vocabulary cannot be empty')
  }

  const rng = config.rng ?? Math.random
  const difficulty = config.difficulty ?? 'normal'
  const runeType = config.runeType ?? 'common-stone'

  const sentenceIndex = Math.floor(rng() * vocabulary.length)
  const currentSentence = vocabulary[sentenceIndex]
  const words = currentSentence.term.split(' ')

  const diffConfig = getDifficultyConfig(difficulty)
  const wordCount = Math.min(diffConfig.wordCount, words.length)
  const activeWords = words.slice(0, wordCount)

  const player: Player = {
    health: RUNE_FORGE_CHAMBER_CONFIG.initialHealth,
  }

  const runeStone: RuneStone = {
    centerX: GAME_WIDTH / 2,
    centerY: GAME_HEIGHT / 2,
    radius: RUNE_FORGE_CHAMBER_CONFIG.runeStoneRadius,
  }

  const circles: WordCircle[] = activeWords.map((word, index) => {
    const baseAngle = (2 * Math.PI * index) / activeWords.length
    const angleOffset = (rng() - 0.5) * 0.3
    return {
      id: generateId(),
      word,
      orderIndex: index,
      angle: baseAngle + angleOffset,
      orbitRadius: RUNE_FORGE_CHAMBER_CONFIG.circleOrbitRadius,
      selected: false,
    }
  })

  for (let i = circles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tempAngle = circles[i].angle
    circles[i].angle = circles[j].angle
    circles[j].angle = tempAngle
  }

  const level1Timer = diffConfig.timer * 2

  return {
    status: 'playing',
    difficulty,
    runeType,
    level: 1,
    vocabulary,
    player,
    runeStone,
    circles,
    currentSentence,
    words: activeWords,
    collectedWords: [],
    targetIndex: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    timer: level1Timer,
    maxTimer: level1Timer,
    gameTime: 0,
    circleAngle: 0,
  }
}

function advanceRuneForgeLevel(state: RuneForgeChamberState): RuneForgeChamberState {
  const rng = Math.random
  const nextLevel = state.level + 1
  const nextMaxTimer = Math.floor(state.maxTimer * 0.8)
  const diffConfig = getDifficultyConfig(state.difficulty)

  const sentenceIndex = Math.floor(rng() * state.vocabulary.length)
  const nextSentence = state.vocabulary[sentenceIndex]
  const nextWords = nextSentence.term.split(' ')
  const wordCount = Math.min(diffConfig.wordCount, nextWords.length)
  const activeWords = nextWords.slice(0, wordCount)

  const circles: WordCircle[] = activeWords.map((word, index) => {
    const baseAngle = (2 * Math.PI * index) / activeWords.length
    return {
      id: generateId(),
      word,
      orderIndex: index,
      angle: baseAngle,
      orbitRadius: RUNE_FORGE_CHAMBER_CONFIG.circleOrbitRadius,
      selected: false,
    }
  })

  return {
    ...state,
    level: nextLevel,
    currentSentence: nextSentence,
    words: activeWords,
    circles,
    collectedWords: [],
    targetIndex: 0,
    timer: nextMaxTimer,
    maxTimer: nextMaxTimer,
    circleAngle: 0,
  }
}

export function tickRuneForgeChamber(
  state: RuneForgeChamberState,
  deltaMs: number
): RuneForgeChamberState {
  if (state.status !== 'playing') return state

  const newState = { ...state }
  newState.gameTime += deltaMs
  newState.timer -= deltaMs

  if (newState.timer <= 0) {
    newState.status = 'defeat'
    return newState
  }

  if (newState.player.health <= 0) {
    newState.status = 'defeat'
    return newState
  }

  const diffConfig = getDifficultyConfig(state.difficulty)
  const rotationSpeed = diffConfig.circleSpeed * (deltaMs / 1000)
  newState.circleAngle += rotationSpeed

  newState.circles = state.circles.map((circle) => ({
    ...circle,
    angle: circle.angle + rotationSpeed,
  }))

  if (newState.targetIndex >= state.words.length) {
    return advanceRuneForgeLevel(newState)
  }

  return newState
}

export function selectCircle(
  state: RuneForgeChamberState,
  circleId: string
): RuneForgeChamberState {
  if (state.status !== 'playing') return state

  const circle = state.circles.find((c) => c.id === circleId)
  if (!circle || circle.selected) return state

  const targetWord = state.words[state.targetIndex]
  const isCorrect = circle.word === targetWord

  if (isCorrect) {
    const newCircles = state.circles.map((c) =>
      c.id === circleId ? { ...c, selected: true } : c
    )

    const newState = {
      ...state,
      circles: newCircles,
      collectedWords: [...state.collectedWords, circle.word],
      targetIndex: state.targetIndex + 1,
      correctAnswers: state.correctAnswers + 1,
    }

    if (newState.targetIndex >= state.words.length) {
      return advanceRuneForgeLevel(newState)
    }

    return newState
  } else {
    const newHealth = state.player.health - RUNE_FORGE_CHAMBER_CONFIG.wrongWordDamage

    return {
      ...state,
      player: { ...state.player, health: newHealth },
      wrongAnswers: state.wrongAnswers + 1,
      status: newHealth <= 0 ? 'defeat' : state.status,
    }
  }
}

export function getCirclePosition(
  circle: WordCircle,
  runeStone: RuneStone,
  baseAngle: number
): Position {
  const angle = circle.angle + baseAngle
  return {
    x: runeStone.centerX + Math.cos(angle) * circle.orbitRadius,
    y: runeStone.centerY + Math.sin(angle) * circle.orbitRadius,
  }
}

export function calculateXP(state: RuneForgeChamberState): number {
  const baseXP = state.correctAnswers * RUNE_FORGE_CHAMBER_CONFIG.xpPerCorrectWord
  let bonus = 0

  if (state.wrongAnswers === 0) {
    bonus += RUNE_FORGE_CHAMBER_CONFIG.accuracyBonus
  }

  const timeRemaining = state.timer / state.maxTimer
  if (timeRemaining >= RUNE_FORGE_CHAMBER_CONFIG.speedBonusThreshold) {
    bonus += RUNE_FORGE_CHAMBER_CONFIG.speedBonus
  }

  const healthPercent = (state.player.health / RUNE_FORGE_CHAMBER_CONFIG.initialHealth) * 100
  if (healthPercent >= RUNE_FORGE_CHAMBER_CONFIG.survivalBonusThreshold) {
    bonus += RUNE_FORGE_CHAMBER_CONFIG.survivalBonus
  }

  return Math.min(RUNE_FORGE_CHAMBER_CONFIG.maxXP, baseXP + bonus)
}

export function isPointInCircle(
  point: Position,
  circleCenter: Position,
  radius: number
): boolean {
  const dx = point.x - circleCenter.x
  const dy = point.y - circleCenter.y
  return Math.sqrt(dx * dx + dy * dy) <= radius
}
