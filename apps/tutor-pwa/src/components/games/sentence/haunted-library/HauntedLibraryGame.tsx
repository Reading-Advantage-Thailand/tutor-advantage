'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Stage, Layer, Rect, Text, Group, Circle } from 'react-konva'
import {
  createLibraryState,
  tickLibrary,
  calculateXP,
  GAME_WIDTH,
  GAME_HEIGHT,
  TRAMPOLINE_HEIGHT,
  type LibraryState,
} from '@/lib/games/hauntedLibrary'
import type { VocabularyItem } from '@/store/useGameStore'
import { useSound } from '@/hooks/useSound'
import { useDirectionalInput } from '@/hooks/useDirectionalInput'
import { useGameFullscreen } from '@/hooks/useGameFullscreen'
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'
import { VirtualDPad } from '@/lib/games-runtime'
import { GameEndScreen } from '@/components/games/game/GameEndScreen'
import { GameStartScreen } from '@/components/games/game/GameStartScreen'
import { Book, DoorOpen, Sparkles, Zap, AlertTriangle } from 'lucide-react'
import { tx } from '@/lib/games/gameText'
import { computeLetterbox } from '@/lib/games/letterbox'

/**
 * Host-injectable navigation contract (Phase 5 Decision 5.1, D-09).
 *
 * `onNavigate` is provided by the host shell in imported-app contexts.
 * When present, the exit control on the `GameEndScreen` delegates to
 * `onNavigate('exit')` instead of using the host-relative `<Link>`
 * fallback. When absent (standalone advantage-games), the component keeps
 * its existing host-relative `<Link href="/">` behavior so the standalone
 * app is not broken.
 */
export type NavigateTarget = 'back' | 'exit' | 'games'

/**
 * Game-completion payload shape — mirrors `GameCompletionInputSchema` from
 * `@reading-advantage/domain/games`. The XP field is intentionally absent:
 * XP is server-computed (`calculateGameXP`). The idempotencyKey is generated
 * once per session and held in a ref so React re-renders and the game-over
 * path share the same key (B28-017 / B30-002 fire-once defense).
 */
type HauntedLibraryCompletionPayload = {
  gameType: 'haunted-library'
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme'
  score: number
  accuracy: number
  correctAnswers: number
  totalAttempts: number
  duration: number
  victory: boolean
  idempotencyKey: string
  clientTimestamp: number
}

