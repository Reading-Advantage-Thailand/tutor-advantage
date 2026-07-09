"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  Stage,
  Layer,
  Rect,
  Circle,
  Text,
  Image as KonvaImage,
  Group,
} from "react-konva";
import { Shield, Trophy } from "lucide-react";
import { useScopedI18n } from "@/locales/client";
import {
  GameStartScreen,
  type ControlHint,
  type Instruction,
} from "@/components/games/game/GameStartScreen";
import { GameEndScreen } from "@/components/games/game/GameEndScreen";
import { RankingDialog } from "@/components/games/vocabulary/dragon-flight/RankingDialog";

import { VirtualDPad } from "@/components/games/ui/VirtualDPad";
import { useDirectionalInput } from "@/hooks/useDirectionalInput";
import { useGameFullscreen } from "@/hooks/useGameFullscreen";
import { useAccessibilitySettings } from "@/hooks/useAccessibilitySettings";
import { withBasePath } from "@/lib/games/basePath";

import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  GAME_TICK_MS,
  ANIMATION_FRAME_MS,
  createCastleDefenseState,
  advanceCastleDefenseTime,
  CastleDefenseState,
  WORD_RADIUS,
  inRange,
  calculateCastleDefenseXP,
  type SentenceItem,
} from "@/lib/games/castleDefense";
import { BackgroundLayer } from "./BackgroundLayer";

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

type GameAssets = {
  player: HTMLImageElement;
  soldier: HTMLImageElement;
  tank: HTMLImageElement;
  boss: HTMLImageElement;
  towerBase: HTMLImageElement;
  towerBuilt: HTMLImageElement;
  base: HTMLImageElement;
};

type Props = {
  vocabulary: SentenceItem[];
  onComplete?: (results: {
    xp: number;
    accuracy: number;
    difficulty: string;
  }) => void;
};

