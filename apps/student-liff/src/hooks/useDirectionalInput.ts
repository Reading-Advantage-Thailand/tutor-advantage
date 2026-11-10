import { useEffect, useState, useCallback } from 'react'

export type InputVector = {
  dx: number
  dy: number
  cast?: boolean
}

export function useDirectionalInput() {
  const [keys, setKeys] = useState<Set<string>>(new Set())
  const [virtualInput, setVirtualInput] = useState<InputVector>({ dx: 0, dy: 0, cast: false })
  const [castTriggered, setCastTriggered] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const movementKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'])
    const castKeys = new Set(['Space', 'Enter'])
    const shouldTrap = movementKeys.has(e.code) || castKeys.has(e.code)

    if (shouldTrap) {
      e.preventDefault()
    }

    if (e.repeat) {
      return
    }

    setKeys((prev) => {
      if (prev.has(e.code)) {
        return prev
      }
      const next = new Set(prev)
      next.add(e.code)
      return next
    })
    if (castKeys.has(e.code)) {
      setCastTriggered(true)
    }
  }, [])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const movementKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'])
    const castKeys = new Set(['Space', 'Enter'])
    if (movementKeys.has(e.code) || castKeys.has(e.code)) {
      e.preventDefault()
    }
    setKeys((prev) => {
      const next = new Set(prev)
      next.delete(e.code)
      return next
    })
  }, [])

  useEffect(() => {
    // A key released while the page is away never reports keyup, and the walk would not stop.
    const releaseKeys = () => setKeys((prev) => (prev.size ? new Set() : prev))
    const releaseIfHidden = () => {
      if (document.visibilityState === 'hidden') releaseKeys()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', releaseKeys)
    document.addEventListener('visibilitychange', releaseIfHidden)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', releaseKeys)
      document.removeEventListener('visibilitychange', releaseIfHidden)
    }
  }, [handleKeyDown, handleKeyUp])

  // Reset castTriggered after it's been processed?
  // In a React state-based loop, it's tricky.
  // Better: return it and reset it in an effect or callback.
  const consumeCast = useCallback(() => {
      setCastTriggered(false)
  }, [])

  // Calculate final input vector from keys + virtual
  let dx = 0
  let dy = 0

  if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 1
  if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 1
  if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1
  if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1

  // Combine with virtual input
  if (virtualInput.dx !== 0 || virtualInput.dy !== 0) {
      dx = virtualInput.dx
      dy = virtualInput.dy
  }
  
  const cast = castTriggered || virtualInput.cast

  return { 
      input: { dx, dy, cast },
      setVirtualInput,
      triggerCast: () => setCastTriggered(true),
      consumeCast
  }
}
