import type { ContentPackMetadata } from './contentPackSchema'

export interface PackRotationState {
  activePacks: string[]
  stablePacks: string[]
  lastRotation: string | null
  rotationHistory: RotationRecord[]
}

export interface RotationRecord {
  timestamp: string
  action: 'activate' | 'deactivate' | 'rollback'
  packIds: string[]
  previousPackIds: string[]
  note?: string
  consumed?: boolean
}

const ROTATION_STORAGE_KEY = 'advantage-games-pack-rotation'

export interface RotationManager {
  getState(): PackRotationState
  setActivePacks(packIds: string[], note?: string): void
  addActivePack(packId: string): void
  removeActivePack(packId: string): void
  rollback(note?: string): boolean
  saveStablePacks(): void
  getActivePackIds(): string[]
  clearHistory(): void
}

function createDefaultState(): PackRotationState {
  return {
    activePacks: [],
    stablePacks: [],
    lastRotation: null,
    rotationHistory: [],
  }
}

function loadState(): PackRotationState {
  if (typeof window === 'undefined') {
    return createDefaultState()
  }
  try {
    const stored = localStorage.getItem(ROTATION_STORAGE_KEY)
    if (!stored) {
      return createDefaultState()
    }
    const parsed = JSON.parse(stored)
    if (typeof parsed !== 'object' || parsed === null) {
      return createDefaultState()
    }
    return {
      activePacks: Array.isArray(parsed.activePacks) ? parsed.activePacks : [],
      stablePacks: Array.isArray(parsed.stablePacks) ? parsed.stablePacks : [],
      lastRotation: parsed.lastRotation ?? null,
      rotationHistory: Array.isArray(parsed.rotationHistory) ? parsed.rotationHistory : [],
    }
  } catch {
    return createDefaultState()
  }
}

function saveState(state: PackRotationState): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    localStorage.setItem(ROTATION_STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('Failed to save rotation state:', error)
  }
}

export function createRotationManager(): RotationManager {
  let state = loadState()

  function persist(): void {
    saveState(state)
  }

  return {
    getState(): PackRotationState {
      return { ...state }
    },

    setActivePacks(packIds: string[], note?: string): void {
      const previousPackIds = [...state.activePacks]
      const record: RotationRecord = {
        timestamp: new Date().toISOString(),
        action: 'activate',
        packIds: [...packIds],
        previousPackIds,
        note,
      }
      state = {
        ...state,
        activePacks: [...packIds],
        lastRotation: record.timestamp,
        rotationHistory: [...state.rotationHistory, record].slice(-50),
      }
      persist()
    },

    addActivePack(packId: string): void {
      if (state.activePacks.includes(packId)) {
        return
      }
      const previousPackIds = [...state.activePacks]
      const record: RotationRecord = {
        timestamp: new Date().toISOString(),
        action: 'activate',
        packIds: [...state.activePacks, packId],
        previousPackIds,
        note: `Added pack: ${packId}`,
      }
      state = {
        ...state,
        activePacks: [...state.activePacks, packId],
        lastRotation: record.timestamp,
        rotationHistory: [...state.rotationHistory, record].slice(-50),
      }
      persist()
    },

    removeActivePack(packId: string): void {
      if (!state.activePacks.includes(packId)) {
        return
      }
      const previousPackIds = [...state.activePacks]
      const record: RotationRecord = {
        timestamp: new Date().toISOString(),
        action: 'deactivate',
        packIds: state.activePacks.filter((id) => id !== packId),
        previousPackIds,
        note: `Removed pack: ${packId}`,
      }
      state = {
        ...state,
        activePacks: state.activePacks.filter((id) => id !== packId),
        lastRotation: record.timestamp,
        rotationHistory: [...state.rotationHistory, record].slice(-50),
      }
      persist()
    },

    rollback(note?: string): boolean {
      if (state.rotationHistory.length === 0) {
        return false
      }
      const activationRecords = state.rotationHistory.filter(
        (r) => r.action !== 'rollback' && !r.consumed
      )
      if (activationRecords.length === 0) {
        return false
      }
      const lastRecord = activationRecords[activationRecords.length - 1]
      const record: RotationRecord = {
        timestamp: new Date().toISOString(),
        action: 'rollback',
        packIds: lastRecord.previousPackIds,
        previousPackIds: lastRecord.packIds,
        note: note || `Rolled back from: ${lastRecord.timestamp}`,
      }
      const updatedHistory = state.rotationHistory.map((r) =>
        r === lastRecord ? { ...r, consumed: true } : r
      )
      state = {
        ...state,
        activePacks: lastRecord.previousPackIds,
        lastRotation: record.timestamp,
        rotationHistory: [...updatedHistory, record].slice(-50),
      }
      persist()
      return true
    },

    saveStablePacks(): void {
      const record: RotationRecord = {
        timestamp: new Date().toISOString(),
        action: 'activate',
        packIds: [...state.activePacks],
        previousPackIds: [],
        note: 'Saved current active packs as stable',
      }
      state = {
        ...state,
        stablePacks: [...state.activePacks],
        rotationHistory: [...state.rotationHistory, record].slice(-50),
      }
      persist()
    },

    getActivePackIds(): string[] {
      return [...state.activePacks]
    },

    clearHistory(): void {
      state = {
        ...state,
        rotationHistory: [],
      }
      persist()
    },
  }
}

export function validatePackAvailability(
  packIds: string[],
  availablePacks: ContentPackMetadata[]
): { valid: string[]; invalid: string[] } {
  const validPackIds = new Set(availablePacks.map((p) => p.packId))
  const valid: string[] = []
  const invalid: string[] = []
  for (const id of packIds) {
    if (validPackIds.has(id)) {
      valid.push(id)
    } else {
      invalid.push(id)
    }
  }
  return { valid, invalid }
}

export function mergePacksFromIds(
  packIds: string[],
  availablePacks: ContentPackMetadata[]
): ContentPackMetadata[] {
  const packMap = new Map(availablePacks.map((p) => [p.packId, p]))
  const result: ContentPackMetadata[] = []
  for (const id of packIds) {
    const pack = packMap.get(id)
    if (pack) {
      result.push(pack)
    }
  }
  return result
}