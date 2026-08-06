import { useState, useMemo } from 'react'
import { getSpriteFrame, SpriteState, SpriteSheetConfig, SpriteFrame } from '@/lib/spriteAnimation'

export function useSpriteAnimation(
  state: SpriteState,
  gameTime: number,
  config: SpriteSheetConfig
): SpriteFrame {
  const [stateStartTime, setStateStartTime] = useState(gameTime)
  const [currentState, setCurrentState] = useState(state)

  if (state !== currentState) {
    setCurrentState(state)
    setStateStartTime(gameTime)
  }

  return useMemo(() => 
    getSpriteFrame(state, gameTime, stateStartTime, config),
    [state, gameTime, stateStartTime, config]
  )
}
