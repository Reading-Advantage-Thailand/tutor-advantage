"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Stage, Layer, Rect, Text, Circle, Group } from "react-konva";
import {
  createArchersRevengeState,
  tickArchersRevenge,
  fireArrow,
  calculateXP,
  GAME_WIDTH,
  GAME_HEIGHT,
  type ArchersRevengeState,
  type ArchersRevengeResults,
} from "@/lib/games/archersRevenge";
import { ARCHERS_REVENGE_CONFIG } from "@/lib/games/archersRevengeConfig";
import type { VocabularyItem, Difficulty } from "@/store/useGameStore";
import { GameStartScreen } from "@/components/games/game/GameStartScreen";
import { GameEndScreen } from "@/components/games/game/GameEndScreen";
import { useGameFullscreen } from "@/hooks/useGameFullscreen";
import { useAccessibilitySettings } from "@/hooks/useAccessibilitySettings";
import { Target, Shield, Zap, Sword, Heart, Clock, Award } from "lucide-react";

type ArchersRevengeGameProps = {
  vocabulary: VocabularyItem[];
  onComplete?: (results: ArchersRevengeResults) => void;
};

export function ArchersRevengeGame({
  vocabulary,
  onComplete,
}: ArchersRevengeGameProps) {
  const [gameState, setGameState] = useState<ArchersRevengeState | null>(null);
  const [gamePhase, setGamePhase] = useState<"start" | "playing" | "ended">("start");
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>("normal");
  
  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen();
  const { getEffectiveTextSize } = useAccessibilitySettings();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const lastFrameRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const hasReportedRef = useRef(false);
  const gameStateRef = useRef<ArchersRevengeState | null>(null);

  const startGame = useCallback(() => {
    try {
      const state = createArchersRevengeState(vocabulary, { difficulty: selectedDifficulty });
      setGameState(state);
      setGamePhase("playing");
      hasReportedRef.current = false;
      lastFrameRef.current = 0;
    } catch (error) {
      console.error("Failed to start game:", error);
    }
  }, [vocabulary, selectedDifficulty]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) setDimensions({ width, height });
    };

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    updateDimensions();

    return () => observer.disconnect();
  }, [containerRef]);

  useEffect(() => {
    if (gamePhase === "playing") {
      enterFullscreen();
    } else {
      exitFullscreen();
    }
  }, [gamePhase, enterFullscreen, exitFullscreen]);

  useEffect(() => {
    if (gamePhase !== "playing") return;

    const loop = (timestamp: number) => {
      const delta = lastFrameRef.current ? timestamp - lastFrameRef.current : 16;
      lastFrameRef.current = timestamp;
      const clampedDelta = Math.min(delta, 50);

      setGameState((prevState) => {
        if (!prevState || prevState.status !== "playing") return prevState;
        return tickArchersRevenge(prevState, clampedDelta);
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = 0;
    };
  }, [gamePhase]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (gameState?.status === "defeat") {
      setGamePhase("ended");
    }
  }, [gameState?.status, setGamePhase]);

  useEffect(() => {
    if (gamePhase === "ended" && gameStateRef.current && !hasReportedRef.current) {
      hasReportedRef.current = true;
      const state = gameStateRef.current;
      const accuracy = state.totalAttempts > 0 
        ? state.correctAnswers / state.totalAttempts 
        : 0;
      const xp = calculateXP(state);
      onComplete?.({
        score: Math.floor(state.score),
        accuracy,
        xp,
        correctAnswers: state.correctAnswers,
        totalAttempts: state.totalAttempts,
        wavesCompleted: state.wave,
        timeTaken: Math.floor(state.gameTime / 1000),
        difficulty: state.difficulty,
      });
    }
  }, [gamePhase, onComplete]);

  const scale = useMemo(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return 1;
    return Math.min(dimensions.width / GAME_WIDTH, dimensions.height / GAME_HEIGHT);
  }, [dimensions]);

  const handleStageClick = useCallback((e: KonvaEventObject<MouseEvent | TouchEvent | Event>) => {
    if (gamePhase !== "playing") return;
    const stage = e.target.getStage();
    const pointerPosition = stage?.getPointerPosition();
    if (pointerPosition) {
      const x = pointerPosition.x / scale;
      setGameState(prev => prev ? fireArrow(prev, x) : null);
    }
  }, [gamePhase, scale]);

  if (gamePhase === "start") {
    return (
      <div ref={containerRef} className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto">
        <GameStartScreen
          gameTitle="Archer's Revenge"
          gameSubtitle="Defend the Realm"
          vocabulary={vocabulary}
          instructions={[
            { step: 1, text: "Target word is shown at the top. Find the enemy with the matching translation.", icon: Target },
            { step: 2, text: "Tap a column to fire an arrow. Only the enemy with their SHIELD DOWN is vulnerable.", icon: Shield },
            { step: 3, text: "Don't hit shielded enemies! They will shoot back and damage your HP.", icon: Zap },
          ]}
          proTip="The target changes every few seconds. Keep an eye on the top text!"
          controls={[
            { label: "Shoot", keys: "Tap / Click", color: "bg-amber-500" },
          ]}
          startButtonText="Draw Your Bow"
          icon={Sword}
          onStart={startGame}
        >
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-400" style={{ fontSize: getEffectiveTextSize(16) }}>Difficulty:</span>
            <div className="flex gap-2">
              {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDifficulty(d)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors min-h-[44px] min-w-[44px] ${
                    selectedDifficulty === d
                      ? "bg-amber-500 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </GameStartScreen>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto">
      {gamePhase === "playing" && gameState && (
        <>
          <Stage
            width={dimensions.width}
            height={dimensions.height}
            onClick={handleStageClick}
            onTap={handleStageClick}
          >
            <Layer scaleX={scale} scaleY={scale}>
              {/* Background */}
              <Rect x={0} y={0} width={GAME_WIDTH} height={GAME_HEIGHT} fill="#0f172a" />
              
              {/* HUD */}
              <Group y={20}>
                <Rect x={20} y={0} width={GAME_WIDTH - 40} height={80} fill="rgba(30, 41, 59, 0.8)" cornerRadius={12} stroke="#334155" strokeWidth={2} />
                <Text
                  x={GAME_WIDTH / 2}
                  y={15}
                  text={gameState.targetWord.term}
                  fontSize={32}
                  fontStyle="bold"
                  fill="#fbbf24"
                  align="center"
                  width={GAME_WIDTH}
                  offsetX={GAME_WIDTH / 2}
                />
                <Text
                  x={GAME_WIDTH / 2}
                  y={55}
                  text="Target Translation"
                  fontSize={getEffectiveTextSize(16)}
                  fill="#94a3b8"
                  align="center"
                  width={GAME_WIDTH}
                  offsetX={GAME_WIDTH / 2}
                />
              </Group>

              {/* Stats */}
              <Group y={110}>
                <Text x={30} y={0} text={`HP: ${gameState.hp}/${gameState.maxHp}`} fontSize={18} fontStyle="bold" fill="#ef4444" />
                <Text x={GAME_WIDTH - 120} y={0} text={`Score: ${Math.floor(gameState.score)}`} fontSize={18} fontStyle="bold" fill="#22c55e" align="right" width={90} />
                <Text x={GAME_WIDTH / 2 - 40} y={0} text={`Wave ${gameState.wave}`} fontSize={18} fontStyle="bold" fill="#3b82f6" align="center" width={80} />
              </Group>

              {/* Enemies */}
              {gameState.enemies.map((enemy) => (
                <Group key={enemy.id} x={enemy.x} y={enemy.y}>
                  <Circle
                    radius={22}
                    fill={enemy.shieldUp ? "#334155" : "#059669"}
                    stroke={enemy.shieldUp ? "#475569" : "#10b981"}
                    strokeWidth={enemy.shieldUp ? 2 : 4}
                    shadowBlur={enemy.shieldUp ? 0 : 15}
                    shadowColor="#10b981"
                  />
                  {!enemy.shieldUp && (
                    <Circle radius={28} stroke="#10b981" strokeWidth={2} opacity={0.5} />
                  )}
                  <Text
                    x={-40}
                    y={25}
                    text={enemy.translation}
                    fontSize={getEffectiveTextSize(16)}
                    fontStyle="bold"
                    fill="white"
                    width={80}
                    align="center"
                  />
                </Group>
              ))}

              {/* Arrows */}
              {gameState.arrows.map((arrow) => (
                <Rect
                  key={arrow.id}
                  x={arrow.x - 2}
                  y={arrow.y}
                  width={4}
                  height={20}
                  fill="#fbbf24"
                  cornerRadius={2}
                />
              ))}

              {/* Enemy Projectiles */}
              {gameState.enemyProjectiles.map((proj) => (
                <Circle
                  key={proj.id}
                  x={proj.x}
                  y={proj.y}
                  radius={6}
                  fill="#ef4444"
                  shadowBlur={10}
                  shadowColor="#ef4444"
                />
              ))}

              {/* Player */}
              <Group x={gameState.playerX} y={ARCHERS_REVENGE_CONFIG.layout.playerY}>
                <Text x={-15} y={-15} text="🏹" fontSize={30} />
              </Group>

              {/* Target Timer Progress */}
              <Rect
                x={20}
                y={102}
                width={(gameState.targetChangeTimer / (ARCHERS_REVENGE_CONFIG.targetChangeInterval[gameState.difficulty] || 7000)) * (GAME_WIDTH - 40)}
                height={4}
                fill="#fbbf24"
                cornerRadius={2}
              />
            </Layer>
          </Stage>
        </>
      )}

      {gamePhase === "ended" && gameState && (
        <GameEndScreen
          status={gameState.status === "victory" ? "victory" : "defeat"}
          title={gameState.status === "victory" ? "Champion Archer!" : "Wall Breached!"}
          subtitle={gameState.status === "victory" ? "The realm is safe... for now." : "The monsters have overrun the defense."}
          score={Math.floor(gameState.score)}
          xp={calculateXP(gameState)}
          accuracy={gameState.totalAttempts > 0 ? gameState.correctAnswers / gameState.totalAttempts : 0}
          customStats={[
            { label: "Correct", value: gameState.correctAnswers, icon: Target },
            { label: "Wave", value: gameState.wave, icon: Award },
            { label: "Time", value: `${Math.floor(gameState.gameTime / 1000)}s`, icon: Clock },
            { label: "Health", value: `${gameState.hp}/${gameState.maxHp}`, icon: Heart },
          ]}
          onRestart={() => {
            setGamePhase("start");
            setGameState(null);
          }}
          onExit={() => {
            window.location.href = "/student/games";
          }}
        />
      )}
    </div>
  );
}
