'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Rect, Circle, Text, Group } from 'react-konva'
import {
  createLabyrinthGoblinKingState,
  tickLabyrinthGoblinKing,
  startLabyrinthGoblinKing,
  calculateLabyrinthXP,
  type LabyrinthGoblinKingState,
  type LabyrinthInput,
} from '@/lib/games/labyrinthGoblinKing'
import { GAME_WIDTH, GAME_HEIGHT, LABYRINTH_CONFIG } from '@/lib/games/labyrinthGoblinKingConfig'
import type { VocabularyItem } from '@/store/useGameStore'
import type { Difficulty } from '@/store/useGameStore'
import type { GoblinType } from '@/lib/games/labyrinthGoblinKingConfig'
// rAF-based game loop — no useInterval needed
import { GameEndScreen } from '@/components/games/game/GameEndScreen'
import { GameStartScreen } from '@/components/games/game/GameStartScreen'
import { VirtualDPad } from '@/components/games/ui/VirtualDPad'
import { Skull, Heart, BookOpen, AlertTriangle, Zap, Target } from 'lucide-react'
import { useGameFullscreen } from '@/hooks/useGameFullscreen'
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'

export type LabyrinthGoblinKingGameResult = {
  xp: number
  accuracy: number
}

interface LabyrinthGoblinKingGameProps {
  sentences: VocabularyItem[]
  onComplete: (results: LabyrinthGoblinKingGameResult) => void
}

