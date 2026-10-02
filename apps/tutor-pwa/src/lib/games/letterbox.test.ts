import { describe, expect, it } from 'vitest'
import { computeLetterbox, toBoardPoint } from './letterbox'

const board = { width: 390, height: 700 }

describe('computeLetterbox', () => {
  it.each([
    [390, 844],
    [360, 640],
    [768, 768],
    [1366, 768],
    [820, 1180],
  ])('fits and centres a 390x700 board in %ix%i', (width, height) => {
    const box = computeLetterbox({ width, height }, board)
    const w = board.width * box.scale
    const h = board.height * box.scale
    expect(w).toBeLessThanOrEqual(width + 1e-9)
    expect(h).toBeLessThanOrEqual(height + 1e-9)
    // One axis is filled exactly; the other is centred.
    expect(Math.min(width - w, height - h)).toBeCloseTo(0)
    expect(box.x).toBeCloseTo((width - w) / 2)
    expect(box.y).toBeCloseTo((height - h) / 2)
  })

  it('keeps the phone design at its natural size on a 390-wide phone', () => {
    expect(computeLetterbox({ width: 390, height: 844 }, board)).toEqual({ scale: 1, x: 0, y: 72 })
  })

  it('falls back to identity before the container is measured', () => {
    expect(computeLetterbox({ width: 0, height: 0 }, board)).toEqual({ scale: 1, x: 0, y: 0 })
  })

  it('maps container points back to board coordinates', () => {
    const box = computeLetterbox({ width: 1366, height: 768 }, board)
    const centre = toBoardPoint(box, { x: 1366 / 2, y: 768 / 2 })
    expect(centre.x).toBeCloseTo(195)
    expect(centre.y).toBeCloseTo(350)
  })
})
