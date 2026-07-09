'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Text, Group, Rect, Circle } from 'react-konva'
import {
  createRuneForgeChamberState,
  tickRuneForgeChamber,
  selectCircle,
  getCirclePosition,
  calculateXP,
  type RuneForgeChamberState,
} from '@/lib/games/runeForgeChamber'
import { GAME_WIDTH, GAME_HEIGHT, RUNE_FORGE_CHAMBER_CONFIG } from '@/lib/games/runeForgeChamberConfig'
import type { VocabularyItem } from '@/store/useGameStore'
import type { Difficulty } from '@/store/useGameStore'
import type { RuneType } from '@/lib/games/runeForgeChamberConfig'
import { useGameFullscreen } from '@/hooks/useGameFullscreen'
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'
import { GameEndScreen } from '@/components/games/game/GameEndScreen'
import { GameStartScreen } from '@/components/games/game/GameStartScreen'
import { Gem, BookOpen, AlertTriangle, Heart } from 'lucide-react'

export type RuneForgeChamberGameResult = {
  xp: number
  accuracy: number
}

interface RuneForgeChamberGameProps {
  vocabulary: VocabularyItem[]
  onComplete: (results: RuneForgeChamberGameResult) => void
}

export function RuneForgeChamberGame({ vocabulary, onComplete }: RuneForgeChamberGameProps) {
  const [gameState, setGameState] = useState<RuneForgeChamberState | null>(null)
  const [gamePhase, setGamePhase] = useState<'start' | 'playing' | 'ended'>('start')
  const [results, setResults] = useState<RuneForgeChamberGameResult | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('normal')
  const [selectedRuneType, setSelectedRuneType] = useState<RuneType>('common-stone')
  const hasReportedRef = useRef(false)
  const gameStateRef = useRef<RuneForgeChamberState | null>(null)
  const gamePhaseRef = useRef(gamePhase)
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)

  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen()
  const { getEffectiveTextSize, getEffectiveTouchTarget } = useAccessibilitySettings()

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // Keep refs in sync with state for the rAF loop
  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  useEffect(() => {
    gamePhaseRef.current = gamePhase
  }, [gamePhase])

  const resetGame = useCallback(() => {
    if (vocabulary.length > 0) {
      setGameState(createRuneForgeChamberState(vocabulary, {
        difficulty: selectedDifficulty,
        runeType: selectedRuneType,
      }))
      setResults(null)
      hasReportedRef.current = false
    }
  }, [vocabulary, selectedDifficulty, selectedRuneType])

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
  }, [containerRef])

  // requestAnimationFrame game loop with delta-time clamping
  useEffect(() => {
    if (gamePhase !== 'playing') {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      lastTimeRef.current = 0
      return
    }

    const gameLoop = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp
      }
      const deltaMs = Math.min(timestamp - lastTimeRef.current, 50)
      lastTimeRef.current = timestamp

      const currentState = gameStateRef.current
      const currentPhase = gamePhaseRef.current

      if (currentState && currentState.status === 'playing' && currentPhase === 'playing') {
        setGameState(prevState => {
          if (!prevState || prevState.status !== 'playing') return prevState
          return tickRuneForgeChamber(prevState, deltaMs)
        })
      }

      rafRef.current = requestAnimationFrame(gameLoop)
    }

    lastTimeRef.current = 0
    rafRef.current = requestAnimationFrame(gameLoop)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [gamePhase])

  useEffect(() => {
    const currentState = gameStateRef.current
    if (currentState?.status === 'defeat') {
      if (gamePhase !== 'ended') {
        const accuracy = currentState.correctAnswers + currentState.wrongAnswers > 0
          ? currentState.correctAnswers / (currentState.correctAnswers + currentState.wrongAnswers)
          : 0
        const xp = calculateXP(currentState)
        setResults({ xp, accuracy })
        setGamePhase('ended')
      }
    }
  }, [gameState?.status, gamePhase])

  useEffect(() => {
    if (gamePhase === 'playing') {
      enterFullscreen()
    } else {
      exitFullscreen()
    }
  }, [gamePhase, enterFullscreen, exitFullscreen])

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

  const handleCircleClick = useCallback((circleId: string) => {
    setGameState(prevState => {
      if (!prevState || prevState.status !== 'playing') return prevState
      return selectCircle(prevState, circleId)
    })
  }, [])

  if (gamePhase === 'start') {
    return (
      <div
        ref={containerRef}
        className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto"
      >
        <GameStartScreen
          gameTitle="Rune Forge Chamber"
          gameSubtitle="Forge the Ancient Runes"
          vocabulary={vocabulary}
          instructions={[
            { step: 1, text: 'Tap the word circles in the correct order to forge the rune.', icon: BookOpen },
            { step: 2, text: 'The translation is shown on the central rune stone - find the words!', icon: BookOpen },
            { step: 3, text: 'Complete the sentence before the forge cools down. Wrong taps damage the rune!', icon: AlertTriangle },
          ]}
          proTip="The target circle glows gold - tap it first! Watch the timer!"
          controls={[
            { label: 'Select', keys: 'Tap / Click', color: 'bg-amber-500' },
          ]}
          startButtonText="Enter the Forge"
          icon={Gem}
          onStart={() => {
            resetGame()
            setGamePhase('playing')
          }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="difficulty-select" className="text-xs uppercase tracking-wider text-white/50">Difficulty:</label>
              <select
                id="difficulty-select"
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value as Difficulty)}
                className="bg-slate-800 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="easy">Easy</option>
                <option value="normal">Medium</option>
                <option value="hard">Hard</option>
                <option value="extreme">Extreme</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="rune-type-select" className="text-xs uppercase tracking-wider text-white/50">Rune Type:</label>
              <select
                id="rune-type-select"
                value={selectedRuneType}
                onChange={(e) => setSelectedRuneType(e.target.value as RuneType)}
                className="bg-slate-800 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="common-stone">Common Stone</option>
                <option value="rare-crystal">Rare Crystal</option>
                <option value="void-essence">Void Essence</option>
              </select>
            </div>
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
    >
      {gamePhase === 'playing' && gameState && (
        <Stage
          width={dimensions.width}
          height={dimensions.height}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <Layer>
            <Group scale={{ x: scale, y: scale }} offsetX={0} offsetY={0}>
              <Rect
                x={0}
                y={0}
                width={GAME_WIDTH}
                height={GAME_HEIGHT}
                fill="#1a1a2e"
              />

              <Circle
                x={gameState.runeStone.centerX}
                y={gameState.runeStone.centerY}
                radius={gameState.runeStone.radius + 20}
                fill="rgba(255, 149, 0, 0.2)"
              />

              <Circle
                x={gameState.runeStone.centerX}
                y={gameState.runeStone.centerY}
                radius={gameState.runeStone.radius}
                fill="rgba(255, 149, 0, 0.4)"
                stroke="#ff9500"
                strokeWidth={3}
              />

              <Text
                x={gameState.runeStone.centerX - gameState.runeStone.radius + 10}
                y={gameState.runeStone.centerY - 30}
                text={gameState.currentSentence.translation}
                fontSize={getEffectiveTextSize(16)}
                fill="white"
                fontStyle="bold"
                width={(gameState.runeStone.radius - 10) * 2}
                align="center"
                wrap="word"
              />

              <Text
                x={gameState.runeStone.centerX - gameState.runeStone.radius + 10}
                y={gameState.runeStone.centerY + 10}
                text={gameState.collectedWords.join(' ')}
                fontSize={getEffectiveTextSize(16)}
                fill="#00ff88"
                fontStyle="bold"
                width={(gameState.runeStone.radius - 10) * 2}
                align="center"
                wrap="word"
              />

              {gameState.circles.map(circle => {
                const pos = getCirclePosition(circle, gameState.runeStone, gameState.circleAngle)
                const isTarget = !circle.selected && circle.word === gameState.words[gameState.targetIndex]
                const isSelected = circle.selected
                const hitRadius = getEffectiveTouchTarget(RUNE_FORGE_CHAMBER_CONFIG.circleRadius + 12)

                return (
                  <Group
                    key={circle.id}
                    x={pos.x}
                    y={pos.y}
                    onClick={!isSelected ? () => handleCircleClick(circle.id) : undefined}
                    onTap={!isSelected ? () => handleCircleClick(circle.id) : undefined}
                  >
                    {/* Invisible larger hit area for easier tapping */}
                    {!isSelected && (
                      <Circle x={0} y={0} radius={hitRadius} fill="transparent" />
                    )}
                    <Circle
                      x={0}
                      y={0}
                      radius={RUNE_FORGE_CHAMBER_CONFIG.circleRadius}
                      fill={isSelected ? 'rgba(0, 255, 136, 0.8)' : isTarget ? 'rgba(255, 215, 0, 0.9)' : 'rgba(0, 212, 255, 0.8)'}
                      stroke={isSelected ? '#00ff88' : isTarget ? '#ffd700' : '#00d4ff'}
                      strokeWidth={isTarget ? 4 : 2}
                      opacity={isSelected ? 0.5 : 1}
                    />
                    {!isSelected && (
                      <Text
                        x={-RUNE_FORGE_CHAMBER_CONFIG.circleRadius}
                        y={-8}
                        text={circle.word}
                        fontSize={getEffectiveTextSize(16)}
                        fill="white"
                        fontStyle="bold"
                        width={RUNE_FORGE_CHAMBER_CONFIG.circleRadius * 2}
                        align="center"
                      />
                    )}
                  </Group>
                )
              })}

              <Group x={10} y={30}>
                <Rect
                  x={0}
                  y={0}
                  width={GAME_WIDTH - 20}
                  height={20}
                  fill="rgba(0, 0, 0, 0.5)"
                  cornerRadius={8}
                />
                <Rect
                  x={0}
                  y={0}
                  width={(gameState.timer / gameState.maxTimer) * (GAME_WIDTH - 20)}
                  height={20}
                  fill={gameState.timer > gameState.maxTimer * 0.3 ? '#ff9500' : '#ef4444'}
                  cornerRadius={8}
                />
                <Text
                  x={GAME_WIDTH / 2 - 30}
                  y={2}
                  text={`Forge: ${Math.ceil(gameState.timer / 1000)}s`}
                  fontSize={getEffectiveTextSize(16)}
                  fill="white"
                  fontStyle="bold"
                />
              </Group>

              <Group x={10} y={GAME_HEIGHT - 30}>
                <Rect
                  x={0}
                  y={0}
                  width={GAME_WIDTH - 20}
                  height={20}
                  fill="rgba(0, 0, 0, 0.5)"
                  cornerRadius={8}
                />
                <Rect
                  x={0}
                  y={0}
                  width={(gameState.player.health / RUNE_FORGE_CHAMBER_CONFIG.initialHealth) * (GAME_WIDTH - 20)}
                  height={20}
                  fill={gameState.player.health > 50 ? '#22c55e' : gameState.player.health > 25 ? '#eab308' : '#ef4444'}
                  cornerRadius={8}
                />
                <Text
                  x={GAME_WIDTH / 2 - 30}
                  y={2}
                  text={`Rune: ${gameState.player.health}%`}
                  fontSize={getEffectiveTextSize(16)}
                  fill="white"
                  fontStyle="bold"
                />
              </Group>

              <Text
                x={10}
                y={GAME_HEIGHT - 60}
                text={`Words: ${gameState.collectedWords.length}/${gameState.words.length}`}
                fontSize={getEffectiveTextSize(16)}
                fill="white"
                fontStyle="bold"
              />

              <Text
                x={GAME_WIDTH / 2 - 30}
                y={GAME_HEIGHT - 60}
                text={`Level ${gameState.level}`}
                fontSize={getEffectiveTextSize(16)}
                fill="#fbbf24"
                fontStyle="bold"
              />
            </Group>
          </Layer>
        </Stage>
      )}

      {gamePhase === 'ended' && gameState && results && (
        <GameEndScreen
          status="defeat"
          title="Rune Shattered!"
          subtitle={`The forge grew too cold... You reached level ${gameState.level}.`}
          score={gameState.correctAnswers * 10}
          xp={results.xp}
          accuracy={results.accuracy}
          customStats={[
            { label: 'Levels Forged', value: gameState.level, icon: Gem },
            { label: 'Words Forged', value: gameState.correctAnswers, icon: BookOpen },
            { label: 'Rune Integrity', value: gameState.player.health, icon: Heart },
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
