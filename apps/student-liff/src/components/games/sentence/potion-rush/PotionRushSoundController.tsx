'use client'

import { useEffect, useRef } from 'react'
import { usePotionRushStore } from '@/store/usePotionRushStore'
import { useSound } from '@/hooks/useSound'

export default function PotionRushSoundController() {
  const { playSound } = useSound()
  const lastScore = useRef(0)
  const lastReputation = useRef(100)
  const lastCauldronStates = useRef<string[]>([])
  const lastCauldronWordCounts = useRef<number[]>([0, 0, 0])

  useEffect(() => {
    const state = usePotionRushStore.getState()
    lastScore.current = state.score
    lastReputation.current = state.reputation
    lastCauldronStates.current = state.cauldrons.map(c => c.state)
    lastCauldronWordCounts.current = state.cauldrons.map(c => c.currentWords.length)

    const unsubscribe = usePotionRushStore.subscribe((state) => {
      if (state.score > lastScore.current) {
        playSound('cash-register')
      }
      lastScore.current = state.score

      if (state.reputation < lastReputation.current) {
        playSound('angry-grunt')
      }
      lastReputation.current = state.reputation

      state.cauldrons.forEach((cauldron, index) => {
        const prevState = lastCauldronStates.current[index]
        const prevCount = lastCauldronWordCounts.current[index]

        if (cauldron.state !== prevState) {
          if (cauldron.state === 'BREWING' && (prevState === 'IDLE')) {
            playSound('bubbling')
          } else if (cauldron.state === 'WARNING') {
            playSound('error')
          } else if (cauldron.state === 'COMPLETED') {
            playSound('success')
          }
        } else if (cauldron.state === 'BREWING' && cauldron.currentWords.length > prevCount) {
          playSound('bubbling')
        }
      })
      lastCauldronStates.current = state.cauldrons.map(c => c.state)
      lastCauldronWordCounts.current = state.cauldrons.map(c => c.currentWords.length)
    })

    return () => unsubscribe()
  }, [playSound])

  return null
}
