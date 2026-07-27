'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Text, Group, Rect, Circle } from 'react-konva'
import {
  createVillageGuardianState,
  tickVillageGuardian,
  calculateXP,
  type VillageGuardianState,
  type InputState,
} from '@/lib/games/villageGuardian'
import { GAME_WIDTH, GAME_HEIGHT, VILLAGE_GUARDIAN_CONFIG } from '@/lib/games/villageGuardianConfig'
import type { VocabularyItem } from '@/store/useGameStore'
import type { Difficulty } from '@/store/useGameStore'
import type { OpponentType } from '@/lib/games/villageGuardianConfig'
// rAF-based game loop — no useInterval needed
import { GameEndScreen } from '@/components/games/game/GameEndScreen'
import { GameStartScreen } from '@/components/games/game/GameStartScreen'
import { VirtualDPad } from '@/components/games/ui/VirtualDPad'
import { Shield, BookOpen, AlertTriangle, Heart, Users } from 'lucide-react'
import { useGameFullscreen } from '@/hooks/useGameFullscreen'
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'
import { useScopedI18n } from '@/locales/client'

export type VillageGuardianGameResult = {
  xp: number
  accuracy: number
}

interface VillageGuardianGameProps {
  vocabulary: VocabularyItem[]
  onComplete: (results: VillageGuardianGameResult) => void
}

