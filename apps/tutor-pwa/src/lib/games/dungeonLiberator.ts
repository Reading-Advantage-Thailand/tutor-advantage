export type SentenceItem = {
  term: string
  translation: string
}

export type Point = { x: number; y: number }

export type Entity = Point & { id: string; radius: number }

export type Player = Entity & {
  speed: number
  lives: number
  maxLives: number
  invulnerabilityTime: number
}

export type Prisoner = Entity & {
  word: string
  translation: string
  orderIndex: number
  collected: boolean
  fleeing: boolean
  fleeTimer: number
}

export type TrailSegment = Point & {
  id: string
  word: string
  translation: string
  orderIndex: number
}

export type Monster = Entity & {
  speed: number
  damage: number
  velocityX: number
  velocityY: number
}

export type Portal = Entity

export type GamePhase = 'start' | 'playing' | 'victory' | 'defeat'

export type DungeonLiberatorState = {
  phase: GamePhase
  difficulty: Difficulty
  player: Player
  prisoners: Prisoner[]
  trail: TrailSegment[]
  monsters: Monster[]
  portal: Portal
  targetIndex: number
  sentence: { term: string; translation: string }
  words: string[]
  correctWords: number
  totalAttempts: number
  gameTime: number
  level: number
}

export type Difficulty = 'easy' | 'medium' | 'hard'

export type DungeonLiberatorConfig = {
  rng?: () => number
  difficulty?: Difficulty
}

export const GAME_WIDTH = 800
export const GAME_HEIGHT = 600
export const PLAYER_RADIUS = 18
export const PRISONER_RADIUS = 16
export const MONSTER_RADIUS = 20
export const PORTAL_RADIUS = 30
export const TRAIL_SPACING = 72
export const TRAIL_SEGMENT_RADIUS = 12
export const INVULNERABILITY_DURATION = 1000
export const BASE_MONSTER_SPEED = 0.45

export function createDungeonLiberatorState(
  vocabulary: SentenceItem[],
  config: DungeonLiberatorConfig = {}
): DungeonLiberatorState {
  if (vocabulary.length === 0) {
    throw new Error('Vocabulary cannot be empty')
  }

  const rng = config.rng ?? Math.random

  const sentenceIndex = Math.floor(rng() * vocabulary.length)
  const sentence = vocabulary[sentenceIndex]
  const words = sentence.term.split(' ')

  const player: Player = {
    id: 'player',
    x: 100,
    y: GAME_HEIGHT / 2,
    radius: PLAYER_RADIUS,
    speed: 2.5,
    lives: 3,
    maxLives: 3,
    invulnerabilityTime: 0,
  }

  const prisoners = spawnPrisoners(words, sentence, rng)

  const portal: Portal = {
    id: 'portal',
    x: GAME_WIDTH - 80,
    y: 220,
    radius: PORTAL_RADIUS,
  }

  return {
    phase: 'playing',
    difficulty: config.difficulty ?? 'medium',
    player,
    prisoners,
    trail: [],
    monsters: [],
    portal,
    targetIndex: 0,
    sentence,
    words,
    correctWords: 0,
    totalAttempts: 0,
    gameTime: 0,
    level: 1,
  }
}

export type InputState = {
  dx: number
  dy: number
}

export function advanceDungeonLiberatorTime(
  state: DungeonLiberatorState,
  dt: number,
  input: InputState = { dx: 0, dy: 0 }
): DungeonLiberatorState {
  if (state.phase !== 'playing') return state

  let nextState = { ...state, gameTime: state.gameTime + dt }

  nextState = updatePlayer(nextState, input, dt)
  nextState = updatePrisoners(nextState, dt)
  nextState = updateTrail(nextState)
  nextState = updateMonsters(nextState, dt)
  nextState = checkCollisions(nextState)
  nextState = checkVictoryCondition(nextState)

  return nextState
}

