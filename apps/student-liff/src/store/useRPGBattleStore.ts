import { create } from 'zustand'
import { BattleEnemyId, BattleHeroId, BattleLocationId } from '@/lib/games/rpgBattleSelection'

export type BattleStatus = 'idle' | 'playing' | 'victory' | 'defeat'
export type BattleTurn = 'player' | 'enemy'
export type BattlePose =
  | 'idle'
  | 'casting'
  | 'basic-attack'
  | 'power-attack'
  | 'hurt'
  | 'miss'
  | 'defend'
  | 'victory'
  | 'defeat'
export type BattleAttackPower = 'basic' | 'power'
export type BattleSelectionStep = 'hero' | 'location' | 'enemy' | 'ready'

export interface BattleLogEntry {
  text: string
  type: 'player' | 'enemy' | 'system'
}

export interface RPGBattleState {
  playerHealth: number
  playerMaxHealth: number
  enemyHealth: number
  enemyMaxHealth: number
  turn: BattleTurn
  status: BattleStatus
  battleLog: BattleLogEntry[]
  streak: number
  xpEarned: number
  inputLocked: boolean
  revealedTranslation: string | null
  playerPose: BattlePose
  enemyPose: BattlePose
  selectionStep: BattleSelectionStep
  selectedHeroId: BattleHeroId | null
  selectedLocationId: BattleLocationId | null
  selectedEnemyId: BattleEnemyId | null
  
  // Actions
  initializeBattle: (options?: { enemyMaxHealth?: number }) => void
  setTurn: (turn: BattleTurn) => void
  setStatus: (status: BattleStatus) => void
  damagePlayer: (amount: number) => void
  damageEnemy: (amount: number) => void
  enemyAttack: (damage?: number) => void
  submitAnswer: (input: string, expected: string, attackPower?: BattleAttackPower) => boolean
  addLogEntry: (text: string, type: BattleLogEntry['type']) => void
  selectHero: (heroId: BattleHeroId) => void
  selectLocation: (locationId: BattleLocationId) => void
  selectEnemy: (enemyId: BattleEnemyId) => void
  resetSelection: () => void
}

let revealTimeout: ReturnType<typeof setTimeout> | null = null

export const useRPGBattleStore = create<RPGBattleState>((set, get) => ({
  playerHealth: 100,
  playerMaxHealth: 100,
  enemyHealth: 100,
  enemyMaxHealth: 100,
  turn: 'player',
  status: 'idle',
  battleLog: [],
  streak: 0,
  xpEarned: 0,
  inputLocked: false,
  revealedTranslation: null,
  playerPose: 'idle',
  enemyPose: 'idle',
  selectionStep: 'hero',
  selectedHeroId: null,
  selectedLocationId: null,
  selectedEnemyId: null,

  initializeBattle: (options = {}) => {
    const enemyMaxHealth = options.enemyMaxHealth ?? 100

    return set({
      playerHealth: 100,
      playerMaxHealth: 100,
      enemyHealth: enemyMaxHealth,
      enemyMaxHealth,
      turn: 'player',
      status: 'playing',
      battleLog: [{ text: 'A wild monster appears!', type: 'system' }],
      streak: 0,
      xpEarned: 0,
      inputLocked: false,
      revealedTranslation: null,
      playerPose: 'idle',
      enemyPose: 'idle'
    })
  },

  setTurn: (turn) => set({ turn }),
  setStatus: (status) => set({ status }),

  damagePlayer: (amount) => set((state) => {
    const nextHealth = Math.max(0, state.playerHealth - amount)
    const nextStatus = state.status === 'playing' && nextHealth <= 0 ? 'defeat' : state.status

    return {
      playerHealth: nextHealth,
      status: nextStatus,
      playerPose: nextStatus === 'defeat' ? 'defeat' : 'hurt',
    }
  }),

  damageEnemy: (amount) => set((state) => {
    const nextHealth = Math.max(0, state.enemyHealth - amount)
    const nextStatus = state.status === 'playing' && nextHealth <= 0 ? 'victory' : state.status

    return {
      enemyHealth: nextHealth,
      status: nextStatus,
      enemyPose: nextStatus === 'victory' ? 'defeat' : 'hurt',
      playerPose: nextStatus === 'victory' ? 'victory' : state.playerPose,
    }
  }),

  enemyAttack: (damage = 8) => {
    const { status, turn, damagePlayer } = get()
    if (status !== 'playing' || turn !== 'enemy') return

    set({ enemyPose: 'basic-attack', turn: 'player' })
    damagePlayer(damage)
  },

  submitAnswer: (input, expected, attackPower = 'basic') => {
    const normalizedInput = input.trim().toLowerCase()
    const normalizedExpected = expected.trim().toLowerCase()
    const isCorrect = normalizedInput === normalizedExpected

    if (revealTimeout) {
      clearTimeout(revealTimeout)
      revealTimeout = null
    }

    if (isCorrect) {
      set((state) => ({
        inputLocked: false,
        revealedTranslation: null,
        streak: state.streak + 1,
        playerPose: attackPower === 'power' ? 'power-attack' : 'basic-attack',
      }))
      return true
    }

    set({
      inputLocked: true,
      revealedTranslation: expected,
      streak: 0,
      playerPose: 'miss',
    })
    revealTimeout = setTimeout(() => {
      set({ inputLocked: false, revealedTranslation: null })
      revealTimeout = null
    }, 2000)

    return false
  },

  addLogEntry: (text, type) => set((state) => ({
    battleLog: [...state.battleLog, { text, type }]
  })),

  selectHero: (heroId) => set((state) => {
    if (state.selectionStep !== 'hero') return {}

    return {
      selectedHeroId: heroId,
      selectionStep: 'location',
    }
  }),

  selectLocation: (locationId) => set((state) => {
    if (state.selectionStep !== 'location') return {}

    return {
      selectedLocationId: locationId,
      selectionStep: 'enemy',
    }
  }),

  selectEnemy: (enemyId) => set((state) => {
    if (state.selectionStep !== 'enemy') return {}

    return {
      selectedEnemyId: enemyId,
      selectionStep: 'ready',
    }
  }),

  resetSelection: () => set({
    selectionStep: 'hero',
    selectedHeroId: null,
    selectedLocationId: null,
    selectedEnemyId: null,
  }),
}))