export function CastleDefenseGame({ vocabulary, onComplete }: Props) {
  const t = useScopedI18n("pages.student.gamesPage.castleDefense");

  const CASTLE_DEFENSE_INSTRUCTIONS: Instruction[] = [
    { step: 1, text: t("instructions.step1") },
    { step: 2, text: t("instructions.step2") },
    { step: 3, text: t("instructions.step3") },
  ];

  const CASTLE_DEFENSE_CONTROLS: ControlHint[] = [
    {
      label: t("controls.move"),
      keys: t("controls.moveKeys"),
      color: "bg-amber-500",
    },
    {
      label: t("controls.build"),
      keys: t("controls.buildKeys"),
      color: "bg-emerald-500",
    },
    {
      label: t("controls.collect"),
      keys: t("controls.collectKeys"),
      color: "bg-blue-500",
    },
  ];

  const [gameState, setGameState] = useState<CastleDefenseState | null>(null);
  const [difficulty, setDifficulty] = useState<
    "easy" | "medium" | "hard"
  >("medium");
  const [showRanking, setShowRanking] = useState(false);
  const [assets, setAssets] = useState<GameAssets | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [hasStarted, setHasStarted] = useState(false);
  const [buildEffects, setBuildEffects] = useState<
    { id: string; x: number; y: number; createdAt: number }[]
  >([]);

  const [playerFrame, setPlayerFrame] = useState(0);
  const [enemyFrame, setEnemyFrame] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const previousTowerIds = useRef<string[]>([]);
  const lastFrameRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const animTimerRef = useRef<number>(0);
  const buildEffectsRef = useRef(buildEffects);
  const gameStateRef = useRef(gameState);
  const onCompleteRef = useRef(onComplete);

  const { enterFullscreen, exitFullscreen } = useGameFullscreen();
  const { getEffectiveTextSize } = useAccessibilitySettings();

  const { input, setVirtualInput, consumeCast } = useDirectionalInput();

  // Keep refs in sync
  useEffect(() => {
    buildEffectsRef.current = buildEffects;
  }, [buildEffects]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const handleBackToMenu = useCallback(() => {
    setHasStarted(false);
    setGameState(null);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadImage = (src: string): Promise<HTMLImageElement> =>
      new Promise((res, rej) => {
        const img = new Image();
        img.src = withBasePath(src);
        img.onload = () => res(img);
        img.onerror = rej;
      });

    const load = async () => {
      try {
        const [player, soldier, tank, boss, towerBase, towerBuilt, base] =
          await Promise.all([
            loadImage(
              "/games/sentence/castle-defense/player_3x3_pose_sheet.png",
            ),
            loadImage(
              "/games/sentence/castle-defense/goblin_3x3_pose_sheet.png",
            ),
            loadImage("/games/sentence/castle-defense/orc_3x3_pose_sheet.png"),
            loadImage(
              "/games/sentence/castle-defense/troll_3x3_pose_sheet.png",
            ),
            loadImage("/games/sentence/castle-defense/tower-base.png"),
            loadImage("/games/sentence/castle-defense/tower-built.png"),
            loadImage("/games/sentence/castle-defense/player-castle.png"),
          ]);
        if (mounted) {
          setAssets({
            player,
            soldier,
            tank,
            boss,
            towerBase,
            towerBuilt,
            base,
          });
        }
      } catch (e) {
        console.error("Failed to load assets", e);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const towers = gameState?.towers;

  useEffect(() => {
    if (!towers) return;
    const currentIds = towers.map((tower) => tower.id);
    const newTowers = towers.filter(
      (tower) => !previousTowerIds.current.includes(tower.id),
    );

    if (newTowers.length > 0) {
      const now = Date.now();
      setBuildEffects((prev) => [
        ...prev,
        ...newTowers.map((tower) => ({
          id: `${tower.id}-${now}`,
          x: tower.x,
          y: tower.y,
          createdAt: now,
        })),
      ]);
    }

    previousTowerIds.current = currentIds;
  }, [towers]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = (rect?: DOMRectReadOnly) => {
      if (!containerRef.current && !rect) return;
      const { width, height } =
        rect ?? containerRef.current!.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    };
    const handleResize = () => updateDimensions();

    updateDimensions();

    const observer = new ResizeObserver((entries) => {
      updateDimensions(entries[0]?.contentRect);
    });

    observer.observe(containerRef.current);
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [hasStarted]);

  const startGame = useCallback(() => {
    setGameState(createCastleDefenseState(vocabulary, { difficulty }));
    setHasStarted(true);
    enterFullscreen();
  }, [vocabulary, difficulty, enterFullscreen]);

  // Game loop with requestAnimationFrame
  useEffect(() => {
    if (!gameState || gameState.status !== "playing" || !assets || !hasStarted) {
      return;
    }

    const loop = (timestamp: number) => {
      const delta = lastFrameRef.current ? timestamp - lastFrameRef.current : GAME_TICK_MS;
      lastFrameRef.current = timestamp;
      const clampedDelta = Math.min(delta, 50);

      setGameState((prevState) => {
        if (!prevState || prevState.status !== "playing") return prevState;

        const nextState = advanceCastleDefenseTime(
          prevState,
          clampedDelta,
          { dx: input.dx, dy: input.dy, drop: input.cast },
          vocabulary,
        );

        // Update camera
        if (dimensions.width > 0 && dimensions.height > 0) {
          const scaleX = dimensions.width / GAME_WIDTH;
          const scaleY = dimensions.height / GAME_HEIGHT;
          const scale = Math.max(scaleX, scaleY, 0.8);

          let camX = dimensions.width / 2 - nextState.player.x * scale;
          let camY = dimensions.height / 2 - nextState.player.y * scale;

          const minX = dimensions.width - GAME_WIDTH * scale;
          const minY = dimensions.height - GAME_HEIGHT * scale;

          if (minX > 0) camX = (dimensions.width - GAME_WIDTH * scale) / 2;
          else camX = Math.max(minX, Math.min(0, camX));

          if (minY > 0) camY = (dimensions.height - GAME_HEIGHT * scale) / 2;
          else camY = Math.max(minY, Math.min(0, camY));

          setCamera({ x: camX, y: camY, scale });
        }

        // Animation frames
        animTimerRef.current += clampedDelta;
        if (animTimerRef.current >= ANIMATION_FRAME_MS) {
          animTimerRef.current = 0;
          setPlayerFrame((f) => (f + 1) % 3);
          setEnemyFrame((f) => (f + 1) % 3);
        }

        // Build effects cleanup
        setBuildEffects((prev) =>
          prev.filter((effect) => Date.now() - effect.createdAt < 600),
        );

        // Handle game end
        if (
          (nextState.status === "gameover" || nextState.status === "victory") &&
          onCompleteRef.current
        ) {
          const totalAttempts =
            nextState.correctWordCollections +
            nextState.incorrectWordCollections;
          const accuracy =
            totalAttempts > 0
              ? nextState.correctWordCollections / totalAttempts
              : 0;
          onCompleteRef.current({
            xp: calculateCastleDefenseXP(nextState),
            accuracy,
            difficulty: nextState.difficulty,
          });
          exitFullscreen();
        }

        if (input.cast) {
          consumeCast();
        }

        return nextState;
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.status, assets, hasStarted, input.dx, input.dy, input.cast, vocabulary, dimensions.width, dimensions.height, consumeCast, exitFullscreen]);

  const grids = useMemo(() => {
    if (!assets) return null;
    return {
      player: buildSpriteGrid(assets.player.width, assets.player.height),
      soldier: buildSpriteGrid(assets.soldier.width, assets.soldier.height),
      tank: buildSpriteGrid(assets.tank.width, assets.tank.height),
      boss: buildSpriteGrid(assets.boss.width, assets.boss.height),
    };
  }, [assets]);

  const activeBuildSlot = useMemo(() => {
    if (!gameState || !gameState.sentenceCompleted) return null;
    return gameState.towerSlots.find((slot) => {
      const hasTower = gameState.towers.some(
        (tower) => tower.id === `tower-${slot.id}`,
      );
      if (hasTower) return false;
      return inRange(
        gameState.player.x,
        gameState.player.y,
        slot.x,
        slot.y,
        50,
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.sentenceCompleted, gameState?.towerSlots, gameState?.towers, gameState?.player.x, gameState?.player.y]);

  if (!assets) {
    return (
      <div className="relative h-[60vh] w-full overflow-hidden rounded-2xl bg-slate-950 flex items-center justify-center border border-white/10 md:aspect-video md:h-auto">
        <div className="text-white animate-pulse font-mono tracking-widest uppercase" style={{ fontSize: getEffectiveTextSize(16) }}>
          {t("loading")}
        </div>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="relative h-[60vh] w-full overflow-hidden rounded-2xl bg-slate-950 border border-white/10 md:aspect-video md:h-auto">
        <GameStartScreen
          gameTitle={t("title")}
          gameSubtitle={t("subtitle")}
          icon={Shield}
          vocabulary={vocabulary}
          instructions={CASTLE_DEFENSE_INSTRUCTIONS}
          proTip={t("proTip")}
          controls={CASTLE_DEFENSE_CONTROLS}
          startButtonText={t("startButton")}
          onStart={startGame}
        >
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-slate-900/80 p-1 rounded-lg border border-white/10">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-3 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-colors ${
                    difficulty === d
                      ? "bg-amber-500 text-slate-900"
                      : "text-slate-400 hover:text-white hover:bg-white/10"
                  }`}
                  style={{ minHeight: getEffectiveTextSize(44), minWidth: getEffectiveTextSize(44) }}
                >
                  {t(`difficulty.${d}` as "difficulty.easy" | "difficulty.medium" | "difficulty.hard")}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowRanking(true)}
              className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors border border-white/10"
              title="Leaderboard"
              style={{ minHeight: getEffectiveTextSize(44), minWidth: getEffectiveTextSize(44) }}
            >
              <Trophy className="w-5 h-5" />
            </button>
          </div>
        </GameStartScreen>

        <RankingDialog
          open={showRanking}
          onOpenChange={setShowRanking}
          apiEndpoint="/api/v1/games/castle-defense/ranking"
          translationNamespace="castleDefense"
        />
      </div>
    );
  }

  if (gameState?.status === "gameover" || gameState?.status === "victory") {
    const totalAttempts =
      gameState.correctWordCollections + gameState.incorrectWordCollections;
    const accuracy =
      totalAttempts > 0 ? gameState.correctWordCollections / totalAttempts : 0;
    const endStatus = gameState.status === "victory" ? "victory" : "defeat";
    const endTitle =
      gameState.status === "victory"
        ? t("messages.victory")
        : t("messages.defeat");
    const endSubtitle =
      gameState.status === "victory"
        ? t("messages.victoryDesc")
        : t("messages.defeatDesc");

    return (
      <div className="relative h-[60vh] w-full overflow-hidden rounded-2xl bg-slate-950 border border-white/10 md:aspect-video md:h-auto">
        <GameEndScreen
          status={endStatus}
          score={gameState.score}
          xp={calculateCastleDefenseXP(gameState)}
          accuracy={accuracy}
          title={endTitle}
          subtitle={endSubtitle}
          customStats={[
            {
              label: t("messages.wavesCleared"),
              value: gameState.wavesCompleted,
            },
            {
              label: t("messages.enemiesDefeated"),
              value: gameState.totalEnemiesDefeated,
            },
          ]}
          onRestart={handleBackToMenu}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[calc(100svh-8rem)] w-full overflow-hidden rounded-3xl bg-slate-900 touch-none md:aspect-video md:h-auto select-none"
    >
      {gameState && dimensions.width > 0 && dimensions.height > 0 && (
        <Stage width={dimensions.width} height={dimensions.height}>
          <Layer
            scaleX={camera.scale}
            scaleY={camera.scale}
            x={camera.x}
            y={camera.y}
          >
            <BackgroundLayer
              grassMap={gameState.grassMap}
              path={gameState.path}
            />

            {gameState.towerSlots.map((slot) => (
              <Group key={slot.id}>
                {gameState.sentenceCompleted &&
                  !gameState.towers.some(
                    (tower) => tower.id === `tower-${slot.id}`,
                  ) && (
                    <Circle
                      x={slot.x}
                      y={slot.y}
                      radius={TILE_SIZE * 0.6}
                      stroke={
                        activeBuildSlot?.id === slot.id
                          ? "#22c55e"
                          : "rgba(250, 204, 21, 0.9)"
                      }
                      strokeWidth={activeBuildSlot?.id === slot.id ? 4 : 2}
                      dash={activeBuildSlot?.id === slot.id ? [6, 4] : [4, 6]}
                    />
                  )}
                <KonvaImage
                  image={assets.towerBase}
                  x={slot.x}
                  y={slot.y}
                  width={TILE_SIZE}
                  height={TILE_SIZE}
                  offsetX={TILE_SIZE / 2}
                  offsetY={TILE_SIZE / 2}
                  opacity={
                    gameState.towers.some(
                      (tower) => tower.id === `tower-${slot.id}`,
                    )
                      ? 0.3
                      : 0.8
                  }
                />
              </Group>
            ))}

            {gameState.towers.map((tower) => (
              <Group key={tower.id}>
                <Circle
                  x={tower.x}
                  y={tower.y}
                  radius={tower.range}
                  stroke="rgba(59, 130, 246, 0.2)"
                  strokeWidth={1}
                  dash={[10, 5]}
                />
                <KonvaImage
                  image={assets.towerBuilt}
                  x={tower.x}
                  y={tower.y}
                  width={TILE_SIZE * 1.2}
                  height={TILE_SIZE * 1.2}
                  offsetX={(TILE_SIZE * 1.2) / 2}
                  offsetY={(TILE_SIZE * 1.2) / 2}
                />
              </Group>
            ))}

            {buildEffects.map((effect) => {
              const age = Date.now() - effect.createdAt;
              const progress = Math.min(age / 600, 1);
              const radius = TILE_SIZE * (0.6 + progress * 0.8);
              const opacity = 1 - progress;
              return (
                <Circle
                  key={effect.id}
                  x={effect.x}
                  y={effect.y}
                  radius={radius}
                  stroke={`rgba(34, 197, 94, ${opacity})`}
                  strokeWidth={3}
                />
              );
            })}

            <KonvaImage
              image={assets.base}
              x={gameState.base.x}
              y={gameState.base.y}
              width={TILE_SIZE * 1.5}
              height={TILE_SIZE * 1.5}
              offsetX={(TILE_SIZE * 1.5) / 2}
              offsetY={(TILE_SIZE * 1.5) / 2}
            />

            {gameState.projectiles.map((proj) => (
              <Circle
                key={proj.id}
                x={proj.x}
                y={proj.y}
                radius={proj.radius}
                fill="#fbbf24"
              />
            ))}

            {gameState.enemies.map((enemy) => {
              const enemyImage =
                enemy.type === "boss"
                  ? assets.boss
                  : enemy.type === "tank"
                    ? assets.tank
                    : assets.soldier;
              const size =
                enemy.type === "boss" ? 72 : enemy.type === "tank" ? 56 : 40;

              const grid =
                enemy.type === "boss"
                  ? grids?.boss
                  : enemy.type === "tank"
                    ? grids?.tank
                    : grids?.soldier;

              return (
                <Group key={enemy.id}>
                  {grid && (
                    <KonvaImage
                      image={enemyImage}
                      x={enemy.x}
                      y={enemy.y}
                      width={size}
                      height={size}
                      offsetX={size / 2}
                      offsetY={size / 2}
                      crop={getSpriteCrop(grid.fw, grid.fh, enemyFrame, 1)}
                    />
                  )}
                  <Rect
                    x={enemy.x - 15}
                    y={enemy.y - size / 2 - 10}
                    width={30}
                    height={4}
                    fill="#333"
                    cornerRadius={2}
                  />
                  <Rect
                    x={enemy.x - 15}
                    y={enemy.y - size / 2 - 10}
                    width={30 * (enemy.hp / enemy.maxHp)}
                    height={4}
                    fill={enemy.hp > enemy.maxHp * 0.5 ? "#22c55e" : "#ef4444"}
                    cornerRadius={2}
                  />
                </Group>
              );
            })}

            {gameState.words
              .filter((w) => !w.isCollected)
              .map((word) => (
                <Group key={word.term + word.x} x={word.x} y={word.y}>
                  <Circle
                    radius={WORD_RADIUS}
                    fill="white"
                    stroke="#111"
                    strokeWidth={2}
                  />
                  <Text
                    text={word.translation}
                    fontSize={getEffectiveTextSize(16)}
                    fontStyle="bold"
                    fill="black"
                    offsetX={word.radius}
                    offsetY={word.radius}
                    width={word.radius * 2}
                    height={word.radius * 2}
                    align="center"
                    verticalAlign="middle"
                  />
                </Group>
              ))}

            {grids && (
              <KonvaImage
                image={assets.player}
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
                scaleX={input.dx < 0 ? -1 : 1}
              />
            )}
          </Layer>
        </Stage>
      )}

      {gameState && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1 md:gap-2 w-[min(92vw,560px)]">
          {gameState.currentSentenceThai && (
            <div className="bg-blue-900/90 border border-blue-400/40 px-3 py-1.5 md:px-5 md:py-2 rounded-2xl shadow-xl backdrop-blur-md w-full">
              <div className="text-white text-xs md:text-xl font-black text-center leading-snug" style={{ fontSize: getEffectiveTextSize(16) }}>
                {gameState.currentSentenceThai}
              </div>
            </div>
          )}
          <div className="bg-slate-950/70 border border-white/10 px-3 py-1 md:px-4 md:py-2 rounded-xl shadow-lg backdrop-blur-md text-center w-full">
            <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-0.5" style={{ fontSize: getEffectiveTextSize(16) }}>
              {t("hud.progress")}
            </span>
            <div className="text-xs md:text-base font-semibold text-white" style={{ fontSize: getEffectiveTextSize(16) }}>
              {gameState.sentenceWords.map((word, idx) => (
                <span
                  key={`${word}-${idx}`}
                  className={
                    gameState.collectedWordIndices.includes(idx)
                      ? "text-emerald-300"
                      : "text-slate-400"
                  }
                >
                  {gameState.collectedWordIndices.includes(idx)
                    ? word
                    : "___"}{" "}
                </span>
              ))}
            </div>
          </div>
          {gameState.sentenceCompleted && (
            <div className="bg-emerald-600/90 border border-emerald-300/60 px-3 py-0.5 rounded-full shadow-lg text-white text-[10px] font-black uppercase tracking-widest" style={{ fontSize: getEffectiveTextSize(16) }}>
              {t("messages.sentenceComplete")}
            </div>
          )}
          <div className="bg-slate-950/70 border border-white/10 px-3 py-0.5 rounded-full shadow-lg text-white text-[10px] font-bold uppercase tracking-widest" style={{ fontSize: getEffectiveTextSize(16) }}>
            {t("hud.wave", {
              current: gameState.wave,
              killed: gameState.enemiesKilledThisWave,
              total: gameState.totalEnemiesThisWave,
            })}
          </div>
        </div>
      )}

      <div className="absolute bottom-[6.5rem] left-3 z-30 pointer-events-none md:bottom-auto md:top-4 md:left-4">
        <div className="bg-slate-900/90 border border-slate-700/50 px-2 py-1 md:px-4 md:py-2 rounded-xl md:rounded-2xl shadow-xl backdrop-blur-md">
          <span className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest block leading-none mb-0.5" style={{ fontSize: getEffectiveTextSize(16) }}>
            {t("hud.score")}
          </span>
          <span className="text-base md:text-xl font-black text-white leading-none" style={{ fontSize: getEffectiveTextSize(20) }}>
            {gameState?.score || 0}
          </span>
        </div>
      </div>

      <div className="absolute bottom-[6.5rem] right-3 z-30 pointer-events-none md:bottom-auto md:top-4 md:right-4">
        <div className="bg-slate-900/90 border border-slate-700/50 px-2 py-1 md:px-4 md:py-2 rounded-xl md:rounded-2xl shadow-xl backdrop-blur-md text-right">
          <span className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest block leading-none mb-0.5" style={{ fontSize: getEffectiveTextSize(16) }}>
            {t("hud.castleHp")}
          </span>
          <div className="flex items-center gap-1 md:gap-2">
            <span className="text-base md:text-xl font-black text-rose-500 leading-none" style={{ fontSize: getEffectiveTextSize(20) }}>
              {gameState?.base.hp || 0}
            </span>
            <div className="w-12 md:w-16 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full bg-rose-500 transition-all duration-300"
                style={{
                  width: `${((gameState?.base.hp || 0) / (gameState?.base.maxHp || 100)) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {activeBuildSlot && (
        <div className="absolute bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-emerald-600/90 border border-emerald-300/60 px-4 md:px-5 py-1.5 md:py-2 rounded-full shadow-lg text-white font-black uppercase tracking-widest text-[10px] md:text-xs" style={{ fontSize: getEffectiveTextSize(16) }}>
            {t("hud.buildTower")}
          </div>
        </div>
      )}

      {gameState?.waveMessage && (
        <div className="absolute top-[30%] md:top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-amber-500/90 border border-amber-200/60 px-5 md:px-6 py-1.5 md:py-2 rounded-full shadow-xl text-white font-black uppercase tracking-widest text-[10px] md:text-xs" style={{ fontSize: getEffectiveTextSize(16) }}>
            {gameState.waveMessage}
          </div>
        </div>
      )}

      <div
        className="absolute bottom-6 right-6 z-30 pointer-events-auto"
        data-testid="virtual-dpad"
      >
        <VirtualDPad onInput={setVirtualInput} />
      </div>
    </div>
  );
}