function updatePlayer(state: DungeonLiberatorState, input: InputState, dt: number): DungeonLiberatorState {
  let { player } = state

  let moveX = input.dx
  let moveY = input.dy
  if (moveX !== 0 && moveY !== 0) {
    const invSqrt2 = 0.70710678118
    moveX *= invSqrt2
    moveY *= invSqrt2
  }

  const speedFactor = dt / 16.6
  let newX = player.x + moveX * player.speed * speedFactor
  let newY = player.y + moveY * player.speed * speedFactor

  newX = Math.max(PLAYER_RADIUS, Math.min(GAME_WIDTH - PLAYER_RADIUS, newX))
  newY = Math.max(PLAYER_RADIUS, Math.min(GAME_HEIGHT - PLAYER_RADIUS, newY))

  player = {
    ...player,
    x: newX,
    y: newY,
  }

  if (player.invulnerabilityTime > 0) {
    player = {
      ...player,
      invulnerabilityTime: Math.max(0, player.invulnerabilityTime - dt),
    }
  }

  return { ...state, player }
}

function updatePrisoners(state: DungeonLiberatorState, dt: number): DungeonLiberatorState {
  let { prisoners } = state
  const speedFactor = dt / 16.6

  prisoners = prisoners.map(p => {
    if (p.fleeing) {
      const fleeSpeed = 3
      const angle = Math.random() * Math.PI * 2
      let newX = p.x + Math.cos(angle) * fleeSpeed * speedFactor
      let newY = p.y + Math.sin(angle) * fleeSpeed * speedFactor

      newX = Math.max(PRISONER_RADIUS, Math.min(GAME_WIDTH - PRISONER_RADIUS, newX))
      newY = Math.max(PRISONER_RADIUS, Math.min(GAME_HEIGHT - PRISONER_RADIUS, newY))

      const newTimer = p.fleeTimer - dt
      if (newTimer <= 0) {
        return { ...p, fleeing: false, fleeTimer: 0 }
      }

      return { ...p, x: newX, y: newY, fleeTimer: newTimer }
    }
    return p
  })

  return { ...state, prisoners }
}

function updateTrail(state: DungeonLiberatorState): DungeonLiberatorState {
  if (state.trail.length === 0) return state

  const { player, trail } = state
  const newTrail: TrailSegment[] = []

  let targetX = player.x
  let targetY = player.y

  for (let i = 0; i < trail.length; i++) {
    const segment = trail[i]
    const dx = targetX - segment.x
    const dy = targetY - segment.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > TRAIL_SPACING) {
      const ratio = (dist - TRAIL_SPACING) / dist
      newTrail.push({
        ...segment,
        x: segment.x + dx * ratio,
        y: segment.y + dy * ratio,
      })
    } else {
      newTrail.push(segment)
    }

    targetX = newTrail[i].x
    targetY = newTrail[i].y
  }

  return { ...state, trail: newTrail }
}

function updateMonsters(state: DungeonLiberatorState, dt: number): DungeonLiberatorState {
  const { monsters, level } = state
  const speedFactor = dt / 16.6
  const speedMultiplier = Math.pow(1.2, level - 1)

  const updatedMonsters = monsters.map(m => {
    let newX = m.x + m.velocityX * m.speed * speedMultiplier * speedFactor
    let newY = m.y + m.velocityY * m.speed * speedMultiplier * speedFactor
    let newVelocityX = m.velocityX
    let newVelocityY = m.velocityY

    if (newX - MONSTER_RADIUS < 0) {
      newX = MONSTER_RADIUS
      newVelocityX = Math.abs(newVelocityX)
    } else if (newX + MONSTER_RADIUS > GAME_WIDTH) {
      newX = GAME_WIDTH - MONSTER_RADIUS
      newVelocityX = -Math.abs(newVelocityX)
    }

    if (newY - MONSTER_RADIUS < 0) {
      newY = MONSTER_RADIUS
      newVelocityY = Math.abs(newVelocityY)
    } else if (newY + MONSTER_RADIUS > GAME_HEIGHT) {
      newY = GAME_HEIGHT - MONSTER_RADIUS
      newVelocityY = -Math.abs(newVelocityY)
    }

    return { ...m, x: newX, y: newY, velocityX: newVelocityX, velocityY: newVelocityY }
  })

  return { ...state, monsters: updatedMonsters }
}