export function LabyrinthGoblinKingGame({ sentences, onComplete }: LabyrinthGoblinKingGameProps) {
  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen()
  const { getEffectiveTextSize } = useAccessibilitySettings()
  const [gameState, setGameState] = useState<LabyrinthGoblinKingState | null>(null)
  const [gamePhase, setGamePhase] = useState<'start' | 'playing' | 'ended'>('start')
  const [results, setResults] = useState<LabyrinthGoblinKingGameResult | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('normal')
  const [selectedGoblinType, setSelectedGoblinType] = useState<GoblinType>('scout')
  const hasReportedRef = useRef(false)
  const inputRef = useRef<LabyrinthInput>({ dx: 0, dy: 0 })
  const lastFrameRef = useRef<number>(0)
  const rafRef = useRef<number>(0)

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const resetGame = useCallback(() => {
    if (sentences.length > 0) {
      setGameState(createLabyrinthGoblinKingState(sentences, {
        difficulty: selectedDifficulty,
        goblinType: selectedGoblinType,
      }))
      setResults(null)
      hasReportedRef.current = false
    }
  }, [sentences, selectedDifficulty, selectedGoblinType])

  useEffect(() => {
    if (sentences.length > 0 && gamePhase === 'start') {
      resetGame()
    }
  }, [sentences, gamePhase, resetGame])

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
        return tickLabyrinthGoblinKing(prevState, inputRef.current, clampedDelta)
      })
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      lastFrameRef.current = 0
    }
  }, [gamePhase])

  useEffect(() => {
    if (gamePhase === 'playing') {
      enterFullscreen()
    } else if (gamePhase === 'ended' || gamePhase === 'start') {
      exitFullscreen()
    }
  }, [gamePhase, enterFullscreen, exitFullscreen])

  const gameStatus = gameState?.status
  const correctAnswers = gameState?.correctAnswers ?? 0
  const wrongAnswers = gameState?.wrongAnswers ?? 0
  const goblinsEaten = gameState?.goblinsEaten ?? 0

  useEffect(() => {
    if (gameStatus === 'victory' || gameStatus === 'defeat') {
      if (gamePhase !== 'ended') {
        const accuracy = correctAnswers + wrongAnswers > 0
          ? correctAnswers / (correctAnswers + wrongAnswers)
          : 0
        const xp = calculateLabyrinthXP({ correctAnswers, wrongAnswers, goblinsEaten } as unknown as LabyrinthGoblinKingState)
        setResults({ xp, accuracy })
        setGamePhase('ended')
      }
    }
  }, [gameStatus, gamePhase, correctAnswers, wrongAnswers, goblinsEaten])

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
      const arrowKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
      if (arrowKeys.includes(e.key)) e.preventDefault()
      // Set desired direction — player keeps moving even after key release
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputRef.current = { dx: -1, dy: 0 }
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputRef.current = { dx: 1, dy: 0 }
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') inputRef.current = { dx: 0, dy: -1 }
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') inputRef.current = { dx: 0, dy: 1 }
    }

    const handleKeyUp = () => {
      // Don't clear input on keyup — Pac-Man style: player keeps moving in last direction
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
          gameTitle="Labyrinth of the Goblin King"
          gameSubtitle="Navigate the Maze"
          vocabulary={sentences}
          instructions={[
            { step: 1, text: 'Navigate the maze and collect word orbs in the correct order.', icon: BookOpen },
            { step: 2, text: 'The translation is shown at the top - find the words!', icon: Target },
            { step: 3, text: 'Avoid goblins! Collisions cost lives. Wrong words cost a life.', icon: AlertTriangle },
            { step: 4, text: 'Collect all words to become a Paladin and defeat the goblins!', icon: Zap },
          ]}
          proTip="The target orb glows gold! During Heroic Aura, goblins flee and you can eat them for bonus XP!"
          controls={[
            { label: 'Move', keys: 'Arrow Keys / WASD', color: 'bg-green-500' },
            { label: 'DPad', keys: 'Touch & Drag', color: 'bg-emerald-500' },
          ]}
          startButtonText="Enter the Labyrinth"
          icon={Skull}
          onStart={() => {
            resetGame()
            setGameState(prev => prev ? startLabyrinthGoblinKing(prev) : prev)
            setGamePhase('playing')
          }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-white/50">Difficulty:</span>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value as Difficulty)}
                className="bg-slate-800 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                <option value="easy">Small Dungeon</option>
                <option value="normal">Medium Dungeon</option>
                <option value="hard">Large Dungeon</option>
                <option value="extreme">Abyss</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-white/50">Goblin:</span>
              <select
                value={selectedGoblinType}
                onChange={(e) => setSelectedGoblinType(e.target.value as GoblinType)}
                className="bg-slate-800 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                <option value="scout">Scout (Patrol)</option>
                <option value="warrior">Warrior (Chase)</option>
                <option value="elite">Elite (Hunt)</option>
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
                <Rect x={0} y={0} width={GAME_WIDTH} height={GAME_HEIGHT} fill="#1a1a2e" />

                {gameState.maze.map((row, rowIndex) =>
                  row.map((tile, colIndex) => {
                    const x = colIndex * LABYRINTH_CONFIG.tileSize
                    const y = rowIndex * LABYRINTH_CONFIG.tileSize
                    if (tile === 'wall') {
                      return (
                        <Rect
                          key={`${rowIndex}-${colIndex}`}
                          x={x}
                          y={y}
                          width={LABYRINTH_CONFIG.tileSize}
                          height={LABYRINTH_CONFIG.tileSize}
                          fill="#3a3a4a"
                          stroke="#2a2a3a"
                          strokeWidth={1}
                        />
                      )
                    }
                    return (
                      <Rect
                        key={`${rowIndex}-${colIndex}`}
                        x={x}
                        y={y}
                        width={LABYRINTH_CONFIG.tileSize}
                        height={LABYRINTH_CONFIG.tileSize}
                        fill="#2a2a3a"
                      />
                    )
                  })
                )}

                {gameState.wordOrbs.map(orb => {
                  if (orb.collected) return null
                  const isTarget = orb.orderIndex === gameState.targetIndex
                  return (
                    <Group key={orb.id}>
                      <Circle
                        x={orb.x}
                        y={orb.y}
                        radius={LABYRINTH_CONFIG.orbSize / 2}
                        fill={isTarget ? '#ffd700' : '#4a90d9'}
                        opacity={0.8}
                      />
                      <Text
                        x={orb.x - 30}
                        y={orb.y - 10}
                        text={orb.word}
                        fontSize={getEffectiveTextSize(16)}
                        fill="white"
                        width={60}
                        align="center"
                      />
                    </Group>
                  )
                })}

                {gameState.goblins.filter(g => !g.eaten).map(goblin => (
                  <Circle
                    key={goblin.id}
                    x={goblin.x}
                    y={goblin.y}
                    radius={LABYRINTH_CONFIG.goblinSize / 2}
                    fill={goblin.fleeing ? '#4a8cd9' : '#4a8c4a'}
                  />
                ))}

                <Circle
                  x={gameState.player.x}
                  y={gameState.player.y}
                  radius={LABYRINTH_CONFIG.playerSize / 2}
                  fill={gameState.player.heroicAura ? '#ffd700' : '#c0c0c0'}
                  opacity={gameState.player.invulnerabilityTime > 0 ? 0.5 : 1}
                />

                <Rect x={0} y={0} width={GAME_WIDTH} height={40} fill="rgba(0,0,0,0.8)" />
                <Text
                  x={10}
                  y={10}
                  text={gameState.currentSentence.translation}
                  fontSize={getEffectiveTextSize(16)}
                  fill="white"
                  width={GAME_WIDTH - 20}
                />

                <Group x={GAME_WIDTH - 100} y={50}>
                  {Array.from({ length: gameState.player.lives }).map((_, i) => (
                    <Text key={i} x={i * 20} y={0} text="❤️" fontSize={16} />
                  ))}
                </Group>

                {gameState.player.heroicAura && (
                  <Rect
                    x={10}
                    y={50}
                    width={(gameState.player.heroicAuraTimer / LABYRINTH_CONFIG.heroicAuraDuration) * 100}
                    height={10}
                    fill="#ffd700"
                  />
                )}

                <Text
                  x={10}
                  y={GAME_HEIGHT - 30}
                  text={`Words: ${gameState.collectedWords.length}/${gameState.wordOrbs.length} | Goblins Eaten: ${gameState.goblinsEaten}`}
                  fontSize={getEffectiveTextSize(16)}
                  fill="white"
                />
              </Group>
            </Layer>
          </Stage>

          <div className="absolute bottom-4 left-4 z-10 pointer-events-auto">
            <VirtualDPad onInput={handleDPadInput} />
          </div>
        </>
      )}

      {gamePhase === 'ended' && gameState && results && (
        <GameEndScreen
          status={gameState.status === 'victory' ? 'victory' : 'defeat'}
          title={gameState.status === 'victory' ? 'Labyrinth Conquered!' : 'Lost in the Maze!'}
          subtitle={gameState.status === 'victory' ? 'You defeated the Goblin King!' : 'The goblins were too strong...'}
          score={gameState.correctAnswers * 10}
          xp={results.xp}
          accuracy={results.accuracy}
          customStats={[
            { label: 'Words Collected', value: gameState.correctAnswers, icon: BookOpen },
            { label: 'Goblins Eaten', value: gameState.goblinsEaten, icon: Skull },
            { label: 'Lives Left', value: gameState.player.lives, icon: Heart },
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
