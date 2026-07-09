import type { VocabularyItem } from '@/store/useGameStore'
import type { Difficulty } from '@/store/useGameStore'
import type { CreatureType } from './shadowGateDungeonConfig'
import { SHADOW_GATE_DUNGEON_CONFIG, getDifficultyConfig, getCreatureSpeed, getCreaturePatrolSpeed, GAME_WIDTH, GAME_HEIGHT } from './shadowGateDungeonConfig'

export type GameStatus = 'start' | 'playing' | 'victory' | 'defeat'

export type Position = {
  x: number
  y: number
}

export type WordCrystal = {
  id: string
  word: string
  orderIndex: number
  position: Position
  collected: boolean
}

export type CreatureMode = 'patrol' | 'chase'

export type ShadowCreature = {
  position: Position
  velocity: Position
  type: CreatureType
  mode: CreatureMode
  chaseTimer: number
  patrolAngle: number
}

export type ExitGate = {
  position: Position
  width: number
  height: number
  unlocked: boolean
}

export type Player = {
  position: Position
  velocity: Position
  health: number
  invincible: boolean
  invincibilityTimer: number
}

export type ShadowGateDungeonState = {
  status: GameStatus
  difficulty: Difficulty
  creatureType: CreatureType
  player: Player
  creature: ShadowCreature
  gate: ExitGate
  crystals: WordCrystal[]
  currentSentence: VocabularyItem
  words: string[]
  collectedWords: string[]
  targetIndex: number
  correctAnswers: number
  wrongAnswers: number
  gameTime: number
}

export type ShadowGateDungeonConfig = {
  difficulty?: Difficulty
  creatureType?: CreatureType
  rng?: () => number
}

const generateId = () => Math.random().toString(36).substring(2, 9)

export function createShadowGateDungeonState(
  vocabulary: VocabularyItem[],
  config: ShadowGateDungeonConfig = {}
): ShadowGateDungeonState {
  if (vocabulary.length === 0) {
    throw new Error('Vocabulary cannot be empty')
  }

  const rng = config.rng ?? Math.random
  const difficulty = config.difficulty ?? 'normal'
  const creatureType = config.creatureType ?? 'orc-hunter'

  const sentenceIndex = Math.floor(rng() * vocabulary.length)
  const currentSentence = vocabulary[sentenceIndex]
  const words = currentSentence.term.split(' ')

  const diffConfig = getDifficultyConfig(difficulty)
  const wordCount = Math.min(diffConfig.wordCount, words.length)
  const activeWords = words.slice(0, wordCount)

  const player: Player = {
    position: { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 100 },
    velocity: { x: 0, y: 0 },
    health: SHADOW_GATE_DUNGEON_CONFIG.initialHealth,
    invincible: false,
    invincibilityTimer: 0,
  }

  const creature: ShadowCreature = {
    position: { x: GAME_WIDTH / 2, y: 100 },
    velocity: { x: 0, y: 0 },
    type: creatureType,
    mode: 'patrol',
    chaseTimer: 0,
    patrolAngle: 0,
  }

  const gate: ExitGate = {
    position: { x: GAME_WIDTH / 2 - SHADOW_GATE_DUNGEON_CONFIG.gateWidth / 2, y: 20 },
    width: SHADOW_GATE_DUNGEON_CONFIG.gateWidth,
    height: SHADOW_GATE_DUNGEON_CONFIG.gateHeight,
    unlocked: false,
  }

  const crystals = spawnCrystals(activeWords, player.position, gate.position, rng)

  return {
    status: 'playing',
    difficulty,
    creatureType,
    player,
    creature,
    gate,
    crystals,
    currentSentence,
    words: activeWords,
    collectedWords: [],
    targetIndex: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    gameTime: 0,
  }
}

function spawnCrystals(
  words: string[],
  playerPos: Position,
  gatePos: Position,
  rng: () => number
): WordCrystal[] {
  const margin = SHADOW_GATE_DUNGEON_CONFIG.crystalSpawnMargin
  const crystalRadius = SHADOW_GATE_DUNGEON_CONFIG.crystalRadius
  const gateHeight = SHADOW_GATE_DUNGEON_CONFIG.gateHeight

  const crystals: WordCrystal[] = []
  const usedPositions: Position[] = [
    playerPos,
    { x: GAME_WIDTH / 2, y: gatePos.y + gateHeight / 2 },
  ]

  words.forEach((word, index) => {
    let position: Position
    let attempts = 0
    const maxAttempts = 100

    do {
      position = {
        x: margin + rng() * (GAME_WIDTH - 2 * margin),
        y: margin + gateHeight + rng() * (GAME_HEIGHT - 2 * margin - gateHeight),
      }
      attempts++
    } while (
      attempts < maxAttempts &&
      usedPositions.some(
        (p) =>
          Math.sqrt((p.x - position.x) ** 2 + (p.y - position.y) ** 2) <
          crystalRadius * 3
      )
    )

    usedPositions.push(position)

    crystals.push({
      id: generateId(),
      word,
      orderIndex: index,
      position,
      collected: false,
    })
  })

  return crystals
}

