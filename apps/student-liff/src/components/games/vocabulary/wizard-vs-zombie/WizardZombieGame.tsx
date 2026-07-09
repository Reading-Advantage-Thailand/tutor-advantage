"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Stage,
  Layer,
  Text,
  Group,
  Rect,
  Image as KonvaImage,
} from "react-konva";
import {
  Difficulty,
  GAME_HEIGHT,
  GAME_WIDTH,
  WizardZombieState,
  advanceWizardZombieTime,
  createWizardZombieState,
} from "@/lib/games/wizardZombie";
import type { VocabularyItem } from "@/store/useGameStore";
import { useSound } from "@/hooks/useSound";
import { useInterval } from "@/hooks/useInterval";
import { useDirectionalInput } from "@/hooks/useDirectionalInput";
import { useAccessibilitySettings } from "@/hooks/useAccessibilitySettings";
import { useAdaptiveDifficulty } from "@/hooks/useAdaptiveDifficulty";
import { registerDifficultyParams } from "@/lib/adaptive-difficulty/registerDifficultyParams";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { VirtualDPad } from "@/components/ui/VirtualDPad";
import { calculateIndicators } from "@/lib/games/wizardZombieIndicators";
import { getCachedGameImage, loadGameImage } from "@/lib/games/gameAssetPreloader";
import { GameStartScreen } from "@/components/games/game/GameStartScreen";
import { useGameFullscreen } from "@/hooks/useGameFullscreen";
import {
  Shield,
  Zap,
  Sword,
} from "lucide-react";
import { calculateXP } from "@/lib/games/xp";
import { useScopedI18n } from "@/locales/client";

export type WizardZombieGameResult = {
  xp: number;
  accuracy: number;
  correctAnswers: number;
  totalAttempts: number;
  difficulty: Difficulty;
  durationMs?: number;
};

type FloatingText = {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number; // 0-1
  velocity: { x: number; y: number };
};

interface WizardZombieGameProps {
  vocabulary: VocabularyItem[];
  onComplete: (results: WizardZombieGameResult) => void;
  adaptive?: boolean;
  autoStart?: boolean;
}

const GAME_DURATION_MS = 60_000;
const MAX_ROUND_WORDS = 10;
const WIZARD_ASSET_PATHS = {
  player: "/games/vocabulary/wizard-vs-zombie/player_3x3_pose_sheet.png",
  zombie: "/games/vocabulary/wizard-vs-zombie/zombie_3x3_pose_sheet.png",
  orb: "/games/vocabulary/wizard-vs-zombie/orb_3x3_pose_sheet.png",
  floor: "/games/vocabulary/wizard-vs-zombie/tile-ruins.png",
};

const buildRoundVocabulary = (items: VocabularyItem[]) =>
  [...items].sort(() => Math.random() - 0.5).slice(0, MAX_ROUND_WORDS);

const getCachedWizardAssets = () => {
  const player = getCachedGameImage(WIZARD_ASSET_PATHS.player);
  const zombie = getCachedGameImage(WIZARD_ASSET_PATHS.zombie);
  const orb = getCachedGameImage(WIZARD_ASSET_PATHS.orb);
  const floor = getCachedGameImage(WIZARD_ASSET_PATHS.floor);
  return player && zombie && orb && floor ? { player, zombie, orb, floor } : null;
};

// Sprite Helper
const buildSpriteGrid = (width: number, height: number) => {
  const fw = width / 3;
  const fh = height / 3;
  return { fw, fh };
};

const getSpriteCrop = (fw: number, fh: number, col: number, row: number) => ({
  x: col * fw,
  y: row * fh,
  width: fw,
  height: fh,
});

