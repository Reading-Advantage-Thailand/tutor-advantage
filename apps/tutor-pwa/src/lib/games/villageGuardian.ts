import type { VocabularyItem } from '@/store/useGameStore'
import type { Difficulty } from '@/store/useGameStore'
import type { OpponentType } from './villageGuardianConfig'
import {
  VILLAGE_GUARDIAN_CONFIG,
  getDifficultyConfig,
  getMonsterSpeed,
  GAME_WIDTH,
  GAME_HEIGHT,
} from './villageGuardianConfig'

export type GameStatus = 'start' | 'playing' | 'defeat'

export type Position = {
  x: number
  y: number
}

export type Knight = {
  x: number
  y: number
  speed: number
  lives: number
  invulnerabilityTime: number
}

export type Villager = {
  id: string
  x: number
  y: number
  word: string
  orderIndex: number
  collected: boolean
  hiding: boolean
  hideTimer: number
}

export type TrailSegment = {
  id: string
  x: number
  y: number
  word: string
  orderIndex: number
}

export type Monster = {
  id: string
  x: number
  y: number
  speed: number
  velocityX: number
  velocityY: number
  type: OpponentType
}

export type Sanctuary = {
  x: number
  y: number
  radius: number
}

export type VillageGuardianState = {
  status: GameStatus
  difficulty: Difficulty
  opponentType: OpponentType
  level: number
  vocabulary: VocabularyItem[]
  knight: Knight
  villagers: Villager[]
  trail: TrailSegment[]
  monsters: Monster[]
  sanctuary: Sanctuary
  currentSentence: VocabularyItem
  words: string[]
  collectedWords: string[]
  targetIndex: number
  correctAnswers: number
  wrongAnswers: number
  timer: number
  maxTimer: number
  gameTime: number
}

export type VillageGuardianConfig = {
  difficulty?: Difficulty
  opponentType?: OpponentType
  rng?: () => number
}

export type InputState = {
  dx: number
  dy: number
}

const generateId = () => Math.random().toString(36).substring(2, 9)

function getRandomPosition(rng: () => number, margin: number = 80): Position {
  const minX = margin
  const maxX = GAME_WIDTH - margin
  const minY = margin
  const maxY = GAME_HEIGHT - margin - 100

  return {
    x: minX + rng() * (maxX - minX),
    y: minY + rng() * (maxY - minY),
  }
}

function spawnVillagers(
  words: string[],
  sentence: VocabularyItem,
  rng: () => number
): Villager[] {
  const margin = 60
  const minX = margin
  const maxX = GAME_WIDTH - margin
  const minY = margin
  const maxY = GAME_HEIGHT - margin - 100

  const gridCols = Math.ceil(Math.sqrt(words.length * 1.5))
  const gridRows = Math.ceil(words.length / gridCols)
  const cellWidth = (maxX - minX) / gridCols
  const cellHeight = (maxY - minY) / gridRows

  const positions: Position[] = []
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      if (positions.length >= words.length) break
      positions.push({
        x: minX + cellWidth * col + cellWidth / 2 + (rng() - 0.5) * cellWidth * 0.4,
        y: minY + cellHeight * row + cellHeight / 2 + (rng() - 0.5) * cellHeight * 0.4,
      })
    }
  }

  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[positions[i], positions[j]] = [positions[j], positions[i]]
  }

  return words.map((word, index) => ({
    id: `villager-${index}`,
    x: positions[index].x,
    y: positions[index].y,
    word,
    orderIndex: index,
    collected: false,
    hiding: false,
    hideTimer: 0,
  }))
}

function spawnMonster(
  opponentType: OpponentType,
  rng: () => number
): Monster {
  const speed = getMonsterSpeed(opponentType)
  const direction = rng() * Math.PI * 2

  const spawnMargin = 50
  const x = spawnMargin + rng() * (GAME_WIDTH - spawnMargin * 2)
  const y = spawnMargin + rng() * (GAME_HEIGHT - spawnMargin * 2 - 100)

  return {
    id: `monster-${generateId()}`,
    x,
    y,
    speed,
    velocityX: Math.cos(direction),
    velocityY: Math.sin(direction),
    type: opponentType,
  }
}

