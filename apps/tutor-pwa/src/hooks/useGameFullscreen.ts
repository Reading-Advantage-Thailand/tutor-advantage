'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hook to manage fullscreen mode for game canvases.
 * Enters fullscreen when the game starts playing, exits on game end.
 * Gracefully handles browsers that don't support the Fullscreen API.
 */
export function useGameFullscreen() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const enterFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return

    const requestFs =
      el.requestFullscreen ??
      (el as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen

    if (requestFs) {
      requestFs.call(el).catch(() => {
        // Fullscreen denied or unsupported — continue without it
      })
    }
  }, [])

  const exitFullscreen = useCallback(() => {
    if (!document.fullscreenElement) return

    const exitFs =
      document.exitFullscreen ??
      (document as unknown as { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen

    if (exitFs) {
      exitFs.call(document).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleChange)
    document.addEventListener('webkitfullscreenchange', handleChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleChange)
      document.removeEventListener('webkitfullscreenchange', handleChange)
    }
  }, [])

  return { containerRef, isFullscreen, enterFullscreen, exitFullscreen }
}
