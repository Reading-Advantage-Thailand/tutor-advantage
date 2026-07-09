"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Circle, Group, Line } from "react-konva";
import {
  createPaladinsTwinSoulState,
  tickPaladinsTwinSoul,
  calculateXP,
  type PaladinsTwinSoulState,
  type VocabularyItem,
} from "@/lib/games/paladinsTwinSoul";
import { GAME_WIDTH, GAME_HEIGHT, PALADINS_TWIN_SOUL_CONFIG } from "@/lib/games/paladinsTwinSoulConfig";
import { GameStartScreen } from "@/components/games/game/GameStartScreen";
import { GameEndScreen } from "@/components/games/game/GameEndScreen";
import { Sword, Shield, Heart, Target } from "lucide-react";
import { useDirectionalInput } from "@/hooks/useDirectionalInput";
import { useSound } from "@/hooks/useSound";
import { useGameFullscreen } from "@/hooks/useGameFullscreen";
import { useAccessibilitySettings } from "@/hooks/useAccessibilitySettings";
import { VirtualDPad } from "@/components/ui/VirtualDPad";

interface PaladinsTwinSoulGameProps {
  vocabulary: VocabularyItem[];
  onComplete: (results: { xp: number; accuracy: number }) => void;
}

export function PaladinsTwinSoulGame({ vocabulary, onComplete }: PaladinsTwinSoulGameProps) {
  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen();
  const { getEffectiveTextSize } = useAccessibilitySettings();
  const [gameState, setGameState] = useState<PaladinsTwinSoulState | null>(null);
  const [gamePhase, setGamePhase] = useState<"start" | "playing" | "ended">("start");
  const [selectedDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [dpadVelocity, setDpadVelocity] = useState({ x: 0, y: 0 });
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const lastFrameRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const hasReportedRef = useRef(false);

  const { input: keyboardInput } = useDirectionalInput();
  const { playSound } = useSound();

  const velocity = useMemo(() => ({
    x: dpadVelocity.x || keyboardInput.dx,
    y: dpadVelocity.y || keyboardInput.dy,
  }), [dpadVelocity, keyboardInput]);

  const startGame = useCallback(() => {
    try {
      const state = createPaladinsTwinSoulState(vocabulary, { difficulty: selectedDifficulty });
      setGameState(state);
      setGamePhase("playing");
      hasReportedRef.current = false;
      lastFrameRef.current = 0;
      playSound("success");
    } catch (error) {
      console.error("Failed to start game:", error);
    }
  }, [vocabulary, selectedDifficulty, playSound]);

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

  const hasGameState = !!gameState;
  useEffect(() => {
    if (gamePhase !== "playing" || !hasGameState) return;

    const loop = (timestamp: number) => {
      const delta = lastFrameRef.current ? timestamp - lastFrameRef.current : 16;
      lastFrameRef.current = timestamp;
      const clampedDelta = Math.min(delta, 50);

      setGameState((prevState) => {
        if (!prevState || prevState.status !== "playing") return prevState;
        return tickPaladinsTwinSoul(prevState, clampedDelta, { dx: velocity.x });
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = 0;
    };
  }, [gamePhase, velocity.x, hasGameState]);

  useEffect(() => {
    if (gamePhase === "playing") {
      enterFullscreen();
    } else {
      exitFullscreen();
    }
  }, [gamePhase, enterFullscreen, exitFullscreen]);

  useEffect(() => {
    if (gameState?.status === "victory" || gameState?.status === "defeat") {
      setGamePhase("ended");
      if (gameState.status === "victory") playSound("success");
      else playSound("error");
    }
  }, [gameState?.status, playSound]);

  const playerHp = gameState?.player.hp;
  const prevHp = useRef(3);
  useEffect(() => {
    if (playerHp !== undefined && playerHp < prevHp.current) {
      playSound("error");
      prevHp.current = playerHp;
    }
  }, [playerHp, playSound]);

  const wave = gameState?.wave;
  const prevWave = useRef(1);
  useEffect(() => {
    if (wave !== undefined && wave > prevWave.current) {
      playSound("success");
      prevWave.current = wave;
    }
  }, [wave, playSound]);

  useEffect(() => {
    if (gamePhase === "ended" && gameState && !hasReportedRef.current) {
      hasReportedRef.current = true;
      const accuracy = gameState.totalAttempts > 0
        ? gameState.correctAnswers / gameState.totalAttempts
        : 0;
      const xp = calculateXP({
        correctWords: gameState.correctAnswers,
        totalAttempts: gameState.totalAttempts,
        lives: gameState.player.hp,
        initialLives: gameState.player.maxHp,
        gameTime: gameState.gameTime,
      });
      onComplete?.({ xp, accuracy });
    }
  }, [gamePhase, gameState, onComplete]);

  const scale = useMemo(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return 1;
    return Math.min(dimensions.width / GAME_WIDTH, dimensions.height / GAME_HEIGHT);
  }, [dimensions]);

  if (gamePhase === "start") {
    return (
      <div ref={containerRef} className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto">
        <GameStartScreen
          gameTitle="Paladin's Twin-Soul"
          gameSubtitle="Gargoyle Defense"
          vocabulary={vocabulary}
          instructions={[
            { step: 1, text: "Move left/right to defend against gargoyles.", icon: Shield },
            { step: 2, text: "Rescue your twin soul from the correct enemy.", icon: Heart },
            { step: 3, text: "Match the translation to identify your ally!", icon: Target },
          ]}
          proTip="Double your fire rate by rescuing your soul mate!"
          controls={[
            { label: "Move", keys: "Arrows / A-D", color: "bg-amber-500" },
            { label: "Shoot", keys: "Auto-fire", color: "bg-amber-500" },
          ]}
          startButtonText="Begin Defense"
          icon={Sword}
          onStart={startGame}
        />
      </div>
    );
  }

  const currentTarget = gameState?.vocabulary[gameState.targetWordIndex];

  return (
    <div ref={containerRef} className="relative h-[75vh] w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none md:aspect-video md:h-auto">
      {gamePhase === "playing" && gameState && (
        <>
          <Stage width={dimensions.width} height={dimensions.height}>
            <Layer scaleX={scale} scaleY={scale}>
              <Rect x={0} y={0} width={GAME_WIDTH} height={GAME_HEIGHT} fill={PALADINS_TWIN_SOUL_CONFIG.colors.background} />
              
              {/* Stars Background */}
              {[...Array(20)].map((_, i) => (
                <Circle
                  key={i}
                  x={(i * 137) % GAME_WIDTH}
                  y={(i * 251 + gameState.gameTime / 10) % GAME_HEIGHT}
                  radius={1}
                  fill="white"
                  opacity={0.5}
                />
              ))}

              {/* Target Translation */}
              <Group y={60}>
                <Rect x={40} y={0} width={GAME_WIDTH - 80} height={40} fill="rgba(30, 41, 59, 0.8)" cornerRadius={20} stroke="#fbbf24" strokeWidth={1} />
                <Text
                  x={GAME_WIDTH / 2}
                  y={12}
                  text={currentTarget?.translation || ""}
                  fontSize={getEffectiveTextSize(18)}
                  fill="#fbbf24"
                  align="center"
                  width={GAME_WIDTH}
                  offsetX={GAME_WIDTH / 2}
                  fontStyle="bold"
                />
              </Group>

              {/* Bullets */}
              {gameState.bullets.map((bullet) => (
                <Rect
                  key={bullet.id}
                  x={bullet.x - 2}
                  y={bullet.y - 10}
                  width={4}
                  height={20}
                  fill={bullet.isPlayer ? PALADINS_TWIN_SOUL_CONFIG.colors.bullet : "#ef4444"}
                  shadowBlur={5}
                  shadowColor={bullet.isPlayer ? "#fde047" : "#ef4444"}
                />
              ))}

              {/* Enemies */}
              {gameState.enemies.map((enemy) => (
                <Group key={enemy.id} x={enemy.x} y={enemy.y}>
                  <Rect
                    x={-PALADINS_TWIN_SOUL_CONFIG.enemy.width / 2}
                    y={-PALADINS_TWIN_SOUL_CONFIG.enemy.height / 2}
                    width={PALADINS_TWIN_SOUL_CONFIG.enemy.width}
                    height={PALADINS_TWIN_SOUL_CONFIG.enemy.height}
                    fill={enemy.type === "boss" ? "#a855f7" : PALADINS_TWIN_SOUL_CONFIG.colors.enemy}
                    cornerRadius={4}
                    shadowBlur={enemy.isDiving ? 10 : 0}
                    shadowColor="#ef4444"
                  />
                  {enemy.term && (
                    <Text
                      x={-40}
                      y={20}
                      text={enemy.term}
                      fontSize={getEffectiveTextSize(16)}
                      fill="white"
                      align="center"
                      width={80}
                      fontStyle="bold"
                    />
                  )}
                  {enemy.hasCapturedPlayer && (
                    <Rect
                      x={-15}
                      y={10}
                      width={30}
                      height={30}
                      fill={PALADINS_TWIN_SOUL_CONFIG.colors.player}
                      opacity={0.6}
                      cornerRadius={4}
                    />
                  )}
                  {enemy.isCapturing && (
                    <Line
                      points={[0, 0, 0, GAME_HEIGHT]}
                      stroke="#a855f7"
                      strokeWidth={40}
                      opacity={0.2}
                      dash={[10, 10]}
                    />
                  )}
                </Group>
              ))}

              {/* Player */}
              {!gameState.player.isCaptured && (
                <Group x={gameState.player.x} y={PALADINS_TWIN_SOUL_CONFIG.player.y}>
                  <Rect
                    x={-PALADINS_TWIN_SOUL_CONFIG.player.width / 2}
                    y={-PALADINS_TWIN_SOUL_CONFIG.player.height / 2}
                    width={PALADINS_TWIN_SOUL_CONFIG.player.width}
                    height={PALADINS_TWIN_SOUL_CONFIG.player.height}
                    fill={PALADINS_TWIN_SOUL_CONFIG.colors.player}
                    cornerRadius={6}
                    stroke="white"
                    strokeWidth={2}
                  />
                  {gameState.player.hasTwinSoul && (
                    <Rect
                      x={PALADINS_TWIN_SOUL_CONFIG.player.width / 2 + 5}
                      y={-PALADINS_TWIN_SOUL_CONFIG.player.height / 2}
                      width={PALADINS_TWIN_SOUL_CONFIG.player.width}
                      height={PALADINS_TWIN_SOUL_CONFIG.player.height}
                      fill={PALADINS_TWIN_SOUL_CONFIG.colors.twinSoul}
                      cornerRadius={6}
                      stroke="white"
                      strokeWidth={2}
                    />
                  )}
                </Group>
              )}

              {/* HUD Stats */}
              <Group y={20}>
                <Group x={30} y={0}>
                  <Text text={`WAVE ${gameState.wave}`} fill="white" fontSize={getEffectiveTextSize(16)} opacity={0.7} />
                  <Text y={20} text={`Score: ${gameState.score}`} fill="#22c55e" fontSize={getEffectiveTextSize(18)} fontStyle="bold" />
                </Group>
                <Group x={GAME_WIDTH - 80} y={0}>
                  <Text text="HP" fill="#ef4444" fontSize={getEffectiveTextSize(16)} opacity={0.7} />
                  <Text y={20} text={gameState.player.hp.toString()} fill="#ef4444" fontSize={getEffectiveTextSize(24)} fontStyle="bold" />
                </Group>
              </Group>
            </Layer>
          </Stage>

          {/* Virtual DPad Overlay */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 opacity-60 hover:opacity-100 transition-opacity">
            <VirtualDPad onInput={({ dx }) => setDpadVelocity({ x: dx, y: 0 })} />
          </div>
        </>
      )}

      {gamePhase === "ended" && gameState && (
        <GameEndScreen
          status={gameState.status as "victory" | "defeat" | "complete"}
          title={gameState.status === "victory" ? "Defense Successful!" : "Realm Overrun!"}
          subtitle={gameState.status === "victory" ? "The gargoyles have been repelled." : "The twin souls have been lost."}
          score={gameState.score}
          xp={calculateXP({
            correctWords: gameState.correctAnswers,
            totalAttempts: gameState.totalAttempts,
            lives: gameState.player.hp,
            initialLives: gameState.player.maxHp,
            gameTime: gameState.gameTime,
          })}
          accuracy={gameState.totalAttempts > 0 ? gameState.correctAnswers / gameState.totalAttempts : 0}
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
