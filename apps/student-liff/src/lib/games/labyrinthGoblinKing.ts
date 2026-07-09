import type { VocabularyItem } from '@/store/useGameStore'
import type { Difficulty } from '@/store/useGameStore'
import type { GoblinType } from './labyrinthGoblinKingConfig'
import {
  LABYRINTH_CONFIG,
  getDifficultyConfig,
  getGoblinSpeed,
  GAME_WIDTH,
  GAME_HEIGHT,
} from './labyrinthGoblinKingConfig'

export type GameStatus = 'start' | 'playing' | 'victory' | 'defeat'

export type Position = {
  x: number
  y: number
}

export type Direction = 'up' | 'down' | 'left' | 'right' | 'none'

export type Player = {
  x: number
  y: number
  speed: number
  lives: number
  direction: Direction
  invulnerabilityTime: number
  heroicAura: boolean
  heroicAuraTimer: number
}

export type WordOrb = {
  id: string
  x: number
  y: number
  word: string
  orderIndex: number
  collected: boolean
}

export type Goblin = {
  id: string
  x: number
  y: number
  speed: number
  direction: Direction
  type: GoblinType
  fleeing: boolean
  eaten: boolean
}

export type TileType = 'wall' | 'floor'

export type Maze = TileType[][]

export type LabyrinthGoblinKingState = {
  status: GameStatus
  difficulty: Difficulty
  goblinType: GoblinType
  player: Player
  wordOrbs: WordOrb[]
  goblins: Goblin[]
  maze: Maze
  allSentences: VocabularyItem[]
  sentenceIndex: number
  currentSentence: VocabularyItem
  words: string[]
  collectedWords: string[]
  targetIndex: number
  correctAnswers: number
  wrongAnswers: number
  goblinsEaten: number
  gameTime: number
}

export type LabyrinthGoblinKingConfig = {
  difficulty?: Difficulty
  goblinType?: GoblinType
  rng?: () => number
}

const generateId = () => Math.random().toString(36).substring(2, 9)

function createMaze(cols: number, rows: number): Maze {
  const maze: Maze = []
  for (let row = 0; row < rows; row++) {
    const rowTiles: TileType[] = []
    for (let col = 0; col < cols; col++) {
      if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) {
        rowTiles.push('wall')
      } else if (row % 2 === 0 && col % 2 === 0) {
        rowTiles.push('wall')
      } else {
        rowTiles.push('floor')
      }
    }
    maze.push(rowTiles)
  }
  maze[1][0] = 'floor'
  maze[rows - 2][cols - 1] = 'floor'
  return maze
}

function getFloorPositions(maze: Maze, rng: () => number): Position[] {
  const positions: Position[] = []
  const tileSize = LABYRINTH_CONFIG.tileSize
  for (let row = 0; row < maze.length; row++) {
    for (let col = 0; col < maze[row].length; col++) {
      if (maze[row][col] === 'floor') {
        positions.push({
          x: col * tileSize + tileSize / 2,
          y: row * tileSize + tileSize / 2,
        })
      }
    }
  }
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[positions[i], positions[j]] = [positions[j], positions[i]]
  }
  return positions
}

function isWall(x: number, y: number, maze: Maze): boolean {
  const tileSize = LABYRINTH_CONFIG.tileSize
  const col = Math.floor(x / tileSize)
  const row = Math.floor(y / tileSize)
  if (row < 0 || row >= maze.length || col < 0 || col >= maze[0].length) {
    return true
  }
  return maze[row][col] === 'wall'
}

// --- Tile-based movement helpers ---

function isNearTileCenter(x: number, y: number): boolean {
  const tileSize = LABYRINTH_CONFIG.tileSize
  const col = Math.round((x - tileSize / 2) / tileSize)
  const row = Math.round((y - tileSize / 2) / tileSize)
  const cx = col * tileSize + tileSize / 2
  const cy = row * tileSize + tileSize / 2
  return Math.abs(x - cx) < 3 && Math.abs(y - cy) < 3
}

function snapToTileCenter(x: number, y: number): Position {
  const tileSize = LABYRINTH_CONFIG.tileSize
  const col = Math.round((x - tileSize / 2) / tileSize)
  const row = Math.round((y - tileSize / 2) / tileSize)
  return {
    x: col * tileSize + tileSize / 2,
    y: row * tileSize + tileSize / 2,
  }
}