export function createVillageGuardianState(
  vocabulary: VocabularyItem[],
  config: VillageGuardianConfig = {}
): VillageGuardianState {
  if (vocabulary.length === 0) {
    throw new Error('Vocabulary cannot be empty')
  }

  const rng = config.rng ?? Math.random
  const difficulty = config.difficulty ?? 'normal'
  const opponentType = config.opponentType ?? 'bandits'

  const sentenceIndex = Math.floor(rng() * vocabulary.length)
  const currentSentence = vocabulary[sentenceIndex]
  const words = currentSentence.term.split(' ')

  const diffConfig = getDifficultyConfig(difficulty)
  const wordCount = Math.min(diffConfig.wordCount, words.length)
  const activeWords = words.slice(0, wordCount)

  const knight: Knight = {
    x: GAME_WIDTH / 2,
    y: 100,
    speed: VILLAGE_GUARDIAN_CONFIG.knightSpeed,
    lives: VILLAGE_GUARDIAN_CONFIG.initialLives,
    invulnerabilityTime: 0,
  }

  const villagers = spawnVillagers(activeWords, currentSentence, rng)
  const monsters = [spawnMonster(opponentType, rng)]

  const sanctuary: Sanctuary = {
    x: VILLAGE_GUARDIAN_CONFIG.sanctuaryPosition.x,
    y: VILLAGE_GUARDIAN_CONFIG.sanctuaryPosition.y,
    radius: VILLAGE_GUARDIAN_CONFIG.sanctuaryRadius,
  }

  return {
    status: 'playing',
    difficulty,
    opponentType,
    level: 1,
    vocabulary,
    knight,
    villagers,
    trail: [],
    monsters,
    sanctuary,
    currentSentence,
    words: activeWords,
    collectedWords: [],
    targetIndex: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    timer: diffConfig.timer,
    maxTimer: diffConfig.timer,
    gameTime: 0,
  }
}

export function tickVillageGuardian(
  state: VillageGuardianState,
  deltaMs: number,
  input: InputState = { dx: 0, dy: 0 }
): VillageGuardianState {
  if (state.status !== 'playing') return state

  let newState = { ...state, gameTime: state.gameTime + deltaMs }
  newState.timer -= deltaMs

  if (newState.timer <= 0) {
    newState.status = 'defeat'
    return newState
  }

  newState = updateKnight(newState, input, deltaMs)
  newState = updateVillagers(newState, deltaMs)
  newState = updateTrail(newState)
  newState = updateMonsters(newState, deltaMs)
  newState = checkCollisions(newState)
  newState = advanceLevelIfComplete(newState)

  if (newState.knight.lives <= 0) {
    newState.status = 'defeat'
  }

  return newState
}

function updateKnight(
  state: VillageGuardianState,
  input: InputState,
  deltaMs: number
): VillageGuardianState {
  let { knight } = state

  let moveX = input.dx
  let moveY = input.dy

  if (moveX !== 0 && moveY !== 0) {
    const invSqrt2 = 0.70710678118
    moveX *= invSqrt2
    moveY *= invSqrt2
  }

  const speedFactor = deltaMs / 16.6
  const size = VILLAGE_GUARDIAN_CONFIG.knightSize / 2

  let newX = knight.x + moveX * knight.speed * speedFactor
  let newY = knight.y + moveY * knight.speed * speedFactor

  newX = Math.max(size, Math.min(GAME_WIDTH - size, newX))
  newY = Math.max(size, Math.min(GAME_HEIGHT - size, newY))

  knight = {
    ...knight,
    x: newX,
    y: newY,
  }

  if (knight.invulnerabilityTime > 0) {
    knight = {
      ...knight,
      invulnerabilityTime: Math.max(0, knight.invulnerabilityTime - deltaMs),
    }
  }

  return { ...state, knight }
}

function updateVillagers(
  state: VillageGuardianState,
  deltaMs: number
): VillageGuardianState {
  const speedFactor = deltaMs / 16.6

  const villagers = state.villagers.map((v) => {
    if (v.hiding) {
      const newTimer = v.hideTimer - deltaMs
      if (newTimer <= 0) {
        return { ...v, hiding: false, hideTimer: 0 }
      }

      const fleeSpeed = 2
      const angle = Math.random() * Math.PI * 2
      const size = VILLAGE_GUARDIAN_CONFIG.villagerSize / 2
      let newX = v.x + Math.cos(angle) * fleeSpeed * speedFactor
      let newY = v.y + Math.sin(angle) * fleeSpeed * speedFactor

      newX = Math.max(size, Math.min(GAME_WIDTH - size, newX))
      newY = Math.max(size, Math.min(GAME_HEIGHT - size - 100, newY))

      return { ...v, x: newX, y: newY, hideTimer: newTimer }
    }
    return v
  })

  return { ...state, villagers }
}

