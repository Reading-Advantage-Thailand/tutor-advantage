'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { withBasePath } from '@/lib/games/basePath'

const ENEMY_SPRITE = withBasePath('/games/vocabulary/magic-defense/skeletons_3x3_pose_sheet.png')
const ENEMY_SHEET_SIZE = 426
const ENEMY_FRAME_SIZE = 142
const ENEMY_BASE_SCALE = 0.5
const ENEMY_START_SCALE = 0.2 * ENEMY_BASE_SCALE
const ENEMY_END_SCALE = 1.5 * ENEMY_BASE_SCALE
const ENEMY_DEATH_SCALE = 2 * ENEMY_BASE_SCALE
const WALK_ANIMATION_CLASS = 'enemy-walk'
const DEATH_ANIMATION_CLASS = 'enemy-die'
const DEATH_ANIMATION_DURATION = 1.0
const START_TOP = '30%'

interface EnemyProps {
  id: string
  x: number
  targetX: number
  term: string
  duration: number
  state: 'falling' | 'targeted' | 'dying'
  onReachBottom: (id: string) => void
  onDeathComplete: (id: string) => void
}

export function Enemy({ id, x, targetX, term, duration, state, onReachBottom, onDeathComplete }: EnemyProps) {
  const isDying = state === 'dying'
  const spriteClassName = isDying ? DEATH_ANIMATION_CLASS : WALK_ANIMATION_CLASS

  return (
    <motion.div
      initial={{ top: START_TOP, left: `${x}%`, opacity: 1 }}
      animate={isDying ? { 
        rotate: 180,
      } : { 
        top: '100%',
        left: `${targetX}%`,
      }}
      transition={isDying ? { duration: DEATH_ANIMATION_DURATION } : { duration, ease: 'linear' }}
      onAnimationComplete={() => {
        if (isDying) {
          onDeathComplete(id)
          return
        }
        if (state === 'falling') {
          onReachBottom(id)
        }
      }}
      className="absolute flex flex-col items-center group"
      style={{ position: 'absolute' }}
    >
      <div className="relative">
        <motion.div
          initial={{ scale: ENEMY_START_SCALE }}
          animate={{ scale: isDying ? ENEMY_DEATH_SCALE : ENEMY_END_SCALE }}
          transition={isDying ? { duration: DEATH_ANIMATION_DURATION } : { duration, ease: 'linear' }}
          className={`bg-no-repeat drop-shadow-md transition-transform duration-200 group-hover:scale-105 ${spriteClassName}`}
          style={{
            width: `${ENEMY_FRAME_SIZE}px`,
            height: `${ENEMY_FRAME_SIZE}px`,
            backgroundImage: `url(${ENEMY_SPRITE})`,
            backgroundSize: `${ENEMY_SHEET_SIZE}px ${ENEMY_SHEET_SIZE}px`,
            backgroundPosition: '0% 0%',
            animationDuration: isDying ? `${DEATH_ANIMATION_DURATION}s` : undefined,
          }}
          data-testid="enemy-sprite"
          aria-hidden="true"
        />
        {!isDying && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-background/90 px-2 py-1 rounded border shadow-sm whitespace-nowrap font-bold text-sm">
            {term}
          </div>
        )}
      </div>
    </motion.div>
  )
}
