import { describe, expect, it } from 'vitest'
import { ARENA_HEIGHT, ARENA_WIDTH, computeSlimeCamera } from './devourerSlime'

const center = { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 }

describe('computeSlimeCamera', () => {
  it('keeps the original 1:1 phone camera', () => {
    expect(computeSlimeCamera({ width: 390, height: 844 }, center)).toEqual({
      scale: 1,
      viewWidth: 390,
      viewHeight: 844,
      x: 205,
      y: 0,
    })
    expect(computeSlimeCamera({ width: 360, height: 640 }, { x: 0, y: 800 })).toMatchObject({ scale: 1, x: 0, y: 160 })
  })

  it.each([
    [768, 700],
    [1366, 768],
    [1002, 560],
    [820, 1180],
    [1440, 900],
  ])('covers a %ix%i frame with the arena (no empty bands)', (width, height) => {
    for (const focus of [center, { x: 0, y: 0 }, { x: ARENA_WIDTH, y: ARENA_HEIGHT }]) {
      const cam = computeSlimeCamera({ width, height }, focus)
      expect(cam.viewWidth * cam.scale).toBeCloseTo(width)
      expect(cam.viewHeight * cam.scale).toBeCloseTo(height)
      expect(cam.viewWidth).toBeLessThanOrEqual(ARENA_WIDTH + 1e-9)
      expect(cam.viewHeight).toBeLessThanOrEqual(ARENA_HEIGHT + 1e-9)
      expect(cam.x).toBeGreaterThanOrEqual(0)
      expect(cam.y).toBeGreaterThanOrEqual(0)
      expect(cam.x + cam.viewWidth).toBeLessThanOrEqual(ARENA_WIDTH + 1e-9)
      expect(cam.y + cam.viewHeight).toBeLessThanOrEqual(ARENA_HEIGHT + 1e-9)
    }
  })

  it('centres the slime when there is room to scroll', () => {
    const cam = computeSlimeCamera({ width: 1366, height: 768 }, center)
    expect(cam.x + cam.viewWidth / 2).toBeCloseTo(center.x)
    expect(cam.y + cam.viewHeight / 2).toBeCloseTo(center.y)
  })

  it('falls back to the phone frame before the container is measured', () => {
    expect(computeSlimeCamera({ width: 0, height: 0 }, center).viewWidth).toBe(390)
  })
})