function updateTrail(state: VillageGuardianState): VillageGuardianState {
  if (state.trail.length === 0) return state

  const { knight, trail } = state
  const newTrail: TrailSegment[] = []
  const spacing = VILLAGE_GUARDIAN_CONFIG.trailSpacing

  let targetX = knight.x
  let targetY = knight.y

  for (let i = 0; i < trail.length; i++) {
    const segment = trail[i]
    const dx = targetX - segment.x
    const dy = targetY - segment.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > spacing) {
      const ratio = (dist - spacing) / dist
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

function updateMonsters(
  state: VillageGuardianState,
  deltaMs: number
): VillageGuardianState {
  const { monsters, knight, opponentType } = state
  const speedFactor = deltaMs / 16.6
  const size = VILLAGE_GUARDIAN_CONFIG.monsterSize / 2

  const updatedMonsters = monsters.map((m) => {
    let newX = m.x
    let newY = m.y
    let newVelocityX = m.velocityX
    let newVelocityY = m.velocityY

    if (opponentType === 'goblins' || opponentType === 'dragons') {
      const dx = knight.x - m.x
      const dy = knight.y - m.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > 0) {
        const chaseStrength = opponentType === 'dragons' ? 0.8 : 0.5
        newVelocityX = newVelocityX * (1 - chaseStrength) + (dx / dist) * chaseStrength
        newVelocityY = newVelocityY * (1 - chaseStrength) + (dy / dist) * chaseStrength

        const mag = Math.sqrt(newVelocityX * newVelocityX + newVelocityY * newVelocityY)
        if (mag > 0) {
          newVelocityX /= mag
          newVelocityY /= mag
        }
      }
    }

    newX = m.x + newVelocityX * m.speed * speedFactor
    newY = m.y + newVelocityY * m.speed * speedFactor

    if (newX - size < 0) {
      newX = size
      newVelocityX = Math.abs(newVelocityX)
    } else if (newX + size > GAME_WIDTH) {
      newX = GAME_WIDTH - size
      newVelocityX = -Math.abs(newVelocityX)
    }

    if (newY - size < 0) {
      newY = size
      newVelocityY = Math.abs(newVelocityY)
    } else if (newY + size > GAME_HEIGHT - size) {
      newY = GAME_HEIGHT - size
      newVelocityY = -Math.abs(newVelocityY)
    }

    return { ...m, x: newX, y: newY, velocityX: newVelocityX, velocityY: newVelocityY }
  })

  return { ...state, monsters: updatedMonsters }
}

function checkCollisions(state: VillageGuardianState): VillageGuardianState {
  let { knight, villagers, trail, targetIndex, correctAnswers, wrongAnswers, timer, collectedWords } =
    state
  const { monsters } = state

  const knightRadius = VILLAGE_GUARDIAN_CONFIG.knightSize / 2
  const villagerRadius = VILLAGE_GUARDIAN_CONFIG.villagerSize / 2
  const monsterRadius = VILLAGE_GUARDIAN_CONFIG.monsterSize / 2
  const trailRadius = VILLAGE_GUARDIAN_CONFIG.villagerSize / 2

  let collidedVillager: { index: number; villager: Villager } | null = null

  for (let i = 0; i < villagers.length; i++) {
    const villager = villagers[i]
    if (villager.collected || villager.hiding) continue

    const dx = knight.x - villager.x
    const dy = knight.y - villager.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < knightRadius + villagerRadius) {
      collidedVillager = { index: i, villager }
      break
    }
  }

  if (collidedVillager) {
    const { index, villager } = collidedVillager

    if (villager.orderIndex === targetIndex) {
      villagers = villagers.map((v, i) => (i === index ? { ...v, collected: true } : v))
      correctAnswers += 1
      targetIndex += 1
      collectedWords = [...collectedWords, villager.word]

      trail = [
        ...trail,
        {
          id: `trail-${villager.id}`,
          x: knight.x,
          y: knight.y,
          word: villager.word,
          orderIndex: villager.orderIndex,
        },
      ]
    } else {
      wrongAnswers += 1
      villagers = villagers.map((v, i) =>
        i === index ? { ...v, hiding: true, hideTimer: 2000 } : v
      )
      timer += VILLAGE_GUARDIAN_CONFIG.wrongWordTimePenalty
    }
  }

  for (const monster of monsters) {
    for (let i = 0; i < trail.length; i++) {
      const segment = trail[i]
      const dx = segment.x - monster.x
      const dy = segment.y - monster.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < trailRadius + monsterRadius) {
        const segmentsToRescatter = trail.slice(i)
        for (const seg of segmentsToRescatter) {
          const newPos = getRandomPosition(Math.random)
          villagers = villagers.map((v) =>
            v.orderIndex === seg.orderIndex ? { ...v, collected: false, ...newPos } : v
          )
        }

        trail = trail.slice(0, i)
        targetIndex = trail.length
        collectedWords = trail.map(t => t.word)
        knight = { ...knight, invulnerabilityTime: VILLAGE_GUARDIAN_CONFIG.invulnerabilityDuration }
        return {
          ...state,
          knight,
          villagers,
          trail,
          targetIndex,
          collectedWords,
          correctAnswers,
          wrongAnswers,
          timer,
          monsters,
        }
      }
    }
  }

  if (knight.invulnerabilityTime === 0) {
    for (const monster of monsters) {
      const dx = knight.x - monster.x
      const dy = knight.y - monster.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < knightRadius + monsterRadius) {
        if (trail.length > 0) {
          for (const segment of trail) {
            const newPos = getRandomPosition(Math.random)
            villagers = villagers.map((v) =>
              v.orderIndex === segment.orderIndex ? { ...v, collected: false, ...newPos } : v
            )
          }

          trail = []
          collectedWords = []
          targetIndex = 0
          knight = { ...knight, invulnerabilityTime: VILLAGE_GUARDIAN_CONFIG.invulnerabilityDuration }
        } else {
          knight = { 
            ...knight, 
            lives: Math.max(0, knight.lives - 1),
            invulnerabilityTime: VILLAGE_GUARDIAN_CONFIG.invulnerabilityDuration 
          }
        }
        break
      }
    }
  }

  return {
    ...state,
    knight,
    villagers,
    trail,
    targetIndex,
    collectedWords,
    correctAnswers,
    wrongAnswers,
    timer,
    monsters,
  }
}

