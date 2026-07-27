export type PortalFrame = {
  rotation: number
  pulse: number
  shimmer: number
}

const ROTATION_DEG_PER_SEC = 90
const PULSE_AMPLITUDE = 0.08
const SHIMMER_AMPLITUDE = 0.4

export function getPortalFrame(timeMs: number): PortalFrame {
  const t = timeMs / 1000
  const rotation = (t * ROTATION_DEG_PER_SEC) % 360
  const pulse = 1 + PULSE_AMPLITUDE * Math.sin(t * 2 * Math.PI)
  const shimmer = 0.6 + SHIMMER_AMPLITUDE * Math.sin(t * Math.PI)

  return { rotation, pulse, shimmer }
}