function checkCollisions(state: DungeonLiberatorState): DungeonLiberatorState {
  let { player, trail, targetIndex, correctWords, totalAttempts, phase } = state
  let prisoners = state.prisoners
  const { monsters } = state

  let collidedPrisoner: { index: number; prisoner: Prisoner } | null = null

  for (let i = 0; i < prisoners.length; i++) {
    const prisoner = prisoners[i]
    if (prisoner.collected || prisoner.fleeing) continue

    const dx = player.x - prisoner.x
    const dy = player.y - prisoner.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < player.radius + prisoner.radius) {
      collidedPrisoner = { index: i, prisoner }
      break
    }
  }

  if (collidedPrisoner) {
    const { index, prisoner } = collidedPrisoner
    totalAttempts += 1

    if (prisoner.orderIndex === targetIndex) {
      prisoners = prisoners.map((p, i) =>
        i === index ? { ...p, collected: true } : p
      )
      correctWords += 1
      targetIndex += 1

      trail = [...trail, {
        id: `trail-${prisoner.id}`,
        x: player.x,
        y: player.y,
        word: prisoner.word,
        translation: prisoner.translation,
        orderIndex: prisoner.orderIndex,
      }]
    } else {
      prisoners = prisoners.map((p, i) =>
        i === index ? { ...p, fleeing: true, fleeTimer: 1500 } : p
      )

      for (const segment of trail) {
        const newPos = getRandomPosition()
        prisoners = prisoners.map(p =>
          p.orderIndex === segment.orderIndex
            ? { ...p, collected: false, x: newPos.x, y: newPos.y }
            : p
        )
      }

      trail = []
      targetIndex = 0
    }
  }

  // Check monster-trail collisions first
  for (const monster of monsters) {
    for (let i = 0; i < trail.length; i++) {
      const segment = trail[i]
      const dx = segment.x - monster.x
      const dy = segment.y - monster.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < TRAIL_SEGMENT_RADIUS + monster.radius) {
        // Rescatter segments from i to end
        const segmentsToRescatter = trail.slice(i)
        for (const seg of segmentsToRescatter) {
          const newPos = getRandomPosition()
          prisoners = prisoners.map(p =>
            p.orderIndex === seg.orderIndex
              ? { ...p, collected: false, x: newPos.x, y: newPos.y }
              : p
          )
        }

        trail = trail.slice(0, i)
        targetIndex = trail.length
        player = { ...player, invulnerabilityTime: INVULNERABILITY_DURATION }
        return {
          ...state,
          player,
          prisoners,
          trail,
          targetIndex,
          correctWords,
          totalAttempts,
          phase,
        }
      }
    }
  }

  if (player.invulnerabilityTime === 0) {
    for (const monster of monsters) {
      const dx = player.x - monster.x
      const dy = player.y - monster.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < player.radius + monster.radius) {
        if (trail.length > 0) {
          for (const segment of trail) {
            const newPos = getRandomPosition()
            prisoners = prisoners.map(p =>
              p.orderIndex === segment.orderIndex
                ? { ...p, collected: false, x: newPos.x, y: newPos.y }
                : p
            )
          }

          trail = []
          targetIndex = 0
          player = { ...player, invulnerabilityTime: INVULNERABILITY_DURATION }
        } else {
          player = { ...player, lives: player.lives - 1 }
          if (player.lives <= 0) {
            phase = 'defeat'
          }
        }
        break
      }
    }
  }

  return {
    ...state,
    player,
    prisoners,
    trail,
    targetIndex,
    correctWords,
    totalAttempts,
    phase,
  }
}

function getRandomPosition(): Point {
  const margin = 80
  const minX = margin + 100
  const maxX = GAME_WIDTH - margin - 100
  const minY = margin
  const maxY = GAME_HEIGHT - margin

  return {
    x: minX + Math.random() * (maxX - minX),
    y: minY + Math.random() * (maxY - minY),
  }
}

