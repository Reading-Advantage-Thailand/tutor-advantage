import type { VocabularyItem } from '@/store/useGameStore'

export type Point = { x: number; y: number }
export type Velocity = { x: number; y: number }

export type Entity = {
  id: string
  pos: Point
  radius: number
}

export type Slime = Entity & {
  scale: number
  color: string
}

export type WordOrb = Entity & {
  word: string
  index: number
  isEaten: boolean
}

export type KnightEnemy = Entity & {
  vel: Velocity
  patrolPoints: Point[]
  currentPatrolIndex: number
}

export type Difficulty = 'easy' | 'medium' | 'hard'

export type SlimeState = {
  phase: 'start' | 'playing' | 'victory' | 'defeat'
  slime: Slime
  orbs: WordOrb[]
  enemies: KnightEnemy[]
  sentences: VocabularyItem[]
  currentSentenceIndex: number
  targetWordIndex: number
  score: number
  lives: number
  maxLives: number
  arenaSize: { width: number; height: number }
  gameTime: number
  correctAnswers: number
  totalAttempts: number
  difficulty: Difficulty
  lastEvent?: 'correct' | 'incorrect' | 'hit' | 'eat_enemy' | 'victory' | 'defeat'
}

export const ARENA_WIDTH = 800 // Larger arena for growth
export const ARENA_HEIGHT = 800
export const INITIAL_SLIME_RADIUS = 25
export const ORB_RADIUS = 20
export const KNIGHT_RADIUS = 35
export const MAX_LIVES = 3

export type SlimeConfig = {
  rng?: () => number
  difficulty?: Difficulty
}

export function createSlimeState(
  sentences: VocabularyItem[],
  config: SlimeConfig = {}
): SlimeState {
  if (sentences.length === 0) {
    throw new Error('Sentences cannot be empty')
  }

  const state: SlimeState = {
    phase: 'playing',
    slime: {
      id: 'slime',
      pos: { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 },
      radius: INITIAL_SLIME_RADIUS,
      scale: 1,
      color: '#4ade80'
    },
    orbs: [],
    enemies: [],
    sentences,
    currentSentenceIndex: 0,
    targetWordIndex: 0,
    score: 0,
    lives: MAX_LIVES,
    maxLives: MAX_LIVES,
    arenaSize: { width: ARENA_WIDTH, height: ARENA_HEIGHT },
    gameTime: 0,
    correctAnswers: 0,
    totalAttempts: 0,
    difficulty: config.difficulty || 'medium'
  }

  return spawnLevel(state, config.rng ?? Math.random)
}

function spawnLevel(state: SlimeState, rng: () => number): SlimeState {
  const sentence = state.sentences[state.currentSentenceIndex]
  const words = sentence.term.split(' ')
  
  const orbs: WordOrb[] = words.map((word, index) => ({
    id: `orb-${index}-${Date.now()}-${rng()}`,
    pos: {
      x: rng() * (ARENA_WIDTH - 100) + 50,
      y: rng() * (ARENA_HEIGHT - 100) + 50,
    },
    radius: ORB_RADIUS,
    word,
    index,
    isEaten: false
  }))

  const enemyCount = state.difficulty === 'easy' ? 2 : state.difficulty === 'hard' ? 6 : 4
  const enemies: KnightEnemy[] = Array.from({ length: enemyCount }).map((_, i) => ({
    id: `knight-${i}-${Date.now()}-${rng()}`,
    pos: {
      x: rng() * ARENA_WIDTH,
      y: rng() * ARENA_HEIGHT,
    },
    vel: {
      x: (rng() - 0.5) * 2,
      y: (rng() - 0.5) * 2,
    },
    radius: KNIGHT_RADIUS,
    patrolPoints: [],
    currentPatrolIndex: 0
  }))

  return { ...state, orbs, enemies, targetWordIndex: 0 }
}

export function moveSlime(state: SlimeState, dx: number, dy: number, dt: number): SlimeState {
  if (state.phase !== 'playing') return state

  const speed = 0.2
  const nx = state.slime.pos.x + dx * speed * dt
  const ny = state.slime.pos.y + dy * speed * dt

  // Clamp to bounds
  const cnx = Math.max(state.slime.radius, Math.min(ARENA_WIDTH - state.slime.radius, nx))
  const cny = Math.max(state.slime.radius, Math.min(ARENA_HEIGHT - state.slime.radius, ny))

  return {
    ...state,
    slime: { ...state.slime, pos: { x: cnx, y: cny } }
  }
}