interface HauntedLibraryGameProps {
  sentences: VocabularyItem[]
  onComplete: (results: HauntedLibraryCompletionPayload) => void
  /**
   * Optional host-injected navigation callback. When provided, the
   * exit control on the game-end screen calls `onNavigate('exit')`
   * instead of the host-relative `<Link>` fallback. See
   * `phase-5-decisions.md` Decision 5.1.
   */
  onNavigate?: (target: NavigateTarget) => void
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID (e.g. older test runtimes).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function HauntedLibraryGame({ sentences, onComplete, onNavigate }: HauntedLibraryGameProps) {
  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen()
  const { getEffectiveTextSize } = useAccessibilitySettings()
  const [gameState, setGameState] = useState<LibraryState | null>(null)
  const [gamePhase, setGamePhase] = useState<'start' | 'playing' | 'ended'>('start')
  // The board is a fixed 390x844 design; fit it into whatever frame hosts the
  // game (phone: 1:1, wide student column / presenter: centred letterbox).
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      setFrameSize((prev) =>
        Math.round(prev.width) === Math.round(width) && Math.round(prev.height) === Math.round(height)
          ? prev
          : { width, height },
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [containerRef, gamePhase])
  const board = computeLetterbox(frameSize, { width: GAME_WIDTH, height: GAME_HEIGHT })
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const { playSound } = useSound()
  const { input, setVirtualInput } = useDirectionalInput()
  const lastFrameRef = useRef<number>(0)
  const rafRef = useRef<number>(0)
  /**
   * Synchronous flag updated inside `endGame` so the game-loop's RAF chain
   * stops scheduling itself as soon as the game reaches a terminal phase.
   * Using a ref (not state) because the loop reads it inside the RAF
   * callback and we need the latest value without waiting for a re-render.
   * This also makes the loop cancellation test-friendly: the jsdom RAF
   * mock does not honor `cancelAnimationFrame`, so the loop must
   * self-terminate via this flag instead of relying on the cleanup path.
   */
  const isLoopActiveRef = useRef<boolean>(false)
  // Stable per-session UUID used as the fire-once idempotency key for the
  // shared `recordGameCompletion` contract (B28-017 / B30-002).
  const idempotencyKeyRef = useRef<string>('')

  if (!idempotencyKeyRef.current) {
    idempotencyKeyRef.current = generateIdempotencyKey()
  }

  /**
   * Exit handler for the `GameEndScreen`. When `onNavigate` is provided
   * (host shell), delegate the navigation to the host. Otherwise fall
   * back to the host-relative `<Link>` in `GameEndScreen` (standalone
   * advantage-games path).
   */
  const handleExit = useCallback(() => {
    if (onNavigate) {
      onNavigate('exit')
    }
  }, [onNavigate])

  const startGame = useCallback(() => {
    if (sentences.length > 0) {
      setGameState(createLibraryState(sentences, { difficulty }))
      setGamePhase('playing')
    }
  }, [sentences, difficulty])

  /**
   * Restart handler for the `GameEndScreen`. Returns the user to the start
   * screen so they can adjust difficulty (or just kick off another run).
   * The session-level `idempotencyKey` ref is preserved across the
   * restart so the next game-over carries the same key — this is the
   * fire-once contract preserved from Phase 3/4 (B28-017 / B30-002).
   */
  const handleRestart = useCallback(() => {
    setGamePhase('start')
    setGameState(null)
    lastFrameRef.current = 0
    isLoopActiveRef.current = false
  }, [])

  const endGame = useCallback((finalState: LibraryState) => {
    // Stop the RAF chain synchronously. The jsdom RAF mock does not honor
    // `cancelAnimationFrame`, so the loop must self-terminate.
    isLoopActiveRef.current = false
    setGamePhase('ended')
    const accuracy =
      finalState.totalAttempts > 0
        ? finalState.correctAnswers / finalState.totalAttempts
        : 0
    const payload: HauntedLibraryCompletionPayload = {
      gameType: 'haunted-library',
      difficulty: finalState.difficulty,
      score: finalState.score,
      accuracy,
      correctAnswers: finalState.correctAnswers,
      totalAttempts: finalState.totalAttempts,
      duration: finalState.time,
      victory: finalState.phase === 'victory',
      idempotencyKey: idempotencyKeyRef.current,
      clientTimestamp: Date.now(),
    }
    onComplete(payload)
  }, [onComplete])

  // Game Loop with requestAnimationFrame.
  //
  // Exactly one requestAnimationFrame is scheduled per frame, from the loop
  // itself, never from inside the setGameState updater: React may run an
  // updater more than once (Strict Mode / concurrent rendering), and each run
  // scheduled another frame, so the pending callbacks doubled every frame
  // (~2M rAF requests/s after a few seconds) and the tab froze. The loop stops
  // when endGame clears isLoopActiveRef (synchronously, so a RAF mock that
  // ignores cancelAnimationFrame still terminates).
  useEffect(() => {
    if (gamePhase !== 'playing') {
      isLoopActiveRef.current = false
      return
    }

    isLoopActiveRef.current = true
    // Per-effect flag: an input change restarts the loop, and a frame queued
    // by the previous run must not keep a second loop alive.
    let active = true

    const loop = (timestamp: number) => {
      if (!active || !isLoopActiveRef.current) {
        return
      }
      const delta = lastFrameRef.current ? timestamp - lastFrameRef.current : 16
      lastFrameRef.current = timestamp
      const clampedDelta = Math.min(delta, 50)

      setGameState(prev => {
        if (!prev || prev.phase !== 'playing') {
          return prev
        }
        return tickLibrary(prev, clampedDelta, { dx: input.dx, dy: input.dy })
      })

      if (active && isLoopActiveRef.current) {
        rafRef.current = requestAnimationFrame(loop)
      }
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      active = false
      isLoopActiveRef.current = false
      cancelAnimationFrame(rafRef.current)
      lastFrameRef.current = 0
    }
  }, [gamePhase, input.dx, input.dy])

  // End the game once a tick leaves the 'playing' phase (kept out of the
  // state updater so it runs once per game, not once per updater call).
  useEffect(() => {
    if (gamePhase === 'playing' && gameState && gameState.phase !== 'playing') {
      endGame(gameState)
    }
  }, [gamePhase, gameState, endGame])

  // Fullscreen handling
  useEffect(() => {
    if (gamePhase === 'playing') {
      enterFullscreen()
    } else if (gamePhase === 'ended' || gamePhase === 'start') {
      exitFullscreen()
    }
  }, [gamePhase, enterFullscreen, exitFullscreen])

  useEffect(() => {
    if (gameState?.lastEvent) {
      switch (gameState.lastEvent) {
        case 'correct': playSound('success'); break
        case 'incorrect': playSound('error'); break
        case 'damage': playSound('error'); break
        case 'victory': playSound('success'); break
        case 'defeat': playSound('error'); break
      }
    }
  }, [gameState?.lastEvent, playSound])

  if (gamePhase === 'start') {
    return (
      <div className="absolute inset-0 z-50 bg-slate-950" ref={containerRef}>
        <GameStartScreen
          gameTitle={tx("The Haunted Library")}
          gameSubtitle={tx("A Spooky Word Adventure")}
          vocabulary={sentences}
          onStart={startGame}
          icon={Book}
          instructions={[
            { step: 1, text: tx("Explore the library floors using the DPad or Arrow Keys."), icon: Sparkles },
            { step: 2, text: tx("Bounce on the orange trampolines at the edges to reach higher floors."), icon: Zap },
            { step: 3, text: tx("Open doors by pressing UP when nearby to collect the next word."), icon: DoorOpen },
            { step: 4, text: tx("Avoid ghosts and bats! Slamming a door on a ghost will stun it."), icon: AlertTriangle }
          ]}
          proTip={tx("Collecting words in the correct order is key to purifying the library!")}
          controls={[
            { label: tx("Move"), keys: tx("Arrow Keys / WASD"), color: "bg-blue-500" },
            { label: tx("Open Door"), keys: tx("Up Arrow / W"), color: "bg-green-500" },
            { label: tx("Bounce"), keys: tx("Move to Edges"), color: "bg-orange-500" }
          ]}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm uppercase tracking-wider text-white/50" style={{ fontSize: getEffectiveTextSize(16) }}>{tx("Difficulty:")}</span>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
              className="bg-slate-800 border border-white/20 rounded-lg px-3 py-1.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ fontSize: getEffectiveTextSize(16) }}
            >
              <option value="easy">{tx("Novice Scholarly")}</option>
              <option value="medium">{tx("Master Archivist")}</option>
              <option value="hard">{tx("Forbidden Knowledge")}</option>
            </select>
          </div>
        </GameStartScreen>
      </div>
    )
  }


  if (gamePhase === 'ended' && gameState) {
    return (
      <div ref={containerRef} className="absolute inset-0 z-50">
        <GameEndScreen
          status={gameState.phase === 'victory' ? 'victory' : 'defeat'}
          score={gameState.score}
          xp={calculateXP(gameState)}
          accuracy={gameState.totalAttempts > 0 ? gameState.correctAnswers / gameState.totalAttempts : 0}
          onRestart={handleRestart}
          onExit={handleExit}
          title={tx("The Haunted Library")}
        />
      </div>
    )
  }


  if (!gameState) return null

  return (
    <div ref={containerRef} className="relative h-full min-h-[400px] w-full overflow-hidden bg-slate-900">
      <Stage width={frameSize.width || GAME_WIDTH} height={frameSize.height || GAME_HEIGHT}>
        <Layer x={board.x} y={board.y} scaleX={board.scale} scaleY={board.scale}>
          {/* Background */}
          <Rect width={GAME_WIDTH} height={GAME_HEIGHT} fill="#1a1a2e" />

          {/* Floors */}
          {gameState.floors.map((floor, i) => (
            <React.Fragment key={i}>
              <Rect
                x={0}
                y={floor.y}
                width={GAME_WIDTH}
                height={floor.height}
                fill="#4a4a4a"
              />
              {/* Trampolines at edges */}
              <Rect
                x={0}
                y={floor.y - TRAMPOLINE_HEIGHT}
                width={40}
                height={TRAMPOLINE_HEIGHT}
                fill="#ff4500"
                cornerRadius={[4, 4, 0, 0]}
              />
              <Rect
                x={GAME_WIDTH - 40}
                y={floor.y - TRAMPOLINE_HEIGHT}
                width={40}
                height={TRAMPOLINE_HEIGHT}
                fill="#ff4500"
                cornerRadius={[4, 4, 0, 0]}
              />
            </React.Fragment>
          ))}

          {/* Doors */}
          {gameState.doors.map((door) => (
            <Group key={door.id} x={door.x} y={door.y}>
              <Rect
                width={60}
                height={80}
                fill={door.isOpen ? (door.isCorrect ? "#22c55e" : "#ef4444") : "#8b4513"}
                stroke="#5d2e0a"
                strokeWidth={2}
                cornerRadius={2}
              />
              {door.isOpen && door.word && (
                <Text
                  text={door.word}
                  fontSize={getEffectiveTextSize(16)}
                  fontStyle="bold"
                  fill="white"
                  width={60}
                  align="center"
                  y={30}
                />
              )}
            </Group>
          ))}

          {/* Ghosts */}
          {gameState.ghosts.map((ghost) => (
            <Group key={ghost.id} x={ghost.x} y={ghost.y}>
              <Circle
                radius={24}
                x={24}
                y={24}
                fill={ghost.state === 'stunned' ? "rgba(200, 200, 255, 0.4)" : "rgba(100, 150, 255, 0.6)"}
                stroke={ghost.state === 'stunned' ? "#999" : "#fff"}
                strokeWidth={1}
              />
              {ghost.state === 'stunned' && (
                <Text
                  text={tx("ZZZ")}
                  fontSize={getEffectiveTextSize(16)}
                  fill="white"
                  x={10}
                  y={-10}
                />
              )}
            </Group>
          ))}

          {/* Bats */}
          {gameState.bats.map((bat) => (
            <Rect
              key={bat.id}
              x={bat.x}
              y={bat.y}
              width={bat.width}
              height={bat.height}
              fill="#ef4444"
              cornerRadius={16}
            />
          ))}

          {/* Player */}
          <Rect
            x={gameState.player.x}
            y={gameState.player.y}
            width={gameState.player.width}
            height={gameState.player.height}
            fill="#3b82f6"
            cornerRadius={4}
            stroke="#fff"
            strokeWidth={2}
          />
        </Layer>
      </Stage>

      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-black/50 text-white backdrop-blur-sm">
        <div className="text-center font-bold mb-2" style={{ fontSize: getEffectiveTextSize(20) }}>
          {gameState.currentSentence.translation}
        </div>
        <div className="flex justify-between items-center" style={{ fontSize: getEffectiveTextSize(16) }}>
          <div className="flex gap-4">
            <span className="flex items-center gap-1 font-bold">
              <Book className="w-4 h-4 text-blue-400" /> {gameState.lives}
            </span>
            <span className="font-bold">{tx("Score:")} {gameState.score}</span>
          </div>
          <div className="flex gap-1">
            {gameState.words.map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${i < gameState.nextWordIndex ? 'bg-green-500' : 'bg-slate-700'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-0 right-0 pointer-events-none">
        <VirtualDPad onInput={setVirtualInput} />
      </div>
    </div>
  )
}