function checkVictoryCondition(state: DungeonLiberatorState): DungeonLiberatorState {
  const { player, trail, portal, words, phase } = state

  if (phase !== 'playing') return state

  const dx = player.x - portal.x
  const dy = player.y - portal.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist < player.radius + portal.radius) {
    if (trail.length === words.length) {
      return { ...state, phase: 'victory' }
    }
  }

  return state
}

function spawnPrisoners(
  words: string[],
  sentence: SentenceItem,
  rng: () => number
): Prisoner[] {
  const margin = 80
  const minX = margin + 100
  const maxX = GAME_WIDTH - margin - 100
  const minY = margin
  const maxY = GAME_HEIGHT - margin

  const gridCols = Math.ceil(Math.sqrt(words.length * 2))
  const gridRows = Math.ceil(words.length / gridCols)
  const cellWidth = (maxX - minX) / gridCols
  const cellHeight = (maxY - minY) / gridRows

  const positions: Point[] = []
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      if (positions.length >= words.length) break
      positions.push({
        x: minX + cellWidth * col + cellWidth / 2 + (rng() - 0.5) * cellWidth * 0.5,
        y: minY + cellHeight * row + cellHeight / 2 + (rng() - 0.5) * cellHeight * 0.5,
      })
    }
  }

  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]]
  }

  return words.map((word, index) => ({
    id: `prisoner-${index}`,
    x: positions[index].x,
    y: positions[index].y,
    radius: PRISONER_RADIUS,
    word,
    translation: sentence.translation,
    orderIndex: index,
    collected: false,
    fleeing: false,
    fleeTimer: 0,
  }))
}

export function spawnMonsterForLevel(level: number, rng: () => number = Math.random): Monster {
  const angle = rng() * Math.PI * 2
  const spawnRadius = 150 + rng() * 100

  const direction = rng() * Math.PI * 2

  return {
    id: `monster-${Date.now()}-${Math.random()}`,
    x: GAME_WIDTH / 2 + Math.cos(angle) * spawnRadius,
    y: GAME_HEIGHT / 2 + Math.sin(angle) * spawnRadius,
    radius: MONSTER_RADIUS,
    speed: BASE_MONSTER_SPEED,
    damage: 1,
    velocityX: Math.cos(direction),
    velocityY: Math.sin(direction),
  }
}

export function calculateDungeonLiberatorXP(state: DungeonLiberatorState): number {
  const totalAttempts = state.correctWords + (state.totalAttempts - state.correctWords)
  if (totalAttempts === 0) return 0

  const accuracy = state.correctWords / totalAttempts
  const baseXP = Math.min(5, state.correctWords)

  let bonus = 0
  if (accuracy === 1 && state.correctWords > 0) bonus += 2 // Perfect accuracy bonus
  if (state.player.lives / state.player.maxLives >= 0.5) bonus += 1 // Survival bonus
  if (state.gameTime < 120000) bonus += 1 // Speed bonus (under 2 min)
  if (state.level >= 3) bonus += 1 // Progression bonus

  return Math.min(10, baseXP + bonus)
}

export function advanceToNextLevel(
  state: DungeonLiberatorState,
  vocabulary: SentenceItem[],
  rng: () => number = Math.random
): DungeonLiberatorState {
  if (vocabulary.length === 0) return state

  const newLevel = state.level + 1
  const sentenceIndex = Math.floor(rng() * vocabulary.length)
  const sentence = vocabulary[sentenceIndex]
  const words = sentence.term.split(' ')

  const prisoners = spawnPrisoners(words, sentence, rng)

  const newMonster = spawnMonsterForLevel(newLevel, rng)
  const monsters = [...state.monsters, newMonster]

  return {
    ...state,
    phase: 'playing',
    player: {
      ...state.player,
      x: 100,
      y: GAME_HEIGHT / 2,
      invulnerabilityTime: 0,
    },
    prisoners,
    trail: [],
    monsters,
    targetIndex: 0,
    sentence,
    words,
    correctWords: 0,
    level: newLevel,
  }
}
