import type { VocabularyItem } from '@/store/useGameStore'
import { ABYSSAL_WELL_CONFIG, getCreatureSpeed, type AbyssalWellDifficulty, type CreatureType } from './abyssalWellConfig'

export type GamePhase = 'start' | 'playing' | 'victory' | 'defeat'

export type Player = {
  lane: number
  lives: number
  lastFireTime: number
}

export type Enemy = {
  id: string
  lane: number
  depth: number // 0 = far end (spawn), 1 = rim (reached)
  word: string
  wordIndex: number
  type: CreatureType
}

export type Projectile = {
  id: string
  lane: number
  depth: number // 0 = far end, 1 = rim (player position)
}

export type AbyssalWellState = {
  phase: GamePhase
  player: Player
  enemies: Enemy[]
  projectiles: Projectile[]
  sentence: { term: string; translation: string }
  words: string[]
  targetIndex: number
  correctWords: number
  totalAttempts: number
  gameTime: number
  difficulty: AbyssalWellDifficulty
  creatureType: CreatureType
}

export type AbyssalWellConfig = {
  rng?: () => number
  difficulty?: AbyssalWellDifficulty
  creatureType?: CreatureType
}

export function createAbyssalWellState(
  vocabulary: VocabularyItem[],
  config: AbyssalWellConfig = {}
): AbyssalWellState {
  if (vocabulary.length === 0) {
    throw new Error('Vocabulary cannot be empty')
  }

  const rng = config.rng ?? Math.random
  const difficulty = config.difficulty ?? 'medium'
  const creatureType = config.creatureType ?? 'cave-spider'

  const sentenceIndex = Math.floor(rng() * vocabulary.length)
  const sentence = vocabulary[sentenceIndex]
  const words = sentence.term.split(' ')

  return {
    phase: 'start',
    player: {
      lane: 0,
      lives: ABYSSAL_WELL_CONFIG.lives,
      lastFireTime: 0,
    },
    enemies: [],
    projectiles: [],
    sentence,
    words,
    targetIndex: 0,
    correctWords: 0,
    totalAttempts: 0,
    gameTime: 0,
    difficulty,
    creatureType,
  }
}

export function getLanePosition(lane: number, depth: number): { x: number; y: number } {
  const normalizedLane = ((lane % ABYSSAL_WELL_CONFIG.lanes) + ABYSSAL_WELL_CONFIG.lanes) % ABYSSAL_WELL_CONFIG.lanes
  const angle = (normalizedLane / ABYSSAL_WELL_CONFIG.lanes) * Math.PI * 2 - Math.PI / 2
  
  const centerX = ABYSSAL_WELL_CONFIG.gameWidth / 2
  const rimY = ABYSSAL_WELL_CONFIG.gameHeight - ABYSSAL_WELL_CONFIG.rimRadius - 50
  
  const maxRadius = ABYSSAL_WELL_CONFIG.rimRadius * 2
  const minRadius = 20
  
  const radius = minRadius + (1 - depth) * (maxRadius - minRadius)
  
  const x = centerX + Math.cos(angle) * radius
  const y = rimY - (1 - depth) * (ABYSSAL_WELL_CONFIG.gameHeight - rimY - 50)
  
  return { x, y }
}

export function rotatePlayer(state: AbyssalWellState, direction: number): AbyssalWellState {
  const newLane = ((state.player.lane + direction) % ABYSSAL_WELL_CONFIG.lanes + ABYSSAL_WELL_CONFIG.lanes) % ABYSSAL_WELL_CONFIG.lanes
  
  return {
    ...state,
    player: {
      ...state.player,
      lane: newLane,
    },
  }
}

export function fireProjectile(state: AbyssalWellState): AbyssalWellState {
  if (state.phase !== 'playing') return state
  
  const now = state.gameTime
  if (now - state.player.lastFireTime < ABYSSAL_WELL_CONFIG.player.fireRate) {
    return state
  }

  const projectile: Projectile = {
    id: `proj-${Date.now()}-${Math.random()}`,
    lane: state.player.lane,
    depth: 1, // starts at rim (player position)
  }

  return {
    ...state,
    player: {
      ...state.player,
      lastFireTime: now,
    },
    projectiles: [...state.projectiles, projectile],
  }
}

export function advanceAbyssalWellTime(
  state: AbyssalWellState,
  dt: number
): AbyssalWellState {
  if (state.phase !== 'playing') return state

  let nextState: AbyssalWellState = {
    ...state,
    gameTime: state.gameTime + dt,
  }

  nextState = updateProjectiles(nextState, dt)
  nextState = updateEnemies(nextState, dt)
  nextState = checkCollisions(nextState)
  nextState = checkEnemyReachRim(nextState)
  nextState = checkVictoryCondition(nextState)

  return nextState
}

