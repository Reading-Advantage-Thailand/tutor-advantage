export type SpriteState = 'idle' | 'walk' | 'attack' | 'hit' | 'death'

export interface StateConfig {
  row: number
  frames: number
  loop: boolean
  startCol?: number
}

export interface SpriteSheetConfig {
  states: Partial<Record<SpriteState, StateConfig>>
  frameDuration: number
}

export interface SpriteFrame {
  row: number
  col: number
}

export function getSpriteFrame(
  state: SpriteState,
  gameTime: number,
  stateStartTime: number,
  config: SpriteSheetConfig
): SpriteFrame {
  const stateConfig = config.states[state]
  if (!stateConfig) {
    return { row: 0, col: 0 }
  }

  const elapsed = Math.max(0, gameTime - stateStartTime)
  const totalFrames = stateConfig.frames
  const startCol = stateConfig.startCol || 0
  
  let frameIndex = Math.floor(elapsed / config.frameDuration)

  if (stateConfig.loop) {
    frameIndex = frameIndex % totalFrames
  } else {
    frameIndex = Math.min(frameIndex, totalFrames - 1)
  }

  return {
    row: stateConfig.row,
    col: startCol + frameIndex
  }
}