export function tickSlime(state: SlimeState, dt: number, rng: () => number = Math.random): SlimeState {
  if (state.phase !== 'playing') return state

  let nextState: SlimeState = { ...state, gameTime: state.gameTime + dt, lastEvent: undefined }

  // 1. Move Enemies
  nextState.enemies = nextState.enemies.map(enemy => {
    const nx = enemy.pos.x + enemy.vel.x * dt
    const ny = enemy.pos.y + enemy.vel.y * dt
    
    let nvx = enemy.vel.x
    let nvy = enemy.vel.y

    if (nx < enemy.radius || nx > ARENA_WIDTH - enemy.radius) nvx *= -1
    if (ny < enemy.radius || ny > ARENA_HEIGHT - enemy.radius) nvy *= -1
    
    return {
      ...enemy,
      pos: { 
        x: Math.max(enemy.radius, Math.min(ARENA_WIDTH - enemy.radius, nx)),
        y: Math.max(enemy.radius, Math.min(ARENA_HEIGHT - enemy.radius, ny))
      },
      vel: { x: nvx, y: nvy }
    }
  })

  // 2. Collision Detection
  nextState = handleCollisions(nextState, rng)

  return nextState
}

function handleCollisions(state: SlimeState, rng: () => number): SlimeState {
  let nextState = { ...state }
  
  // Slime vs Orbs
  for (let i = nextState.orbs.length - 1; i >= 0; i--) {
    const orb = nextState.orbs[i]
    if (!orb.isEaten && checkCollision(nextState.slime, orb)) {
      nextState = handleOrbEaten(nextState, orb, rng)
    }
  }

  // Slime vs Enemies
  for (let i = nextState.enemies.length - 1; i >= 0; i--) {
    const enemy = nextState.enemies[i]
    if (checkCollision(nextState.slime, enemy)) {
      if (nextState.slime.radius > enemy.radius) {
        // Eat enemy
        const newEnemies = [...nextState.enemies]
        newEnemies.splice(i, 1)
        nextState.enemies = newEnemies
        nextState.score += 500
        nextState.lastEvent = 'eat_enemy'
      } else {
        // Get hit
        nextState.lives -= 1
        nextState.lastEvent = 'hit'
        // Shrink
        nextState.slime.radius = Math.max(INITIAL_SLIME_RADIUS, nextState.slime.radius * 0.8)
        nextState.slime.scale = nextState.slime.radius / INITIAL_SLIME_RADIUS
        
        // Push slime back
        const dx = nextState.slime.pos.x - enemy.pos.x
        const dy = nextState.slime.pos.y - enemy.pos.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 0) {
          nextState.slime.pos.x += (dx / dist) * 50
          nextState.slime.pos.y += (dy / dist) * 50
        }

        if (nextState.lives <= 0) {
          nextState.phase = 'defeat'
          nextState.lastEvent = 'defeat'
        }
      }
    }
  }

  return nextState
}

function checkCollision(e1: Entity, e2: Entity): boolean {
  const dx = e1.pos.x - e2.pos.x
  const dy = e1.pos.y - e2.pos.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  return dist < e1.radius + e2.radius
}

function handleOrbEaten(state: SlimeState, orb: WordOrb, rng: () => number): SlimeState {
  let nextState = { ...state, totalAttempts: state.totalAttempts + 1 }
  const words = state.sentences[state.currentSentenceIndex].term.split(' ')
  
  if (orb.index === state.targetWordIndex) {
    nextState.correctAnswers += 1
    nextState.targetWordIndex += 1
    nextState.score += 100
    nextState.lastEvent = 'correct'
    
    // Grow
    nextState.slime.radius += 5
    nextState.slime.scale = nextState.slime.radius / INITIAL_SLIME_RADIUS
    
    // Mark as eaten
    nextState.orbs = nextState.orbs.map(o => o.id === orb.id ? { ...o, isEaten: true } : o)

    if (nextState.targetWordIndex === words.length) {
      // Sentence complete!
      nextState.currentSentenceIndex += 1
      if (nextState.currentSentenceIndex === state.sentences.length) {
        nextState.phase = 'victory'
        nextState.lastEvent = 'victory'
      } else {
        // Reset slime size a bit for next level but keep some growth?
        // Actually Hole.io style usually grows and stays big.
        nextState = spawnLevel(nextState, rng)
      }
    }
  } else {
    // Wrong orb!
    nextState.score = Math.max(0, nextState.score - 50)
    nextState.lastEvent = 'incorrect'
    
    // Shrink
    nextState.slime.radius = Math.max(INITIAL_SLIME_RADIUS, nextState.slime.radius - 3)
    nextState.slime.scale = nextState.slime.radius / INITIAL_SLIME_RADIUS
    
    // Reposition orb so player can't accidentally eat it again immediately
    nextState.orbs = nextState.orbs.map(o => o.id === orb.id ? { 
      ...o, 
      pos: {
        x: rng() * (ARENA_WIDTH - 100) + 50,
        y: rng() * (ARENA_HEIGHT - 100) + 50,
      }
    } : o)
  }
  
  return nextState
}
