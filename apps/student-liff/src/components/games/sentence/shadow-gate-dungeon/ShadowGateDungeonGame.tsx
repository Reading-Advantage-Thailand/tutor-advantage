'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Text, Group, Rect, Circle, Line } from 'react-konva'
import {
  createShadowGateDungeonState,
  tickShadowGateDungeon,
  setPlayerVelocity,
  calculateXP,
  type ShadowGateDungeonState,
} from '@/lib/games/shadowGateDungeon'
import { GAME_WIDTH, GAME_HEIGHT, SHADOW_GATE_DUNGEON_CONFIG } from '@/lib/games/shadowGateDungeonConfig'
import type { VocabularyItem } from '@/store/useGameStore'
import type { Difficulty } from '@/store/useGameStore'
import type { CreatureType } from '@/lib/games/shadowGateDungeonConfig'
import { useGameFullscreen } from '@/hooks/useGameFullscreen'
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'
import { GameEndScreen } from '@/components/games/game/GameEndScreen'
import { GameStartScreen } from '@/components/games/game/GameStartScreen'
import { VirtualDPad } from '@/components/games/ui/VirtualDPad'
import { Castle, BookOpen, AlertTriangle, Heart, Clock, Eye } from 'lucide-react'

export type ShadowGateDungeonGameResult = {
  xp: number
  accuracy: number
}

interface ShadowGateDungeonGameProps {
  vocabulary: VocabularyItem[]
  onComplete: (results: ShadowGateDungeonGameResult) => void
}

