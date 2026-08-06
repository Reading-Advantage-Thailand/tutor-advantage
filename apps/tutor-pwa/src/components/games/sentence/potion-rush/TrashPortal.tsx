import React, { useState } from 'react'
import { Group, Circle, Text } from 'react-konva'
import { useInterval } from '@/hooks/useInterval'
import { getPortalFrame } from '@/lib/games/potionRushEffects'

export default function TrashPortal({ x, y }: { x: number, y: number }) {
  const [timeMs, setTimeMs] = useState(0)

  useInterval(() => {
    setTimeMs((prev) => prev + 50)
  }, 50)

  const frame = getPortalFrame(timeMs)

  return (
    <Group x={x} y={y}>
        <Circle radius={48 * frame.pulse} fill="#a855f7" opacity={0.2 + 0.2 * frame.shimmer} />

        <Group rotation={frame.rotation}>
          <Circle
            radius={44 * frame.pulse}
            stroke="#d8b4fe"
            strokeWidth={4}
            dash={[10, 6]}
            opacity={0.8}
          />
          <Circle
            radius={32 * frame.pulse}
            stroke="#7e22ce"
            strokeWidth={3}
            dash={[6, 8]}
            opacity={0.7}
          />
        </Group>

        <Circle radius={22 * frame.pulse} fill="#6b21a8" opacity={0.9} />
        <Circle radius={14 * frame.pulse} fill="#581c87" opacity={0.9} />

        <Text text="TRASH" fontSize={12} fill="white" fontStyle="bold" x={-20} y={-5} />
    </Group>
  )
}
