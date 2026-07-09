import React from 'react'
import { Group, Circle, Star, Path } from 'react-konva'
import { usePotionRushStore, PotionRushEffect, PotionRushEffectType } from '@/store/usePotionRushStore'

type EffectConfig = {
  count: number
  colors: string[]
  angleRange: [number, number]
  speedRange: [number, number]
  sizeRange: [number, number]
  gravity: number
}

const EFFECT_CONFIG: Record<PotionRushEffectType, EffectConfig> = {
  SPLASH: {
    count: 10,
    colors: ['#60a5fa', '#93c5fd'],
    angleRange: [-Math.PI, 0],
    speedRange: [90, 160],
    sizeRange: [4, 7],
    gravity: 140,
  },
  SMOKE: {
    count: 12,
    colors: ['#64748b', '#94a3b8'],
    angleRange: [-Math.PI * 0.9, -Math.PI * 0.1],
    speedRange: [25, 55],
    sizeRange: [6, 12],
    gravity: -30,
  },
  SUCCESS: {
    count: 10,
    colors: ['#facc15', '#fb7185'],
    angleRange: [-Math.PI, Math.PI],
    speedRange: [35, 85],
    sizeRange: [6, 10],
    gravity: -40,
  },
}

const HEART_PATH =
  'M12 21s-6-4.35-9-7.5C-1 10 1.5 5 6 5c2.5 0 4 1.5 6 3.5C14 6.5 15.5 5 18 5c4.5 0 7 5 3 8.5-3 3.15-9 7.5-9 7.5z'

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

const seededRandom = (seed: number, offset: number) => {
  const value = Math.sin(seed * 1000 + offset * 78.233) * 10000
  return value - Math.floor(value)
}

const getParticleSpec = (effect: PotionRushEffect, index: number) => {
  const config = EFFECT_CONFIG[effect.type]
  const angle = lerp(
    config.angleRange[0],
    config.angleRange[1],
    seededRandom(effect.seed, index + 1)
  )
  const speed = lerp(
    config.speedRange[0],
    config.speedRange[1],
    seededRandom(effect.seed, index + 7)
  )
  const size = lerp(
    config.sizeRange[0],
    config.sizeRange[1],
    seededRandom(effect.seed, index + 13)
  )
  const color = config.colors[index % config.colors.length]
  const rotation = seededRandom(effect.seed, index + 21) * 360

  return { angle, speed, size, color, rotation }
}

const renderParticle = (effect: PotionRushEffect, index: number) => {
  const config = EFFECT_CONFIG[effect.type]
  const t = clamp(effect.age / effect.duration, 0, 1)
  const { angle, speed, size, color, rotation } = getParticleSpec(effect, index)

  const travel = speed * t
  const x = effect.x + Math.cos(angle) * travel
  const y = effect.y + Math.sin(angle) * travel + config.gravity * t * t
  const opacity = 1 - t

  if (effect.type === 'SUCCESS') {
    if (index % 2 === 0) {
      return (
        <Star
          key={`${effect.id}-${index}`}
          x={x}
          y={y}
          numPoints={5}
          innerRadius={size * 0.45}
          outerRadius={size}
          fill={color}
          opacity={opacity}
          rotation={rotation + t * 120}
          listening={false}
        />
      )
    }

    const heartScale = size / 24
    return (
      <Path
        key={`${effect.id}-${index}`}
        x={x}
        y={y}
        data={HEART_PATH}
        fill={color}
        opacity={opacity}
        offsetX={12}
        offsetY={12}
        scaleX={heartScale}
        scaleY={heartScale}
        rotation={rotation - t * 80}
        listening={false}
      />
    )
  }

  const sizeMultiplier = effect.type === 'SMOKE' ? 1 + t * 0.7 : 1 - t * 0.2

  return (
    <Circle
      key={`${effect.id}-${index}`}
      x={x}
      y={y}
      radius={size * sizeMultiplier}
      fill={color}
      opacity={opacity}
      listening={false}
    />
  )
}

export default function PotionRushEffectsLayer() {
  const effects = usePotionRushStore(state => state.effects)

  return (
    <Group>
      {effects.map(effect => (
        <Group key={effect.id}>
          {Array.from({ length: EFFECT_CONFIG[effect.type].count }).map((_, index) =>
            renderParticle(effect, index)
          )}
        </Group>
      ))}
    </Group>
  )
}
