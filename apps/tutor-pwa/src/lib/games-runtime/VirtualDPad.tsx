'use client'

import React, { useCallback, useEffect, useRef, useState, memo } from 'react'

import { stickVector } from '@/lib/games/moveVector'

/**
 * Props for the canonical VirtualDPad component.
 *
 * The single source of truth for the directional-input DPad used by all
 * Advantage Games. The polished, memoized implementation that wins the
 * Phase 5 duplication consolidation (see `phase-5-decisions.md` Decision 5.3).
 */
export interface VirtualDPadProps {
  onInput: (input: { dx: number; dy: number }) => void
  activeVector?: { dx: number; dy: number }
}

/**
 * Canonical VirtualDPad — memoized, polished styling with backdrop blur and
 * bright white/30 thumb. Exported from `@/lib/games-runtime` so all games
 * (and host shells) share one implementation.
 *
 * The duplicate files at `@/components/ui/VirtualDPad.tsx` and
 * `@/components/games/ui/VirtualDPad.tsx` are re-export shims so unmigrated
 * games that import from the legacy paths keep working.
 */
export const VirtualDPad = memo(function VirtualDPad({ onInput, activeVector }: VirtualDPadProps) {
  const [active, setActive] = useState(false)
  const [thumbPos, setThumbPos] = useState({ x: 0, y: 0 })
  const centerRef = useRef<{ x: number; y: number } | null>(null)
  // The finger that started on the stick. Other fingers on the screen, even one
  // that lands on the stick later, never steer it.
  const touchIdRef = useRef<number | null>(null)
  const lastTouchAtRef = useRef(0)
  const inputCallbackRef = useRef(onInput)
  inputCallbackRef.current = onInput

  const handleEnd = useCallback(() => {
    setActive(false)
    centerRef.current = null
    touchIdRef.current = null
    setThumbPos({ x: 0, y: 0 })
    inputCallbackRef.current({ dx: 0, dy: 0 })
  }, [])

  // A phone can suspend the page before it reports the touch ending. Window blur
  // is left out on purpose: it can fire with the finger still down and would
  // freeze the stick until the next press.
  useEffect(() => {
    const stopIfHidden = () => {
      if (document.visibilityState === 'hidden' && centerRef.current) handleEnd()
    }
    const stop = () => {
      if (centerRef.current) handleEnd()
    }
    document.addEventListener('visibilitychange', stopIfHidden)
    window.addEventListener('pagehide', stop)
    return () => {
      document.removeEventListener('visibilitychange', stopIfHidden)
      window.removeEventListener('pagehide', stop)
      // Never leave the game walking after the stick is gone.
      if (centerRef.current) inputCallbackRef.current({ dx: 0, dy: 0 })
    }
  }, [handleEnd])

  const updateInput = useCallback((clientX: number, clientY: number) => {
    if (!centerRef.current) return
    const dxRaw = clientX - centerRef.current.x
    const dyRaw = clientY - centerRef.current.y

    const distance = Math.sqrt(dxRaw * dxRaw + dyRaw * dyRaw)
    const maxRadius = 40

    const vector = stickVector(dxRaw, dyRaw)
    if (vector.dx === 0 && vector.dy === 0) {
      setThumbPos({ x: 0, y: 0 })
      inputCallbackRef.current(vector)
      return
    }

    const angle = Math.atan2(dyRaw, dxRaw)

    const displayRadius = Math.min(distance, maxRadius)
    setThumbPos({
      x: Math.cos(angle) * displayRadius,
      y: Math.sin(angle) * displayRadius,
    })

    inputCallbackRef.current(vector)
  }, [])

  const startInput = useCallback((clientX: number, clientY: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect()
    centerRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
    setActive(true)
    updateInput(clientX, clientY)
  }, [updateInput])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    lastTouchAtRef.current = Date.now()
    if (touchIdRef.current !== null) return
    const touch = e.changedTouches[0]
    touchIdRef.current = touch.identifier
    startInput(touch.clientX, touch.clientY, e.currentTarget as HTMLElement)
  }, [startInput])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // A phone follows every tap with a fake mouse press: ignore those.
    if (Date.now() - lastTouchAtRef.current < 800) return
    startInput(e.clientX, e.clientY, e.currentTarget as HTMLElement)
  }, [startInput])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    lastTouchAtRef.current = Date.now()
    if (touchIdRef.current === null) return
    const touch = Array.from(e.touches).find((t) => t.identifier === touchIdRef.current)
    if (touch) updateInput(touch.clientX, touch.clientY)
    else handleEnd()
  }, [handleEnd, updateInput])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    lastTouchAtRef.current = Date.now()
    const ended = Array.from(e.changedTouches).some((t) => t.identifier === touchIdRef.current)
    if (ended) handleEnd()
  }, [handleEnd])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!active) return
    updateInput(e.clientX, e.clientY)
  }, [active, updateInput])

  const handleMouseEnd = useCallback(() => {
    if (touchIdRef.current === null) handleEnd()
  }, [handleEnd])

  const effectiveVector = activeVector && (activeVector.dx !== 0 || activeVector.dy !== 0);
  const displayThumbPos = active ? thumbPos : (effectiveVector ? { x: activeVector.dx * 28, y: activeVector.dy * 28 } : thumbPos);
  const isGlowing = active || effectiveVector;

  return (
    <div
      className={`relative w-32 h-32 rounded-full border-2 touch-none select-none shadow-2xl backdrop-blur transition-all ${
        isGlowing ? "bg-slate-900/90 border-cyan-400 ring-4 ring-cyan-400/50" : "bg-slate-900/70 border-white/30 ring-1 ring-white/20"
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseEnd}
      onMouseLeave={handleMouseEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none" />

      <div
        className={`absolute top-1/2 left-1/2 w-12 h-12 -mt-6 -ml-6 rounded-full border-2 shadow-xl pointer-events-none transition-transform duration-75 ${
          isGlowing ? 'scale-110 opacity-100 bg-cyan-400 border-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.9)]' : 'scale-100 opacity-60 bg-white/30 border-white/50'
        }`}
        style={{ transform: `translate(${displayThumbPos.x}px, ${displayThumbPos.y}px)` }}
      >
        <div className="absolute inset-0 m-2 rounded-full bg-white/30" />
      </div>

      <div className={`absolute top-2 left-1/2 -ml-0.5 w-1 h-2 rounded-full ${effectiveVector && activeVector.dy === -1 ? "bg-cyan-300 shadow-[0_0_8px_#22d3ee]" : "bg-white/20"}`} />
      <div className={`absolute bottom-2 left-1/2 -ml-0.5 w-1 h-2 rounded-full ${effectiveVector && activeVector.dy === 1 ? "bg-cyan-300 shadow-[0_0_8px_#22d3ee]" : "bg-white/20"}`} />
      <div className={`absolute left-2 top-1/2 -mt-0.5 w-2 h-1 rounded-full ${effectiveVector && activeVector.dx === -1 ? "bg-cyan-300 shadow-[0_0_8px_#22d3ee]" : "bg-white/20"}`} />
      <div className={`absolute right-2 top-1/2 -mt-0.5 w-2 h-1 rounded-full ${effectiveVector && activeVector.dx === 1 ? "bg-cyan-300 shadow-[0_0_8px_#22d3ee]" : "bg-white/20"}`} />
    </div>
  )
})