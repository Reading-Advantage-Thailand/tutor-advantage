'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Text, Group, Rect, Circle, Line, Ring, Image as KonvaImage } from 'react-konva'
import {
  createDungeonLiberatorState,
  advanceDungeonLiberatorTime,
  advanceToNextLevel,
  calculateDungeonLiberatorXP,
  GAME_WIDTH,
  GAME_HEIGHT,
  PLAYER_RADIUS,
  PRISONER_RADIUS,
  MONSTER_RADIUS,
  PORTAL_RADIUS,
  type DungeonLiberatorState,
  type SentenceItem,
} from '@/lib/games/dungeonLiberator'
import { calculateIndicators } from '@/lib/games/dungeonLiberatorIndicators'
import { useDirectionalInput } from '@/hooks/useDirectionalInput'
import { useGameFullscreen } from '@/hooks/useGameFullscreen'
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'
import { VirtualDPad } from '@/components/ui/VirtualDPad'
import { GameEndScreen } from '@/components/games/game/GameEndScreen'
import { GameStartScreen } from '@/components/games/game/GameStartScreen'
import { Shield, Sword, Users, AlertTriangle } from 'lucide-react'
import { withBasePath } from '@/lib/basePath'

const SPRITE_SIZE = {
  player: 48,
  prisoner: 40,
  slime: 48,
}

function loadSprite(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = withBasePath(src)
    img.onload = () => resolve(img)
    img.onerror = reject
  })
}

export type DungeonLiberatorGameResult = {
  xp: number
  accuracy: number
  difficulty: string
}

interface DungeonLiberatorGameProps {
  vocabulary: SentenceItem[]
  onComplete: (results: DungeonLiberatorGameResult) => void
}

