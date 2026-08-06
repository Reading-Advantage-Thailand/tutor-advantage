'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface MagicBoltProps {
  startX: number
  startY: number
  targetX: number
  targetY: number
  onComplete: () => void
}

export function MagicBolt({ startX, startY, targetX, targetY, onComplete }: MagicBoltProps) {
  return (
    <motion.div
      initial={{ left: `${startX}%`, top: `${startY}%`, opacity: 1 }}
      animate={{ left: `${targetX}%`, top: `${targetY}%` }}
      transition={{ duration: 0.3, ease: 'easeIn' }}
      onAnimationComplete={onComplete}
      className="absolute w-4 h-4 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)] z-50 pointer-events-none"
    />
  )
}
