import type { VocabularyItem } from '@/store/useGameStore'

export interface Entity {
  id: string
  x: number
  y: number
  width: number
  height: number
  type: 'player' | 'ghost' | 'bat'
  velocity: { x: number; y: number }
  facing: 'left' | 'right'
  state: 'idle' | 'walking' | 'jumping' | 'stunned'
  stunTimer: number
}

export interface Door {
  id: string
  x: number
  y: number
  floor: number
  wordIndex: number | null // null means no word (trap door)
  word: string | null
  isOpen: boolean
  openTimer: number
  isCorrect: boolean | null
}

export interface LibraryState {
  currentSentence: VocabularyItem
  words: string[]
  nextWordIndex: number
  player: Entity
  ghosts: Entity[]
  bats: Entity[]
  doors: Door[]
  floors: { y: number; height: number }[]
  lives: number
  initialLives: number
  score: number
  accuracy: number
  totalAttempts: number
  correctAnswers: number
  phase: 'playing' | 'victory' | 'defeat'
  time: number
  lastEvent: 'correct' | 'incorrect' | 'damage' | 'victory' | 'defeat' | null
  difficulty: 'easy' | 'medium' | 'hard'
}

export const GAME_WIDTH = 390
export const GAME_HEIGHT = 844
export const FLOOR_HEIGHT = 160
export const PLAYER_WIDTH = 48
export const PLAYER_HEIGHT = 64
export const DOOR_WIDTH = 60
export const DOOR_HEIGHT = 80
export const TRAMPOLINE_HEIGHT = 20

export interface LibraryConfig {
  difficulty: 'easy' | 'medium' | 'hard'
}

export function createLibraryState(
  sentences: VocabularyItem[],
  config: LibraryConfig = { difficulty: 'medium' },
  rng: () => number = Math.random
): LibraryState {
  const sentence = sentences[0]
  const words = sentence.term.split(' ')

  const floorCount = config.difficulty === 'easy' ? 3 : config.difficulty === 'medium' ? 4 : 5
  const ghostCount = config.difficulty === 'easy' ? 2 : config.difficulty === 'medium' ? 3 : 5
  const trapDoorCount = config.difficulty === 'easy' ? 1 : config.difficulty === 'medium' ? 3 : 5

  const floors: { y: number; height: number }[] = []
  for (let i = 0; i < floorCount; i++) {
    floors.push({ y: GAME_HEIGHT - 100 - FLOOR_HEIGHT * i, height: 20 })
  }

  const doors: Door[] = []
  words.forEach((word, index) => {
    const floor = Math.floor(rng() * floorCount)
    doors.push({
      id: `door-${index}`,
      x: 50 + rng() * (GAME_WIDTH - 100),
      y: floors[floor].y - DOOR_HEIGHT,
      floor,
      wordIndex: index,
      word,
      isOpen: false,
      openTimer: 0,
      isCorrect: null,
    })
  })

  // Add fake/trap doors
  for (let i = 0; i < trapDoorCount; i++) {
    const floor = Math.floor(rng() * floorCount)
    doors.push({
      id: `trap-${i}`,
      x: 50 + rng() * (GAME_WIDTH - 100),
      y: floors[floor].y - DOOR_HEIGHT,
      floor,
      wordIndex: null,
      word: '?', 
      isOpen: false,
      openTimer: 0,
      isCorrect: null,
    })
  }

  const ghosts: Entity[] = []
  const ghostSpeed = config.difficulty === 'easy' ? 60 : config.difficulty === 'medium' ? 80 : 120
  for (let i = 0; i < ghostCount; i++) {
    const floor = 1 + Math.floor(rng() * (floorCount - 1))
    ghosts.push({
      id: `ghost-${i}`,
      x: rng() * (GAME_WIDTH - 48),
      y: floors[floor].y - 48,
      width: 48,
      height: 48,
      type: 'ghost',
      velocity: { x: (rng() > 0.5 ? 1 : -1) * ghostSpeed, y: 0 },
      facing: 'right',
      state: 'walking',
      stunTimer: 0,
    })
  }

  return {
    currentSentence: sentence,
    words,
    nextWordIndex: 0,
    player: {
      id: 'player',
      x: GAME_WIDTH / 2 - PLAYER_WIDTH / 2,
      y: floors[0].y - PLAYER_HEIGHT,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      type: 'player',
      velocity: { x: 0, y: 0 },
      facing: 'right',
      state: 'idle',
      stunTimer: 0,
    },
    ghosts,
    bats: [],
    doors,
    floors,
    lives: config.difficulty === 'easy' ? 5 : 3,
    initialLives: config.difficulty === 'easy' ? 5 : 3,
    score: 0,
    accuracy: 0,
    totalAttempts: 0,
    correctAnswers: 0,
    phase: 'playing',
    time: 0,
    lastEvent: null,
    difficulty: config.difficulty,
  }
}


