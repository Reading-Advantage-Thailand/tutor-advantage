import type { VocabularyItem } from '@/store/useGameStore'
import { STORM_CASTLE_TOWER_CONFIG, getDifficultyConfig, getGuardSpeedMult, type StormCastleTowerDifficulty, type GuardType } from './stormCastleTowerConfig'

export type GamePhase = 'start' | 'playing' | 'victory' | 'defeat'

export type Position = {
  col: number
  row: number
}

export type Player = {
  position: Position
  lives: number
  lastMoveTime: number
}

export type WindowState = 'open' | 'closed' | 'collected'

export type GameWindow = {
  id: string
  position: Position
  word: string
  wordIndex: number
  state: WindowState
}

export type HazardType = 'oil' | 'rock'

export type Hazard = {
  id: string
  type: HazardType
  column: number
  y: number
  speed: number
}

export type StormCastleTowerState = {
  phase: GamePhase
  player: Player
  windows: GameWindow[]
  hazards: Hazard[]
  sentence: { term: string; translation: string }
  words: string[]
  targetIndex: number
  correctWords: number
  totalAttempts: number
  gameTime: number
  scrollOffset: number
  difficulty: StormCastleTowerDifficulty
  guardType: GuardType
}

export type StormCastleTowerConfig = {
  rng?: () => number
  difficulty?: StormCastleTowerDifficulty
  guardType?: GuardType
}

export function createStormCastleTowerState(
  vocabulary: VocabularyItem[],
  config: StormCastleTowerConfig = {}
): StormCastleTowerState {
  if (vocabulary.length === 0) {
    throw new Error('Vocabulary cannot be empty')
  }

  const rng = config.rng ?? Math.random
  const difficulty = config.difficulty ?? 'normal'
  const guardType = config.guardType ?? 'alert-sentry'

  const sentenceIndex = Math.floor(rng() * vocabulary.length)
  const sentence = vocabulary[sentenceIndex]
  const words = sentence.term.split(' ')

  const windows = createWindows(words, rng)

  return {
    phase: 'start',
    player: {
      position: { col: Math.floor(STORM_CASTLE_TOWER_CONFIG.columns / 2), row: 0 },
      lives: STORM_CASTLE_TOWER_CONFIG.player.lives,
      lastMoveTime: 0,
    },
    windows,
    hazards: [],
    sentence,
    words,
    targetIndex: 0,
    correctWords: 0,
    totalAttempts: 0,
    gameTime: 0,
    scrollOffset: 0,
    difficulty,
    guardType,
  }
}

function createWindows(words: string[], rng: () => number): GameWindow[] {
  const windows: GameWindow[] = []
  const columns = STORM_CASTLE_TOWER_CONFIG.columns
  const baseRow = 3
  
  words.forEach((word, index) => {
    const col = Math.floor(rng() * columns)
    const row = baseRow + index * 3 + Math.floor(rng() * 2)
    
    windows.push({
      id: `window-${index}`,
      position: { col, row },
      word,
      wordIndex: index,
      state: 'open',
    })
  })
  
  return windows
}

export function movePlayer(
  state: StormCastleTowerState,
  direction: 'up' | 'down' | 'left' | 'right'
): StormCastleTowerState {
  if (state.phase !== 'playing') return state
  
  const now = state.gameTime
  if (now - state.player.lastMoveTime < STORM_CASTLE_TOWER_CONFIG.player.moveSpeed) {
    return state
  }
  
  const { position } = state.player
  let newPos = { ...position }
  
  switch (direction) {
    case 'up':
      newPos = { ...position, row: position.row + 1 }
      break
    case 'down':
      newPos = { ...position, row: Math.max(0, position.row - 1) }
      break
    case 'left':
      newPos = { ...position, col: Math.max(0, position.col - 1) }
      break
    case 'right':
      newPos = { ...position, col: Math.min(STORM_CASTLE_TOWER_CONFIG.columns - 1, position.col + 1) }
      break
  }
  
  return {
    ...state,
    player: {
      ...state.player,
      position: newPos,
      lastMoveTime: now,
    },
  }
}

export function collectWindow(state: StormCastleTowerState): StormCastleTowerState {
  if (state.phase !== 'playing') return state
  
  const { player, windows, targetIndex, words, correctWords, totalAttempts } = state
  
  const adjacentWindows = windows.filter(w => 
    w.state === 'open' &&
    Math.abs(w.position.col - player.position.col) <= 1 &&
    Math.abs(w.position.row - player.position.row) <= 1
  )
  
  if (adjacentWindows.length === 0) return state
  
  // Prioritize exact position, then target index, then first found
  const exactWindow = adjacentWindows.find(
    w => w.position.col === player.position.col && w.position.row === player.position.row
  )
  const adjacentWindow = exactWindow || adjacentWindows.find(w => w.wordIndex === targetIndex) || adjacentWindows[0]
  
  const newTotalAttempts = totalAttempts + 1
  let newTargetIndex = targetIndex
  let newCorrectWords = correctWords
  let newLives = player.lives
  let newWindows = [...windows]
  
  if (adjacentWindow.wordIndex === targetIndex) {
    newCorrectWords++
    newTargetIndex++
    newWindows = windows.map(w =>
      w.id === adjacentWindow.id ? { ...w, state: 'collected' as WindowState } : w
    )
  } else {
    newLives--
    newWindows = windows.map(w =>
      w.id === adjacentWindow.id ? { ...w, state: 'closed' as WindowState } : w
    )
  }
  
  const newPhase = newLives <= 0 ? 'defeat' : 
                   newTargetIndex >= words.length ? 'victory' : state.phase
  
  return {
    ...state,
    player: { ...player, lives: newLives },
    windows: newWindows,
    targetIndex: newTargetIndex,
    correctWords: newCorrectWords,
    totalAttempts: newTotalAttempts,
    phase: newPhase,
  }
}

