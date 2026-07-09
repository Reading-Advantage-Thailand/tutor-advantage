'use client'

import React, { useCallback, useRef, useState, memo } from 'react'

/**
 * Props for the canonical VirtualDPad component.
 *
 * The single source of truth for the directional-input DPad used by all
 * Advantage Games. The polished, memoized implementation that wins the
 * Phase 5 duplication consolidation (see `phase-5-decisions.md` Decision 5.3).
 */
export interface VirtualDPadProps {
  onInput: (input: { dx: number; dy: number }) => void
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
export const VirtualDPad = memo(function VirtualDPad({ onInput }: VirtualDPadProps) {
  const [active, setActive] = useState(false)
  const [thumbPos, setThumbPos] = useState({ x: 0, y: 0 })
  const centerRef = useRef<{ x: number; y: number } | null>(null)
  const inputCallbackRef = useRef(onInput)
  inputCallbackRef.current = onInput

  const handleEnd = useCallback(() => {
    setActive(false)
    centerRef.current = null
    setThumbPos({ x: 0, y: 0 })
    inputCallbackRef.current({ dx: 0, dy: 0 })
  }, [])

  const updateInput = useCallback((clientX: number, clientY: number) => {
    if (!centerRef.current) return
    const dxRaw = clientX - centerRef.current.x
    const dyRaw = clientY - centerRef.current.y

    const distance = Math.sqrt(dxRaw * dxRaw + dyRaw * dyRaw)
    const maxRadius = 40

    if (distance < 5) {
      setThumbPos({ x: 0, y: 0 })
      inputCallbackRef.current({ dx: 0, dy: 0 })
      return
    }

    const angle = Math.atan2(dyRaw, dxRaw)

    const displayRadius = Math.min(distance, maxRadius)
    setThumbPos({
      x: Math.cos(angle) * displayRadius,
      y: Math.sin(angle) * displayRadius,
    })

    let dx = Math.cos(angle)
    let dy = Math.sin(angle)

    if (Math.abs(dx) < 0.2) dx = 0
    if (Math.abs(dy) < 0.2) dy = 0
    if (dx > 0.8) dx = 1
    if (dx < -0.8) dx = -1
    if (dy > 0.8) dy = 1
    if (dy < -0.8) dy = -1

    inputCallbackRef.current({ dx, dy })
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
    startInput(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget as HTMLElement)
  }, [startInput])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    startInput(e.clientX, e.clientY, e.currentTarget as HTMLElement)
  }, [startInput])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!active) return
    updateInput(e.touches[0].clientX, e.touches[0].clientY)
  }, [active, updateInput])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!active) return
    updateInput(e.clientX, e.clientY)
  }, [active, updateInput])

  return (
    <div
      className="relative w-32 h-32 rounded-full bg-slate-900/70 border-2 border-white/30 ring-1 ring-white/20 touch-none select-none shadow-2xl backdrop-blur"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none" />

      <div
        className={`absolute top-1/2 left-1/2 w-12 h-12 -mt-6 -ml-6 rounded-full bg-white/30 border-2 border-white/50 shadow-xl pointer-events-none transition-transform duration-75 ${active ? 'scale-110 opacity-100' : 'scale-100 opacity-60'}`}
        style={{ transform: `translate(${thumbPos.x}px, ${thumbPos.y}px)` }}
      >
        <div className="absolute inset-0 m-2 rounded-full bg-white/20" />
      </div>

      <div className="absolute top-2 left-1/2 -ml-0.5 w-1 h-2 bg-white/20 rounded-full" />
      <div className="absolute bottom-2 left-1/2 -ml-0.5 w-1 h-2 bg-white/20 rounded-full" />
      <div className="absolute left-2 top-1/2 -mt-0.5 w-2 h-1 bg-white/20 rounded-full" />
      <div className="absolute right-2 top-1/2 -mt-0.5 w-2 h-1 bg-white/20 rounded-full" />
    </div>
  )
})