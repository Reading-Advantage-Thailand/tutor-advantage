'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Text, Group, Rect, Circle } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import {
  createGriffinSkyJoustState,
  tickGriffinSkyJoust,
  flap,
  startGame,
  calculateXP,
  type GriffinSkyJoustState,
  type SentenceItem,
} from '@/lib/games/griffinSkyJoust'
import { GRIFFIN_SKY_JOUST_CONFIG } from '@/lib/games/griffinSkyJoustConfig'
import type { GriffinSkyJoustDifficulty } from '@/lib/games/griffinSkyJoustConfig'
import { GameEndScreen } from '@/components/games/game/GameEndScreen'
import { GameStartScreen } from '@/components/games/game/GameStartScreen'
import { useSound } from '@/hooks/useSound'
import { useGameFullscreen } from '@/hooks/useGameFullscreen'
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'
import { Bird, Shield, Sword } from 'lucide-react'

export type GriffinSkyJoustGameResult = {
  xp: number
  accuracy: number
}

interface GriffinSkyJoustGameProps {
  vocabulary: SentenceItem[]
  onComplete: (results: GriffinSkyJoustGameResult) => void
}

export function GriffinSkyJoustGame({ vocabulary, onComplete }: GriffinSkyJoustGameProps) {
  const { playSound } = useSound()
  const [gameState, setGameState] = useState<GriffinSkyJoustState | null>(null)
  const [gamePhase, setGamePhase] = useState<'start' | 'playing' | 'ended'>('start')
  const [results, setResults] = useState<GriffinSkyJoustGameResult | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<GriffinSkyJoustDifficulty>('medium')
  const hasReportedRef = useRef(false)
  const lastFrameRef = useRef<number>(0)
  const rafRef = useRef<number>(0)

  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen()
  const { getEffectiveTextSize } = useAccessibilitySettings()
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const resetGame = useCallback(() => {
    if (vocabulary.length > 0) {
      setGameState(createGriffinSkyJoustState(vocabulary, {
        difficulty: selectedDifficulty,
      }))
      setResults(null)
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
    updateDimensions()

    return () => {
      observer.disconnect()
    }
  }, [containerRef])

  useEffect(() => {
    if (gamePhase !== 'playing') return
    enterFullscreen()

    const loop = (timestamp: number) => {
      const delta = lastFrameRef.current ? timestamp - lastFrameRef.current : 16
      lastFrameRef.current = timestamp
      const clampedDelta = Math.min(delta, 50)
      
      setGameState(prevState => {
        if (!prevState || prevState.status !== 'playing') return prevState
        return tickGriffinSkyJoust(prevState, clampedDelta)
      })
      
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      lastFrameRef.current = 0
      exitFullscreen()
    }
  }, [gamePhase, enterFullscreen, exitFullscreen])

  const gameStateRef = useRef<GriffinSkyJoustState | null>(null)
  gameStateRef.current = gameState

  useEffect(() => {
    if (!gameStateRef.current) return
    const status = gameStateRef.current.status
    if (status === 'victory' || status === 'defeat') {
      if (gamePhase !== 'ended') {
        if (status === 'victory') playSound('success')
        else playSound('error')
        
        const accuracy = gameStateRef.current.totalAttempts > 0
          ? gameStateRef.current.correctAnswers / gameStateRef.current.totalAttempts
          : 0
        const xp = calculateXP(gameStateRef.current)
        setResults({ xp, accuracy })
        setGamePhase('ended')
      }
    }
  }, [gameState?.status, gamePhase, playSound])

  const prevCorrectCount = useRef(0)
  const prevHp = useRef(0)

  const correctAnswers = gameState?.correctAnswers ?? 0
  const playerHp = gameState?.player.hp ?? 0

  useEffect(() => {
    if (correctAnswers > prevCorrectCount.current) {
      playSound('cash-register') // collect sound
    }
    if (playerHp < prevHp.current) {
      playSound('angry-grunt') // hit sound
    }
    prevCorrectCount.current = correctAnswers
    prevHp.current = playerHp
  }, [correctAnswers, playerHp, playSound])

  useEffect(() => {
    if (gamePhase === 'ended' && results && !hasReportedRef.current) {
      hasReportedRef.current = true
      onComplete(results)
    }
  }, [gamePhase, results, onComplete])

  const scale = useMemo(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return 1
    return Math.min(dimensions.width / GRIFFIN_SKY_JOUST_CONFIG.gameWidth, dimensions.height / GRIFFIN_SKY_JOUST_CONFIG.gameHeight)
  }, [dimensions])

  const handleFlap = useCallback((e?: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (gamePhase !== 'playing') return
    
    playSound('bubbling') // Placeholder for flap sound

    let dir: -1 | 0 | 1 = 0
    if (e && e.target && e.target.getStage) {
      const stage = e.target.getStage()
      if (stage) {
        const pos = stage.getPointerPosition()
        if (pos) {
          const x = pos.x / scale
          dir = x < GRIFFIN_SKY_JOUST_CONFIG.gameWidth / 2 ? -1 : 1
        }
      }
    }

    setGameState(prevState => {
      if (!prevState || prevState.status !== 'playing') return prevState
      return flap(prevState, dir)
    })
  }, [gamePhase, scale, playSound])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gamePhase !== 'playing') return
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault()
        handleFlap()
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setGameState(prevState => prevState ? flap(prevState, -1) : null)
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setGameState(prevState => prevState ? flap(prevState, 1) : null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [gamePhase, handleFlap])

  if (gamePhase === 'start') {
    return (
      <div
        ref={containerRef}
        className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto"
      >
        <GameStartScreen
          gameTitle="Griffin Sky-Joust"
          gameSubtitle="Aerial Word Combat"
          vocabulary={vocabulary}
          instructions={[
            { step: 1, text: 'Tap to flap wings and gain altitude.', icon: Bird },
            { step: 2, text: 'Land ON TOP of enemy knights carrying the target word.', icon: Sword },
            { step: 3, text: 'Striking from below or hitting the wrong word costs a heart!', icon: Shield },
          ]}
          proTip="Use momentum to drift! Screen edges wrap around horizontally."
          controls={[
            { label: 'Flap', keys: 'Space / Tap', color: 'bg-cyan-500' },
            { label: 'Drift', keys: 'A/D or Tap Sides', color: 'bg-blue-500' },
          ]}
          startButtonText="Take Flight"
          icon={Bird}
          onStart={() => {
            if (gameState) {
              setGameState(startGame(gameState))
              setGamePhase("playing")
            }
          }}
        >
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-400">Difficulty:</span>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value as GriffinSkyJoustDifficulty)}
              className="bg-slate-800 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              <option value="easy">Fledgling (Low Gravity)</option>
              <option value="medium">Rider (Standard)</option>
              <option value="hard">Veteran (Heavy Gravity)</option>
            </select>
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
          status={gameState?.status === 'victory' ? 'victory' : 'defeat'}
          score={gameState?.score ?? 0}
          xp={results.xp}
          accuracy={results.accuracy}
          onRestart={() => {
            resetGame()
            setGamePhase('start')
          }}
          customStats={[
            { label: 'Words Joustred', value: gameState?.correctAnswers ?? 0 },
            { label: 'Hearts Left', value: gameState?.player.hp ?? 0 },
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
          width={dimensions.width}
          height={dimensions.height}
          onMouseDown={handleFlap}
          onTouchStart={handleFlap}
        >
          <Layer scaleX={scale} scaleY={scale}>
            {/* Sky Background */}
            <Rect
              x={0}
              y={0}
              width={GRIFFIN_SKY_JOUST_CONFIG.gameWidth}
              height={GRIFFIN_SKY_JOUST_CONFIG.gameHeight}
              fillLinearGradientStartPoint={{ x: 0, y: 0 }}
              fillLinearGradientEndPoint={{ x: 0, y: GRIFFIN_SKY_JOUST_CONFIG.gameHeight }}
              fillLinearGradientColorStops={[0, '#0ea5e9', 1, '#1e40af']}
            />
            
            {/* Parallax Clouds */}
            {[...Array(5)].map((_, i) => (
              <Circle
                key={`cloud-${i}`}
                x={((gameState.gameTime * (0.02 + i * 0.01)) % (GRIFFIN_SKY_JOUST_CONFIG.gameWidth + 100)) - 50}
                y={100 + i * 120}
                radius={30 + i * 10}
                fill="rgba(255,255,255,0.2)"
                shadowBlur={10}
                shadowColor="white"
              />
            ))}

            {/* Floating Islands */}
            {[...Array(3)].map((_, i) => (
              <Rect
                key={`island-${i}`}
                x={(100 + i * 150) % GRIFFIN_SKY_JOUST_CONFIG.gameWidth}
                y={150 + i * 200}
                width={60}
                height={20}
                fill="#4d7c0f"
                cornerRadius={10}
                opacity={0.6}
              />
            ))}
            {/* HUD */}
            <Rect
              x={0}
              y={0}
              width={GRIFFIN_SKY_JOUST_CONFIG.gameWidth}
              height={50}
              fill="rgba(0,0,0,0.3)"
            />
            <Text
              x={10}
              y={15}
              text={gameState.currentSentence.translation}
              fontSize={getEffectiveTextSize(16)}
              fill="white"
              width={GRIFFIN_SKY_JOUST_CONFIG.gameWidth - 20}
              align="center"
            />
            
            <Text
              x={10}
              y={60}
              text={`Target: ${targetWord}`}
              fontSize={getEffectiveTextSize(20)}
              fontStyle="bold"
              fill="#fbbf24"
              width={GRIFFIN_SKY_JOUST_CONFIG.gameWidth - 20}
              align="center"
            />

            {/* HP */}
            <Group x={10} y={10}>
              <Text
                text={`❤️ ${gameState.player.hp}`}
                fontSize={getEffectiveTextSize(16)}
                fill="#f87171"
                fontStyle="bold"
              />
            </Group>

            {/* Score */}
            <Group x={GRIFFIN_SKY_JOUST_CONFIG.gameWidth - 80} y={10}>
              <Text
                text={`Score: ${gameState.score}`}
                fontSize={getEffectiveTextSize(16)}
                fill="#fbbf24"
                align="right"
                width={70}
              />
            </Group>

            {/* Enemies */}
            {gameState.enemies.map(enemy => (
              <Group key={enemy.id} x={enemy.x} y={enemy.y}>
                <Circle
                  radius={enemy.radius}
                  fill={enemy.wordIndex === gameState.targetIndex ? '#fbbf24' : '#64748b'}
                  stroke="white"
                  strokeWidth={2}
                  shadowBlur={enemy.wordIndex === gameState.targetIndex ? 10 : 0}
                  shadowColor="#fbbf24"
                />
                <Text
                  x={-enemy.radius}
                  y={enemy.radius + 5}
                  text={enemy.word}
                  fontSize={getEffectiveTextSize(16)}
                  fill="white"
                  fontStyle="bold"
                  width={enemy.radius * 2}
                  align="center"
                />
                <Text
                  x={-10}
                  y={-10}
                  text="🏇"
                  fontSize={20}
                />
              </Group>
            ))}

            {/* Player Griffin */}
            <Group x={gameState.player.x} y={gameState.player.y}>
              <Circle
                radius={gameState.player.radius}
                fill={gameState.gameTime < gameState.player.invincibleUntil ? 'rgba(255,255,255,0.5)' : 'transparent'}
                stroke={gameState.gameTime < gameState.player.invincibleUntil ? '#ef4444' : '#38bdf8'}
                strokeWidth={3}
              />
              <Text
                x={-20}
                y={-20}
                text={gameState.player.vy < 0 ? "🦅" : "🦅"} // Change emoji for flap animation later
                fontSize={40}
                scaleX={gameState.player.vx < 0 ? -1 : 1}
              />
            </Group>
          </Layer>
        </Stage>
      )}
      
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 text-xs text-white/50">
        <span>Space/Tap = Flap</span>
        <span>A/D = Drift</span>
      </div>
    </div>
  )
}
