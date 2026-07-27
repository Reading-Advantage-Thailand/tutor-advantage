import type { VocabularyItem, Difficulty } from '@/store/useGameStore'
import { GRIFFIN_RIDERS_ESCAPE_CONFIG, getDifficultyConfig } from './griffinRidersEscapeConfig'

export type Lane = 'left' | 'center' | 'right'

export type GameStatus = 'playing' | 'victory' | 'defeat'

export type WorldObject = {
  id: string
  z: number // 100 (far) to 0 (near)
  lane: Lane
  type: 'gate' | 'obstacle'
  word?: string
  orderIndex?: number
  collisionTriggered?: boolean
}

export type GriffinRiderState = {
  status: GameStatus
  difficulty: Difficulty
  lives: number
  score: number
  combo: number
  collectedWords: string[]
  targetIndex: number
  objects: WorldObject[]
  currentSentence: VocabularyItem
  words: string[]
  correctAnswers: number
  totalAttempts: number
  sentencesCompleted: number
  gameTime: number
  spawnTimer: number
  playerLane: Lane
}

const generateId = () => Math.random().toString(36).substring(2, 9)

const getLaneFromRng = (rng: () => number): Lane => {
  const roll = rng()
  if (roll < 0.33) return 'left'
  if (roll < 0.66) return 'center'
  return 'right'
}

export function createGriffinRidersEscapeState(
  vocabulary: VocabularyItem[],
  config: { difficulty?: Difficulty; rng?: () => number } = {}
): GriffinRiderState {
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
    lives: GRIFFIN_RIDERS_ESCAPE_CONFIG.initialLives,
    score: 0,
    combo: 0,
    collectedWords: [],
    targetIndex: 0,
    objects: [],
    currentSentence,
    words,
    correctAnswers: 0,
    totalAttempts: 0,
    sentencesCompleted: 0,
    gameTime: 0,
    spawnTimer: 0,
    playerLane: 'center'
  }
}

export function spawnWave(
  state: GriffinRiderState,
  rng: () => number = Math.random
): GriffinRiderState {
  if (state.status !== 'playing') return state

  const diffConfig = getDifficultyConfig(state.difficulty)
  const isObstacleWave = rng() < diffConfig.obstacleFreq
  const newObjects: WorldObject[] = []

  if (isObstacleWave) {
    // Spawn 1 or 2 obstacles in random lanes
    const obstacleCount = rng() < 0.5 ? 1 : 2
    const usedLanes = new Set<Lane>()
    for (let i = 0; i < obstacleCount; i++) {
      let lane = getLaneFromRng(rng)
      while (usedLanes.has(lane)) {
        lane = getLaneFromRng(rng)
      }
      usedLanes.add(lane)
      newObjects.push({
        id: generateId(),
        z: 100,
        lane,
        type: 'obstacle'
      })
    }
  } else {
    // Spawn gates
    // One gate is correct, others are decoys
    const correctLane = getLaneFromRng(rng)
    const targetWord = state.words[state.targetIndex]
    
    // Correct gate
    newObjects.push({
      id: generateId(),
      z: 100,
      lane: correctLane,
      type: 'gate',
      word: targetWord,
      orderIndex: state.targetIndex
    })

    // Decoy gates for other lanes
    const lanes: Lane[] = ['left', 'center', 'right']
    lanes.forEach(lane => {
      if (lane !== correctLane) {
        let decoyIndex = Math.floor(rng() * state.words.length)
        let retries = 0
        while (decoyIndex === state.targetIndex && retries < 10) {
          decoyIndex = Math.floor(rng() * state.words.length)
          retries++
        }
        newObjects.push({
          id: generateId(),
          z: 100,
          lane,
          type: 'gate',
          word: state.words[decoyIndex],
          orderIndex: decoyIndex
        })
      }
    })
  }

  return {
    ...state,
    objects: [...state.objects, ...newObjects]
  }
}

export function tickGriffinRidersEscape(
  state: GriffinRiderState,
  vocabulary: VocabularyItem[],
  deltaMs: number,
  rng: () => number = Math.random
): GriffinRiderState {
  if (state.status !== 'playing') return state

  const diffConfig = getDifficultyConfig(state.difficulty)
  const speed = GRIFFIN_RIDERS_ESCAPE_CONFIG.baseSpeed * diffConfig.speedMult
  const spawnInterval = diffConfig.spawnInterval

  let newState = { ...state }
  newState.gameTime += deltaMs
  newState.spawnTimer += deltaMs

  // Move objects
  newState.objects = state.objects
    .map(obj => ({
      ...obj,
      z: obj.z - speed * deltaMs
    }))
    .filter(obj => obj.z > -10) // Keep slightly past 0 for exit animation

  // Collision detection
  newState.objects.forEach(obj => {
    if (!obj.collisionTriggered && obj.z <= 5 && obj.z >= -5) {
      if (obj.lane === state.playerLane) {
        obj.collisionTriggered = true
        if (obj.type === 'obstacle') {
          newState.lives -= 1
          newState.combo = 0
          newState.totalAttempts += 1
          if (newState.lives <= 0) newState.status = 'defeat'
        } else if (obj.type === 'gate') {
          newState.totalAttempts += 1
          if (obj.orderIndex === state.targetIndex) {
            newState.score += 10 + state.combo * 2
            newState.correctAnswers += 1
            newState.combo += 1
            newState.collectedWords.push(obj.word!)
            newState.targetIndex += 1
            
            if (newState.targetIndex >= state.words.length) {
              newState.sentencesCompleted += 1
              // Transition to next sentence or victory
              // For MVP, just victory if session done
              newState.status = 'victory' 
            }
          } else {
            newState.lives -= 1
            newState.combo = 0
            if (newState.lives <= 0) newState.status = 'defeat'
          }
        }
      }
    }
  })

  // Spawn new wave
  if (newState.spawnTimer >= spawnInterval) {
    newState = spawnWave(newState, rng)
    newState.spawnTimer = 0
  }

  return newState
}

export function calculateXP(params: {
  correctAnswers: number
  totalAttempts: number
  lives: number
  initialLives: number
  gameTime: number
}): number {
  if (params.totalAttempts === 0) return 0

  const accuracy = params.correctAnswers / params.totalAttempts
  const baseXP = params.correctAnswers

  let bonus = 0
  if (accuracy === 1) bonus += 2 // Perfect accuracy bonus
  if (params.lives / params.initialLives >= 0.5) bonus += 1 // Survival bonus
  if (params.gameTime < 30000) bonus += 1 // Speed bonus (under 30s)

  return Math.min(10, baseXP + bonus)
}

export function switchLane(state: GriffinRiderState, direction: 'left' | 'right'): GriffinRiderState {
  if (state.status !== 'playing') return state

  const lanes: Lane[] = ['left', 'center', 'right']
  const currentIndex = lanes.indexOf(state.playerLane)
  let nextIndex = currentIndex

  if (direction === 'left') {
    nextIndex = Math.max(0, currentIndex - 1)
  } else {
    nextIndex = Math.min(lanes.length - 1, currentIndex + 1)
  }

  return {
    ...state,
    playerLane: lanes[nextIndex]
  }
}