export const PLAYER_SPEED = 200
export const GRAVITY = 800
export const JUMP_FORCE = -500
export const TRAMPOLINE_FORCE = -700
export const GHOST_SPEED = 80
export const BAT_SPEED = 120
export const INITIAL_LIVES = { easy: 5, medium: 3, hard: 3 } as const

export function calculateXP(state: LibraryState): number {
  if (state.totalAttempts === 0) return 0

  const accuracy = state.correctAnswers / state.totalAttempts
  const baseXP = state.correctAnswers

  let bonus = 0
  if (accuracy === 1) bonus += 2
  if (state.lives / state.initialLives >= 0.5) bonus += 1
  if (state.time < 60000) bonus += 1

  return Math.min(10, baseXP + bonus)
}

export function tickLibrary(state: LibraryState, delta: number, input: { dx: number; dy: number }): LibraryState {
  if (state.phase !== 'playing') return state

  const dt = delta / 1000
  const nextState = { ...state, time: state.time + delta, lastEvent: null as LibraryState['lastEvent'] }
  const player = { ...nextState.player }

  // 1. Movement & Gravity
  player.velocity.x = input.dx * PLAYER_SPEED
  player.velocity.y += GRAVITY * dt

  // 2. Apply Velocity
  player.x += player.velocity.x * dt
  player.y += player.velocity.y * dt

  // 3. Keep within boundaries
  if (player.x < 0) player.x = 0
  if (player.x > GAME_WIDTH - player.width) player.x = GAME_WIDTH - player.width

  // 4. Floor Collision
  let onFloor = false
  for (const floor of nextState.floors) {
    if (
      player.velocity.y >= 0 &&
      player.y + player.height >= floor.y &&
      player.y + player.height <= floor.y + floor.height + 10 &&
      player.x + player.width > 0 &&
      player.x < GAME_WIDTH
    ) {
      player.y = floor.y - player.height
      player.velocity.y = 0
      onFloor = true
      break
    }
  }

  // 5. Trampoline logic (jump-pads are at the edges)
  const isAtEdge = player.x < 40 || player.x > GAME_WIDTH - 40 - player.width
  if (onFloor && isAtEdge) {
    player.velocity.y = TRAMPOLINE_FORCE
    player.state = 'jumping'
  } else if (onFloor) {
    player.state = player.velocity.x !== 0 ? 'walking' : 'idle'
  } else {
    player.state = 'jumping'
  }

  // 6. Ghosts movement & Collision
  nextState.ghosts = nextState.ghosts.map(ghost => {
    const nextGhost = { ...ghost }
    if (ghost.stunTimer > 0) {
      nextGhost.stunTimer -= delta
      return nextGhost
    }

    nextGhost.x += ghost.velocity.x * dt
    if (nextGhost.x < 0 || nextGhost.x > GAME_WIDTH - ghost.width) {
      nextGhost.velocity.x *= -1
      nextGhost.x = Math.max(0, Math.min(GAME_WIDTH - ghost.width, nextGhost.x))
    }

    // Collision with player
    const dist = Math.sqrt(
      Math.pow(player.x + player.width / 2 - (nextGhost.x + ghost.width / 2), 2) +
      Math.pow(player.y + player.height / 2 - (nextGhost.y + ghost.height / 2), 2)
    )
    if (dist < 30) {
      nextState.lives--
      nextState.lastEvent = 'damage'
    }

    return nextGhost
  })


  // 7. Bats movement & Collision
  const bats = nextState.bats.map(bat => {
    const nextBat = { ...bat }
    const angle = Math.atan2(
      player.y + player.height / 2 - (bat.y + bat.height / 2),
      player.x + player.width / 2 - (bat.x + bat.width / 2)
    )
    nextBat.velocity.x = Math.cos(angle) * BAT_SPEED
    nextBat.velocity.y = Math.sin(angle) * BAT_SPEED
    nextBat.x += nextBat.velocity.x * dt
    nextBat.y += nextBat.velocity.y * dt

    // Collision with player
    const dist = Math.sqrt(
      Math.pow(player.x + player.width / 2 - (nextBat.x + bat.width / 2), 2) +
      Math.pow(player.y + player.height / 2 - (nextBat.y + bat.height / 2), 2)
    )
    if (dist < 20) {
      nextState.lives--
      nextState.lastEvent = 'damage'
      return null // Remove bat on hit
    }
    return nextBat
  }).filter(Boolean) as Entity[]

  // 8. Door Interaction
  const newBats: Entity[] = []
  
  // Find doors player is near
  const nearDoors = nextState.doors.map((door, index) => {
    const isPlayerNear = Math.abs(player.x + player.width / 2 - (door.x + DOOR_WIDTH / 2)) < 30 &&
                         Math.abs(player.y + player.height / 2 - (door.y + DOOR_HEIGHT / 2)) < 40
    return { door, index, isPlayerNear, dist: Math.abs(player.x + player.width / 2 - (door.x + DOOR_WIDTH / 2)) }
  }).filter(d => d.isPlayerNear && !d.door.isOpen)

  // Only interact with the closest door if any are near and pressing Up
  const closestDoorIndex = nearDoors.length > 0 ? nearDoors.sort((a, b) => a.dist - b.dist)[0].index : -1

  const doors = nextState.doors.map((door, index) => {
    const nextDoor = { ...door }
    if (index === closestDoorIndex && input.dy < 0) {
      nextDoor.isOpen = true
      nextDoor.openTimer = 500

      if (door.wordIndex === nextState.nextWordIndex) {
        nextDoor.isCorrect = true
        nextState.nextWordIndex++
        nextState.score += 100
        nextState.correctAnswers++
        nextState.totalAttempts++
        nextState.lastEvent = 'correct'
      } else {
        nextDoor.isCorrect = false
        nextState.lives--
        nextState.totalAttempts++
        nextState.lastEvent = 'incorrect'
        // Spawn bat!
        newBats.push({
          id: `bat-${nextState.time}-${Math.random()}`,
          x: door.x,
          y: door.y,
          width: 32,
          height: 32,
          type: 'bat',
          velocity: { x: 0, y: 0 },
          facing: 'right',
          state: 'jumping',
          stunTimer: 0,
        })
      }

      // Slam ghost if near door
      nextState.ghosts = nextState.ghosts.map(ghost => {
        const dist = Math.sqrt(
          Math.pow(ghost.x + ghost.width / 2 - (door.x + DOOR_WIDTH / 2), 2) +
          Math.pow(ghost.y + ghost.height / 2 - (door.y + DOOR_HEIGHT / 2), 2)
        )
        if (dist < 50) {
          return { ...ghost, state: 'stunned', stunTimer: 2000 }
        }
        return ghost
      })
    }

    return nextDoor
  })


  // 9. Check Win/Loss
  if (nextState.nextWordIndex >= nextState.words.length) {
    nextState.phase = 'victory'
    nextState.lastEvent = 'victory'
  } else if (nextState.lives <= 0) {
    nextState.phase = 'defeat'
    nextState.lastEvent = 'defeat'
  }

  nextState.player = player
  nextState.bats = [...bats, ...newBats]
  nextState.doors = doors
  return nextState
}

