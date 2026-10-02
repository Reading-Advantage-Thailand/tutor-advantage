import { describe, expect, it } from 'vitest'
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  HIT_GRACE_MS,
  KNIGHT_RADIUS,
  MAX_LIVES,
  SPAWN_GRACE_MS,
  SPAWN_SAFE_RADIUS,
  createSlimeState,
  isSlimeInvulnerable,
  pickSafeSpawn,
  tickSlime,
} from './devourerSlime'

const sentences = [{ id: 's1', term: 'The dragon flew over the forest', translation: 'มังกรบินข้ามป่า' }]
const centre = { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 }
const constant = (value: number) => () => value
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

describe('Devourer Slime spawn rule', () => {
  it('never spawns a knight inside the safe radius around the slime', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const state = createSlimeState(sentences, { rng: seeded(seed), difficulty: 'hard' })
      for (const knight of state.enemies) {
        expect(Math.hypot(knight.pos.x - state.slime.pos.x, knight.pos.y - state.slime.pos.y)).toBeGreaterThanOrEqual(
          SPAWN_SAFE_RADIUS,
        )
        expect(knight.pos.x).toBeGreaterThanOrEqual(KNIGHT_RADIUS)
        expect(knight.pos.x).toBeLessThanOrEqual(ARENA_WIDTH - KNIGHT_RADIUS)
        expect(knight.pos.y).toBeGreaterThanOrEqual(KNIGHT_RADIUS)
        expect(knight.pos.y).toBeLessThanOrEqual(ARENA_HEIGHT - KNIGHT_RADIUS)
      }
    }
  })

  it('moves a point that lands on the slime out of the safe radius', () => {
    // rng 0.5 always picks the arena centre, i.e. right on top of the slime.
    const point = pickSafeSpawn(constant(0.5), centre, SPAWN_SAFE_RADIUS)
    expect(Math.hypot(point.x - centre.x, point.y - centre.y)).toBeGreaterThanOrEqual(SPAWN_SAFE_RADIUS)
  })

  it('gives a grace period at the start so an overlapping knight cannot hurt', () => {
    const state = createSlimeState(sentences, { rng: seeded(7) })
    expect(isSlimeInvulnerable(state)).toBe(true)
    // Force a knight onto the slime during the grace period.
    const crowded = { ...state, enemies: state.enemies.map((k) => ({ ...k, pos: { ...state.slime.pos }, vel: { x: 0, y: 0 } })) }
    const next = tickSlime(crowded, 16.6, seeded(1))
    expect(next.lives).toBe(MAX_LIVES)
    expect(SPAWN_GRACE_MS).toBeGreaterThan(0)
  })

  it('costs one life per touch, then a short grace period', () => {
    const state = createSlimeState(sentences, { rng: seeded(3) })
    const knight = { ...state.enemies[0], pos: { ...state.slime.pos }, vel: { x: 0, y: 0 } }
    let current = { ...state, gameTime: SPAWN_GRACE_MS + 1, enemies: [knight] }
    current = tickSlime(current, 16.6, seeded(1))
    expect(current.lives).toBe(MAX_LIVES - 1)
    // Still touching on the next frames: no further damage during the grace.
    for (let frame = 0; frame < 10; frame += 1) {
      current = tickSlime(
        { ...current, slime: { ...current.slime, pos: { ...knight.pos } }, enemies: [knight] },
        16.6,
        seeded(1),
      )
    }
    expect(current.lives).toBe(MAX_LIVES - 1)
    expect(current.invulnerableUntil).toBeGreaterThanOrEqual(SPAWN_GRACE_MS + HIT_GRACE_MS)
  })
})
