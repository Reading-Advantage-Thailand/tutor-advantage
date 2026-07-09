import React from 'react'

const GRID_SIZE = 3

export type SpritePose =
  | 'idle'
  | 'casting'
  | 'basic-attack'
  | 'power-attack'
  | 'hurt'
  | 'miss'
  | 'defend'
  | 'victory'
  | 'defeat'

const poseMap: Record<SpritePose, { row: number; col: number }> = {
  idle: { row: 1, col: 1 },
  casting: { row: 1, col: 2 },
  'basic-attack': { row: 1, col: 3 },
  'power-attack': { row: 2, col: 1 },
  hurt: { row: 2, col: 2 },
  miss: { row: 2, col: 3 },
  defend: { row: 3, col: 1 },
  victory: { row: 3, col: 2 },
  defeat: { row: 3, col: 3 },
}

interface SpriteProps {
  src: string
  pose: SpritePose
  alt: string
  size?: number
  flip?: boolean
  className?: string
}

export function Sprite({ src, pose, alt, size = 128, flip = false, className }: SpriteProps) {
  const { row, col } = poseMap[pose]
  const maxIndex = GRID_SIZE - 1
  const x = (col - 1) / maxIndex * 100
  const y = (row - 1) / maxIndex * 100

  return (
    <div
      role="img"
      aria-label={alt}
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundImage: `url(${src})`,
        backgroundSize: `${GRID_SIZE * 100}% ${GRID_SIZE * 100}%`,
        backgroundPosition: `${x}% ${y}%`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        transform: flip ? 'scaleX(-1)' : undefined,
        transformOrigin: 'center',
      }}
    />
  )
}