function getAvailableDirections(x: number, y: number, maze: Maze, size: number): Direction[] {
  const tileSize = LABYRINTH_CONFIG.tileSize
  const snapped = snapToTileCenter(x, y)
  const dirs: Direction[] = []
  if (canMove(snapped.x, snapped.y - tileSize, maze, size)) dirs.push('up')
  if (canMove(snapped.x, snapped.y + tileSize, maze, size)) dirs.push('down')
  if (canMove(snapped.x - tileSize, snapped.y, maze, size)) dirs.push('left')
  if (canMove(snapped.x + tileSize, snapped.y, maze, size)) dirs.push('right')
  return dirs
}



// --- End tile-based helpers ---

export function createLabyrinthGoblinKingState(
  sentences: VocabularyItem[],
  config: LabyrinthGoblinKingConfig = {}
): LabyrinthGoblinKingState {
  if (!sentences || sentences.length === 0) {
    throw new Error('Sentences cannot be empty')
  }
  const rng = config.rng ?? Math.random
  const difficulty = config.difficulty ?? 'normal'
  const goblinType = config.goblinType ?? 'scout'

  const diffConfig = getDifficultyConfig(difficulty)
  const sentence = sentences[0]
  const words = sentence.term.split(' ').filter(w => w.trim().length > 0)

  const maze = createMaze(LABYRINTH_CONFIG.mazeCols, LABYRINTH_CONFIG.mazeRows)
  const floorPositions = getFloorPositions(maze, rng)

  const tileSize = LABYRINTH_CONFIG.tileSize
  const playerStartX = tileSize / 2
  const playerStartY = tileSize * 1.5

  const player: Player = {
    x: playerStartX,
    y: playerStartY,
    speed: LABYRINTH_CONFIG.playerSpeed,
    lives: diffConfig.lives,
    direction: 'right',
    invulnerabilityTime: 0,
    heroicAura: false,
    heroicAuraTimer: 0,
  }

  const wordOrbs: WordOrb[] = words.slice(0, diffConfig.wordCount).map((word, index) => {
    const pos = floorPositions[index] ?? { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 }
    return {
      id: generateId(),
      x: pos.x,
      y: pos.y,
      word,
      orderIndex: index,
      collected: false,
    }
  })

  const goblins: Goblin[] = []
  for (let i = 0; i < diffConfig.goblinCount; i++) {
    const pos = floorPositions[words.length + i] ?? { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 }
    goblins.push({
      id: generateId(),
      x: pos.x,
      y: pos.y,
      speed: getGoblinSpeed(goblinType),
      direction: 'none',
      type: goblinType,
      fleeing: false,
      eaten: false,
    })
  }

  return {
    status: 'start',
    difficulty,
    goblinType,
    player,
    wordOrbs,
    goblins,
    maze,
    allSentences: sentences,
    sentenceIndex: 0,
    currentSentence: sentence,
    words,
    collectedWords: [],
    targetIndex: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    goblinsEaten: 0,
    gameTime: 0,
  }
}

export type LabyrinthInput = {
  dx: number
  dy: number
}

function getRandomDirection(rng: () => number): Direction {
  const dirs: Direction[] = ['up', 'down', 'left', 'right']
  return dirs[Math.floor(rng() * dirs.length)]
}

function getOppositeDirection(dir: Direction): Direction {
  const opposites: Record<Direction, Direction> = {
    up: 'down',
    down: 'up',
    left: 'right',
    right: 'left',
    none: 'none',
  }
  return opposites[dir]
}

function moveInDirection(x: number, y: number, dir: Direction, speed: number): Position {
  switch (dir) {
    case 'up': return { x, y: y - speed }
    case 'down': return { x, y: y + speed }
    case 'left': return { x: x - speed, y }
    case 'right': return { x: x + speed, y }
    default: return { x, y }
  }
}

