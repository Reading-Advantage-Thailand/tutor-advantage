import React from 'react'
import Image from 'next/image'

export function EnemySprite() {
  return (
    <div className="flex items-end justify-end">
      <Image
        src="/games/rpg-battle/enemy_slime_pose_sheet_3x3.png"
        alt="Enemy sprite sheet"
        width={160}
        height={160}
        className="h-40 w-40 rounded-lg border bg-muted/40 object-contain"
        unoptimized
      />
    </div>
  )
}
