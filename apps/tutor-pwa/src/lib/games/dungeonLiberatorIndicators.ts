import type { Prisoner } from './dungeonLiberator'

export type Indicator = {
  prisoner: Prisoner
  x: number
  y: number
  rotation: number // degrees
}

export function calculateIndicators(
  prisoners: Prisoner[],
  camera: { x: number; y: number; scale: number },
  viewport: { width: number; height: number }
): Indicator[] {
  const indicators: Indicator[] = []
  const margin = 40

  for (const prisoner of prisoners) {
    if (prisoner.collected || prisoner.fleeing) continue

    // Convert world position to screen position
    const screenX = prisoner.x * camera.scale + camera.x
    const screenY = prisoner.y * camera.scale + camera.y

    // Check if visible
    const isVisible =
      screenX >= 0 &&
      screenX <= viewport.width &&
      screenY >= 0 &&
      screenY <= viewport.height

    if (isVisible) continue

    // Calculate position on screen edge
    const centerX = viewport.width / 2
    const centerY = viewport.height / 2

    const dx = screenX - centerX
    const dy = screenY - centerY

    const angle = Math.atan2(dy, dx)

    const halfW = viewport.width / 2 - margin
    const halfH = viewport.height / 2 - margin

    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    const tX = halfW / Math.abs(cos)
    const tY = halfH / Math.abs(sin)

    const t = Math.min(tX, tY)

    indicators.push({
      prisoner,
      x: centerX + t * cos,
      y: centerY + t * sin,
      rotation: angle * 180 / Math.PI,
    })
  }

  return indicators
}