export function VillageGuardianGame({ vocabulary, onComplete }: VillageGuardianGameProps) {
  const [gameState, setGameState] = useState<VillageGuardianState | null>(null)
  const [gamePhase, setGamePhase] = useState<'start' | 'playing' | 'ended'>('start')
  const [results, setResults] = useState<VillageGuardianGameResult | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('normal')
  const [selectedOpponent, setSelectedOpponent] = useState<OpponentType>('bandits')
  const hasReportedRef = useRef(false)
  const inputRef = useRef<InputState>({ dx: 0, dy: 0 })
  const lastFrameRef = useRef<number>(0)
  const rafRef = useRef<number>(0)

  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen()
  const { getEffectiveTextSize } = useAccessibilitySettings()
  useScopedI18n('pages.student.gamesPage.villageGuardian')

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const resetGame = useCallback(() => {
    if (vocabulary.length > 0) {
      setGameState(createVillageGuardianState(vocabulary, {
        difficulty: selectedDifficulty,
        opponentType: selectedOpponent,
      }))
      setResults(null)
      hasReportedRef.current = false
    }
  }, [vocabulary, selectedDifficulty, selectedOpponent])

  useEffect(() => {
    if (vocabulary.length > 0 && gamePhase === 'start') {
      resetGame()
    }
  }, [vocabulary, gamePhase, resetGame])

  useEffect(() => {
    if (gamePhase === 'playing') {
      enterFullscreen()
    } else {
      exitFullscreen()
    }
  }, [gamePhase, enterFullscreen, exitFullscreen])

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

  useEffect(() => {
    if (gamePhase !== 'playing') return

    const loop = (timestamp: number) => {
      const delta = lastFrameRef.current ? timestamp - lastFrameRef.current : 16
      lastFrameRef.current = timestamp
      const clampedDelta = Math.min(delta, 50)
      setGameState(prevState => {
        if (!prevState || prevState.status !== 'playing') return prevState
        return tickVillageGuardian(prevState, clampedDelta, inputRef.current)
      })
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      lastFrameRef.current = 0
    }
  }, [gamePhase])

  const gameStateRef = useRef(gameState)
  gameStateRef.current = gameState

  useEffect(() => {
    if (gameState?.status === 'defeat' && gamePhase !== 'ended') {
      const currentState = gameStateRef.current
      if (!currentState) return
      const accuracy = currentState.correctAnswers + currentState.wrongAnswers > 0
        ? currentState.correctAnswers / (currentState.correctAnswers + currentState.wrongAnswers)
        : 0
      const xp = calculateXP(currentState)
      setResults({ xp, accuracy })
      setGamePhase('ended')
    }
  }, [gameState?.status, gamePhase])

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

  const handleDPadInput = useCallback((input: { dx: number; dy: number }) => {
    inputRef.current = input
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gamePhase !== 'playing') return
      let dx = inputRef.current.dx, dy = inputRef.current.dy
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dx = -1
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dx = 1
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dy = -1
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dy = 1
      inputRef.current = { dx, dy }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (gamePhase !== 'playing') return
      let dx = inputRef.current.dx, dy = inputRef.current.dy
      if (['ArrowLeft', 'a', 'A', 'ArrowRight', 'd', 'D'].includes(e.key)) dx = 0
      if (['ArrowUp', 'w', 'W', 'ArrowDown', 's', 'S'].includes(e.key)) dy = 0
      inputRef.current = { dx, dy }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [gamePhase])

  if (gamePhase === 'start') {
    return (
      <div
        ref={containerRef}
        className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto"
      >
        <GameStartScreen
          gameTitle="Village Guardian"
          gameSubtitle="Defend the Innocent"
          vocabulary={vocabulary}
          instructions={[
            { step: 1, text: 'Rescue villagers with word bubbles in the correct order to form the sentence.', icon: BookOpen },
            { step: 2, text: 'The translation is shown at the top - find the words!', icon: BookOpen },
            { step: 3, text: 'Avoid monsters! Collisions lose villagers. Wrong words add time penalty.', icon: AlertTriangle },
          ]}
          proTip="The target villager glows gold! Lead all rescued villagers to the sanctuary to win!"
          controls={[
            { label: 'Move', keys: 'Arrow Keys / WASD', color: 'bg-amber-500' },
            { label: 'DPad', keys: 'Touch & Drag', color: 'bg-orange-500' },
          ]}
          startButtonText="Defend the Village"
          icon={Shield}
          onStart={() => {
            resetGame()
            setGamePhase('playing')
          }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-white/50">Difficulty:</span>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value as Difficulty)}
                className="bg-slate-800 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                aria-label="Difficulty"
              >
                <option value="easy">Scout Party</option>
                <option value="normal">War Band</option>
                <option value="hard">Full Siege</option>
                <option value="extreme">Apocalypse</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-white/50">Opponent:</span>
              <select
                value={selectedOpponent}
                onChange={(e) => setSelectedOpponent(e.target.value as OpponentType)}
                className="bg-slate-800 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                aria-label="Opponent"
              >
                <option value="bandits">Bandits (Wander)</option>
                <option value="goblins">Goblins (Chase)</option>
                <option value="dragons">Dragons (Hunt)</option>
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
                  fill="#2d1810"
                />

                <Rect
                  x={0}
                  y={0}
                  width={GAME_WIDTH}
                  height={70}
                  fill="rgba(0, 0, 0, 0.7)"
                />

                <Text
                  x={10}
                  y={10}
                  text={gameState.currentSentence.translation}
                  fontSize={getEffectiveTextSize(16)}
                  fill="white"
                  fontStyle="bold"
                  width={GAME_WIDTH - 20}
                  align="center"
                  wrap="word"
                />

                <Text
                  x={10}
                  y={35}
                  text={gameState.collectedWords.join(' ')}
                  fontSize={getEffectiveTextSize(16)}
                  fill="#22c55e"
                  fontStyle="bold"
                  width={GAME_WIDTH - 20}
                  align="center"
                />

                <Text
                  x={10}
                  y={52}
                  text={`Words: ${gameState.collectedWords.length}/${gameState.words.length}`}
                  fontSize={getEffectiveTextSize(14)}
                  fill="#a3a3a3"
                  width={GAME_WIDTH - 20}
                  align="center"
                />

                <Circle
                  x={gameState.sanctuary.x}
                  y={gameState.sanctuary.y}
                  radius={gameState.sanctuary.radius}
                  fill="rgba(34, 197, 94, 0.3)"
                  stroke="#22c55e"
                  strokeWidth={3}
                />
                <Text
                  x={gameState.sanctuary.x - 30}
                  y={gameState.sanctuary.y - 8}
                  text="SAFE"
                  fontSize={getEffectiveTextSize(16)}
                  fill="#22c55e"
                  fontStyle="bold"
                  width={60}
                  align="center"
                />

                {gameState.villagers.filter(v => !v.collected).map(villager => {
                  const isTarget = villager.orderIndex === gameState.targetIndex
                  const isHiding = villager.hiding
                  return (
                    <Group key={villager.id} x={villager.x} y={villager.y}>
                      <Circle
                        x={0}
                        y={0}
                        radius={VILLAGE_GUARDIAN_CONFIG.villagerSize / 2}
                        fill={isHiding ? 'rgba(150, 150, 150, 0.5)' : isTarget ? 'rgba(255, 215, 0, 0.9)' : 'rgba(59, 130, 246, 0.8)'}
                        stroke={isHiding ? '#666' : isTarget ? '#ffd700' : '#3b82f6'}
                        strokeWidth={isTarget ? 3 : 2}
                        opacity={isHiding ? 0.5 : 1}
                      />
                      <Text
                        x={-VILLAGE_GUARDIAN_CONFIG.villagerSize / 2}
                        y={-VILLAGE_GUARDIAN_CONFIG.villagerSize / 2 - 18}
                        text={villager.word}
                        fontSize={getEffectiveTextSize(14)}
                        fill="white"
                        fontStyle="bold"
                        width={VILLAGE_GUARDIAN_CONFIG.villagerSize}
                        align="center"
                      />
                    </Group>
                  )
                })}

                {gameState.trail.map((segment) => (
                  <Group key={segment.id} x={segment.x} y={segment.y}>
                    <Circle
                      x={0}
                      y={0}
                      radius={VILLAGE_GUARDIAN_CONFIG.villagerSize / 2 - 2}
                      fill="rgba(34, 197, 94, 0.8)"
                      stroke="#22c55e"
                      strokeWidth={2}
                    />
                    <Text
                      x={-VILLAGE_GUARDIAN_CONFIG.villagerSize / 2 + 2}
                      y={-6}
                        text={segment.word}
                        fontSize={getEffectiveTextSize(14)}
                        fill="white"
                        fontStyle="bold"
                        width={VILLAGE_GUARDIAN_CONFIG.villagerSize - 4}
                        align="center"
                      />
                  </Group>
                ))}

                {gameState.monsters.map(monster => (
                  <Group key={monster.id} x={monster.x} y={monster.y}>
                    <Circle
                      x={0}
                      y={0}
                      radius={VILLAGE_GUARDIAN_CONFIG.monsterSize / 2}
                      fill={monster.type === 'dragons' ? 'rgba(239, 68, 68, 0.9)' : monster.type === 'goblins' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(234, 179, 8, 0.9)'}
                      stroke={monster.type === 'dragons' ? '#dc2626' : monster.type === 'goblins' ? '#16a34a' : '#ca8a04'}
                      strokeWidth={3}
                    />
                    <Circle x={-6} y={-4} radius={3} fill="black" />
                    <Circle x={6} y={-4} radius={3} fill="black" />
                    <Circle x={-6} y={-4} radius={1} fill="white" />
                    <Circle x={6} y={-4} radius={1} fill="white" />
                  </Group>
                ))}

                <Group x={gameState.knight.x} y={gameState.knight.y}>
                  <Circle
                    x={0}
                    y={0}
                    radius={VILLAGE_GUARDIAN_CONFIG.knightSize / 2}
                    fill={gameState.knight.invulnerabilityTime > 0 ? 'rgba(59, 130, 246, 0.5)' : '#3b82f6'}
                    stroke={gameState.knight.invulnerabilityTime > 0 ? '#93c5fd' : '#1d4ed8'}
                    strokeWidth={3}
                  />
                  <Circle x={0} y={0} radius={8} fill="#60a5fa" />
                </Group>

                <Group x={10} y={GAME_HEIGHT - 60}>
                  <Rect
                    x={0}
                    y={0}
                    width={(GAME_WIDTH - 20) / 2 - 5}
                    height={16}
                    fill="rgba(0, 0, 0, 0.5)"
                    cornerRadius={8}
                  />
                  <Rect
                    x={0}
                    y={0}
                    width={(gameState.timer / gameState.maxTimer) * ((GAME_WIDTH - 20) / 2 - 5)}
                    height={16}
                    fill={gameState.timer > gameState.maxTimer * 0.3 ? '#22c55e' : '#ef4444'}
                    cornerRadius={8}
                  />
                  <Text
                    x={5}
                    y={2}
                    text={`Time: ${Math.ceil(gameState.timer / 1000)}s`}
                    fontSize={getEffectiveTextSize(14)}
                    fill="white"
                    fontStyle="bold"
                  />
                </Group>

                <Group x={GAME_WIDTH / 2 + 5} y={GAME_HEIGHT - 60}>
                  <Rect
                    x={0}
                    y={0}
                    width={(GAME_WIDTH - 20) / 2 - 5}
                    height={16}
                    fill="rgba(0, 0, 0, 0.5)"
                    cornerRadius={8}
                  />
                  <Rect
                    x={0}
                    y={0}
                    width={(gameState.knight.lives / VILLAGE_GUARDIAN_CONFIG.initialLives) * ((GAME_WIDTH - 20) / 2 - 5)}
                    height={16}
                    fill="#ef4444"
                    cornerRadius={8}
                  />
                  <Text
                    x={5}
                    y={2}
                    text={`Lives: ${gameState.knight.lives}`}
                    fontSize={getEffectiveTextSize(14)}
                    fill="white"
                    fontStyle="bold"
                  />
                </Group>

                <Text
                  x={GAME_WIDTH - 60}
                  y={GAME_HEIGHT - 35}
                  text={`Score: ${gameState.correctAnswers * 10}`}
                  fontSize={getEffectiveTextSize(16)}
                  fill="white"
                  fontStyle="bold"
                />

                <Text
                  x={GAME_WIDTH / 2 - 30}
                  y={GAME_HEIGHT - 35}
                  text={`Level ${gameState.level}`}
                  fontSize={getEffectiveTextSize(16)}
                  fill="#fbbf24"
                  fontStyle="bold"
                />
              </Group>
            </Layer>
          </Stage>

          <div className="absolute bottom-4 left-4 z-10">
            <VirtualDPad onInput={handleDPadInput} />
          </div>
        </>
      )}

      {gamePhase === 'ended' && gameState && results && (
        <GameEndScreen
          status="defeat"
          title="Village Overrun!"
          subtitle={`The monsters were too strong... You reached level ${gameState.level}.`}
          score={gameState.correctAnswers * 10}
          xp={results.xp}
          accuracy={results.accuracy}
          customStats={[
            { label: 'Levels Survived', value: gameState.level, icon: Users },
            { label: 'Villagers Saved', value: gameState.correctAnswers, icon: Users },
            { label: 'Lives Left', value: gameState.knight.lives, icon: Heart },
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
