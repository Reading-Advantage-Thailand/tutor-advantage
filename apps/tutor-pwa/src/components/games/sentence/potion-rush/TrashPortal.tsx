import React, { useEffect, useRef } from 'react'
import type Konva from 'konva'
import { Group, Circle, Text } from 'react-konva'
import { getPortalFrame } from '@/lib/games/potionRushEffects'
import { tx } from '@/lib/games/gameText'

const REDRAW_MS = 100

export default function TrashPortal({ x, y }: { x: number, y: number }) {
  const glowRef = useRef<Konva.Circle | null>(null)
  const ringsRef = useRef<Konva.Group | null>(null)
  const pulseRef = useRef<Konva.Group | null>(null)

  // The swirl is drawn straight on its nodes, so it does not re-render the game.
  useEffect(() => {
    const startedAt = performance.now()
    const timer = setInterval(() => {
      const frame = getPortalFrame(performance.now() - startedAt)
      glowRef.current?.opacity(0.2 + 0.2 * frame.shimmer)
      ringsRef.current?.rotation(frame.rotation)
      pulseRef.current?.scale({ x: frame.pulse, y: frame.pulse })
    }, REDRAW_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <Group x={x} y={y} listening={false}>
        <Group ref={pulseRef}>
          <Circle ref={glowRef} radius={48} fill="#a855f7" opacity={0.3} />

          <Group ref={ringsRef}>
            <Circle
              radius={44}
              stroke="#d8b4fe"
              strokeWidth={4}
              dash={[10, 6]}
              opacity={0.8}
            />
            <Circle
              radius={32}
              stroke="#7e22ce"
              strokeWidth={3}
              dash={[6, 8]}
              opacity={0.7}
            />
          </Group>

          <Circle radius={22} fill="#6b21a8" opacity={0.9} />
          <Circle radius={14} fill="#581c87" opacity={0.9} />
        </Group>

        <Text text={tx("TRASH")} fontSize={12} fill="white" fontStyle="bold" x={-20} y={-5} />
    </Group>
  )
}
