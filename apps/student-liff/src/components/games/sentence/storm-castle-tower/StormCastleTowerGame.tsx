'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Text, Group, Rect, Circle } from 'react-konva'
import {
  createStormCastleTowerState,
  advanceStormCastleTowerTime,
  movePlayer,
  collectWindow,
  spawnHazard,
  startGame,
  getGridPosition,
  type StormCastleTowerState,
} from '@/lib/games/stormCastleTower'
import { STORM_CASTLE_TOWER_CONFIG } from '@/lib/games/stormCastleTowerConfig'
import type { VocabularyItem, Difficulty } from '@/store/useGameStore'
import type { GuardType } from '@/lib/games/stormCastleTowerConfig'
import { GameEndScreen } from '@/components/games/game/GameEndScreen'
import { GameStartScreen } from '@/components/games/game/GameStartScreen'
import { useGameFullscreen } from '@/hooks/useGameFullscreen'
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'
import { calculateXP } from '@/lib/games/xp'
import { Shield, BookOpen, AlertTriangle, Target, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'

export type StormCastleTowerGameResult = {
  xp: number
  accuracy: number
}

interface StormCastleTowerGameProps {
  vocabulary: VocabularyItem[]
  onComplete: (results: StormCastleTowerGameResult) => void
}

export function StormCastleTowerGame({ vocabulary, onComplete }: StormCastleTowerGameProps) {
  const [gameState, setGameState] = useState<StormCastleTowerState | null>(null)
  const [gamePhase, setGamePhase] = useState<'start' | 'playing' | 'ended'>('start')
  const [results, setResults] = useState<StormCastleTowerGameResult | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('normal')
  const [selectedGuard, setSelectedGuard] = useState<GuardType>('alert-sentry')
  const hasReportedRef = useRef(false)
  const lastHazardRef = useRef(0)
  const lastFrameRef = useRef<number>(0)
  const rafRef = useRef<number>(0)

  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen()
  const { getEffectiveTextSize } = useAccessibilitySettings()
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const resetGame = useCallback(() => {
    if (vocabulary.length > 0) {
      setGameState(createStormCastleTowerState(vocabulary, {
        difficulty: selectedDifficulty,
        guardType: selectedGuard,
      }))
      setResults(null)
      hasReportedRef.current = false
      lastHazardRef.current = 0
    }
  }, [vocabulary, selectedDifficulty, selectedGuard])

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

  useEffect(() => {
    if (gamePhase !== 'playing') return

    const loop = (timestamp: number) => {
      const delta = lastFrameRef.current ? timestamp - lastFrameRef.current : 16
      lastFrameRef.current = timestamp
      const clampedDelta = Math.min(delta, 50)
      setGameState(prevState => {
        if (!prevState || prevState.phase !== 'playing') return prevState

        let nextState = advanceStormCastleTowerTime(prevState, clampedDelta)

        if (nextState.gameTime - lastHazardRef.current > STORM_CASTLE_TOWER_CONFIG.hazards.oilInterval) {
          nextState = spawnHazard(nextState)
          lastHazardRef.current = nextState.gameTime
        }

        return nextState
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
    } else if (gamePhase === 'ended') {
      exitFullscreen()
    }
  }, [gamePhase, enterFullscreen, exitFullscreen])

  useEffect(() => {
    if (gameState?.phase === 'victory' || gameState?.phase === 'defeat') {
      if (gamePhase !== 'ended') {
        const correctWords = gameState!.correctWords
        const totalAttempts = gameState!.totalAttempts
        const accuracy = totalAttempts > 0 ? correctWords / totalAttempts : 0
        const xp = calculateXP(correctWords, correctWords, totalAttempts)
        setResults({ xp, accuracy })
        setGamePhase('ended')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.phase, gamePhase])

  useEffect(() => {
    if (gamePhase === 'ended' && results && !hasReportedRef.current) {
      hasReportedRef.current = true
      onComplete(results)
    }
  }, [gamePhase, results, onComplete])

  const scale = useMemo(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return 1
    return Math.min(dimensions.width / STORM_CASTLE_TOWER_CONFIG.gameWidth, dimensions.height / STORM_CASTLE_TOWER_CONFIG.gameHeight)
  }, [dimensions])

  const handleMove = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (gamePhase !== 'playing') return
    setGameState(prevState => {
      if (!prevState || prevState.phase !== 'playing') return prevState
      return movePlayer(prevState, direction)
    })
  }, [gamePhase])

  const handleCollect = useCallback(() => {
    if (gamePhase !== 'playing') return
    setGameState(prevState => {
      if (!prevState || prevState.phase !== 'playing') return prevState
      return collectWindow(prevState)
    })
  }, [gamePhase])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gamePhase !== 'playing') return
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        handleMove('up')
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        handleMove('down')
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        handleMove('left')
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        handleMove('right')
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        handleCollect()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [gamePhase, handleMove, handleCollect])

  const handleTouchMove = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    handleMove(direction)
  }, [handleMove])

  if (gamePhase === 'start') {
    return (
      <div
        ref={containerRef}
        className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto"
      >
        <GameStartScreen
          gameTitle="Storm the Castle Tower"
          gameSubtitle="Scale the Walls"
          vocabulary={vocabulary}
          instructions={[
            { step: 1, text: 'Windows on the tower show words from the sentence.', icon: BookOpen },
            { step: 2, text: 'Move to windows and tap to collect words in the correct order!', icon: Target },
            { step: 3, text: 'Dodge boiling oil and falling rocks!', icon: AlertTriangle },
          ]}
          proTip="Move quickly but carefully. Wrong words slam the window shut and cost a life!"
          controls={[
            { label: 'Move', keys: 'Arrow Keys / WASD', color: 'bg-cyan-500' },
            { label: 'Collect', keys: 'Space / Tap Window', color: 'bg-purple-500' },
          ]}
          startButtonText="Storm the Tower"
          icon={Shield}
          onStart={() => {
            resetGame()
            const startedState = startGame(gameState!)
            setGameState(startedState)
            setGamePhase("playing")
          }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-white/50">Tower Height:</span>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value as Difficulty)}
                className="bg-slate-800 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                <option value="easy">Squire&apos;s Tower (4 words)</option>
                <option value="medium">Knight&apos;s Keep (5 words)</option>
                <option value="hard">Lord&apos;s Citadel (6 words)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-white/50">Guard Type:</span>
              <select
                value={selectedGuard}
                onChange={(e) => setSelectedGuard(e.target.value as GuardType)}
                className="bg-slate-800 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                <option value="lazy-guard">Lazy Guard (Slow)</option>
                <option value="alert-sentry">Alert Sentry (Medium)</option>
                <option value="elite-watchman">Elite Watchman (Fast)</option>
              </select>
            </div>
          </div>
        </GameStartScreen>
      </div>
    )
  }

  if (gamePhase === 'ended' && results) {
    return (
      <div
        ref={containerRef}
        className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto"
      >
        <GameEndScreen
          status={gameState?.phase === 'victory' ? 'victory' : 'defeat'}
          score={gameState?.correctWords ?? 0}
          xp={results.xp}
          accuracy={results.accuracy}
          onRestart={() => {
            resetGame()
            setGamePhase('start')
          }}
          customStats={[
            { label: 'Words Collected', value: gameState?.correctWords ?? 0 },
            { label: 'Lives Left', value: gameState?.player.lives ?? 0 },
          ]}
        />
      </div>
    )
  }

  const targetWord = gameState?.words[gameState.targetIndex] ?? ''

  return (
    <div
      ref={containerRef}
      className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto"
    >
      {gameState && (
        <Stage
          width={STORM_CASTLE_TOWER_CONFIG.gameWidth}
          height={STORM_CASTLE_TOWER_CONFIG.gameHeight}
          scale={{ x: scale, y: scale }}
        >
          <Layer>
            <Rect
              x={0}
              y={0}
              width={STORM_CASTLE_TOWER_CONFIG.gameWidth}
              height={STORM_CASTLE_TOWER_CONFIG.gameHeight}
              fill="#1e293b"
            />
            
            <Rect
              x={0}
              y={0}
              width={STORM_CASTLE_TOWER_CONFIG.gameWidth}
              height={50}
              fill="rgba(0,0,0,0.5)"
            />
            
            <Text
              x={10}
              y={15}
              text={gameState.sentence.translation}
              fontSize={getEffectiveTextSize(16)}
              fill="#94a3b8"
              width={STORM_CASTLE_TOWER_CONFIG.gameWidth - 20}
              align="center"
            />
            
            <Text
              x={10}
              y={70}
              text={`Target: ${targetWord}`}
              fontSize={getEffectiveTextSize(18)}
              fill="#fbbf24"
              width={STORM_CASTLE_TOWER_CONFIG.gameWidth - 20}
              align="center"
            />
            
            <Group>
              <Rect
                x={10}
                y={10}
                width={80}
                height={30}
                fill="rgba(239,68,68,0.3)"
                cornerRadius={5}
              />
              <Text
                x={15}
                y={15}
                text={`Lives: ${gameState.player.lives}`}
                fontSize={getEffectiveTextSize(16)}
                fill="#f87171"
              />
            </Group>
            
            {gameState.windows.map(win => {
              if (win.state === 'collected') return null
              
              const pos = getGridPosition(win.position.col, win.position.row, gameState.scrollOffset)
              const isTarget = win.wordIndex === gameState.targetIndex
              const windowColor = win.state === 'closed' ? '#6b7280' : (isTarget ? '#fbbf24' : '#64748b')
              
              return (
                <Group key={win.id}>
                  <Rect
                    x={pos.x - STORM_CASTLE_TOWER_CONFIG.window.width / 2}
                    y={pos.y - STORM_CASTLE_TOWER_CONFIG.window.height / 2}
                    width={STORM_CASTLE_TOWER_CONFIG.window.width}
                    height={STORM_CASTLE_TOWER_CONFIG.window.height}
                    fill={win.state === 'closed' ? '#374151' : '#1e293b'}
                    stroke={windowColor}
                    strokeWidth={isTarget ? 3 : 1}
                    cornerRadius={5}
                  />
                  {win.state === 'open' && (
                    <Text
                      x={pos.x - 30}
                      y={pos.y - 8}
                      text={win.word}
                      fontSize={getEffectiveTextSize(16)}
                      fill={isTarget ? '#fef3c7' : '#e2e8f0'}
                      width={60}
                      align="center"
                    />
                  )}
                </Group>
              )
            })}
            
            {gameState.hazards.map(hazard => {
              const x = hazard.column * STORM_CASTLE_TOWER_CONFIG.cellSize + STORM_CASTLE_TOWER_CONFIG.cellSize / 2
              const y = hazard.y
              
              if (hazard.type === 'oil') {
                return (
                  <Rect
                    key={hazard.id}
                    x={x - STORM_CASTLE_TOWER_CONFIG.hazards.oilWidth / 2}
                    y={y}
                    width={STORM_CASTLE_TOWER_CONFIG.hazards.oilWidth}
                    height={30}
                    fill="#f97316"
                    opacity={0.8}
                    cornerRadius={3}
                  />
                )
              } else {
                return (
                  <Circle
                    key={hazard.id}
                    x={x}
                    y={y}
                    radius={STORM_CASTLE_TOWER_CONFIG.hazards.rockRadius}
                    fill="#78716c"
                    stroke="#a8a29e"
                    strokeWidth={2}
                  />
                )
              }
            })}
            
            {(() => {
              const playerPos = getGridPosition(
                gameState.player.position.col,
                gameState.player.position.row,
                gameState.scrollOffset
              )
              return (
                <Circle
                  x={playerPos.x}
                  y={playerPos.y}
                  radius={STORM_CASTLE_TOWER_CONFIG.player.radius}
                  fill="#3b82f6"
                  stroke="#60a5fa"
                  strokeWidth={3}
                />
              )
            })()}
          </Layer>
        </Stage>
      )}
      
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 text-xs text-white/50">
        <span>Arrows/WASD = Move</span>
        <span>Space = Collect</span>
      </div>
      
      <div className="absolute bottom-20 left-0 right-0 flex justify-center gap-2">
        <button
          onTouchStart={() => handleTouchMove('left')}
          className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center text-white active:bg-white/20"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex flex-col gap-2">
          <button
            onTouchStart={() => handleTouchMove('up')}
            className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center text-white active:bg-white/20"
          >
            <ArrowUp className="w-6 h-6" />
          </button>
          <button
            onTouchStart={() => handleTouchMove('down')}
            className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center text-white active:bg-white/20"
          >
            <ArrowDown className="w-6 h-6" />
          </button>
        </div>
        <button
          onTouchStart={() => handleTouchMove('right')}
          className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center text-white active:bg-white/20"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
        <button
          onTouchStart={handleCollect}
          className="w-16 h-12 bg-purple-500/50 rounded-lg flex items-center justify-center text-white active:bg-purple-500/70 ml-4"
        >
          Collect
        </button>
      </div>
    </div>
  )
}
