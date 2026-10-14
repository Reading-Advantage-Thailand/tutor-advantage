import { describe, expect, it } from 'vitest'
import { createStormCastleTowerState, getGridPosition, movePlayer, ROW_STEP } from './stormCastleTower'
import { STORM_CASTLE_TOWER_CONFIG } from './stormCastleTowerConfig'

const vocabulary = [{ id: 's1', term: 'The dragon flew over the forest', translation: 'มังกรบินข้ามป่า' }]

const screenOf = (state: ReturnType<typeof createStormCastleTowerState>) =>
  getGridPosition(state.player.position.col, state.player.position.row, state.scrollOffset)

describe('Storm Castle Tower controls match the screen', () => {
  const ready = (state: ReturnType<typeof createStormCastleTowerState>) => ({
    ...state,
    phase: 'playing' as const,
    gameTime: state.player.lastMoveTime + STORM_CASTLE_TOWER_CONFIG.player.moveSpeed + 1,
  })

  it('maps up to a smaller row and down to a larger row', () => {
    expect(ROW_STEP).toEqual({ up: -1, down: 1 })
  })

  it.each([
    ['up', 0, -1],
    ['down', 0, 1],
    ['left', -1, 0],
    ['right', 1, 0],
  ] as const)('%s moves the knight %s/%s on screen', (direction, sx, sy) => {
    let state = ready(createStormCastleTowerState(vocabulary, { rng: () => 0.5 }))
    // Start away from the edges so every direction can move.
    state = ready({ ...state, player: { ...state.player, position: { col: 1, row: 2 } } })
    const before = screenOf(state)
    const after = screenOf(movePlayer(state, direction))
    expect(Math.sign(after.x - before.x)).toBe(sx)
    expect(Math.sign(after.y - before.y)).toBe(sy)
  })

  it('does not move above the first row', () => {
    const state = ready(createStormCastleTowerState(vocabulary, { rng: () => 0.5 }))
    const top = ready({ ...state, player: { ...state.player, position: { col: 1, row: 0 } } })
    expect(movePlayer(top, 'up').player.position.row).toBe(0)
  })
})
