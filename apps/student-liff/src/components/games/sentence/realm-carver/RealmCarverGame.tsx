"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Circle, Group } from "react-konva";
import {
  createRealmCarverState,
  tickRealmCarver,
  calculateXP,
  type RealmCarverState,
  SentenceItem,
} from "@/lib/games/realmCarver";
import { GAME_WIDTH, GAME_HEIGHT, GRID_SIZE, REALM_CARVER_CONFIG } from "@/lib/games/realmCarverConfig";
import { GameStartScreen } from "@/components/games/game/GameStartScreen";
import { GameEndScreen } from "@/components/games/game/GameEndScreen";
import { Map as MapIcon, Shield, Target, Heart, Award } from "lucide-react";
import { useDirectionalInput } from "@/hooks/useDirectionalInput";
import { VirtualDPad } from "@/components/ui/VirtualDPad";
import { useSound } from "@/hooks/useSound";
import { useGameFullscreen } from "@/hooks/useGameFullscreen";
import { useAccessibilitySettings } from "@/hooks/useAccessibilitySettings";
import type { VocabularyItem } from "@/store/useGameStore";

interface RealmCarverGameProps {
  sentences: SentenceItem[];
  onComplete: (results: { xp: number; accuracy: number }) => void;
}

export function RealmCarverGame({ sentences, onComplete }: RealmCarverGameProps) {
  const [gameState, setGameState] = useState<RealmCarverState | null>(null);
  const [gamePhase, setGamePhase] = useState<"start" | "playing" | "ended">("start");
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const lastFrameRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const hasReportedRef = useRef(false);

  const { input, setVirtualInput } = useDirectionalInput();
  const { playSound } = useSound();
  const { enterFullscreen, exitFullscreen } = useGameFullscreen();
  const { getEffectiveTextSize } = useAccessibilitySettings();

  const startGame = useCallback(() => {
    try {
      const state = createRealmCarverState(sentences);
      setGameState(state);
      setGamePhase("playing");
      hasReportedRef.current = false;
      lastFrameRef.current = 0;
      playSound("success");
      enterFullscreen();
    } catch (error) {
      console.error("Failed to start game:", error);
    }
  }, [sentences, playSound, enterFullscreen]);

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
  }, []);

  // Update game state with input
  useEffect(() => {
    if (gamePhase !== "playing" || !gameState) return;

    const loop = (timestamp: number) => {
      const delta = lastFrameRef.current ? timestamp - lastFrameRef.current : 16;
      lastFrameRef.current = timestamp;
      const clampedDelta = Math.min(delta, 50);

      setGameState((prevState) => {
        if (!prevState || prevState.status !== "playing") return prevState;
        
        // Update velocity if input is active
        let nextVx = prevState.player.vx;
        let nextVy = prevState.player.vy;
        
        if (input.dx !== 0 || input.dy !== 0) {
            // Only allow 4-way movement, prioritizing x then y if both are pressed
            if (input.dx !== 0) {
                nextVx = input.dx > 0 ? 1 : -1;
                nextVy = 0;
            } else if (input.dy !== 0) {
                nextVy = input.dy > 0 ? 1 : -1;
                nextVx = 0;
            }
        }

        const updatedState = {
          ...prevState,
          player: {
            ...prevState.player,
            vx: nextVx,
            vy: nextVy,
          }
        };
        
        return tickRealmCarver(updatedState, clampedDelta);
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = 0;
    };
  }, [gamePhase, input.dx, input.dy, gameState]);

  useEffect(() => {
    if (gameState?.status === "victory" || gameState?.status === "defeat") {
      setGamePhase("ended");
      exitFullscreen();
      if (gameState.status === "victory") playSound("success");
      else playSound("error");
    }
  }, [gameState?.status, playSound, exitFullscreen]);

  const targetWordIndex = gameState?.targetWordIndex ?? -1;
  const prevTargetIndex = useRef(0);
  useEffect(() => {
    if (targetWordIndex > prevTargetIndex.current) {
      playSound("success");
      prevTargetIndex.current = targetWordIndex;
    }
  }, [targetWordIndex, playSound]);

  const playerHp = gameState?.player.hp ?? -1;
  const prevHp = useRef(3);
  useEffect(() => {
    if (playerHp >= 0 && playerHp < prevHp.current) {
      playSound("error");
      prevHp.current = playerHp;
    }
  }, [playerHp, playSound]);

  useEffect(() => {
    if (gamePhase === "ended" && gameState && !hasReportedRef.current) {
      hasReportedRef.current = true;
      const accuracy = gameState.fullSentence.length > 0 
        ? gameState.targetWordIndex / gameState.fullSentence.length 
        : 0;
      const xp = calculateXP({
        targetWordIndex: gameState.targetWordIndex,
        fullSentenceLength: gameState.fullSentence.length,
        hp: gameState.player.hp,
        maxHp: gameState.player.maxHp,
        gameTime: gameState.gameTime,
      });
      onComplete?.({ xp, accuracy });
    }
  }, [gamePhase, gameState, onComplete]);

  const scale = useMemo(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return 1;
    return Math.min(dimensions.width / GAME_WIDTH, dimensions.height / GAME_HEIGHT);
  }, [dimensions]);

  const cellScale = GAME_WIDTH / GRID_SIZE;

  if (gamePhase === "start") {
    return (
      <div ref={containerRef} className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto">
        <GameStartScreen
          gameTitle="Realm Carver"
          gameSubtitle="Magical Cartographer"
          vocabulary={sentences as VocabularyItem[]}
          instructions={[
            { step: 1, text: "Move to draw lines and claim territory.", icon: MapIcon },
            { step: 2, text: "Enclose words to capture them in order.", icon: Target },
            { step: 3, text: "Don't let monsters hit your trail!", icon: Shield },
          ]}
          proTip="Return to a claimed area to finish your circuit."
          controls={[
            { label: "Move", keys: "DPad / Arrows", color: "bg-amber-500" },
          ]}
          startButtonText="Start Mapping"
          icon={MapIcon}
          onStart={startGame}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto flex flex-col items-center">
      {gamePhase === "playing" && gameState && (
        <>
          {/* HUD */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 px-4 py-2 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-1">
                {[...Array(gameState.player.maxHp)].map((_, i) => (
                  <Heart
                    key={i}
                    className={`h-5 w-5 ${i < gameState.player.hp ? "text-red-500 fill-red-500" : "text-slate-600"}`}
                  />
                ))}
              </div>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center gap-1.5">
                <Target className="h-4 w-4 text-amber-400" />
                <span className="font-bold text-white tabular-nums" style={{ fontSize: getEffectiveTextSize(16) }}>
                  {gameState.targetWordIndex} / {gameState.fullSentence.length}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Award className="h-4 w-4 text-amber-400" />
              <span className="font-bold text-white tabular-nums" style={{ fontSize: getEffectiveTextSize(16) }}>{gameState.score}</span>
            </div>
          </div>

          {/* Current Target Word */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 px-6 py-2 bg-amber-500/20 border border-amber-500/40 rounded-full backdrop-blur-sm">
            <div className="flex flex-col items-center">
              <span className="uppercase tracking-widest text-amber-400 font-bold mb-0.5" style={{ fontSize: getEffectiveTextSize(16) }}>Find</span>
              <span className="font-black text-amber-500 drop-shadow-sm" style={{ fontSize: getEffectiveTextSize(20) }}>
                {gameState.currentSentence.term}
              </span>
            </div>
          </div>

          <Stage width={dimensions.width} height={dimensions.height} className="mt-auto mb-auto">
            <Layer scaleX={scale} scaleY={scale}>
              {/* Background */}
              <Rect x={0} y={0} width={GAME_WIDTH} height={GAME_HEIGHT} fill={REALM_CARVER_CONFIG.colors.wild} />
              
              {/* Grid Content */}
              <Group y={(GAME_HEIGHT - GAME_WIDTH) / 2}>
                {/* Claimed Cells */}
                {gameState.grid.map((row, y) => 
                  row.map((cell, x) => {
                    if (cell === "wild") return null;
                    return (
                      <Rect
                        key={`${x}-${y}`}
                        x={x * cellScale}
                        y={y * cellScale}
                        width={cellScale + 0.5}
                        height={cellScale + 0.5}
                        fill={cell === "claimed" ? REALM_CARVER_CONFIG.colors.claimed : REALM_CARVER_CONFIG.colors.trail}
                      />
                    );
                  })
                )}

                {/* Words */}
                {gameState.words.map((word) => {
                  const isTarget = word.term === gameState.currentSentence.term;
                  return (
                    <Group key={word.id} x={word.x * cellScale} y={word.y * cellScale}>
                      <Circle
                        radius={REALM_CARVER_CONFIG.word.radius}
                        fill={isTarget ? REALM_CARVER_CONFIG.colors.targetWord : REALM_CARVER_CONFIG.colors.word}
                        opacity={isTarget ? 0.8 : 0.5}
                        shadowBlur={isTarget ? 15 : 5}
                        shadowColor={isTarget ? REALM_CARVER_CONFIG.colors.targetWord : "#000"}
                      />
                      <Text
                        text={word.term}
                        fontSize={getEffectiveTextSize(16)}
                        fontStyle="bold"
                        fill="white"
                        align="center"
                        width={60}
                        x={-30}
                        y={REALM_CARVER_CONFIG.word.radius + 5}
                      />
                    </Group>
                  );
                })}

                {/* Monsters */}
                {gameState.monsters.map((monster) => (
                  <Group key={monster.id} x={monster.x * cellScale} y={monster.y * cellScale}>
                    <Circle
                      radius={REALM_CARVER_CONFIG.monster.radius}
                      fill={REALM_CARVER_CONFIG.colors.monster}
                      shadowBlur={10}
                      shadowColor={REALM_CARVER_CONFIG.colors.monster}
                    />
                    <Circle
                      radius={REALM_CARVER_CONFIG.monster.radius * 0.4}
                      fill="white"
                      opacity={0.8}
                    />
                  </Group>
                ))}

                {/* Player */}
                <Group x={gameState.player.x * cellScale} y={gameState.player.y * cellScale}>
                  <Circle
                    radius={REALM_CARVER_CONFIG.player.radius}
                    fill={REALM_CARVER_CONFIG.colors.player}
                    shadowBlur={15}
                    shadowColor={REALM_CARVER_CONFIG.colors.player}
                  />
                  <Rect
                    x={-4}
                    y={-4}
                    width={8}
                    height={8}
                    fill="white"
                    rotation={45}
                  />
                </Group>
              </Group>
            </Layer>
          </Stage>

          {/* D-Pad */}
          <div className="absolute bottom-10 left-10 z-30 opacity-60 hover:opacity-100 transition-opacity">
            <VirtualDPad onInput={({ dx, dy }) => setVirtualInput({ dx, dy, cast: false })} />
          </div>
        </>
      )}

      {gamePhase === "ended" && gameState && (
        <GameEndScreen
          status={gameState.status === "playing" ? "complete" : gameState.status}
          title={gameState.status === "victory" ? "Map Completed!" : "Cartographer Defeated!"}
          subtitle={gameState.status === "victory" ? "The realm has been fully mapped." : "The wild magic was too strong."}
          score={gameState.score}
          xp={Math.floor(gameState.score / 10)}
          accuracy={gameState.targetWordIndex / gameState.fullSentence.length}
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