function canMove(newX: number, newY: number, maze: Maze, size: number): boolean {
  const halfSize = size / 2 - 2
  return !isWall(newX - halfSize, newY - halfSize, maze) &&
         !isWall(newX + halfSize, newY - halfSize, maze) &&
         !isWall(newX - halfSize, newY + halfSize, maze) &&
         !isWall(newX + halfSize, newY + halfSize, maze)
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

function spawnWordOrbs(
  sentence: VocabularyItem,
  maze: Maze,
  playerX: number,
  playerY: number,
  wordCount: number,
): WordOrb[] {
  const words = sentence.term.split(' ').filter(w => w.trim().length > 0)
  const rng = Math.random
  const floorPositions = getFloorPositions(maze, rng)
  const tileSize = LABYRINTH_CONFIG.tileSize
  const minDist = tileSize * 3

  // Filter out positions too close to player
  const safePositions = floorPositions.filter(
    p => distance(p.x, p.y, playerX, playerY) > minDist
  )
  const positionsToUse = safePositions.length >= words.length ? safePositions : floorPositions

  return words.slice(0, wordCount).map((word, index) => {
    const pos = positionsToUse[index] ?? { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 }
    return {
      id: generateId(),
      x: pos.x,
      y: pos.y,
      word,
      orderIndex: index,
      collected: false,
    }
  })
}

function respawnGoblin(goblin: Goblin, maze: Maze, playerX: number, playerY: number, fleeing: boolean): Goblin {
  const tileSize = LABYRINTH_CONFIG.tileSize
  const minDist = tileSize * 5
  const floorPositions = getFloorPositions(maze, Math.random)
  // Pick a floor position far from player
  const farPositions = floorPositions.filter(
    p => distance(p.x, p.y, playerX, playerY) > minDist
  )
  const pos = farPositions.length > 0 ? farPositions[0] : floorPositions[floorPositions.length - 1]
  return {
    ...goblin,
    x: pos.x,
    y: pos.y,
    direction: 'none',
    eaten: false,
    fleeing,
  }
}

function moveGoblinTileBased(
  goblin: Goblin,
  maze: Maze,
  playerX: number,
  playerY: number,
  dt: number,
  rng: () => number,
): Goblin {
  const newGoblin = { ...goblin }
  const speed = goblin.speed * dt

  // Move in current direction
  if (goblin.direction !== 'none') {
    const newPos = moveInDirection(goblin.x, goblin.y, goblin.direction, speed)
    if (canMove(newPos.x, newPos.y, maze, LABYRINTH_CONFIG.goblinSize)) {
      newGoblin.x = newPos.x
      newGoblin.y = newPos.y
    }
  }

  // At tile centers, decide next direction then nudge past center
  // so this doesn't retrigger every frame
  if (isNearTileCenter(newGoblin.x, newGoblin.y)) {
    const available = getAvailableDirections(newGoblin.x, newGoblin.y, maze, LABYRINTH_CONFIG.goblinSize)
    if (available.length === 0) return newGoblin

    const snapped = snapToTileCenter(newGoblin.x, newGoblin.y)
    const tileSize = LABYRINTH_CONFIG.tileSize

    if (newGoblin.fleeing) {
      // Flee: pick direction that moves away from player
      let bestDir = available[0]
      let bestDist = -1
      for (const dir of available) {
        const tx = snapped.x + (dir === 'right' ? tileSize : dir === 'left' ? -tileSize : 0)
        const ty = snapped.y + (dir === 'down' ? tileSize : dir === 'up' ? -tileSize : 0)
        const d = distance(tx, ty, playerX, playerY)
        if (d > bestDist) { bestDist = d; bestDir = dir }
      }
      newGoblin.direction = bestDir
    } else if (goblin.type !== 'scout' && distance(goblin.x, goblin.y, playerX, playerY) < LABYRINTH_CONFIG.chaseRange) {
      // Chase: pick direction toward player
      let bestDir = available[0]
      let bestDist = Infinity
      for (const dir of available) {
        const tx = snapped.x + (dir === 'right' ? tileSize : dir === 'left' ? -tileSize : 0)
        const ty = snapped.y + (dir === 'down' ? tileSize : dir === 'up' ? -tileSize : 0)
        const d = distance(tx, ty, playerX, playerY)
        if (d < bestDist) { bestDist = d; bestDir = dir }
      }
      newGoblin.direction = bestDir
    } else {
      // Patrol: random, prefer non-reverse
      const nonReverse = available.filter(d => d !== getOppositeDirection(goblin.direction))
      const choices = nonReverse.length > 0 ? nonReverse : available
      newGoblin.direction = choices[Math.floor(rng() * choices.length)]
    }

    // Nudge past tile center so isNearTileCenter won't retrigger next frame
    const nudged = moveInDirection(snapped.x, snapped.y, newGoblin.direction, 4)
    if (canMove(nudged.x, nudged.y, maze, LABYRINTH_CONFIG.goblinSize)) {
      newGoblin.x = nudged.x
      newGoblin.y = nudged.y
    } else {
      newGoblin.x = snapped.x
      newGoblin.y = snapped.y
    }
  }

  // Initialize direction if 'none'
  if (newGoblin.direction === 'none') {
    const available = getAvailableDirections(newGoblin.x, newGoblin.y, maze, LABYRINTH_CONFIG.goblinSize)
    newGoblin.direction = available.length > 0
      ? available[Math.floor(rng() * available.length)]
      : getRandomDirection(rng)
  }

  return newGoblin
}

export function tickLabyrinthGoblinKing(
  state: LabyrinthGoblinKingState,
  input: LabyrinthInput,
  deltaTimeMs: number
): LabyrinthGoblinKingState {
  if (state.status !== 'playing') return state

  const rng = Math.random
  const dt = deltaTimeMs / 16.67
  const newState = { ...state }

  newState.player = { ...state.player }
  if (newState.player.invulnerabilityTime > 0) {
    newState.player.invulnerabilityTime = Math.max(0, state.player.invulnerabilityTime - deltaTimeMs)
  }

  if (newState.player.heroicAura) {
    newState.player.heroicAuraTimer = Math.max(0, state.player.heroicAuraTimer - deltaTimeMs)
    if (newState.player.heroicAuraTimer <= 0) {
      newState.player.heroicAura = false
      newState.goblins = state.goblins.map(g => ({ ...g, fleeing: false }))
    }
  }

  // Pac-Man movement: player always moves, input sets desired direction
  const dx = input.dx
  const dy = input.dy
  const tileSize = LABYRINTH_CONFIG.tileSize
  const speed = state.player.speed * dt

  // Derive desired direction from input (if any)
  let desiredDirection: Direction = state.player.direction
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) desiredDirection = 'right'
    else if (dx < 0) desiredDirection = 'left'
  } else if (dy !== 0) {
    if (dy > 0) desiredDirection = 'down'
    else if (dy < 0) desiredDirection = 'up'
  }

  let moved = false

  // Try desired direction first (with corner-rounding snap)
  if (desiredDirection !== state.player.direction) {
    let snapX = state.player.x
    let snapY = state.player.y

    // Snap perpendicular axis to nearest tile center for smooth turning
    if (desiredDirection === 'up' || desiredDirection === 'down') {
      const col = Math.round((state.player.x - tileSize / 2) / tileSize)
      snapX = col * tileSize + tileSize / 2
    } else {
      const row = Math.round((state.player.y - tileSize / 2) / tileSize)
      snapY = row * tileSize + tileSize / 2
    }

    const snapDist = Math.abs(snapX - state.player.x) + Math.abs(snapY - state.player.y)
    if (snapDist < tileSize * 0.45) {
      const testPos = moveInDirection(snapX, snapY, desiredDirection, speed)
      if (canMove(testPos.x, testPos.y, state.maze, LABYRINTH_CONFIG.playerSize)) {
        newState.player.x = testPos.x
        newState.player.y = testPos.y
        newState.player.direction = desiredDirection
        moved = true
      }
    }
  }

  // If desired direction didn't work, keep moving in current direction
  if (!moved && state.player.direction !== 'none') {
    const newPos = moveInDirection(state.player.x, state.player.y, state.player.direction, speed)
    if (canMove(newPos.x, newPos.y, state.maze, LABYRINTH_CONFIG.playerSize)) {
      newState.player.x = newPos.x
      newState.player.y = newPos.y
    }
  }

  // --- Word orb collection ---
  newState.wordOrbs = state.wordOrbs.map(orb => {
    if (orb.collected) return orb
    const dist = distance(newState.player.x, newState.player.y, orb.x, orb.y)
    if (dist < (LABYRINTH_CONFIG.playerSize + LABYRINTH_CONFIG.orbSize) / 2) {
      return { ...orb, collected: true }
    }
    return orb
  })

  const justCollectedOrb = newState.wordOrbs.find(
    (orb, i) => orb.collected && !state.wordOrbs[i].collected
  )
  if (justCollectedOrb) {
    if (justCollectedOrb.orderIndex === state.targetIndex) {
      newState.correctAnswers = state.correctAnswers + 1
      newState.collectedWords = [...state.collectedWords, justCollectedOrb.word]
      newState.targetIndex = state.targetIndex + 1

      // All words in this sentence collected → heroic aura + next sentence
      if (newState.targetIndex >= newState.wordOrbs.length) {
        newState.player.heroicAura = true
        newState.player.heroicAuraTimer = LABYRINTH_CONFIG.heroicAuraDuration
        newState.goblins = (newState.goblins ?? state.goblins).map(g => ({ ...g, fleeing: true }))

        // Advance to next sentence and spawn new word orbs
        const nextIndex = (state.sentenceIndex + 1) % state.allSentences.length
        const nextSentence = state.allSentences[nextIndex]
        const diffConfig = getDifficultyConfig(state.difficulty)
        newState.sentenceIndex = nextIndex
        newState.currentSentence = nextSentence
        newState.words = nextSentence.term.split(' ').filter(w => w.trim().length > 0)
        newState.wordOrbs = spawnWordOrbs(
          nextSentence, state.maze, newState.player.x, newState.player.y, diffConfig.wordCount
        )
        newState.collectedWords = []
        newState.targetIndex = 0
      }
    } else {
      newState.wrongAnswers = state.wrongAnswers + 1
      newState.player.lives = state.player.lives - 1
      newState.player.invulnerabilityTime = LABYRINTH_CONFIG.invulnerabilityDuration
      const floorPositions = getFloorPositions(state.maze, rng)
      const uncollectedOrbs = newState.wordOrbs.filter(o => !o.collected)
      const usedPositions = uncollectedOrbs.map(o => `${o.x},${o.y}`)
      const availablePositions = floorPositions.filter(
        p => !usedPositions.includes(`${p.x},${p.y}`)
      )
      if (availablePositions.length > 0) {
        const orbIndex = newState.wordOrbs.findIndex(o => o.id === justCollectedOrb.id)
        if (orbIndex >= 0) {
          const newPos = availablePositions[0]
          newState.wordOrbs = newState.wordOrbs.map((o, i) =>
            i === orbIndex ? { ...o, collected: false, x: newPos.x, y: newPos.y } : o
          )
        }
      }
    }
  }

  if (newState.player.lives <= 0) {
    newState.status = 'defeat'
    return newState
  }

  // --- Goblin movement (tile-based) ---
  newState.goblins = (newState.goblins ?? state.goblins).map(goblin => {
    if (goblin.eaten) {
      // Respawn eaten goblins at a far floor position
      return respawnGoblin(goblin, state.maze, newState.player.x, newState.player.y, newState.player.heroicAura)
    }

    const newGoblin = moveGoblinTileBased(
      goblin, state.maze, newState.player.x, newState.player.y, dt, rng
    )

    // Update fleeing state based on heroic aura
    if (newState.player.heroicAura) {
      newGoblin.fleeing = true
    }

    // Collision with player
    const collisionDist = distance(newState.player.x, newState.player.y, newGoblin.x, newGoblin.y)
    if (collisionDist < (LABYRINTH_CONFIG.playerSize + LABYRINTH_CONFIG.goblinSize) / 2) {
      if (newState.player.heroicAura) {
        newGoblin.eaten = true
        newState.goblinsEaten = (newState.goblinsEaten ?? state.goblinsEaten) + 1
      } else if (newState.player.invulnerabilityTime <= 0) {
        newState.player.lives = newState.player.lives - 1
        newState.player.invulnerabilityTime = LABYRINTH_CONFIG.invulnerabilityDuration
      }
    }

    return newGoblin
  })

  newState.gameTime = state.gameTime + deltaTimeMs

  return newState
}

export function startLabyrinthGoblinKing(state: LabyrinthGoblinKingState): LabyrinthGoblinKingState {
  if (state.status !== 'start') return state
  return { ...state, status: 'playing' }
}

export function calculateLabyrinthXP(state: LabyrinthGoblinKingState): number {
  const totalAttempts = state.correctAnswers + state.wrongAnswers
  const accuracy = totalAttempts > 0 ? state.correctAnswers / totalAttempts : 0
  const baseXP = Math.floor(state.correctAnswers * accuracy)
  const goblinBonus = state.goblinsEaten * LABYRINTH_CONFIG.xpPerGoblinEaten
  return Math.min(LABYRINTH_CONFIG.maxXP, baseXP + goblinBonus)
}

export function getTileAt(x: number, y: number, maze: Maze): TileType {
  const tileSize = LABYRINTH_CONFIG.tileSize
  const col = Math.floor(x / tileSize)
  const row = Math.floor(y / tileSize)
  if (row < 0 || row >= maze.length || col < 0 || col >= maze[0].length) {
    return 'wall'
  }
  return maze[row][col]
}
