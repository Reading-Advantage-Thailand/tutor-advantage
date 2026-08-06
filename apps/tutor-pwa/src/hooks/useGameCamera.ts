import { useMemo, useCallback } from 'react'
import { useGameDimensions, type Dimensions } from './useGameDimensions'

export interface Camera {
  x: number
  y: number
  scale: number
}

export interface ScreenPosition {
  x: number
  y: number
}

export interface UseGameCameraOptions {
  minScale?: number
}

export interface UseGameCameraResult {
  dimensions: Dimensions
  camera: Camera
  getIndicatorPosition: (worldX: number, worldY: number) => ScreenPosition
}

export function useGameCamera(
  containerRef: React.RefObject<HTMLDivElement | null>,
  gameWidth: number,
  gameHeight: number,
  options: UseGameCameraOptions = {}
): UseGameCameraResult {
  const { minScale = 0.8 } = options

  const dimensions = useGameDimensions(containerRef)

  const camera = useMemo<Camera>(() => {
    if (dimensions.width === 0 || dimensions.height === 0) {
      return { x: 0, y: 0, scale: 1 }
    }

    const scaleY = dimensions.height / gameHeight
    const scale = Math.max(scaleY, minScale)

    const camX = dimensions.width / 2 - (gameWidth / 2) * scale
    const camY = dimensions.height / 2 - (gameHeight / 2) * scale

    return { x: camX, y: camY, scale }
  }, [dimensions, gameWidth, gameHeight, minScale])

  const getIndicatorPosition = useCallback(
    (worldX: number, worldY: number): ScreenPosition => {
      return {
        x: worldX * camera.scale + camera.x,
        y: worldY * camera.scale + camera.y,
      }
    },
    [camera]
  )

  return { dimensions, camera, getIndicatorPosition }
}