export function WizardZombieGame({
  vocabulary,
  onComplete,
  adaptive = false,
  autoStart = false,
}: WizardZombieGameProps) {
  const t = useScopedI18n("pages.student.gamesPage");
  const { playSound } = useSound();
  const { input, setVirtualInput, triggerCast, consumeCast } =
    useDirectionalInput();
  const { getEffectiveTouchTarget, getEffectiveTextSize } =
    useAccessibilitySettings();
  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen();
  const gameVocabulary = useMemo(() => buildRoundVocabulary(vocabulary), [vocabulary]);

  const [gamePhase, setGamePhase] = useState<"start" | "playing" | "ended">(
    autoStart ? "playing" : "start",
  );
  const selectedDifficulty: Difficulty = "medium";

  const [gameState, setGameState] = useState<WizardZombieState | null>(() =>
    autoStart && gameVocabulary.length > 0
      ? createWizardZombieState(gameVocabulary, { difficulty: "medium" })
      : null,
  );
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  const completedRef = useRef(false);

  // Register adaptive difficulty params for wizard-vs-zombie
  useMemo(() => {
    const difficultyModifiers = {
      easy: { speed: 0.8, spawnRate: 1.2 },
      medium: { speed: 1.0, spawnRate: 1.0 },
      hard: { speed: 1.2, spawnRate: 0.8 },
    };
    const modifiers = difficultyModifiers[selectedDifficulty] || difficultyModifiers.medium;
    registerDifficultyParams('wizard-vs-zombie', {
      zombieSpeed: { current: modifiers.speed, min: 0.5, max: 2.0, default: 1.0, step: 0.1 },
      spawnRate: { current: modifiers.spawnRate, min: 0.4, max: 1.5, default: 1.0, step: 0.1 },
    });
  }, [selectedDifficulty]);

  const { recordResponse: recordAdaptiveResponse } = useAdaptiveDifficulty({
    gameId: 'wizard-vs-zombie',
    adaptive,
  });

  const dpadSize = getEffectiveTouchTarget(136);
  const castButtonSize = getEffectiveTouchTarget(82);
  const textScale = getEffectiveTextSize(16); // base font size in pixels

  const [assets, setAssets] = useState<{
    player: HTMLImageElement;
    zombie: HTMLImageElement;
    orb: HTMLImageElement;
    floor: HTMLImageElement;
  } | null>(() => getCachedWizardAssets());
  const assetsRef = useRef(assets);
  useEffect(() => { assetsRef.current = assets; }, [assets]);

  const dimensions = useGameDimensions(containerRef);
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });

  // Animation Frames
  const [playerFrame, setPlayerFrame] = useState(0);
  const [zombieFrame, setZombieFrame] = useState(0);
  const [orbFrame, setOrbFrame] = useState(0);

  // Juice State
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const floatingTextsRef = useRef(floatingTexts);
  useEffect(() => { floatingTextsRef.current = floatingTexts; }, [floatingTexts]);

  const [, setScreenShake] = useState(0);
  const [screenShakeOffset, setScreenShakeOffset] = useState({ x: 0, y: 0 });
  const [damageFlash, setDamageFlash] = useState(0); // opacity
  const [shockwaveRing, setShockwaveRing] = useState(0); // scale/opacity

  const inputRef = useRef(input);
  useEffect(() => { inputRef.current = input; }, [input]);

  // Asset Loading
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [player, zombie, orb, floor] = await Promise.all([
          loadGameImage(WIZARD_ASSET_PATHS.player),
          loadGameImage(WIZARD_ASSET_PATHS.zombie),
          loadGameImage(WIZARD_ASSET_PATHS.orb),
          loadGameImage(WIZARD_ASSET_PATHS.floor),
        ]);
        if (mounted) setAssets({ player, zombie, orb, floor });
      } catch (e) {
        console.error("Failed to load assets", e);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const startGame = useCallback(() => {
    if (gameVocabulary.length > 0) {
      const state = createWizardZombieState(gameVocabulary, { difficulty: selectedDifficulty });
      setGameState(state);
      setGamePhase("playing");
      completedRef.current = false;
      setFloatingTexts([]);
      setScreenShake(0);
      setScreenShakeOffset({ x: 0, y: 0 });
      setDamageFlash(0);
      setShockwaveRing(0);
    }
  }, [gameVocabulary, selectedDifficulty]);

  const completeGame = useCallback(() => {
    if (completedRef.current) return;
    if (gameStateRef.current) {
      const state = gameStateRef.current;
      completedRef.current = true;
      const totalWords = Math.max(gameVocabulary.length, 1);
      const correctWords = Math.min(state.correctAnswers, totalWords);
      const results: WizardZombieGameResult = {
        xp: calculateXP(
          state.score,
          correctWords,
          totalWords,
        ),
        accuracy: correctWords / totalWords,
        correctAnswers: correctWords,
        totalAttempts: totalWords,
        difficulty: selectedDifficulty,
        durationMs: Math.min(state.gameTime, GAME_DURATION_MS),
      };
      onComplete(results);
    }
  }, [gameVocabulary.length, onComplete, selectedDifficulty]);

  useEffect(() => {
        if (!autoStart) return;
        if (gameState || gameVocabulary.length === 0) return;
        startGame();
  }, [autoStart, gameState, gameVocabulary.length, startGame]);

  useEffect(() => {
    if (gamePhase === "playing") {
      enterFullscreen();
    } else {
      exitFullscreen();
    }
  }, [gamePhase, enterFullscreen, exitFullscreen]);

  // Animation Loop (sprite frames)
  useInterval(() => {
    if (gamePhase === "playing") {
      setPlayerFrame((f) => (f + 1) % 3);
      setZombieFrame((f) => (f + 1) % 3);
      setOrbFrame((f) => (f + 1) % 3);
    }
  }, 150);

  // Game Loop with requestAnimationFrame
  useEffect(() => {
    if (gamePhase !== "playing") return;

    let rafId: number;
    let lastTime = 0;

    const loop = (timestamp: number) => {
      const dt = lastTime ? timestamp - lastTime : 16.6;
      lastTime = timestamp;
      const clampedDt = Math.min(dt, 50);

      const currentState = gameStateRef.current;
      const currentInput = inputRef.current;
      const currentAssets = assetsRef.current;

      if (!currentState || currentState.status !== "playing" || !currentAssets) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      const nextState = advanceWizardZombieTime(
        currentState,
        clampedDt,
        currentInput,
        gameVocabulary,
      );
      const timeLimitedState =
        nextState.gameTime >= GAME_DURATION_MS
          ? { ...nextState, status: "gameover" as const }
          : nextState;

      // Diffing for Juice
      // Damage check
      if (timeLimitedState.player.hp < currentState.player.hp) {
        setScreenShake(10);
        setDamageFlash(0.5);
        setFloatingTexts((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            x: timeLimitedState.player.x,
            y: timeLimitedState.player.y - 20,
            text: `-${currentState.player.hp - timeLimitedState.player.hp}`,
            color: "#ef4444",
            life: 1.0,
            velocity: { x: (Math.random() - 0.5) * 2, y: -3 },
          },
        ]);
      }
      // Score check
      if (timeLimitedState.score > currentState.score) {
        setFloatingTexts((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            x: timeLimitedState.player.x,
            y: timeLimitedState.player.y - 40,
            text: `+${timeLimitedState.score - currentState.score}`,
            color: "#fbbf24",
            life: 1.0,
            velocity: { x: (Math.random() - 0.5) * 2, y: -4 },
          },
        ]);
      }
      // Penalty check
      if (timeLimitedState.score < currentState.score) {
        setFloatingTexts((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            x: timeLimitedState.player.x,
            y: timeLimitedState.player.y - 40,
            text: `${timeLimitedState.score - currentState.score}`,
            color: "#ef4444",
            life: 1.0,
            velocity: { x: (Math.random() - 0.5) * 2, y: -2 },
          },
        ]);
      }
      // Adaptive difficulty: track orb collection
      if (timeLimitedState.totalAttempts > currentState.totalAttempts) {
        const isCorrect = timeLimitedState.correctAnswers > currentState.correctAnswers;
        recordAdaptiveResponse(isCorrect, 1000);
      }

      // Update Juice
      setScreenShake((prev) => {
        if (prev > 0) {
          setScreenShakeOffset({
            x: (Math.random() - 0.5) * prev,
            y: (Math.random() - 0.5) * prev,
          });
          return Math.max(0, prev - 1);
        } else {
          setScreenShakeOffset({ x: 0, y: 0 });
          return 0;
        }
      });
      setDamageFlash((prev) => Math.max(0, prev - 0.05));
      setShockwaveRing((prev) => Math.max(0, prev - 0.1));
      setFloatingTexts((prev) =>
        prev
          .map((ft) => ({
            ...ft,
            life: ft.life - 0.02,
            x: ft.x + ft.velocity.x,
            y: ft.y + ft.velocity.y,
          }))
          .filter((ft) => ft.life > 0),
      );

      setGameState(timeLimitedState);

      if (currentInput.cast) {
        consumeCast();
        playSound("success");
        setShockwaveRing(1.0);
      }

      if (dimensions.width > 0 && dimensions.height > 0) {
        const scaleY = dimensions.height / GAME_HEIGHT;
        const scale = Math.max(scaleY, 0.8);

        let camX = dimensions.width / 2 - timeLimitedState.player.x * scale;
        let camY = dimensions.height / 2 - timeLimitedState.player.y * scale;

        const minX = dimensions.width - GAME_WIDTH * scale;
        const minY = dimensions.height - GAME_HEIGHT * scale;

        if (minX > 0) camX = (dimensions.width - GAME_WIDTH * scale) / 2;
        else camX = Math.max(minX, Math.min(0, camX));

        if (minY > 0) camY = (dimensions.height - GAME_HEIGHT * scale) / 2;
        else camY = Math.max(minY, Math.min(0, camY));

        setCamera({ x: camX, y: camY, scale });
      }

      if (timeLimitedState.status === "gameover") {
        setGamePhase("ended");
        gameStateRef.current = timeLimitedState;
        completeGame();
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [gamePhase, gameVocabulary, dimensions.width, dimensions.height, consumeCast, playSound, recordAdaptiveResponse, completeGame]);

  // Calculate indicators
  const indicators =
    gameState && dimensions.width > 0
      ? calculateIndicators(gameState.orbs, camera, dimensions)
      : [];

  // Memoize sprite grids
  const grids = useMemo(() => {
    if (!assets) return null;
    return {
      player: buildSpriteGrid(assets.player.width, assets.player.height),
      zombie: buildSpriteGrid(assets.zombie.width, assets.zombie.height),
      orb: buildSpriteGrid(assets.orb.width, assets.orb.height),
    };
  }, [assets]);

  if (!assets) {
    return (
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-2xl bg-slate-950 flex items-center justify-center border border-white/10"
        style={{ height: "min(75svh, 100%)" }}
      >
        <div className="text-white animate-pulse font-mono tracking-widest uppercase text-sm sm:text-base">
          Initializing Grimoire...
        </div>
      </div>
    );
  }

  if (gamePhase === "start") {
    return (
      <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none">
        <GameStartScreen
          gameTitle="Wizard vs Zombie"
          gameSubtitle="Arcane Defense"
          vocabulary={gameVocabulary}
          instructions={[
            { step: 1, text: "The horde is endless. Survive as long as possible by collecting Healing Orbs.", icon: Shield },
            { step: 2, text: "Match the Target Word shown at the bottom to heal (+10 HP).", icon: Zap },
            { step: 3, text: "Picking the Wrong Orb reshuffles the field and costs 5 points.", icon: Shield },
            { step: 4, text: "Each correct orb grants one Shockwave charge. Use it to blast zombies back!", icon: Zap },
          ]}
          proTip="Use Shockwave when surrounded to create space for an escape!"
          controls={[
            { label: "Move", keys: "Arrows / WASD", color: "bg-blue-500" },
            { label: "Cast", keys: "Space / Enter", color: "bg-yellow-500" },
          ]}
          startButtonText={t("common.startSurvival")}
          icon={Sword}
          onStart={startGame}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ minHeight: "400px", height: "100%" }}
      className="relative w-full overflow-hidden rounded-none bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none sm:rounded-3xl"
    >
      {gameState && grids && (
        <>
          {/* HUD Overlay */}
          <div className="absolute top-2 sm:top-4 left-2 sm:left-4 z-10 flex flex-col gap-0.5 sm:gap-1 text-white font-bold text-sm sm:text-lg pointer-events-none drop-shadow-md">
            <div>HP: {Math.ceil(gameState.player.hp)}</div>
            <div className="text-blue-400 text-xs sm:text-sm flex items-center gap-0.5 sm:gap-1">
              SHOCKWAVE:{" "}
              {Array(gameState.player.maxShockwaveCharges)
                .fill(0)
                .map((_, i) => (
                  <span
                    key={i}
                    className={
                      i < gameState.player.shockwaveCharges
                        ? "opacity-100"
                        : "opacity-30"
                    }
                  >
                    ⚡
                  </span>
                ))}
            </div>
          </div>
          <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-10 text-white font-bold text-sm sm:text-lg pointer-events-none drop-shadow-md">
            {t("common.score")}: {gameState.score}
          </div>
          <div className="absolute top-2 sm:top-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/15 bg-black/55 px-4 py-1.5 text-center font-black text-white shadow-lg backdrop-blur-sm pointer-events-none">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/60">
              Time
            </div>
            <div className="text-lg leading-none tabular-nums text-cyan-300">
              {Math.max(
                0,
                Math.ceil((GAME_DURATION_MS - gameState.gameTime) / 1000),
              )}
              s
            </div>
          </div>

          {/* Target Word - centered below HUD, above virtual controls */}
          <div className="absolute right-3 top-20 z-10 max-w-[42vw] rounded-2xl border border-white/20 bg-black/65 px-3 py-2 text-right shadow-lg backdrop-blur-sm pointer-events-none sm:right-5 sm:top-24 sm:max-w-[320px] sm:px-4">
            <span className="block text-[10px] uppercase tracking-[0.18em] text-white/60 sm:text-xs">
              Find:
            </span>
            <span className="block break-words text-sm font-bold leading-tight text-yellow-400 sm:text-lg">
              {gameState.targetWord}
            </span>
          </div>

          {/* Off-screen Indicators */}
          {indicators.map((ind) => (
            <div
              key={ind.orb.id}
              className="absolute z-10 flex items-center justify-center pointer-events-none"
              style={{
                left: ind.x,
                top: ind.y,
                transform: `translate(-50%, -50%) rotate(${ind.rotation}deg)`,
              }}
            >
              <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[15px] border-b-yellow-400 animate-pulse" />
            </div>
          ))}

          {/* Text Labels for Indicators */}
          {indicators.map((ind) => (
            <div
              key={`label-${ind.orb.id}`}
              className="absolute z-10 pointer-events-none text-xs font-bold text-white bg-black/60 px-2 py-1 rounded whitespace-nowrap shadow-lg border border-white/10"
              style={{
                left: ind.x,
                top: ind.y,
                transform: `translate(-50%, -50%) translate(${Math.cos((ind.rotation * Math.PI) / 180) * -35}px, ${Math.sin((ind.rotation * Math.PI) / 180) * -35}px)`,
              }}
            >
              {ind.orb.translation}
            </div>
          ))}

          {/* Virtual Controls */}
          <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 sm:bottom-5">
            <div style={{ transform: `scale(${dpadSize / 128})`, transformOrigin: 'bottom center' }}>
              <VirtualDPad onInput={setVirtualInput} />
            </div>
          </div>
          <div className="absolute bottom-6 right-4 z-20 sm:bottom-7 sm:right-7">
            <button
              onClick={() => triggerCast()}
              disabled={gameState.player.shockwaveCharges === 0}
              style={{
                width: castButtonSize,
                height: castButtonSize,
                fontSize: `${Math.max(13, textScale * 0.875)}px`,
              }}
              className={`rounded-full border-2 flex flex-col items-center justify-center gap-0.5 font-black uppercase tracking-wide transition-all active:scale-95 ${
                gameState.player.shockwaveCharges > 0
                  ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                  : "bg-slate-800 border-slate-700 text-slate-500 opacity-50"
              }`}
            >
              <Zap className="h-5 w-5" />
              Cast
            </button>
          </div>

          {/* Canvas */}
          <Stage
            width={dimensions.width}
            height={dimensions.height}
            data-testid="stage"
          >
            <Layer
              scaleX={camera.scale}
              scaleY={camera.scale}
              x={camera.x + screenShakeOffset.x}
              y={camera.y + screenShakeOffset.y}
            >
              {/* Floor Tiling - Using Rect for proper pattern repeat */}
              <Rect
                x={0}
                y={0}
                width={GAME_WIDTH}
                height={GAME_HEIGHT}
                fillPatternImage={assets.floor}
                fillPatternRepeat="repeat"
                fillPatternScaleX={0.5}
                fillPatternScaleY={0.5}
              />

              <Group>
                {/* Player */}
                <KonvaImage
                  image={assets.player}
                  name="player"
                  x={gameState.player.x}
                  y={gameState.player.y}
                  width={64}
                  height={64}
                  offsetX={32}
                  offsetY={32}
                  crop={getSpriteCrop(
                    grids.player.fw,
                    grids.player.fh,
                    playerFrame,
                    input.dx === 0 && input.dy === 0 ? 0 : 1,
                  )}
                />

                {/* Shockwave FX */}
                {shockwaveRing > 0 && (
                  <Rect
                    x={gameState.player.x}
                    y={gameState.player.y}
                    width={0}
                    height={0}
                    offsetX={0}
                    offsetY={0}
                    stroke="cyan"
                    strokeWidth={10 * shockwaveRing}
                    cornerRadius={250}
                    shadowBlur={20}
                    shadowColor="cyan"
                    opacity={shockwaveRing}
                    scale={{
                      x: (1 - shockwaveRing) * 20 + 1,
                      y: (1 - shockwaveRing) * 20 + 1,
                    }}
                  />
                )}

                {/* Zombies - Offset animation */}
                {gameState.zombies.map((zombie, i) => (
                  <KonvaImage
                    key={zombie.id}
                    image={assets.zombie}
                    name="zombie"
                    x={zombie.x}
                    y={zombie.y}
                    width={48}
                    height={48}
                    offsetX={24}
                    offsetY={24}
                    crop={getSpriteCrop(
                      grids.zombie.fw,
                      grids.zombie.fh,
                      (zombieFrame + i) % 3,
                      0,
                    )}
                  />
                ))}

                {/* Orbs - Offset animation */}
                {gameState.orbs.map((orb, i) => (
                  <Group key={orb.id} x={orb.x} y={orb.y}>
                    <KonvaImage
                      image={assets.orb}
                      name="orb"
                      width={orb.radius * 2}
                      height={orb.radius * 2}
                      offsetX={orb.radius}
                      offsetY={orb.radius}
                      crop={getSpriteCrop(
                        grids.orb.fw,
                        grids.orb.fh,
                        (orbFrame + i) % 3,
                        0,
                      )}
                    />
                    <Text
                      text={orb.translation}
                      fontSize={14}
                      fontStyle="bold"
                      fill="white"
                      offsetX={orb.radius}
                      offsetY={orb.radius + 20}
                      width={orb.radius * 2}
                      align="center"
                      shadowColor="black"
                      shadowBlur={4}
                    />
                  </Group>
                ))}
              </Group>
            </Layer>
          </Stage>

          {/* FX Layer */}
          {damageFlash > 0 && (
            <div
              className="absolute inset-0 bg-red-500 pointer-events-none z-40 transition-opacity duration-75"
              style={{ opacity: damageFlash }}
            />
          )}

          {/* Floating Texts */}
          {floatingTexts.map((ft) => (
            <div
              key={ft.id}
              className="absolute pointer-events-none font-bold text-shadow-sm z-50 whitespace-nowrap"
              style={{
                left: dimensions.width / 2 + (ft.x - camera.x) * camera.scale,
                top: dimensions.height / 2 + (ft.y - camera.y) * camera.scale,
                color: ft.color,
                fontSize: `${Math.max(12, 24 * camera.scale)}px`,
                opacity: ft.life,
                transform: `translate(-50%, -50%) scale(${0.5 + ft.life * 0.5})`,
              }}
            >
              {ft.text}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
