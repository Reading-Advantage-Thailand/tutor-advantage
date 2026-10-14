import { describe, expect, it } from 'vitest'
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  KNIGHT_SPEED_PX_PER_MS,
  MAX_TICK_MS,
  SLIME_SPEED_PX_PER_MS,
  SPAWN_GRACE_MS,
  createSlimeState,
  knightVelocity,
  moveSlime,
  tickSlime,
  type Difficulty,
} from './devourerSlime'

const sentences = [{ id: 's1', term: 'The dragon flew over the forest', translation: 'มังกรบินข้ามป่า' }]
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}
const speedOf = (v: { x: number; y: number }) => Math.hypot(v.x, v.y)

describe('Devourer Slime movement speed', () => {
  it('gives knights a fixed walking speed per difficulty, slower than the slime', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
      for (let seed = 1; seed < 50; seed += 1) {
        const state = createSlimeState(sentences, { rng: seeded(seed), difficulty })
        for (const knight of state.enemies) {
          expect(speedOf(knight.vel)).toBeCloseTo(KNIGHT_SPEED_PX_PER_MS[difficulty])
        }
      }
      expect(KNIGHT_SPEED_PX_PER_MS[difficulty]).toBeLessThan(SLIME_SPEED_PX_PER_MS)
    }
    // Harder means faster (and more knights), as before.
    expect(KNIGHT_SPEED_PX_PER_MS.easy).toBeLessThan(KNIGHT_SPEED_PX_PER_MS.medium)
    expect(KNIGHT_SPEED_PX_PER_MS.medium).toBeLessThan(KNIGHT_SPEED_PX_PER_MS.hard)
    // A knight needs several seconds to cross the arena.
    expect(ARENA_WIDTH / KNIGHT_SPEED_PX_PER_MS.hard / 1000).toBeGreaterThan(5)
  })

  it('moves knights by distance proportional to elapsed time (frame-rate independent)', () => {
    const base = createSlimeState(sentences, { rng: seeded(11) })
    const knight = { ...base.enemies[0], pos: { x: 200, y: 200 }, vel: knightVelocity(seeded(5), 'medium') }
    const state = { ...base, slime: { ...base.slime, pos: { x: 700, y: 700 } }, enemies: [knight] }
    const at60 = Array.from({ length: 60 }).reduce<typeof state>((s) => tickSlime(s, 1000 / 60, seeded(1)), state)
    const at30 = Array.from({ length: 30 }).reduce<typeof state>((s) => tickSlime(s, 1000 / 30, seeded(1)), state)
    expect(at60.enemies[0].pos.x).toBeCloseTo(at30.enemies[0].pos.x, 6)
    expect(at60.enemies[0].pos.y).toBeCloseTo(at30.enemies[0].pos.y, 6)
    expect(Math.hypot(at60.enemies[0].pos.x - 200, at60.enemies[0].pos.y - 200)).toBeCloseTo(KNIGHT_SPEED_PX_PER_MS.medium * 1000, 6)
  })

  it('moves the slime at its speed and clamps very long frames', () => {
    const state = { ...createSlimeState(sentences, { rng: seeded(2) }), gameTime: SPAWN_GRACE_MS }
    const start = state.slime.pos.x
    expect(moveSlime(state, 1, 0, 40).slime.pos.x - start).toBeCloseTo(SLIME_SPEED_PX_PER_MS * 40)
    expect(moveSlime(state, 1, 0, 5000).slime.pos.x - start).toBeCloseTo(SLIME_SPEED_PX_PER_MS * MAX_TICK_MS)
    expect(tickSlime(state, 5000, seeded(1)).gameTime - state.gameTime).toBe(MAX_TICK_MS)
    expect(ARENA_HEIGHT).toBeGreaterThan(0)
  })
})
