'use client'

import React, { useCallback, useState, useEffect } from 'react'
import { Stage, Layer, Rect, Text, Group, Circle } from 'react-konva'
import {
  createSlimeState,
  tickSlime,
  moveSlime,
  type SlimeState,
  type Difficulty,
  ARENA_WIDTH,
  ARENA_HEIGHT,
} from '@/lib/games/devourerSlime'
import type { VocabularyItem } from '@/store/useGameStore'
import { useInterval } from '@/hooks/useInterval'
import { useDirectionalInput } from '@/hooks/useDirectionalInput'
import { useSound } from '@/hooks/useSound'
import { useGameFullscreen } from '@/hooks/useGameFullscreen'
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'
import { GameStartScreen } from '@/components/games/game/GameStartScreen'
import { GameEndScreen } from '@/components/games/game/GameEndScreen'
import { Move, Zap, Target, Shield } from 'lucide-react'

const VIEWPORT_WIDTH = 390
const VIEWPORT_HEIGHT = 844

interface DevourerSlimeGameProps {
  sentences: VocabularyItem[]
  difficulty?: Difficulty
  onComplete: (state: SlimeState) => void
}

export function DevourerSlimeGame({ sentences, difficulty = 'medium', onComplete }: DevourerSlimeGameProps) {
  const [gameState, setGameState] = useState<SlimeState | null>(null)
  const [gamePhase, setGamePhase] = useState<'start' | 'playing' | 'ended'>('start')
  const { input, setVirtualInput } = useDirectionalInput()
  const { playSound } = useSound()
  const { getEffectiveTouchTarget } = useAccessibilitySettings()
  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen()

  const [grassPatches] = useState(() => 
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * ARENA_WIDTH,
      y: Math.random() * ARENA_HEIGHT,
      size: Math.random() * 10 + 5,
      opacity: Math.random() * 0.2 + 0.1
    }))
  )

  const handleStart = useCallback(() => {
    const initialState = createSlimeState(sentences, { difficulty })
    setGameState(initialState)
    setGamePhase('playing')
    enterFullscreen()
  }, [sentences, difficulty, enterFullscreen])

  const handleRestart = useCallback(() => {
    setGamePhase('start')
    setGameState(null)
  }, [])

  const endGame = useCallback((finalState: SlimeState) => {
    exitFullscreen()
    setGamePhase('ended')
    onComplete(finalState)
  }, [onComplete, exitFullscreen])

  // Sound effects
  useEffect(() => {
    if (gameState?.lastEvent) {
      switch (gameState.lastEvent) {
        case 'correct':
        case 'eat_enemy':
          playSound('success')
          break
        case 'incorrect':
        case 'hit':
          playSound('error')
          break
        case 'victory':
          playSound('success')
          break
        case 'defeat':
          playSound('error')
          break
      }
    }
  }, [gameState?.lastEvent, playSound])

  useInterval(() => {
    if (gameState && gameState.phase === 'playing') {
      let nextState = { ...gameState }

      // Handle Input
      if (input.dx !== 0 || input.dy !== 0) {
        nextState = moveSlime(nextState, input.dx, input.dy, 16.6)
      }

      const tickedState = tickSlime(nextState, 16.6)
      if (tickedState.phase !== 'playing') {
        endGame(tickedState)
      }
      setGameState(tickedState)
    }
  }, gameState?.phase === 'playing' ? 16.6 : null)

  // Calculate off-screen indicators for orbs and enemies
  const getIndicators = useCallback(() => {
    if (!gameState) return []
    const indicators: { x: number; y: number; label: string; color: string }[] = []
    
    const cameraX = Math.max(0, Math.min(ARENA_WIDTH - VIEWPORT_WIDTH, gameState.slime.pos.x - VIEWPORT_WIDTH / 2))
    const cameraY = Math.max(0, Math.min(ARENA_HEIGHT - VIEWPORT_HEIGHT, gameState.slime.pos.y - VIEWPORT_HEIGHT / 2))
    
    // Target orb indicator
    const targetOrb = gameState.orbs.find(o => !o.isEaten && o.index === gameState.targetWordIndex)
    if (targetOrb) {
      const screenX = targetOrb.pos.x - cameraX
      const screenY = targetOrb.pos.y - cameraY
      if (screenX < 0 || screenX > VIEWPORT_WIDTH || screenY < 0 || screenY > VIEWPORT_HEIGHT) {
        indicators.push({
          x: Math.max(20, Math.min(VIEWPORT_WIDTH - 20, screenX)),
          y: Math.max(20, Math.min(VIEWPORT_HEIGHT - 20, screenY)),
          label: targetOrb.word,
          color: '#fbbf24'
        })
      }
    }
    
    return indicators
  }, [gameState])

  if (gamePhase === 'start') {
    return (
      <div ref={containerRef} className="relative h-screen w-full overflow-hidden bg-emerald-950">
        <GameStartScreen
          gameTitle="Devourer Slime"
          gameSubtitle="Eat words, grow big, devour knights!"
          icon={Zap}
          vocabulary={sentences}
          instructions={[
            { step: 1, text: "Move with WASD / Arrow Keys or Virtual D-Pad", icon: Move },
            { step: 2, text: "Eat word orbs in the correct sentence order", icon: Target },
            { step: 3, text: "Grow bigger to devour enemy knights", icon: Shield }
          ]}
          controls={[
            { label: "Move", keys: "WASD / Arrows", color: "bg-emerald-500" },
            { label: "Dash", keys: "Shift", color: "bg-blue-500" }
          ]}
          startButtonText="START DEVOURING"
          onStart={handleStart}
        />
      </div>
    )
  }

  if (gamePhase === 'ended' && gameState) {
    const accuracy = gameState.totalAttempts > 0
      ? Math.round((gameState.correctAnswers / gameState.totalAttempts) * 100)
      : 0
    return (
      <div ref={containerRef} className="relative h-screen w-full overflow-hidden bg-emerald-950">
        <GameEndScreen
          status={gameState.phase === 'victory' ? 'victory' : 'defeat'}
          score={gameState.score}
          xp={Math.floor(gameState.correctAnswers * (gameState.totalAttempts > 0 ? gameState.correctAnswers / gameState.totalAttempts : 0))}
          accuracy={accuracy}
          onRestart={handleRestart}
          gameId="devourer-slime"
          gameName="Devourer Slime"
          showLeaderboardLink
        />
      </div>
    )
  }

  if (!gameState) return null

  const currentSentence = gameState.sentences[gameState.currentSentenceIndex]
  const words = currentSentence?.term.split(' ') || []

  // Camera logic: Center on Slime
  const cameraX = Math.max(0, Math.min(ARENA_WIDTH - VIEWPORT_WIDTH, gameState.slime.pos.x - VIEWPORT_WIDTH / 2))
  const cameraY = Math.max(0, Math.min(ARENA_HEIGHT - VIEWPORT_HEIGHT, gameState.slime.pos.y - VIEWPORT_HEIGHT / 2))

  const indicators = getIndicators()
  const dpadSize = getEffectiveTouchTarget(64)
  const dpadScale = dpadSize / 64

  return (
    <div ref={containerRef} className="relative h-screen w-full overflow-hidden bg-emerald-950 touch-none">
      {/* HUD: Translation */}
      <div className="absolute top-6 left-0 right-0 z-10 px-6">
        <div className="bg-emerald-950/40 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-4 text-center">
          <p className="text-emerald-200 text-xs font-bold uppercase tracking-widest mb-1 opacity-70">Translation</p>
          <p className="text-white text-xl font-medium">{currentSentence?.translation}</p>
          <div className="mt-3 flex justify-center gap-1">
            {words.map((w, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < gameState.targetWordIndex ? 'w-6 bg-emerald-400' : 
                  i === gameState.targetWordIndex ? 'w-8 bg-amber-400 animate-pulse' : 'w-4 bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* HUD: Status */}
      <div className="absolute top-36 left-6 z-10 flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
          <span className="text-red-400">❤️</span>
          <div className="flex gap-1">
            {Array.from({ length: gameState.maxLives }).map((_, i) => (
              <div key={i} className={`w-3 h-3 rounded-full ${i < gameState.lives ? 'bg-red-500' : 'bg-slate-800'}`} />
            ))}
          </div>
        </div>
        <div className="bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10 text-xs font-bold text-emerald-300 tracking-tighter uppercase">
          Score: {gameState.score}
        </div>
        <div className="bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10 text-xs font-bold text-blue-300 tracking-tighter uppercase">
          Size: {(gameState.slime.scale * 100).toFixed(0)}%
        </div>
      </div>

      {/* Off-screen Indicators */}
      {indicators.map((ind, i) => (
        <div
          key={i}
          className="absolute z-20 pointer-events-none"
          style={{
            left: ind.x,
            top: ind.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="bg-amber-500/80 text-black text-xs font-bold px-2 py-1 rounded-full animate-pulse">
            {ind.label}
          </div>
        </div>
      ))}

      <Stage width={VIEWPORT_WIDTH} height={VIEWPORT_HEIGHT}>
        <Layer x={-cameraX} y={-cameraY}>
          {/* Forest Floor */}
          <Rect width={ARENA_WIDTH} height={ARENA_HEIGHT} fill="#064e3b" />
          {grassPatches.map(patch => (
            <Circle 
              key={patch.id} 
              x={patch.x} 
              y={patch.y} 
              radius={patch.size} 
              fill="#065f46" 
              opacity={patch.opacity} 
            />
          ))}

          {/* Word Orbs */}
          {gameState.orbs.filter(o => !o.isEaten).map(orb => (
            <Group key={orb.id} x={orb.pos.x} y={orb.pos.y}>
              <Circle 
                radius={orb.radius} 
                fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                fillRadialGradientStartRadius={0}
                fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                fillRadialGradientEndRadius={orb.radius}
                fillRadialGradientColorStops={[0, '#fde047', 1, '#ca8a04']}
                shadowBlur={15}
                shadowColor="#eab308"
              />
              <Text 
                text={orb.word} 
                fill="white" 
                fontSize={16} 
                fontStyle="bold"
                align="center" 
                verticalAlign="middle"
                width={orb.radius * 2} 
                height={orb.radius * 2}
                x={-orb.radius} 
                y={-orb.radius}
                shadowBlur={5}
                shadowColor="black"
              />
            </Group>
          ))}

          {/* Knight Enemies */}
          {gameState.enemies.map(enemy => (
            <Group key={enemy.id} x={enemy.pos.x} y={enemy.pos.y}>
                {/* Knight body */}
                <Rect 
                x={-enemy.radius/2} 
                y={-enemy.radius/2} 
                width={enemy.radius} 
                height={enemy.radius} 
                fill="#94a3b8" 
                cornerRadius={5}
                stroke="#475569"
                strokeWidth={2}
              />
              {/* Helmet */}
              <Rect 
                x={-enemy.radius/2} 
                y={-enemy.radius/2} 
                width={enemy.radius} 
                height={enemy.radius/3} 
                fill="#1e293b" 
              />
              {/* Eyes */}
              <Circle x={-5} y={-enemy.radius/4} radius={2} fill="red" />
              <Circle x={5} y={-enemy.radius/4} radius={2} fill="red" />
              
              {/* Danger circle if larger than slime */}
              {enemy.radius >= gameState.slime.radius && (
                <Circle radius={enemy.radius + 5} stroke="#ef4444" strokeWidth={1} dash={[5, 5]} />
              )}
            </Group>
          ))}

          {/* Slime */}
          <Group x={gameState.slime.pos.x} y={gameState.slime.pos.y}>
            {/* Slime body - wobbly circle */}
            <Circle 
              radius={gameState.slime.radius} 
              fill={gameState.lastEvent === 'hit' || gameState.lastEvent === 'incorrect' ? '#ef4444' : gameState.slime.color} 
              opacity={0.6}
              stroke="white"
              strokeWidth={2}
              shadowBlur={20}
              shadowColor={gameState.slime.color}
            />
            <Circle 
              radius={gameState.slime.radius * 0.8} 
              fill={gameState.slime.color} 
              opacity={0.4}
            />
            
            {/* Eyes */}
            <Group y={-gameState.slime.radius * 0.2}>
              <Circle x={-gameState.slime.radius * 0.3} radius={gameState.slime.radius * 0.15} fill="white" />
              <Circle x={gameState.slime.radius * 0.3} radius={gameState.slime.radius * 0.15} fill="white" />
              <Circle x={-gameState.slime.radius * 0.3} radius={gameState.slime.radius * 0.08} fill="black" />
              <Circle x={gameState.slime.radius * 0.3} radius={gameState.slime.radius * 0.08} fill="black" />
            </Group>
          </Group>
        </Layer>
      </Stage>

      {/* Virtual DPad */}
      <div className="absolute bottom-10 left-10 z-10 pointer-events-none">
        <div className="grid grid-cols-3 gap-2 pointer-events-auto" style={{ transform: `scale(${dpadScale})`, transformOrigin: 'bottom left' }}>
          <div />
          <button 
            onPointerDown={() => setVirtualInput(v => ({ ...v, dy: -1 }))}
            onPointerUp={() => setVirtualInput(v => ({ ...v, dy: 0 }))}
            onPointerLeave={() => setVirtualInput(v => ({ ...v, dy: 0 }))}
            className="w-16 h-16 rounded-2xl bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 flex items-center justify-center text-emerald-300 active:bg-emerald-500/40"
          >
            <Move className="rotate-0" />
          </button>
          <div />
          <button 
            onPointerDown={() => setVirtualInput(v => ({ ...v, dx: -1 }))}
            onPointerUp={() => setVirtualInput(v => ({ ...v, dx: 0 }))}
            onPointerLeave={() => setVirtualInput(v => ({ ...v, dx: 0 }))}
            className="w-16 h-16 rounded-2xl bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 flex items-center justify-center text-emerald-300 active:bg-emerald-500/40"
          >
            <Move className="-rotate-90" />
          </button>
          <button 
            onPointerDown={() => setVirtualInput(v => ({ ...v, dy: 1 }))}
            onPointerUp={() => setVirtualInput(v => ({ ...v, dy: 0 }))}
            onPointerLeave={() => setVirtualInput(v => ({ ...v, dy: 0 }))}
            className="w-16 h-16 rounded-2xl bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 flex items-center justify-center text-emerald-300 active:bg-emerald-500/40"
          >
            <Move className="rotate-180" />
          </button>
          <button 
            onPointerDown={() => setVirtualInput(v => ({ ...v, dx: 1 }))}
            onPointerUp={() => setVirtualInput(v => ({ ...v, dx: 0 }))}
            onPointerLeave={() => setVirtualInput(v => ({ ...v, dx: 0 }))}
            className="w-16 h-16 rounded-2xl bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 flex items-center justify-center text-emerald-300 active:bg-emerald-500/40"
          >
            <Move className="rotate-90" />
          </button>
        </div>
      </div>
    </div>
  )
}