export function DungeonLiberatorGame({ vocabulary, onComplete }: DungeonLiberatorGameProps) {
  const { input, setVirtualInput } = useDirectionalInput()
  const { getEffectiveTouchTarget, getEffectiveTextSize } = useAccessibilitySettings()
  const [gameState, setGameState] = useState<DungeonLiberatorState | null>(null)
  const [gamePhase, setGamePhase] = useState<'start' | 'playing' | 'ended'>('start')
  const [results, setResults] = useState<DungeonLiberatorGameResult | null>(null)
  const hasReportedRef = useRef(false)

  const [assets, setAssets] = useState<{
    background: HTMLImageElement
    player: HTMLImageElement
    prisoner: HTMLImageElement
    slime: HTMLImageElement
  } | null>(null)
  const [animFrame, setAnimFrame] = useState(0)

  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')

  // Camera state (scrolling viewport)
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 })

  // Fullscreen
  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen()

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // rAF refs
  const rafRef = useRef<number>(0)
  const lastFrameRef = useRef<number>(0)
  const gameStateRef = useRef(gameState)
  const inputRef = useRef(input)
  const assetsRef = useRef(assets)
  const animTimerRef = useRef<number>(0)

  useEffect(() => { gameStateRef.current = gameState }, [gameState])
  useEffect(() => { inputRef.current = input }, [input])
  useEffect(() => { assetsRef.current = assets }, [assets])

  // Calculate off-screen indicators
  const indicators = useMemo(
    () =>
      gameState && dimensions.width > 0
        ? calculateIndicators(gameState.prisoners, camera, dimensions)
        : [],
    [gameState, camera, dimensions]
  )

  // Asset loading
  useEffect(() => {
    const load = async () => {
      const [background, player, prisoner, slime] = await Promise.all([
        loadSprite('/games/sentence/dungeon-liberator/background.png'),
        loadSprite('/games/sentence/dungeon-liberator/player-sheet.png'),
        loadSprite('/games/sentence/dungeon-liberator/prisoner-sheet.png'),
        loadSprite('/games/sentence/dungeon-liberator/slime-sheet.png'),
      ])
      setAssets({ background, player, prisoner, slime })
    }
    load()
  }, [])

  // Animation frames
  useEffect(() => {
    if (gamePhase === 'playing') {
      const interval = setInterval(() => {
        setAnimFrame(f => (f + 1) % 3)
      }, 200)
      return () => clearInterval(interval)
    }
  }, [gamePhase])

  const resetGame = useCallback(() => {
    if (vocabulary.length > 0) {
      setGameState(createDungeonLiberatorState(vocabulary, { difficulty }))
      setResults(null)
      setTotalXP(0)
      setTotalCorrect(0)
      hasReportedRef.current = false
    }
  }, [vocabulary, difficulty])

  useEffect(() => {
    if (vocabulary.length > 0 && gamePhase === 'start') {
      resetGame()
    }
  }, [vocabulary, gamePhase, resetGame])

  // Dimension tracking
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

  const [totalXP, setTotalXP] = useState(0)
  const [totalCorrect, setTotalCorrect] = useState(0)

  // Animation frame counter using rAF
  useEffect(() => {
    if (gamePhase !== 'playing') return
    let frame = 0
    let lastAnim = 0
    const animLoop = (ts: number) => {
      if (ts - lastAnim >= 200) {
        lastAnim = ts
        frame = (frame + 1) % 3
        setAnimFrame(frame)
      }
      animTimerRef.current = requestAnimationFrame(animLoop)
    }
    animTimerRef.current = requestAnimationFrame(animLoop)
    return () => cancelAnimationFrame(animTimerRef.current)
  }, [gamePhase])

  // Game loop with requestAnimationFrame
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing' || gamePhase !== 'playing') return

    const loop = (timestamp: number) => {
      const delta = lastFrameRef.current ? timestamp - lastFrameRef.current : 16.67
      lastFrameRef.current = timestamp
      const clampedDelta = Math.min(delta, 50)

      const prevState = gameStateRef.current
      if (!prevState || prevState.phase !== 'playing') {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      const currentInput = inputRef.current
      const nextState = advanceDungeonLiberatorTime(prevState, clampedDelta, { dx: currentInput.dx, dy: currentInput.dy })

      if (nextState.phase === 'victory') {
        const levelXP = calculateDungeonLiberatorXP(nextState)

        setTotalXP(prev => prev + levelXP)
        setTotalCorrect(prev => prev + nextState.correctWords)

        const nextLevelState = advanceToNextLevel(nextState, vocabulary)
        setGameState(nextLevelState)
        gameStateRef.current = nextLevelState
      } else if (nextState.phase === 'defeat') {
        const finalTotalCorrect = totalCorrect + nextState.correctWords
        const finalTotalAttempts = nextState.totalAttempts
        const finalAccuracy = finalTotalAttempts > 0 ? finalTotalCorrect / finalTotalAttempts : 0
        const finalResults = { xp: totalXP, accuracy: finalAccuracy, difficulty }
        setResults(finalResults)
        if (!hasReportedRef.current) {
          onComplete(finalResults)
          hasReportedRef.current = true
        }

        setGamePhase('ended')
        exitFullscreen()
      } else {
        setGameState(nextState)
        gameStateRef.current = nextState
      }

      // Update camera — follow player, clamp to world bounds
      if (dimensions.width > 0 && dimensions.height > 0) {
        const scaleY = dimensions.height / GAME_HEIGHT
        const scale = Math.max(scaleY, 0.8)

        let camX = dimensions.width / 2 - nextState.player.x * scale
        let camY = dimensions.height / 2 - nextState.player.y * scale

        const minX = dimensions.width - GAME_WIDTH * scale
        const minY = dimensions.height - GAME_HEIGHT * scale

        if (minX > 0) camX = (dimensions.width - GAME_WIDTH * scale) / 2
        else camX = Math.max(minX, Math.min(0, camX))

        if (minY > 0) camY = (dimensions.height - GAME_HEIGHT * scale) / 2
        else camY = Math.max(minY, Math.min(0, camY))

        setCamera({ x: camX, y: camY, scale })
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    lastFrameRef.current = 0
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, gameState?.phase, dimensions.width, dimensions.height, vocabulary, difficulty, totalXP, onComplete, exitFullscreen])

  if (gamePhase === 'start') {
    return (
      <div
        ref={containerRef}
        className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto"
      >
        <GameStartScreen
          gameTitle="Dungeon Liberator"
          gameSubtitle="Rescue the Prisoners"
          vocabulary={vocabulary}
          instructions={[
            { step: 1, text: 'Collect prisoners in the correct word order to build your rescue party.', icon: Users },
            { step: 2, text: 'Wrong prisoner? They panic and flee. Monster hits your trail? The tail gets cut off!', icon: AlertTriangle },
            { step: 3, text: 'Guide everyone to the exit portal to complete the sentence and escape!', icon: Shield },
          ]}
          proTip="Read the Thai translation at the top to figure out which word comes next. Monsters get faster each level!"
          controls={[
            { label: 'Move', keys: 'Arrows / WASD', color: 'bg-amber-500' },
          ]}
          startButtonText="Enter the Dungeon"
          icon={Sword}
          onStart={() => {
            resetGame()
            setGamePhase('playing')
            enterFullscreen()
          }}
        >
          <div className="flex gap-1 bg-slate-900/80 p-1 rounded-lg border border-white/10">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-3 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-colors ${
                  difficulty === d
                    ? 'bg-amber-500 text-slate-900'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
                style={{ minHeight: getEffectiveTouchTarget(44), minWidth: getEffectiveTouchTarget(44) }}
              >
                {d}
              </button>
            ))}
          </div>
        </GameStartScreen>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{ minHeight: '400px' }}
      className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto fullscreen:h-screen fullscreen:rounded-none"
    >
      {gamePhase === 'playing' && gameState && (
        <>
          {/* HUD — Lives, Rescued, Level */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 text-white font-bold text-lg pointer-events-none drop-shadow-md">
            <div className="flex items-center gap-2">
              Lives: {Array(gameState.player.maxLives).fill(0).map((_, i) => (
                <span key={i} className={i < gameState.player.lives ? "text-red-400" : "text-white/30"}>❤️</span>
              ))}
            </div>
            <div className="text-sm text-amber-400">
              Rescued: {gameState.trail.length} / {gameState.words.length}
            </div>
            <div className="text-sm text-purple-400">
              Level: {gameState.level}
            </div>
          </div>

          {/* Sentence progress bar */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-black/70 px-6 py-3 rounded-xl border border-white/20 backdrop-blur-sm pointer-events-none max-w-[90%]">
            <div className="text-white/70 text-xs mb-1 text-center">{gameState.sentence.translation}</div>
            <div className="flex flex-wrap gap-2 justify-center min-h-[28px]">
              {gameState.trail.map((segment) => (
                <span
                  key={segment.id}
                  className="px-2 py-1 rounded text-sm font-bold bg-emerald-500/30 text-emerald-300"
                >
                  {segment.word}
                </span>
              ))}
            </div>
          </div>

          {/* Off-screen prisoner indicators - CSS transform only, no layout reflow */}
          {indicators.map((ind) => (
            <div
              key={`ind-${ind.prisoner.id}`}
              className="absolute z-10 flex items-center justify-center pointer-events-none"
              style={{
                transform: `translate(${ind.x}px, ${ind.y}px) translate(-50%, -50%) rotate(${ind.rotation}deg)`,
              }}
            >
              <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[15px] border-b-amber-400 animate-pulse" />
            </div>
          ))}
          {/* Labels for off-screen indicators - CSS transform only */}
          {indicators.map((ind) => (
            <div
              key={`label-${ind.prisoner.id}`}
              className="absolute z-10 pointer-events-none text-xs font-bold text-white bg-black/60 px-2 py-1 rounded whitespace-nowrap shadow-lg border border-white/10"
              style={{
                transform: `translate(${ind.x}px, ${ind.y}px) translate(-50%, -50%) translate(${Math.cos((ind.rotation * Math.PI) / 180) * -35}px, ${Math.sin((ind.rotation * Math.PI) / 180) * -35}px)`,
              }}
            >
              {ind.prisoner.word}
            </div>
          ))}

          {/* Virtual D-Pad */}
          <div
            className="absolute bottom-8 right-8 z-20"
            style={{ transform: `scale(${getEffectiveTouchTarget(128) / 128})`, transformOrigin: 'bottom right' }}
          >
            <VirtualDPad onInput={setVirtualInput} />
          </div>

          {/* Canvas with camera transform */}
          <Stage width={dimensions.width} height={dimensions.height}>
            <Layer
              scaleX={camera.scale}
              scaleY={camera.scale}
              x={camera.x}
              y={camera.y}
            >
              {assets ? (
                <KonvaImage
                  image={assets.background}
                  x={0}
                  y={0}
                  width={GAME_WIDTH}
                  height={GAME_HEIGHT}
                />
              ) : (
                <Rect x={0} y={0} width={GAME_WIDTH} height={GAME_HEIGHT} fill="#1a1a2e" />
              )}

              {gameState.portal && (
                <Group x={gameState.portal.x} y={gameState.portal.y}>
                  <Ring
                    innerRadius={PORTAL_RADIUS - 10}
                    outerRadius={PORTAL_RADIUS + 10}
                    fill="#8b5cf6"
                    opacity={0.2}
                  />
                  <Circle
                    radius={PORTAL_RADIUS}
                    fill="#4c1d95"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    opacity={0.2}
                  />
                   <Text
                    text="EXIT"
                    fontSize={getEffectiveTextSize(16)}
                    fill="white"
                    fontStyle="bold"
                    offsetX={getEffectiveTextSize(16) * 0.75}
                    offsetY={getEffectiveTextSize(16) * 0.375}
                  />
                </Group>
              )}

              {gameState.prisoners
                .filter((p) => !p.collected)
                .map((prisoner) => {
                  const isWrong = prisoner.fleeing
                  return (
                    <Group key={prisoner.id} x={prisoner.x} y={prisoner.y}>
                      {assets ? (
                        <KonvaImage
                          image={assets.prisoner}
                          x={-SPRITE_SIZE.prisoner / 2}
                          y={-SPRITE_SIZE.prisoner / 2}
                          width={SPRITE_SIZE.prisoner}
                          height={SPRITE_SIZE.prisoner}
                          crop={{
                            x: isWrong ? 0 : animFrame * (assets.prisoner.width / 3),
                            y: isWrong ? assets.prisoner.height / 3 : 0,
                            width: assets.prisoner.width / 3,
                            height: assets.prisoner.height / 3,
                          }}
                          opacity={isWrong ? 0.5 : 1}
                        />
                      ) : (
                        <Circle
                          radius={PRISONER_RADIUS}
                          fill={isWrong ? '#ef4444' : '#64748b'}
                          stroke="#ffffff"
                          strokeWidth={1}
                          opacity={isWrong ? 0.5 : 1}
                        />
                      )}
                      <Text
                        text={prisoner.word}
                        fontSize={getEffectiveTextSize(16)}
                        fill="white"
                        fontStyle="bold"
                        offsetX={prisoner.word.length * getEffectiveTextSize(4)}
                        offsetY={getEffectiveTextSize(4)}
                        y={SPRITE_SIZE.prisoner / 2 + getEffectiveTextSize(4)}
                      />
                    </Group>
                  )
                })}

              {gameState.trail.map((segment, i) => {
                const prevX = i === 0 ? gameState.player.x : gameState.trail[i - 1].x
                const prevY = i === 0 ? gameState.player.y : gameState.trail[i - 1].y

                const ropePoints: number[] = []
                const ropeSegments = 3
                for (let j = 0; j <= ropeSegments; j++) {
                  const t = j / ropeSegments
                  ropePoints.push(
                    prevX + (segment.x - prevX) * t,
                    prevY + (segment.y - prevY) * t
                  )
                }

                return (
                  <Group key={segment.id}>
                    <Line
                      points={ropePoints}
                      stroke="#8b5a2b"
                      strokeWidth={4}
                      opacity={0.8}
                      lineCap="round"
                      lineJoin="round"
                    />
                    <Line
                      points={ropePoints}
                      stroke="#d4a574"
                      strokeWidth={2}
                      opacity={0.6}
                      lineCap="round"
                      lineJoin="round"
                    />
                    {assets ? (
                      <KonvaImage
                        image={assets.prisoner}
                        x={segment.x - SPRITE_SIZE.prisoner / 2}
                        y={segment.y - SPRITE_SIZE.prisoner / 2}
                        width={SPRITE_SIZE.prisoner}
                        height={SPRITE_SIZE.prisoner}
                        crop={{
                          x: 0,
                          y: 0,
                          width: assets.prisoner.width / 3,
                          height: assets.prisoner.height / 3,
                        }}
                      />
                    ) : (
                      <Circle
                        x={segment.x}
                        y={segment.y}
                        radius={12}
                        fill="#22c55e"
                        stroke="#86efac"
                        strokeWidth={2}
                      />
                    )}
                    <Text
                      text={segment.word}
                      fontSize={getEffectiveTextSize(16)}
                      fill="white"
                      fontStyle="bold"
                      offsetX={segment.word.length * getEffectiveTextSize(3)}
                      offsetY={getEffectiveTextSize(3)}
                      x={segment.x}
                      y={segment.y + SPRITE_SIZE.prisoner / 2 + getEffectiveTextSize(4)}
                    />
                  </Group>
                )})}

              {gameState.player && (
                <Group x={gameState.player.x} y={gameState.player.y}>
                  {assets ? (
                    <KonvaImage
                      image={assets.player}
                      x={-SPRITE_SIZE.player / 2}
                      y={-SPRITE_SIZE.player / 2}
                      width={SPRITE_SIZE.player}
                      height={SPRITE_SIZE.player}
                      crop={{
                        x: animFrame * (assets.player.width / 3),
                        y: 0,
                        width: assets.player.width / 3,
                        height: assets.player.height / 3,
                      }}
                      opacity={gameState.player.invulnerabilityTime > 0 ? 0.5 : 1}
                    />
                  ) : (
                    <Circle
                      radius={PLAYER_RADIUS}
                      fill={gameState.player.invulnerabilityTime > 0 ? '#60a5fa' : '#3b82f6'}
                      stroke="#93c5fd"
                      strokeWidth={3}
                    />
                  )}
                </Group>
              )}

              {gameState.monsters.map((monster) => (
                <Group key={monster.id} x={monster.x} y={monster.y}>
                  {assets ? (
                    <KonvaImage
                      image={assets.slime}
                      x={-SPRITE_SIZE.slime / 2}
                      y={-SPRITE_SIZE.slime / 2}
                      width={SPRITE_SIZE.slime}
                      height={SPRITE_SIZE.slime}
                      crop={{
                        x: animFrame * (assets.slime.width / 3),
                        y: 0,
                        width: assets.slime.width / 3,
                        height: assets.slime.height / 3,
                      }}
                    />
                  ) : (
                    <Circle
                      radius={MONSTER_RADIUS}
                      fill="#dc2626"
                      stroke="#fca5a5"
                      strokeWidth={2}
                    />
                  )}
                </Group>
              ))}
            </Layer>
          </Stage>
        </>
      )}

      {gamePhase === 'ended' && gameState && results && (
        <GameEndScreen
          status="defeat"
          title="Overwhelmed!"
          subtitle="The dungeon claimed another hero..."
          score={totalCorrect * 10}
          xp={results.xp}
          accuracy={results.accuracy}
          customStats={[
            { label: 'Words Rescued', value: totalCorrect, icon: Users },
            { label: 'Level Reached', value: gameState.level },
          ]}
          onRestart={() => {
            resetGame()
            setGamePhase('start')
          }}
          onExit={() => {
            exitFullscreen()
            window.location.href = '/'
          }}
        />
      )}
    </div>
  )
}