export function tickShadowGateDungeon(
  state: ShadowGateDungeonState,
  deltaMs: number,
): ShadowGateDungeonState {
  if (state.status !== 'playing') return state

  const newState = { ...state }
  newState.gameTime += deltaMs

  const deltaSeconds = deltaMs / 1000
  const playerSpeed = SHADOW_GATE_DUNGEON_CONFIG.playerSpeed
  const creatureSpeed = getCreatureSpeed(state.creatureType)

  newState.player = {
    ...state.player,
    position: {
      x: Math.max(
        SHADOW_GATE_DUNGEON_CONFIG.playerRadius,
        Math.min(
          GAME_WIDTH - SHADOW_GATE_DUNGEON_CONFIG.playerRadius,
          state.player.position.x + state.player.velocity.x * playerSpeed * deltaSeconds
        )
      ),
      y: Math.max(
        SHADOW_GATE_DUNGEON_CONFIG.playerRadius,
        Math.min(
          GAME_HEIGHT - SHADOW_GATE_DUNGEON_CONFIG.playerRadius,
          state.player.position.y + state.player.velocity.y * playerSpeed * deltaSeconds
        )
      ),
    },
    invincibilityTimer: Math.max(0, state.player.invincibilityTimer - deltaMs),
    invincible: state.player.invincibilityTimer - deltaMs > 0,
  }

  const playerPos = newState.player.position
  const creatureChaseSpeed = creatureSpeed / 1000
  const creaturePatrolSpeed = getCreaturePatrolSpeed(state.creatureType) / 1000

  const dxToPlayer = playerPos.x - state.creature.position.x
  const dyToPlayer = playerPos.y - state.creature.position.y
  const distToPlayer = Math.sqrt(dxToPlayer * dxToPlayer + dyToPlayer * dyToPlayer)

  // Determine mode: enter chase if player within sight radius
  let creatureMode = state.creature.mode
  let chaseTimer = state.creature.chaseTimer

  if (distToPlayer < SHADOW_GATE_DUNGEON_CONFIG.sightRadius) {
    creatureMode = 'chase'
    chaseTimer = SHADOW_GATE_DUNGEON_CONFIG.chaseDuration
  } else if (creatureMode === 'chase') {
    chaseTimer -= deltaMs
    if (chaseTimer <= 0) {
      creatureMode = 'patrol'
      chaseTimer = 0
    }
  }

  let newCreatureX = state.creature.position.x
  let newCreatureY = state.creature.position.y
  let newVelocity = state.creature.velocity
  let newPatrolAngle = state.creature.patrolAngle

  if (creatureMode === 'chase' && distToPlayer > 0) {
    // Chase: move directly toward player
    const vx = (dxToPlayer / distToPlayer) * creatureChaseSpeed
    const vy = (dyToPlayer / distToPlayer) * creatureChaseSpeed
    newCreatureX = state.creature.position.x + vx * deltaMs
    newCreatureY = state.creature.position.y + vy * deltaMs
    newVelocity = { x: vx, y: vy }
  } else {
    // Patrol: circle around the dungeon center
    const patrolRadiansPerMs = creaturePatrolSpeed / SHADOW_GATE_DUNGEON_CONFIG.patrolRadius
    newPatrolAngle = state.creature.patrolAngle + patrolRadiansPerMs * deltaMs
    newCreatureX = SHADOW_GATE_DUNGEON_CONFIG.patrolCenterX + Math.cos(newPatrolAngle) * SHADOW_GATE_DUNGEON_CONFIG.patrolRadius
    newCreatureY = SHADOW_GATE_DUNGEON_CONFIG.patrolCenterY + Math.sin(newPatrolAngle) * SHADOW_GATE_DUNGEON_CONFIG.patrolRadius
    newVelocity = {
      x: -Math.sin(newPatrolAngle) * creaturePatrolSpeed,
      y: Math.cos(newPatrolAngle) * creaturePatrolSpeed,
    }
  }

  newState.creature = {
    ...state.creature,
    position: {
      x: Math.max(SHADOW_GATE_DUNGEON_CONFIG.creatureRadius, Math.min(GAME_WIDTH - SHADOW_GATE_DUNGEON_CONFIG.creatureRadius, newCreatureX)),
      y: Math.max(SHADOW_GATE_DUNGEON_CONFIG.creatureRadius, Math.min(GAME_HEIGHT - SHADOW_GATE_DUNGEON_CONFIG.creatureRadius, newCreatureY)),
    },
    velocity: newVelocity,
    mode: creatureMode,
    chaseTimer,
    patrolAngle: newPatrolAngle,
  }

  if (!newState.player.invincible) {
    const creatureDistance = Math.sqrt(
      (newState.player.position.x - newState.creature.position.x) ** 2 +
        (newState.player.position.y - newState.creature.position.y) ** 2
    )

    if (creatureDistance < SHADOW_GATE_DUNGEON_CONFIG.playerRadius + SHADOW_GATE_DUNGEON_CONFIG.creatureRadius) {
      newState.player = {
        ...newState.player,
        health: newState.player.health - SHADOW_GATE_DUNGEON_CONFIG.creatureCollisionDamage,
        invincible: true,
        invincibilityTimer: SHADOW_GATE_DUNGEON_CONFIG.invincibilityDuration,
      }
    }
  }

  if (newState.player.health <= 0) {
    newState.status = 'defeat'
    return newState
  }

  for (let i = 0; i < newState.crystals.length; i++) {
    const crystal = newState.crystals[i]
    if (crystal.collected) continue

    const crystalDistance = Math.sqrt(
      (newState.player.position.x - crystal.position.x) ** 2 +
        (newState.player.position.y - crystal.position.y) ** 2
    )

    if (crystalDistance < SHADOW_GATE_DUNGEON_CONFIG.playerRadius + SHADOW_GATE_DUNGEON_CONFIG.crystalRadius) {
      const targetWord = state.words[state.targetIndex]
      const isCorrect = crystal.word === targetWord

      if (isCorrect) {
        newState.crystals = [
          ...newState.crystals.slice(0, i),
          { ...crystal, collected: true },
          ...newState.crystals.slice(i + 1),
        ]
        newState.collectedWords = [...state.collectedWords, crystal.word]
        newState.targetIndex = state.targetIndex + 1
        newState.correctAnswers = state.correctAnswers + 1
      } else {
        newState.player = {
          ...newState.player,
          health: newState.player.health - SHADOW_GATE_DUNGEON_CONFIG.wrongWordDamage,
          invincible: true,
          invincibilityTimer: SHADOW_GATE_DUNGEON_CONFIG.invincibilityDuration,
        }
        newState.wrongAnswers = state.wrongAnswers + 1

        if (newState.player.health <= 0) {
          newState.status = 'defeat'
          return newState
        }
      }
      break
    }
  }

  if (newState.targetIndex >= state.words.length) {
    newState.gate = { ...state.gate, unlocked: true }
  }

  if (newState.gate.unlocked) {
    const gateCenterX = state.gate.position.x + state.gate.width / 2
    const gateCenterY = state.gate.position.y + state.gate.height / 2
    const gateDistance = Math.sqrt(
      (newState.player.position.x - gateCenterX) ** 2 +
        (newState.player.position.y - gateCenterY) ** 2
    )

    if (gateDistance < SHADOW_GATE_DUNGEON_CONFIG.playerRadius + Math.min(state.gate.width, state.gate.height) / 2) {
      newState.status = 'victory'
    }
  }

  return newState
}

export function calculateXP(state: ShadowGateDungeonState): number {
  const baseXP = state.correctAnswers * SHADOW_GATE_DUNGEON_CONFIG.xpPerCorrectWord
  let bonus = 0

  if (state.wrongAnswers === 0) {
    bonus += SHADOW_GATE_DUNGEON_CONFIG.accuracyBonus
  }

  if (state.gameTime < SHADOW_GATE_DUNGEON_CONFIG.speedBonusThreshold) {
    bonus += SHADOW_GATE_DUNGEON_CONFIG.speedBonus
  }

  const healthPercent = (state.player.health / SHADOW_GATE_DUNGEON_CONFIG.initialHealth) * 100
  if (healthPercent >= SHADOW_GATE_DUNGEON_CONFIG.survivalBonusThreshold) {
    bonus += SHADOW_GATE_DUNGEON_CONFIG.survivalBonus
  }

  return Math.min(SHADOW_GATE_DUNGEON_CONFIG.maxXP, baseXP + bonus)
}

export function setPlayerVelocity(
  state: ShadowGateDungeonState,
  velocity: Position
): ShadowGateDungeonState {
  return {
    ...state,
    player: {
      ...state.player,
      velocity,
    },
  }
}
