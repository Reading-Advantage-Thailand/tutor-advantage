import { useState, useEffect, useCallback } from 'react'

export interface Dimensions {
  width: number
  height: number
}

export function useGameDimensions(
  containerRef: React.RefObject<HTMLDivElement | null>
): Dimensions {
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: 0,
    height: 0,
  })

  const updateDimensions = useCallback(() => {
    if (!containerRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    if (width > 0 && height > 0) {
      setDimensions({ width, height })
    }
  }, [containerRef])

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          })
        }
      }
    })

    observer.observe(containerRef.current)

    const interval = setInterval(updateDimensions, 200)
    const timeout = setTimeout(() => clearInterval(interval), 2000)
    updateDimensions()

    return () => {
      observer.disconnect()
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [containerRef, updateDimensions])

  return dimensions
}