import type { Orb } from '@/lib/games/wizardZombie'

export type Indicator = {
  orb: Orb
  x: number
  y: number
  rotation: number // in degrees
}

export function calculateIndicators(
  orbs: Orb[],
  camera: { x: number; y: number; scale: number },
  viewport: { width: number; height: number }
): Indicator[] {
  const indicators: Indicator[] = []
  const margin = 40 // Padding from edge

  for (const orb of orbs) {
    // 1. Convert World Pos to Screen Pos
    const screenX = (orb.x * camera.scale) + camera.x
    const screenY = (orb.y * camera.scale) + camera.y

    // 2. Check if visible (simple AABB)
    const isVisible = 
        screenX >= 0 && 
        screenX <= viewport.width && 
        screenY >= 0 && 
        screenY <= viewport.height

    if (isVisible) continue

    // 3. Calculate position on edge
    const centerX = viewport.width / 2
    const centerY = viewport.height / 2
    
    const dx = screenX - centerX
    const dy = screenY - centerY
    
    // Angle in radians
    const angle = Math.atan2(dy, dx)
    
    // Find intersection with screen bounds
    // Screen bounds relative to center:
    const halfW = (viewport.width / 2) - margin
    const halfH = (viewport.height / 2) - margin

    // We want to find t such that point = center + t * dir is on the box
    // x = t * cos(angle), y = t * sin(angle)
    // We want |x| = halfW OR |y| = halfH
    
    // tX = halfW / |cos(angle)|
    // tY = halfH / |sin(angle)|
    
    // t = min(tX, tY)
    
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    
    const tX = halfW / Math.abs(cos)
    const tY = halfH / Math.abs(sin)
    
    const t = Math.min(tX, tY)
    
    const indicatorX = centerX + t * cos
    const indicatorY = centerY + t * sin
    
    indicators.push({
        orb,
        x: indicatorX,
        y: indicatorY,
        rotation: (angle * 180 / Math.PI)
    })
  }

  return indicators
}
