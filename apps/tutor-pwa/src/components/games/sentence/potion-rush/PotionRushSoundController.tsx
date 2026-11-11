'use client'

import { useEffect, useRef } from 'react'
import { usePotionRushStore } from '@/store/usePotionRushStore'
import { useSound } from '@/hooks/useSound'

export default function PotionRushSoundController() {
  const { playSound } = useSound()
  const lastServed = useRef(0)
  const lastAngry = useRef(0)
  const lastRejection = useRef<number | null>(null)
  const lastCauldronWordCounts = useRef<number[]>([0, 0, 0])

  useEffect(() => {
    const state = usePotionRushStore.getState()
    lastServed.current = state.completedSentences
    lastAngry.current = state.angryCustomers
    lastRejection.current = state.lastRejection?.seq ?? null
    lastCauldronWordCounts.current = state.cauldrons.map(c => c.currentWords.length)

    const unsubscribe = usePotionRushStore.subscribe((state) => {
      if (state.completedSentences > lastServed.current) {
        playSound('cash-register')
      }
      lastServed.current = state.completedSentences

      if (state.angryCustomers > lastAngry.current) {
        playSound('angry-grunt')
      }
      lastAngry.current = state.angryCustomers

      const rejection = state.lastRejection?.seq ?? null
      if (rejection !== null && rejection !== lastRejection.current) {
        playSound('error')
      }
      lastRejection.current = rejection

      state.cauldrons.forEach((cauldron, index) => {
        if (cauldron.state === 'BREWING' && cauldron.currentWords.length > lastCauldronWordCounts.current[index]) {
          playSound('bubbling')
        }
      })
      lastCauldronWordCounts.current = state.cauldrons.map(c => c.currentWords.length)
    })

    return () => unsubscribe()
  }, [playSound])

  return null
}
