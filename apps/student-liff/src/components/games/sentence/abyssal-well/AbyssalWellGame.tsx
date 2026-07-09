'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Text, Group, Rect, Circle } from 'react-konva'
import {
  createAbyssalWellState,
  advanceAbyssalWellTime,
  fireProjectile,
  rotatePlayer,
  spawnEnemy,
  startGame,
  getLanePosition,
  calculateXP,
  type AbyssalWellState,
} from '@/lib/games/abyssalWell'
import { ABYSSAL_WELL_CONFIG } from '@/lib/games/abyssalWellConfig'
import type { VocabularyItem } from '@/store/useGameStore'
import type { CreatureType, AbyssalWellDifficulty } from '@/lib/games/abyssalWellConfig'
import { useGameFullscreen } from '@/hooks/useGameFullscreen'
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'
import { GameEndScreen } from '@/components/games/game/GameEndScreen'
import { GameStartScreen } from '@/components/games/game/GameStartScreen'
import { Flame, BookOpen, AlertTriangle, Target } from 'lucide-react'

export type AbyssalWellGameResult = {
  xp: number
  accuracy: number
}

interface AbyssalWellGameProps {
  sentences: VocabularyItem[]
  onComplete: (results: AbyssalWellGameResult) => void
}

export function AbyssalWellGame({ sentences, onComplete }: AbyssalWellGameProps) {
  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen()
  const { getEffectiveTextSize } = useAccessibilitySettings()
  const [gameState, setGameState] = useState<AbyssalWellState | null>(null)
  const [gamePhase, setGamePhase] = useState<'start' | 'playing' | 'ended'>('start')
  const [results, setResults] = useState<AbyssalWellGameResult | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<AbyssalWellDifficulty>('medium')
  const [selectedCreature, setSelectedCreature] = useState<CreatureType>('cave-spider')
  const hasReportedRef = useRef(false)
  const lastSpawnRef = useRef(0)
  const lastFrameRef = useRef<number>(0)
  const rafRef = useRef<number>(0)

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const resetGame = useCallback(() => {
    if (sentences.length > 0) {
      setGameState(createAbyssalWellState(sentences, {
        difficulty: selectedDifficulty,
        creatureType: selectedCreature,
      }))
      setResults(null)
      hasReportedRef.current = false
      lastSpawnRef.current = 0
    }
  }, [sentences, selectedDifficulty, selectedCreature])

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
        if (!prevState || prevState.phase !== 'playing') return prevState

        let nextState = advanceAbyssalWellTime(prevState, clampedDelta)

        if (nextState.gameTime - lastSpawnRef.current > ABYSSAL_WELL_CONFIG.enemy.spawnInterval) {
          nextState = spawnEnemy(nextState)
          lastSpawnRef.current = nextState.gameTime
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
    } else {
      exitFullscreen()
    }
  }, [gamePhase, enterFullscreen, exitFullscreen])

  useEffect(() => {
    if (gameState?.phase === 'victory' || gameState?.phase === 'defeat') {
      if (gamePhase !== 'ended') {
        const accuracy = gameState.totalAttempts > 0
          ? gameState.correctWords / gameState.totalAttempts
          : 0
        const xp = calculateXP({
          correctWords: gameState.correctWords,
          totalAttempts: gameState.totalAttempts,
          lives: gameState.player.lives,
          initialLives: ABYSSAL_WELL_CONFIG.lives,
          gameTime: gameState.gameTime,
        })
        setResults({ xp, accuracy })
        setGamePhase('ended')
      }
    }
  }, [gameState?.phase, gamePhase, gameState])

  useEffect(() => {
    if (gamePhase === 'ended' && results && !hasReportedRef.current) {
      hasReportedRef.current = true
      onComplete(results)
    }
  }, [gamePhase, results, onComplete])

  const scale = useMemo(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return 1
    return Math.min(dimensions.width / ABYSSAL_WELL_CONFIG.gameWidth, dimensions.height / ABYSSAL_WELL_CONFIG.gameHeight)
  }, [dimensions])

  const handleRotate = useCallback((direction: number) => {
    if (gameState && gameState.phase === 'playing' && gamePhase === 'playing') {
      setGameState(prevState => {
        if (!prevState || prevState.phase !== 'playing') return prevState
        return rotatePlayer(prevState, direction)
      })
    }
  }, [gameState, gamePhase])

  const handleFire = useCallback(() => {
    if (gameState && gameState.phase === 'playing' && gamePhase === 'playing') {
      setGameState(prevState => {
        if (!prevState || prevState.phase !== 'playing') return prevState
        return fireProjectile(prevState)
      })
    }
  }, [gameState, gamePhase])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gamePhase !== 'playing') return
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        handleRotate(-1)
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        handleRotate(1)
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        handleFire()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [gamePhase, handleRotate, handleFire])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (gamePhase !== 'playing' || !containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const touch = e.touches[0]
    const x = touch.clientX - rect.left
    const centerX = rect.width / 2
    
    if (x < centerX - 50) {
      handleRotate(-1)
    } else if (x > centerX + 50) {
      handleRotate(1)
    } else {
      handleFire()
    }
  }, [gamePhase, handleRotate, handleFire, containerRef])

  if (gamePhase === 'start') {
    return (
      <div
        ref={containerRef}
        className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto"
      >
        <GameStartScreen
          gameTitle="The Abyssal Well"
          gameSubtitle="Defend the Rim"
          vocabulary={sentences}
          instructions={[
            { step: 1, text: 'Enemies climb up from the well carrying word orbs.', icon: BookOpen },
            { step: 2, text: 'Shoot the enemies in the correct sentence order!', icon: Target },
            { step: 3, text: 'If an enemy reaches the rim, you lose a life. Don\'t let them through!', icon: AlertTriangle },
          ]}
          proTip="Rotate left/right to aim, tap center to fire. Hit enemies carrying the correct word in sequence!"
          controls={[
            { label: 'Rotate', keys: '← → / A D', color: 'bg-cyan-500' },
            { label: 'Fire', keys: 'Space / Tap Center', color: 'bg-purple-500' },
          ]}
          startButtonText="Enter the Well"
          icon={Flame}
          onStart={() => {
            resetGame()
            const startedState = startGame(gameState!)
            setGameState(startedState)
            setGamePhase('playing')
          }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm uppercase tracking-wider text-white/50">Well Depth:</span>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value as AbyssalWellDifficulty)}
                className="bg-slate-800 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                <option value="easy">Shallow Well</option>
                <option value="medium">Deep Chasm</option>
                <option value="hard">Abyss</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm uppercase tracking-wider text-white/50">Enemy Type:</span>
              <select
                value={selectedCreature}
                onChange={(e) => setSelectedCreature(e.target.value as CreatureType)}
                className="bg-slate-800 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                <option value="goblin-scout">Goblin Scout (Slow)</option>
                <option value="cave-spider">Cave Spider (Medium)</option>
                <option value="shadow-demon">Shadow Demon (Fast)</option>
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
      onTouchStart={handleTouchStart}
    >
      {gameState && (
        <Stage
          width={ABYSSAL_WELL_CONFIG.gameWidth}
          height={ABYSSAL_WELL_CONFIG.gameHeight}
          scale={{ x: scale, y: scale }}
        >
          <Layer>
            <Rect
              x={0}
              y={0}
              width={ABYSSAL_WELL_CONFIG.gameWidth}
              height={ABYSSAL_WELL_CONFIG.gameHeight}
              fill="#0f172a"
            />
            
            <Rect
              x={0}
              y={0}
              width={ABYSSAL_WELL_CONFIG.gameWidth}
              height={50}
              fill="rgba(0,0,0,0.5)"
            />
            
            <Text
              x={10}
              y={15}
              text={gameState.sentence.translation}
              fontSize={getEffectiveTextSize(16)}
              fill="#94a3b8"
              width={ABYSSAL_WELL_CONFIG.gameWidth - 20}
              align="center"
            />
            
            <Text
              x={10}
              y={70}
              text={`Target: ${targetWord}`}
              fontSize={getEffectiveTextSize(18)}
              fill="#22d3ee"
              width={ABYSSAL_WELL_CONFIG.gameWidth - 20}
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
                y={17}
                text={`❤️ ${gameState.player.lives}`}
                fontSize={getEffectiveTextSize(16)}
                fill="#f87171"
              />
            </Group>
            
            {Array.from({ length: ABYSSAL_WELL_CONFIG.wellDepth }).map((_, i) => {
              const depth = (i + 1) / ABYSSAL_WELL_CONFIG.wellDepth
              const radius = 20 + (1 - depth) * (ABYSSAL_WELL_CONFIG.rimRadius * 2 - 20)
              const y = ABYSSAL_WELL_CONFIG.gameHeight - ABYSSAL_WELL_CONFIG.rimRadius - 50 - (1 - depth) * (ABYSSAL_WELL_CONFIG.gameHeight - 150)
              
              return (
                <Circle
                  key={`ring-${i}`}
                  x={ABYSSAL_WELL_CONFIG.gameWidth / 2}
                  y={y}
                  radius={radius}
                  stroke={`rgba(34, 211, 238, ${0.1 + depth * 0.2})`}
                  strokeWidth={1}
                />
              )
            })}
            
            {gameState.projectiles.map(proj => {
              const pos = getLanePosition(proj.lane, proj.depth)
              return (
                <Circle
                  key={proj.id}
                  x={pos.x}
                  y={pos.y}
                  radius={6}
                  fill="#22d3ee"
                />
              )
            })}
            
            {gameState.enemies.map(enemy => {
              const pos = getLanePosition(enemy.lane, enemy.depth)
              const size = 12 + enemy.depth * 8
              const isTarget = enemy.wordIndex === gameState.targetIndex
              
              return (
                <Group key={enemy.id}>
                  <Circle
                    x={pos.x}
                    y={pos.y}
                    radius={size}
                    fill={isTarget ? '#fbbf24' : '#7c3aed'}
                    stroke={isTarget ? '#fde047' : '#a855f7'}
                    strokeWidth={2}
                  />
                  <Text
                    x={pos.x - 30}
                    y={pos.y - 8}
                    text={enemy.word}
                    fontSize={getEffectiveTextSize(16)}
                    fill="white"
                    width={60}
                    align="center"
                  />
                </Group>
              )
            })}
            
            {(() => {
              const playerPos = getLanePosition(gameState.player.lane, 1)
              return (
                <Group>
                  <Circle
                    x={playerPos.x}
                    y={playerPos.y}
                    radius={15}
                    fill="#06b6d4"
                    stroke="#22d3ee"
                    strokeWidth={3}
                  />
                  <Text
                    x={playerPos.x - 10}
                    y={playerPos.y - 6}
                    text="🔥"
                    fontSize={getEffectiveTextSize(18)}
                  />
                </Group>
              )
            })()}
          </Layer>
        </Stage>
      )}
      
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 text-sm text-white/50">
        <span>← → Rotate</span>
        <span>Space = Fire</span>
      </div>
    </div>
  )
}