export function ShadowGateDungeonGame({ vocabulary, onComplete }: ShadowGateDungeonGameProps) {
  const { getEffectiveTextSize } = useAccessibilitySettings()
  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen()

  const [gameState, setGameState] = useState<ShadowGateDungeonState | null>(null)
  const [gamePhase, setGamePhase] = useState<'start' | 'playing' | 'ended'>('start')
  const [results, setResults] = useState<ShadowGateDungeonGameResult | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('normal')
  const [selectedCreature, setSelectedCreature] = useState<CreatureType>('orc-hunter')
  const hasReportedRef = useRef(false)
  const pressedKeysRef = useRef<Set<string>>(new Set())

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const resetGame = useCallback(() => {
    if (vocabulary.length > 0) {
      setGameState(createShadowGateDungeonState(vocabulary, {
        difficulty: selectedDifficulty,
        creatureType: selectedCreature,
      }))
      setResults(null)
      hasReportedRef.current = false
    }
  }, [vocabulary, selectedDifficulty, selectedCreature])

  useEffect(() => {
    if (vocabulary.length > 0 && gamePhase === 'start') {
      resetGame()
    }
  }, [vocabulary, gamePhase, resetGame])

  // Fullscreen handling
  useEffect(() => {
    if (gamePhase === 'playing') {
      enterFullscreen()
    } else if (gamePhase === 'ended') {
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

  const lastFrameRef = useRef<number>(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (gamePhase !== 'playing') return

    const loop = (timestamp: number) => {
      const delta = lastFrameRef.current ? timestamp - lastFrameRef.current : 16
      lastFrameRef.current = timestamp
      const clampedDelta = Math.min(delta, 50) // cap at 50ms to avoid huge jumps
      setGameState(prevState => {
        if (!prevState || prevState.status !== 'playing') return prevState
        return tickShadowGateDungeon(prevState, clampedDelta)
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
    if (gameState?.status === 'victory' || gameState?.status === 'defeat') {
      if (gamePhase !== 'ended') {
        const accuracy = gameState.correctAnswers + gameState.wrongAnswers > 0
          ? gameState.correctAnswers / (gameState.correctAnswers + gameState.wrongAnswers)
          : 0
        const xp = calculateXP(gameState)
        setResults({ xp, accuracy })
        setGamePhase('ended')
      }
    }
  }, [gameState?.status, gamePhase, gameState])

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
    if (gameState && gameState.status === 'playing' && gamePhase === 'playing') {
      setGameState(prevState => {
        if (!prevState || prevState.status !== 'playing') return prevState
        return setPlayerVelocity(prevState, { x: input.dx, y: input.dy })
      })
    }
  }, [gameState, gamePhase])

  useEffect(() => {
    const keysRef = pressedKeysRef

    const computeVelocity = () => {
      const keys = keysRef.current
      let dx = 0, dy = 0
      if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) dx = -1
      if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) dx = 1
      if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) dy = -1
      if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) dy = 1
      handleDPadInput({ dx, dy })
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (gamePhase !== 'playing') return
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'A', 'd', 'D', 'w', 'W', 's', 'S'].includes(e.key)) {
        e.preventDefault()
        keysRef.current.add(e.key)
        computeVelocity()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (gamePhase !== 'playing') return
      keysRef.current.delete(e.key)
      computeVelocity()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      keysRef.current.clear()
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [gamePhase, handleDPadInput])

  if (gamePhase === 'start') {
    return (
      <div
        ref={containerRef}
        className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto"
      >
        <GameStartScreen
          gameTitle="Shadow Gate Dungeon"
          gameSubtitle="Escape the Darkness"
          vocabulary={vocabulary}
          instructions={[
            { step: 1, text: 'Collect word crystals in the correct order to unlock the exit gate.', icon: BookOpen },
            { step: 2, text: 'The creature patrols a circular path — stay outside its detection ring to avoid being chased.', icon: Eye },
            { step: 3, text: 'Avoid the shadow creature! Wrong words and collisions drain your health.', icon: AlertTriangle },
          ]}
          proTip="The creature turns RED when it spots you. Grab crystals while it patrols away!"
          controls={[
            { label: 'Move', keys: 'Arrow Keys / WASD', color: 'bg-purple-500' },
            { label: 'DPad', keys: 'Touch & Drag', color: 'bg-indigo-500' },
          ]}
          startButtonText="Enter the Dungeon"
          icon={Castle}
          onStart={() => {
            resetGame()
            setGamePhase('playing')
          }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-white/50">Difficulty:</span>
              <select
                aria-label="Difficulty"
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value as Difficulty)}
                className="bg-slate-800 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="easy">Dark Cell</option>
                <option value="normal">Forgotten Crypt</option>
                <option value="hard">Abyssal Chamber</option>
                <option value="extreme">Abyssal Depths</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-white/50">Opponent:</span>
              <select
                aria-label="Opponent"
                value={selectedCreature}
                onChange={(e) => setSelectedCreature(e.target.value as CreatureType)}
                className="bg-slate-800 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="goblin-scout">Goblin Scout (Slow)</option>
                <option value="orc-hunter">Orc Hunter (Medium)</option>
                <option value="shadow-dragon">Shadow Dragon (Fast)</option>
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
                  fill="#1a0a2e"
                />

                <Rect
                  x={0}
                  y={0}
                  width={GAME_WIDTH}
                  height={GAME_HEIGHT}
                  fill="url(#dungeonGradient)"
                />

                <Line
                  points={[0, 80, GAME_WIDTH, 80]}
                  stroke="#3d3d5c"
                  strokeWidth={2}
                />

                <Group>
                  <Rect
                    x={gameState.gate.position.x}
                    y={gameState.gate.position.y}
                    width={gameState.gate.width}
                    height={gameState.gate.height}
                    fill={gameState.gate.unlocked ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)'}
                    stroke={gameState.gate.unlocked ? '#22c55e' : '#ef4444'}
                    strokeWidth={3}
                    cornerRadius={8}
                  />
                  <Text
                    x={gameState.gate.position.x + 5}
                    y={gameState.gate.position.y + 8}
                    text={gameState.currentSentence.translation}
                    fontSize={getEffectiveTextSize(16)}
                    fill="white"
                    fontStyle="bold"
                    width={gameState.gate.width - 10}
                    align="center"
                    wrap="word"
                  />
                </Group>

                {gameState.crystals.filter(c => !c.collected).map(crystal => {
                  const isTarget = crystal.word === gameState.words[gameState.targetIndex]
                  return (
                    <Group key={crystal.id} x={crystal.position.x} y={crystal.position.y}>
                      <Circle
                        x={0}
                        y={0}
                        radius={SHADOW_GATE_DUNGEON_CONFIG.crystalRadius}
                        fill={isTarget ? 'rgba(255, 215, 0, 0.8)' : 'rgba(0, 255, 255, 0.7)'}
                        stroke={isTarget ? '#ffd700' : '#00ffff'}
                        strokeWidth={isTarget ? 4 : 2}
                      />
                      <Text
                        x={-SHADOW_GATE_DUNGEON_CONFIG.crystalRadius}
                        y={-8}
                        text={crystal.word}
                        fontSize={getEffectiveTextSize(16)}
                        fill="white"
                        fontStyle="bold"
                        width={SHADOW_GATE_DUNGEON_CONFIG.crystalRadius * 2}
                        align="center"
                      />
                    </Group>
                  )
                })}

                {/* Sight radius indicator — shows detection zone */}
                <Circle
                  x={gameState.creature.position.x}
                  y={gameState.creature.position.y}
                  radius={SHADOW_GATE_DUNGEON_CONFIG.sightRadius}
                  fill={gameState.creature.mode === 'chase' ? 'rgba(239,68,68,0.08)' : 'rgba(147,51,234,0.06)'}
                  stroke={gameState.creature.mode === 'chase' ? 'rgba(239,68,68,0.4)' : 'rgba(147,51,234,0.2)'}
                  strokeWidth={1}
                  dash={[6, 4]}
                />
                <Group x={gameState.creature.position.x} y={gameState.creature.position.y}>
                  <Circle
                    x={0}
                    y={0}
                    radius={SHADOW_GATE_DUNGEON_CONFIG.creatureRadius}
                    fill={gameState.creature.mode === 'chase' ? 'rgba(220, 38, 38, 0.95)' : 'rgba(74, 0, 128, 0.9)'}
                    stroke={gameState.creature.mode === 'chase' ? '#ef4444' : '#9333ea'}
                    strokeWidth={3}
                  />
                  <Circle x={-4} y={-3} radius={2.5} fill={gameState.creature.mode === 'chase' ? '#ffff00' : '#ff0000'} />
                  <Circle x={4} y={-3} radius={2.5} fill={gameState.creature.mode === 'chase' ? '#ffff00' : '#ff0000'} />
                  {gameState.creature.mode === 'chase' && (
                    <Text x={-8} y={-24} text="!" fontSize={getEffectiveTextSize(16)} fill="#ef4444" fontStyle="bold" />
                  )}
                </Group>

                <Group x={gameState.player.position.x} y={gameState.player.position.y}>
                  <Circle
                    x={0}
                    y={0}
                    radius={SHADOW_GATE_DUNGEON_CONFIG.playerRadius}
                    fill={gameState.player.invincible ? 'rgba(100, 149, 237, 0.5)' : '#4a90d9'}
                    stroke={gameState.player.invincible ? '#87ceeb' : '#1e40af'}
                    strokeWidth={3}
                  />
                  <Circle x={0} y={0} radius={5} fill="#87ceeb" />
                </Group>

                <Group x={10} y={GAME_HEIGHT - 30}>
                  <Rect
                    x={0}
                    y={0}
                    width={GAME_WIDTH - 20}
                    height={20}
                    fill="rgba(0, 0, 0, 0.5)"
                    cornerRadius={10}
                  />
                  <Rect
                    x={0}
                    y={0}
                    width={(gameState.player.health / SHADOW_GATE_DUNGEON_CONFIG.initialHealth) * (GAME_WIDTH - 20)}
                    height={20}
                    fill={gameState.player.health > 50 ? '#22c55e' : gameState.player.health > 25 ? '#eab308' : '#ef4444'}
                    cornerRadius={10}
                  />
                  <Text
                    x={GAME_WIDTH / 2 - 30}
                    y={4}
                    text={`HP: ${gameState.player.health}`}
                    fontSize={getEffectiveTextSize(16)}
                    fill="white"
                    fontStyle="bold"
                  />
                </Group>

                <Text
                  x={10}
                  y={GAME_HEIGHT - 55}
                  text={`Words: ${gameState.collectedWords.length}/${gameState.words.length}`}
                  fontSize={getEffectiveTextSize(16)}
                  fill="white"
                  fontStyle="bold"
                />

                <Text
                  x={10}
                  y={GAME_HEIGHT - 75}
                  text={gameState.collectedWords.join(' ')}
                  fontSize={getEffectiveTextSize(16)}
                  fill="#a5b4fc"
                  fontStyle="bold"
                  width={GAME_WIDTH - 20}
                />

                <Text
                  x={GAME_WIDTH - 80}
                  y={GAME_HEIGHT - 55}
                  text={`Time: ${Math.floor(gameState.gameTime / 1000)}s`}
                  fontSize={getEffectiveTextSize(16)}
                  fill="white"
                />

                {/* Stealth status */}
                <Text
                  x={10}
                  y={GAME_HEIGHT - 95}
                  text={gameState.creature.mode === 'chase' ? '⚠ DETECTED!' : '👁 Undetected'}
                  fontSize={getEffectiveTextSize(16)}
                  fill={gameState.creature.mode === 'chase' ? '#ef4444' : '#a5b4fc'}
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
          status={gameState.status === 'victory' ? 'victory' : 'defeat'}
          title={gameState.status === 'victory' ? 'Escaped!' : 'Captured!'}
          subtitle={gameState.status === 'victory' ? 'You found the way out!' : 'The shadows consumed you...'}
          score={gameState.correctAnswers * 10}
          xp={results.xp}
          accuracy={results.accuracy}
          customStats={[
            { label: 'Words Collected', value: gameState.correctAnswers, icon: BookOpen },
            { label: 'Time', value: `${Math.floor(gameState.gameTime / 1000)}s`, icon: Clock },
            { label: 'Health Left', value: gameState.player.health, icon: Heart },
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
