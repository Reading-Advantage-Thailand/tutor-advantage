'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Text, Group, Rect, Circle } from 'react-konva'
import {
  createSpellweaversRunState,
  tickSpellweaversRun,
  collectOrb,
  calculateSpellweaversRunXP,
  type SpellweaversRunState,
  type Lane,
  type SentenceItem,
} from '@/lib/games/spellweaversRun'
import { GAME_WIDTH, GAME_HEIGHT, SPELLWEAVERS_RUN_CONFIG } from '@/lib/games/spellweaversRunConfig'
import { useGameFullscreen } from '@/hooks/useGameFullscreen'
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'
import { GameEndScreen } from '@/components/games/game/GameEndScreen'
import { GameStartScreen } from '@/components/games/game/GameStartScreen'
import { Wand2, BookOpen, AlertTriangle } from 'lucide-react'
import type { Difficulty } from '@/store/useGameStore'

export type SpellweaversRunGameResult = {
  xp: number
  accuracy: number
  difficulty: string
}

interface SpellweaversRunGameProps {
  vocabulary: SentenceItem[]
  onComplete: (results: SpellweaversRunGameResult) => void
}

export function SpellweaversRunGame({ vocabulary, onComplete }: SpellweaversRunGameProps) {
  const [gameState, setGameState] = useState<SpellweaversRunState | null>(null)
  const [gamePhase, setGamePhase] = useState<'start' | 'playing' | 'ended'>('start')
  const [results, setResults] = useState<SpellweaversRunGameResult | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('normal')
  const hasReportedRef = useRef(false)
  const lastFrameRef = useRef<number>(0)
  const rafRef = useRef<number>(0)

  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen()
  const { getEffectiveTextSize } = useAccessibilitySettings()
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const [totalCorrect, setTotalCorrect] = useState(0)
  const [totalAttempts, setTotalAttempts] = useState(0)

  const gameStateRef = useRef(gameState)
  const gamePhaseRef = useRef(gamePhase)
  const totalCorrectRef = useRef(totalCorrect)
  const totalAttemptsRef = useRef(totalAttempts)

  useEffect(() => { gameStateRef.current = gameState }, [gameState])
  useEffect(() => { gamePhaseRef.current = gamePhase }, [gamePhase])
  useEffect(() => { totalCorrectRef.current = totalCorrect }, [totalCorrect])
  useEffect(() => { totalAttemptsRef.current = totalAttempts }, [totalAttempts])

  const resetGame = useCallback(() => {
    if (vocabulary.length > 0) {
      setGameState(createSpellweaversRunState(vocabulary, { difficulty: selectedDifficulty }))
      setResults(null)
      setTotalCorrect(0)
      setTotalAttempts(0)
      hasReportedRef.current = false
    }
  }, [vocabulary, selectedDifficulty])

  useEffect(() => {
    if (vocabulary.length > 0 && gamePhase === 'start') {
      resetGame()
    }
  }, [vocabulary, gamePhase, resetGame])

  useEffect(() => {
    if (!containerRef.current) return

    const updateDimensions = () => {
      if (!containerRef.current) return
      const { width, height } = containerRef.current.getBoundingClientRect()
      if (width > 0 && height > 0) setDimensions({ width, height })
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height })
        }
      }
    })

    observer.observe(containerRef.current)
    const interval = setInterval(updateDimensions, 200)
    const timeout = setTimeout(() => clearInterval(interval), 2000)
    updateDimensions()

    return () => {
      observer.disconnect()
      clearInterval(interval)
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (gamePhase !== 'playing') {
      if (gamePhase === 'ended') {
        exitFullscreen()
      }
      return
    }

    enterFullscreen()
    lastFrameRef.current = 0

    const loop = (timestamp: number) => {
      const delta = lastFrameRef.current ? timestamp - lastFrameRef.current : 16
      lastFrameRef.current = timestamp
      const clampedDelta = Math.min(delta, 50)
      setGameState(prevState => {
        if (!prevState || prevState.status !== 'playing') return prevState
        return tickSpellweaversRun(prevState, vocabulary, clampedDelta)
      })
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      lastFrameRef.current = 0
    }
  }, [gamePhase, vocabulary, enterFullscreen, exitFullscreen])

  useEffect(() => {
    if (gameState?.status === 'victory' || gameState?.status === 'defeat') {
      if (gamePhaseRef.current !== 'ended') {
        const accuracy = totalAttemptsRef.current > 0 ? totalCorrectRef.current / totalAttemptsRef.current : 0
        const xp = gameStateRef.current ? calculateSpellweaversRunXP(gameStateRef.current, totalCorrectRef.current, totalAttemptsRef.current) : 0
        setResults({ xp, accuracy, difficulty: selectedDifficulty })
        setGamePhase('ended')
      }
    }
  }, [gameState?.status, selectedDifficulty])

  useEffect(() => {
    if (gamePhase === 'ended' && results && !hasReportedRef.current) {
      hasReportedRef.current = true
      onComplete(results)
    }
  }, [gamePhase, results, onComplete])

  const scale = useMemo(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return 1
    return Math.min(dimensions.width / GAME_WIDTH, dimensions.height / GAME_HEIGHT)
  }, [dimensions])

  const laneWidth = GAME_WIDTH / SPELLWEAVERS_RUN_CONFIG.laneCount

  const handleLaneTap = useCallback((lane: Lane) => {
    if (gamePhaseRef.current !== 'playing') return
    setGameState(prevState => {
      if (!prevState || prevState.status !== 'playing') return prevState
      const newState = collectOrb(prevState, lane)
      if (newState.correctAnswers > prevState.correctAnswers) {
        setTotalCorrect(c => c + 1)
      }
      if (newState.totalAttempts > prevState.totalAttempts) {
        setTotalAttempts(a => a + 1)
      }
      return newState
    })
  }, [])

  const handleStageClick = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current || !dimensions.width || !dimensions.height) return
    
    const rect = containerRef.current.getBoundingClientRect()
    let clientX: number
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX
    } else {
      clientX = e.clientX
    }
    
    const x = clientX - rect.left
    const gameX = x / scale
    const laneIndex = Math.floor(gameX / laneWidth)
    const lanes: Lane[] = ['left', 'center', 'right']
    const lane = lanes[Math.min(Math.max(laneIndex, 0), 2)]
    handleLaneTap(lane)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions, scale, laneWidth, handleLaneTap])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gamePhaseRef.current !== 'playing') return
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        handleLaneTap('left')
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        handleLaneTap('center')
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        handleLaneTap('right')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleLaneTap])

  const baseTextSize = 16
  const effectiveTextSize = useMemo(() => getEffectiveTextSize(baseTextSize), [getEffectiveTextSize])
  const smallTextSize = useMemo(() => Math.max(12, getEffectiveTextSize(14)), [getEffectiveTextSize])
  const tinyTextSize = useMemo(() => Math.max(10, getEffectiveTextSize(12)), [getEffectiveTextSize])

  if (gamePhase === 'start') {
    return (
      <div
        ref={containerRef}
        className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto"
      >
        <GameStartScreen
          gameTitle="Spellweaver's Run"
          gameSubtitle="Enchanted Forest Runner"
          vocabulary={vocabulary}
          instructions={[
            { step: 1, text: 'Collect word orbs in the correct order to form the sentence.', icon: BookOpen },
            { step: 2, text: 'The translation scrolls at the top - use it to find the next word!', icon: BookOpen },
            { step: 3, text: 'Wrong words drain your mana. Run out of mana and the spell fails!', icon: AlertTriangle },
          ]}
          proTip="Watch the translation carefully. Tap the lane when the correct orb enters the collection zone!"
          controls={[
            { label: 'Left Lane', keys: '← / A', color: 'bg-purple-500' },
            { label: 'Center Lane', keys: '↓ / S', color: 'bg-indigo-500' },
            { label: 'Right Lane', keys: '→ / D', color: 'bg-violet-500' },
          ]}
          startButtonText="Begin the Run"
          icon={Wand2}
          onStart={() => {
            resetGame()
            setGamePhase('playing')
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-white/50">Difficulty:</span>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value as Difficulty)}
              className="bg-slate-800 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="easy">Easy</option>
              <option value="normal">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </GameStartScreen>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{ minHeight: '400px' }}
      className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto"
      onClick={handleStageClick}
      onTouchStart={handleStageClick}
    >
      {gamePhase === 'playing' && gameState && (
        <>
          <Stage
            width={dimensions.width}
            height={dimensions.height}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          >
            <Layer>
              <Group scale={{ x: scale, y: scale }} offsetX={0} offsetY={0}>
                <Rect
                  x={0}
                  y={0}
                  width={GAME_WIDTH}
                  height={GAME_HEIGHT}
                  fill="linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 50%, #1a0a2e 100%)"
                />
                
                <Rect
                  x={0}
                  y={0}
                  width={GAME_WIDTH}
                  height={SPELLWEAVERS_RUN_CONFIG.scrollHeight}
                  fill="rgba(75, 0, 130, 0.8)"
                  cornerRadius={8}
                />
                
                <Text
                  x={10}
                  y={20}
                  text={gameState.currentSentence.translation}
                  fontSize={effectiveTextSize}
                  fill="white"
                  fontStyle="bold"
                  width={GAME_WIDTH - 20}
                  align="center"
                />

                <Text
                  x={10}
                  y={SPELLWEAVERS_RUN_CONFIG.scrollHeight + 10}
                  text={gameState.collectedWords.join(' ')}
                  fontSize={smallTextSize}
                  fill="#a5b4fc"
                  fontStyle="bold"
                  width={GAME_WIDTH - 20}
                  align="center"
                />

                {['left', 'center', 'right'].map((lane, index) => (
                  <Rect
                    key={lane}
                    x={index * laneWidth}
                    y={SPELLWEAVERS_RUN_CONFIG.scrollHeight + 40}
                    width={laneWidth}
                    height={GAME_HEIGHT - SPELLWEAVERS_RUN_CONFIG.scrollHeight - 40 - SPELLWEAVERS_RUN_CONFIG.collectionZoneHeight}
                    stroke="rgba(139, 92, 246, 0.2)"
                    strokeWidth={1}
                  />
                ))}

                {gameState.orbs.filter(orb => !orb.collected).map(orb => {
                  const laneIndex = orb.lane === 'left' ? 0 : orb.lane === 'center' ? 1 : 2
                  const orbX = laneIndex * laneWidth + laneWidth / 2
                  const isTarget = orb.word === gameState.words[gameState.targetIndex]
                  return (
                    <Group key={orb.id} x={orbX} y={orb.y}>
                      <Circle
                        x={0}
                        y={0}
                        radius={SPELLWEAVERS_RUN_CONFIG.orbRadius}
                        fill={isTarget ? 'rgba(167, 139, 250, 0.9)' : 'rgba(139, 92, 246, 0.7)'}
                        stroke={isTarget ? '#fbbf24' : '#a78bfa'}
                        strokeWidth={isTarget ? 3 : 2}
                      />
                      <Text
                        x={-SPELLWEAVERS_RUN_CONFIG.orbRadius}
                        y={-8}
                        text={orb.word}
                        fontSize={tinyTextSize}
                        fill="white"
                        fontStyle="bold"
                        width={SPELLWEAVERS_RUN_CONFIG.orbRadius * 2}
                        align="center"
                      />
                    </Group>
                  )
                })}

                <Rect
                  x={0}
                  y={GAME_HEIGHT - SPELLWEAVERS_RUN_CONFIG.collectionZoneHeight}
                  width={GAME_WIDTH}
                  height={SPELLWEAVERS_RUN_CONFIG.collectionZoneHeight}
                  fill="rgba(139, 92, 246, 0.3)"
                  stroke="rgba(167, 139, 250, 0.6)"
                  strokeWidth={2}
                />

                <Group x={10} y={GAME_HEIGHT - 25}>
                  <Rect
                    x={0}
                    y={0}
                    width={GAME_WIDTH - 20}
                    height={16}
                    fill="rgba(0, 0, 0, 0.5)"
                    cornerRadius={8}
                  />
                  <Rect
                    x={0}
                    y={0}
                    width={(gameState.mana / SPELLWEAVERS_RUN_CONFIG.initialMana) * (GAME_WIDTH - 20)}
                    height={16}
                    fill="rgba(139, 92, 246, 1)"
                    cornerRadius={8}
                  />
                  <Text
                    x={GAME_WIDTH / 2 - 20}
                    y={2}
                    text={`Mana: ${gameState.mana}`}
                    fontSize={tinyTextSize}
                    fill="white"
                    fontStyle="bold"
                  />
                </Group>

                <Text
                  x={GAME_WIDTH - 80}
                  y={SPELLWEAVERS_RUN_CONFIG.scrollHeight + 30}
                  text={`Score: ${gameState.score}`}
                  fontSize={smallTextSize}
                  fill="white"
                  fontStyle="bold"
                />

                <Text
                  x={GAME_WIDTH - 80}
                  y={SPELLWEAVERS_RUN_CONFIG.scrollHeight + 50}
                  text={`Combo: ${gameState.combo}`}
                  fontSize={tinyTextSize}
                  fill="#a5b4fc"
                />
              </Group>
            </Layer>
          </Stage>
        </>
      )}

      {gamePhase === 'ended' && gameState && results && (
        <GameEndScreen
          status={gameState.status === 'victory' ? 'victory' : 'defeat'}
          title={gameState.status === 'victory' ? 'Sentence Complete!' : 'Mana Depleted!'}
          subtitle={gameState.status === 'victory' ? 'You wove the spell perfectly!' : 'The magic faded away...'}
          score={totalCorrect * 10}
          xp={results.xp}
          accuracy={results.accuracy}
          customStats={[
            { label: 'Words Collected', value: totalCorrect, icon: BookOpen },
            { label: 'Sentences Complete', value: gameState.sentencesCompleted },
          ]}
          onRestart={() => {
            resetGame()
            setGamePhase('start')
          }}
          onExit={() => {
            window.location.href = '/student/games'
          }}
        />
      )}
    </div>
  )
}