function updateProjectiles(state: AbyssalWellState, dt: number): AbyssalWellState {
  const speedFactor = dt / 1000
  const projectileSpeed = ABYSSAL_WELL_CONFIG.player.projectileSpeed / 1000

  const updatedProjectiles = state.projectiles
    .map(p => ({
      ...p,
      depth: p.depth - projectileSpeed * speedFactor * 2,
    }))
    .filter(p => p.depth > 0)

  return { ...state, projectiles: updatedProjectiles }
}

function updateEnemies(state: AbyssalWellState, dt: number): AbyssalWellState {
  const speedFactor = dt / 1000
  const creatureSpeed = getCreatureSpeed(state.creatureType)
  const baseSpeed = creatureSpeed / ABYSSAL_WELL_CONFIG.gameHeight

  const updatedEnemies = state.enemies.map(e => ({
    ...e,
    depth: e.depth + baseSpeed * speedFactor,
  }))

  return { ...state, enemies: updatedEnemies }
}

function checkCollisions(state: AbyssalWellState): AbyssalWellState {
  const { enemies, projectiles, targetIndex, correctWords, totalAttempts } = state
  
  let newEnemies = [...enemies]
  let newProjectiles = [...projectiles]
  let newTargetIndex = targetIndex
  let newCorrectWords = correctWords
  let newTotalAttempts = totalAttempts

  for (let i = newProjectiles.length - 1; i >= 0; i--) {
    const proj = newProjectiles[i]
    
    for (let j = newEnemies.length - 1; j >= 0; j--) {
      const enemy = newEnemies[j]
      
      if (proj.lane === enemy.lane && Math.abs(proj.depth - enemy.depth) < 0.15) {
        newTotalAttempts++
        
        if (enemy.wordIndex === newTargetIndex) {
          newCorrectWords++
          newTargetIndex++
        }
        
        newEnemies = newEnemies.filter((_, idx) => idx !== j)
        newProjectiles = newProjectiles.filter((_, idx) => idx !== i)
        break
      }
    }
  }

  return {
    ...state,
    enemies: newEnemies,
    projectiles: newProjectiles,
    targetIndex: newTargetIndex,
    correctWords: newCorrectWords,
    totalAttempts: newTotalAttempts,
  }
}

function checkEnemyReachRim(state: AbyssalWellState): AbyssalWellState {
  const { enemies, player } = state
  
  const breachedEnemies = enemies.filter(e => e.depth >= 1)
  
  if (breachedEnemies.length === 0) return state

  const newLives = player.lives - breachedEnemies.length
  const newEnemies = enemies.filter(e => e.depth < 1)

  return {
    ...state,
    player: {
      ...player,
      lives: Math.max(0, newLives),
    },
    enemies: newEnemies,
    phase: newLives <= 0 ? 'defeat' : state.phase,
  }
}

function checkVictoryCondition(state: AbyssalWellState): AbyssalWellState {
  if (state.targetIndex >= state.words.length) {
    return { ...state, phase: 'victory' }
  }
  return state
}

export function spawnEnemy(
  state: AbyssalWellState,
  rng: () => number = Math.random
): AbyssalWellState {
  if (state.phase !== 'playing') return state
  
  const unassignedWords = state.words
    .map((word, index) => ({ word, wordIndex: index }))
    .filter(({ wordIndex }) => !state.enemies.some(e => e.wordIndex === wordIndex))
  
  if (unassignedWords.length === 0) return state
  
  const { word, wordIndex } = unassignedWords[Math.floor(rng() * unassignedWords.length)]
  const lane = Math.floor(rng() * ABYSSAL_WELL_CONFIG.lanes)
  
  const enemy: Enemy = {
    id: `enemy-${Date.now()}-${Math.random()}`,
    lane,
    depth: 0,
    word,
    wordIndex,
    type: state.creatureType,
  }
  
  return {
    ...state,
    enemies: [...state.enemies, enemy],
  }
}

export function startGame(state: AbyssalWellState): AbyssalWellState {
  return {
    ...state,
    phase: 'playing',
    gameTime: 0,
  }
}

export function calculateXP(params: {
  correctWords: number
  totalAttempts: number
  lives: number
  initialLives: number
  gameTime: number
}): number {
  if (params.totalAttempts === 0) return 0

  const accuracy = params.correctWords / params.totalAttempts
  const baseXP = params.correctWords

  let bonus = 0
  if (accuracy === 1) bonus += 2 // Perfect accuracy bonus
  if (params.lives / params.initialLives >= 0.5) bonus += 1 // Survival bonus
  if (params.gameTime < 30000) bonus += 1 // Speed bonus (under 30s)

  return Math.min(10, baseXP + bonus)
}