function advanceLevelIfComplete(state: VillageGuardianState): VillageGuardianState {
  const { knight, trail, sanctuary, words, status } = state

  if (status !== 'playing') return state

  const dx = knight.x - sanctuary.x
  const dy = knight.y - sanctuary.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist < VILLAGE_GUARDIAN_CONFIG.knightSize / 2 + sanctuary.radius && trail.length === words.length) {
    const rng = Math.random
    const nextLevel = state.level + 1
    const diffConfig = getDifficultyConfig(state.difficulty)

    // Pick a new sentence
    const sentenceIndex = Math.floor(rng() * state.vocabulary.length)
    const nextSentence = state.vocabulary[sentenceIndex]
    const nextWords = nextSentence.term.split(' ')
    const wordCount = Math.min(diffConfig.wordCount, nextWords.length)
    const activeWords = nextWords.slice(0, wordCount)

    // Spawn new villagers
    const newVillagers = spawnVillagers(activeWords, nextSentence, rng)

    // Add one more monster per level, capped at maxMonsters, with scaled speed
    const speedScale = 1 + VILLAGE_GUARDIAN_CONFIG.monsterSpeedScalePerLevel * (nextLevel - 1)
    const targetMonsterCount = Math.min(nextLevel, VILLAGE_GUARDIAN_CONFIG.maxMonsters)
    const newMonsters: Monster[] = Array.from({ length: targetMonsterCount }, () => {
      const m = spawnMonster(state.opponentType, rng)
      return { ...m, speed: m.speed * speedScale }
    })

    return {
      ...state,
      level: nextLevel,
      currentSentence: nextSentence,
      words: activeWords,
      villagers: newVillagers,
      trail: [],
      collectedWords: [],
      targetIndex: 0,
      monsters: newMonsters,
      timer: diffConfig.timer,
      maxTimer: diffConfig.timer,
    }
  }

  return state
}

export function calculateXP(state: VillageGuardianState): number {
  const baseXP = state.correctAnswers * VILLAGE_GUARDIAN_CONFIG.xpPerCorrectWord
  let bonus = 0

  const accuracy = state.correctAnswers / (state.correctAnswers + state.wrongAnswers)
  if (accuracy >= VILLAGE_GUARDIAN_CONFIG.accuracyBonusThreshold) {
    bonus += VILLAGE_GUARDIAN_CONFIG.accuracyBonus
  }

  const timeRemaining = state.timer / state.maxTimer
  if (timeRemaining >= VILLAGE_GUARDIAN_CONFIG.speedBonusThreshold) {
    bonus += VILLAGE_GUARDIAN_CONFIG.speedBonus
  }

  if (state.trail.length >= VILLAGE_GUARDIAN_CONFIG.survivalBonusThreshold) {
    bonus += VILLAGE_GUARDIAN_CONFIG.survivalBonus
  }

  return Math.min(VILLAGE_GUARDIAN_CONFIG.maxXP, baseXP + bonus)
}