export function spawnHazard(
  state: StormCastleTowerState,
  rng: () => number = Math.random
): StormCastleTowerState {
  if (state.phase !== 'playing') return state
  
  const guardSpeedMult = getGuardSpeedMult(state.guardType)
  const diffConfig = getDifficultyConfig(state.difficulty)
  const baseSpeed = 100 * diffConfig.hazardSpeedMult * guardSpeedMult
  
  const type: HazardType = rng() < 0.5 ? 'oil' : 'rock'
  const column = Math.floor(rng() * STORM_CASTLE_TOWER_CONFIG.columns)
  
  const hazard: Hazard = {
    id: `hazard-${Date.now()}-${Math.random()}`,
    type,
    column,
    y: -50,
    speed: baseSpeed * (rng() * 0.4 + 0.8),
  }
  
  return {
    ...state,
    hazards: [...state.hazards, hazard],
  }
}

export function advanceStormCastleTowerTime(
  state: StormCastleTowerState,
  dt: number
): StormCastleTowerState {
  if (state.phase !== 'playing') return state

  let nextState: StormCastleTowerState = {
    ...state,
    gameTime: state.gameTime + dt,
  }

  nextState = updateHazards(nextState, dt)
  nextState = updateScroll(nextState)
  nextState = checkHazardCollisions(nextState)

  return nextState
}

function updateHazards(state: StormCastleTowerState, dt: number): StormCastleTowerState {
  const speedFactor = dt / 1000
  
  const updatedHazards = state.hazards
    .map(h => ({
      ...h,
      y: h.y + h.speed * speedFactor,
    }))
    .filter(h => h.y < STORM_CASTLE_TOWER_CONFIG.gameHeight + 100)
  
  return { ...state, hazards: updatedHazards }
}

function updateScroll(state: StormCastleTowerState): StormCastleTowerState {
  const playerRow = state.player.position.row
  const targetScroll = Math.max(0, (playerRow - 5) * STORM_CASTLE_TOWER_CONFIG.cellSize)
  
  return { ...state, scrollOffset: targetScroll }
}

function checkHazardCollisions(state: StormCastleTowerState): StormCastleTowerState {
  const { player, hazards } = state
  
  const cellSize = STORM_CASTLE_TOWER_CONFIG.cellSize
  const playerY = player.position.row * cellSize - state.scrollOffset
  const playerX = player.position.col * cellSize + cellSize / 2
  const playerRadius = STORM_CASTLE_TOWER_CONFIG.player.radius
  
  let hitHazard = false
  const remainingHazards: Hazard[] = []
  
  for (const hazard of hazards) {
    const hazardX = hazard.column * cellSize + cellSize / 2
    
    if (hazard.type === 'oil') {
      const oilWidth = STORM_CASTLE_TOWER_CONFIG.hazards.oilWidth
      if (
        Math.abs(hazardX - playerX) < oilWidth / 2 + playerRadius &&
        Math.abs(hazard.y - playerY) < cellSize / 2 + playerRadius
      ) {
        hitHazard = true
      } else {
        remainingHazards.push(hazard)
      }
    } else {
      const rockRadius = STORM_CASTLE_TOWER_CONFIG.hazards.rockRadius
      const dist = Math.sqrt((hazardX - playerX) ** 2 + (hazard.y - playerY) ** 2)
      if (dist < rockRadius + playerRadius) {
        hitHazard = true
      } else {
        remainingHazards.push(hazard)
      }
    }
  }
  
  if (hitHazard) {
    const newLives = player.lives - 1
    return {
      ...state,
      player: { ...player, lives: newLives },
      hazards: remainingHazards,
      phase: newLives <= 0 ? 'defeat' : state.phase,
    }
  }
  
  return { ...state, hazards: remainingHazards }
}

export function startGame(state: StormCastleTowerState): StormCastleTowerState {
  return {
    ...state,
    phase: 'playing',
    gameTime: 0,
  }
}

export function getGridPosition(col: number, row: number, scrollOffset: number): { x: number; y: number } {
  const cellSize = STORM_CASTLE_TOWER_CONFIG.cellSize
  return {
    x: col * cellSize + cellSize / 2,
    y: row * cellSize - scrollOffset,
  }
}
