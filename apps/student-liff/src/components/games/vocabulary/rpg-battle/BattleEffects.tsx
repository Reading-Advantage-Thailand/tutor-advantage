import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'

type FlashTone = 'player' | 'enemy'

interface BattleEffectsProps {
  children: React.ReactNode
  shakeKey?: number
  flashKey?: number
  flashTone?: FlashTone
}

export function BattleEffects({
  children,
  shakeKey = 0,
  flashKey = 0,
  flashTone = 'player',
}: BattleEffectsProps) {
  const flashColor = flashTone === 'player'
    ? 'rgba(16, 185, 129, 0.35)'
    : 'rgba(244, 63, 94, 0.35)'

  return (
    <motion.div
      data-testid="battle-effects"
      data-shake-key={shakeKey}
      className="relative"
      animate={shakeKey ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
    >
      <AnimatePresence>
        {flashKey ? (
          <motion.div
            key={flashKey}
            data-testid="battle-flash"
            className="pointer-events-none absolute inset-0 rounded-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              background: `radial-gradient(circle at center, ${flashColor}, transparent 70%)`,
            }}
          />
        ) : null}
      </AnimatePresence>
      {children}
    </motion.div>
  )
}
