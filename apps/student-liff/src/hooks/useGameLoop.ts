import { useInterval } from './useInterval'

export function useGameLoop(
  onTick: (dt: number) => void,
  isRunning: boolean,
  tickMs: number = 50
) {
  useInterval(() => onTick(tickMs / 1000), isRunning ? tickMs : null)
}
