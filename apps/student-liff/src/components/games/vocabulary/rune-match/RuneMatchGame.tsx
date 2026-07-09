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
  Rect,
  Text,
  Group,
  Image as KonvaImage,
  Circle,
} from "react-konva";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, RefreshCcw } from "lucide-react";
import {
  createRuneMatchState,
  initializeGrid,
  swapRunes,
  findMatches,
  processMatches,
  applyMatchResult,
  advanceTime,
  shuffleGrid,
  freezeMonster,
  findPossibleMoves,
  type RuneMatchState,
} from "@/lib/games/runeMatch";
import {
  RUNE_MATCH_CONFIG,
  MONSTER_DIFFICULTY,
  type MonsterType,
} from "@/lib/games/runeMatchConfig";
import type { VocabularyItem } from "@/store/useGameStore";
import { withBasePath } from "@/lib/games/basePath";
import { MonsterSelection } from "./MonsterSelection";
import { Button } from "@/components/ui/button";
import { useScopedI18n } from "@/locales/client";
import { useGameFullscreen } from "@/hooks/useGameFullscreen";
import { useAccessibilitySettings } from "@/hooks/useAccessibilitySettings";
import { GameStartScreen } from "@/components/games/game/GameStartScreen";
import { GameEndScreen } from "@/components/games/game/GameEndScreen";
import { calculateXP } from "@/lib/games/xp";

export type RuneMatchGameResult = {
  xp: number;
  accuracy: number;
  score: number;
  correctAnswers: number;
  totalAttempts: number;
  monsterType?: string;
  difficulty?: string;
};
export type RuneMatchGameProps = {
  vocabulary: VocabularyItem[];
  onComplete: (result: RuneMatchGameResult) => void;
};

type RuneMatchAssets = {
  monsters: {
    goblin: HTMLImageElement;
    skeleton: HTMLImageElement;
    orc: HTMLImageElement;
    dragon: HTMLImageElement;
  };
  runes: {
    base: HTMLImageElement;
    heal: HTMLImageElement;
    shield: HTMLImageElement;
  };
  background: HTMLImageElement;
};

export function RuneMatchGame({ vocabulary, onComplete }: RuneMatchGameProps) {
  const t = useScopedI18n("pages.student.gamesPage");
  const [gameState, setGameState] = useState<RuneMatchState | null>(null);
  const [assets, setAssets] = useState<RuneMatchAssets | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [animFrame, setAnimFrame] = useState(0);
  const [monsterAnimFrame, setMonsterAnimFrame] = useState(0);

  const { containerRef: fullscreenRef, enterFullscreen, exitFullscreen } = useGameFullscreen();
  const { getEffectiveTextSize } = useAccessibilitySettings();

  // Merge refs so both fullscreen and ResizeObserver work
  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      (fullscreenRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [fullscreenRef],
  );

  const layout = useMemo(() => {
    const padding = 16;
    const isMobile = dimensions.width < 768; // Mobile breakpoint

    if (isMobile) {
      // Vertical layout: monster on top, grid below, special moves at bottom
      const monsterAreaHeight = dimensions.height * 0.25; // Create more vertical space
      const gridAreaHeight = dimensions.height * 0.6; // Leave 15% for bottom bar
      const availableGridWidth = dimensions.width - padding * 2;
      const availableGridHeight = gridAreaHeight - padding;
      const cellSize = Math.min(
        availableGridWidth / RUNE_MATCH_CONFIG.grid.columns,
        availableGridHeight / RUNE_MATCH_CONFIG.grid.rows,
      );
      const gridWidth = cellSize * RUNE_MATCH_CONFIG.grid.columns;
      const gridHeight = cellSize * RUNE_MATCH_CONFIG.grid.rows;
      const gridX = (dimensions.width - gridWidth) / 2;
      // Center grid in its area, but push it slightly up if needed
      const gridY = monsterAreaHeight + (gridAreaHeight - gridHeight) / 2;
      return {
        cellSize,
        gridX,
        gridY,
        gridWidth,
        gridHeight,
        sidebarWidth: 0,
        monsterAreaHeight,
        isMobile: true,
      };
    } else {
      // Horizontal layout: sidebar on left, grid on right
      const sidebarWidth = Math.min(200, dimensions.width * 0.25);
      const gridAreaWidth = dimensions.width - sidebarWidth - padding * 2;
      const gridAreaHeight = dimensions.height - padding * 2;
      const cellSize = Math.min(
        gridAreaWidth / RUNE_MATCH_CONFIG.grid.columns,
        gridAreaHeight / RUNE_MATCH_CONFIG.grid.rows,
      );
      const gridWidth = cellSize * RUNE_MATCH_CONFIG.grid.columns;
      const gridHeight = cellSize * RUNE_MATCH_CONFIG.grid.rows;
      const gridX = sidebarWidth + (gridAreaWidth - gridWidth) / 2 + padding;
      const gridY = (dimensions.height - gridHeight) / 2;
      return {
        cellSize,
        gridX,
        gridY,
        gridWidth,
        gridHeight,
        sidebarWidth,
        monsterAreaHeight: 0,
        isMobile: false,
      };
    }
  }, [dimensions]);

  useEffect(() => {
    const rInt = setInterval(() => setAnimFrame((f) => (f + 1) % 3), 500);
    const mInt = setInterval(
      () => setMonsterAnimFrame((f) => (f + 1) % 3),
      150,
    );
    return () => {
      clearInterval(rInt);
      clearInterval(mInt);
    };
  }, []);

  useEffect(() => {
    if (gameState?.status === "playing") {
      enterFullscreen();
    } else {
      exitFullscreen();
    }
    return () => {
      exitFullscreen();
    };
  }, [gameState?.status, enterFullscreen, exitFullscreen]);

  useEffect(() => {
    let lastTime = performance.now();
    let frameId: number;
    const tick = (now: number) => {
      const rawDt = now - lastTime;
      lastTime = now;
      const dt = Math.min(rawDt, 50); // Clamp delta to 50ms
      setGameState((current) => {
        if (!current || current.status !== "playing") return current;
        return advanceTime(current, dt);
      });
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoadError(null);
    const load = async () => {
      const loadImage = (src: string): Promise<HTMLImageElement> =>
        new Promise((res, rej) => {
          const img = new Image();
          img.src = withBasePath(src);
          img.onload = () => res(img);
          img.onerror = () => rej(new Error(`Failed to load image: ${src}`));
        });
      try {
        const [goblin, skeleton, orc, dragon, base, heal, shield, background] =
          await Promise.all([
            loadImage("/games/vocabulary/rune-match/monsters/goblin_3x4_pose_sheet.png"),
            loadImage("/games/vocabulary/rune-match/monsters/skeleton_3x4_pose_sheet.png"),
            loadImage("/games/vocabulary/rune-match/monsters/orc_3x4_pose_sheet.png"),
            loadImage("/games/vocabulary/rune-match/monsters/dragon_3x4_pose_sheet.png"),
            loadImage("/games/vocabulary/rune-match/runes/rune_base_3x2_pose_sheet.png"),
            loadImage("/games/vocabulary/rune-match/runes/rune_heal_3x2_pose_sheet.png"),
            loadImage("/games/vocabulary/rune-match/runes/rune_shield_3x2_pose_sheet.png"),
            loadImage("/games/vocabulary/rune-match/ui/background-tiled.png"),
          ]);
        if (mounted)
          setAssets({
            monsters: { goblin, skeleton, orc, dragon },
            runes: { base, heal, shield },
            background,
          });
      } catch (e) {
        console.error("Failed to load assets", e);
        if (mounted)
          setLoadError(
            "Failed to load game assets. Please check your connection.",
          );
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [retryCount]);

  const resetGame = useCallback(() => {
    if (vocabulary.length > 0) setGameState(createRuneMatchState(vocabulary));
  }, [vocabulary]);

  const handleStartGame = useCallback(() => {
    setGameStarted(true);
    resetGame();
  }, [resetGame]);

  const handleSelectMonster = useCallback((monsterType: MonsterType) => {
    const config = RUNE_MATCH_CONFIG.monsters[monsterType];
    setGameState((prev) => {
      if (!prev) return null;
      // Use activeVocabulary if available, otherwise fallback to full vocab (should be there from createRuneMatchState)
      const vocabToUse = prev.activeVocabulary || prev.vocabulary;
      const grid = initializeGrid(vocabToUse, { rng: prev.rng });
      return {
        ...prev,
        status: "playing",
        selectedMonster: monsterType,
        monster: {
          type: monsterType,
          hp: config.hp,
          maxHp: config.hp,
          attack: config.attack,
          xp: config.xp,
        },
        grid,
      };
    });
  }, []);

  const handleCellClick = useCallback((row: number, col: number) => {
    setGameState((prev) => {
      if (!prev || prev.status !== "playing") return prev;
      const selected = prev.selectedCell;
      if (!selected) return { ...prev, selectedCell: { row, col } };
      const isAdjacent =
        (Math.abs(selected.row - row) === 1 && selected.col === col) ||
        (Math.abs(selected.col - col) === 1 && selected.row === row);
      if (isAdjacent) {
        const gridAfterSwap = swapRunes(prev.grid, selected, { row, col });
        const matches = findMatches(gridAfterSwap);
        if (matches.length > 0) {
          const vocabToUse = prev.activeVocabulary || prev.vocabulary;
          const result = processMatches(gridAfterSwap, vocabToUse, {
            rng: prev.rng,
          });
          const newState = {
            ...applyMatchResult({ ...prev, grid: gridAfterSwap }, result),
            selectedCell: null,
            currentStreak: prev.currentStreak + 1, // Increment combo
            hintCells: [], // Clear hints on match
          };

          // Award bomb for matching 5+ runes
          const hasLargeMatch = result.groups.some((g) => g.coords.length >= 5);
          if (hasLargeMatch) {
            newState.specialMoves = {
              ...newState.specialMoves,
              bomb: newState.specialMoves.bomb + 1,
            };
          }

          // Award freeze for matching shield
          const hasShieldMatch = result.groups.some((g) => g.type === "shield");
          if (hasShieldMatch && !newState.specialMoves.freeze) {
            newState.specialMoves = {
              ...newState.specialMoves,
              freeze: newState.specialMoves.freeze + 1,
            };
          }

          // Monster counter-attack removed (now realtime)

          // Clear frozen after attack
          if (newState.isFrozen) {
            newState.isFrozen = false;
          }

          // Random new power word
          newState.powerWord =
            prev.vocabulary[
              Math.floor(prev.rng() * prev.vocabulary.length)
            ].translation;

          return newState;
        } else {
          // No match: Allow swap but deduct 1 HP
          const newHp = Math.max(0, prev.player.hp - 1);
          return {
            ...prev,
            grid: gridAfterSwap,
            player: { ...prev.player, hp: newHp },
            selectedCell: null,
            status: newHp <= 0 ? "defeat" : prev.status,
            floatingTexts: [
              ...prev.floatingTexts,
              {
                id: Math.random().toString(36).substring(2, 9),
                text: "-1 HP",
                x: col,
                y: row,
                offsetX: 0,
                offsetY: 0,
                color: "#ef4444",
                opacity: 1,
                scale: 1,
                duration: 1500,
                maxDuration: 1500,
              },
            ],
            shakeIntensity: newHp < prev.player.hp ? 0.5 : prev.shakeIntensity,
          };
        }
      } else {
        return { ...prev, selectedCell: { row, col } };
      }
    });
  }, []);

  const handleShuffle = useCallback(() => {
    setGameState((prev) => (prev ? shuffleGrid(prev) : prev));
  }, []);

  const handleFreeze = useCallback(() => {
    setGameState((prev) => (prev ? freezeMonster(prev) : prev));
  }, []);

  const handleHint = useCallback(() => {
    setGameState((prev) => {
      if (!prev || prev.grid.length === 0) return prev;
      // Only show hints for Goblin and Skeleton
      if (
        prev.selectedMonster !== "goblin" &&
        prev.selectedMonster !== "skeleton"
      )
        return prev;

      // Check if hints remaining
      if (prev.hintsRemaining <= 0) return prev;

      const possibleMoves = findPossibleMoves(prev.grid);
      if (possibleMoves.length > 0) {
        const randomMove =
          possibleMoves[Math.floor(prev.rng() * possibleMoves.length)];
        return {
          ...prev,
          hintsRemaining: prev.hintsRemaining - 1,
          hintCells: [randomMove.from, randomMove.to],
          floatingTexts: [
            ...prev.floatingTexts,
            {
              id: Math.random().toString(36).substring(2, 9),
              text: "💡 HINT!",
              x: -1,
              y: -1,
              offsetX: 0,
              offsetY: 0,
              color: "#facc15",
              opacity: 1,
              scale: 1,
              duration: 2000,
              maxDuration: 2000,
            },
          ],
        };
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateDimensions = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) setDimensions({ width, height });
    };
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0)
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
      }
    });
    observer.observe(containerRef.current);
    updateDimensions();
    const interval = setInterval(updateDimensions, 200);
    const timeout = setTimeout(() => clearInterval(interval), 2000);
    return () => {
      observer.disconnect();
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const handleRestart = useCallback(() => {
    setGameStarted(false);
    setGameState(null);
    exitFullscreen();
  }, [exitFullscreen]);

  const handleExit = useCallback(() => {
    setGameStarted(false);
    setGameState(null);
    exitFullscreen();
  }, [exitFullscreen]);

  useEffect(() => {
    if (!gameState) return;
    if (gameState.status === "victory" || gameState.status === "defeat") {
      const xp =
        gameState.status === "victory"
          ? calculateXP(
              gameState.monster?.xp || 0,
              gameState.correctAnswers,
              gameState.totalAttempts,
            )
          : 0;
      onComplete({
        xp,
        accuracy:
          gameState.totalAttempts > 0
            ? (gameState.correctAnswers / gameState.totalAttempts) * 100
            : gameState.status === "victory"
              ? 100
              : 0,
        score: gameState.monster?.xp || 0,
        correctAnswers: gameState.correctAnswers,
        totalAttempts: gameState.totalAttempts,
        monsterType: gameState.monster?.type,
        difficulty:
          MONSTER_DIFFICULTY[
            (gameState.monster?.type || "goblin") as MonsterType
          ],
      });
    }
  }, [gameState, onComplete]);

  if (!gameStarted) {
    return (
      <div
        ref={mergedRef}
        data-testid="rune-match-container"
        className="relative h-[80vh] w-full overflow-hidden rounded-2xl bg-slate-900/40 backdrop-blur-sm border border-white/10 md:aspect-video md:h-auto"
      >
        <GameStartScreen
          gameTitle={t("games.runeMatch.title")}
          vocabulary={vocabulary}
          onStart={handleStartGame}
          instructions={[
            { step: 1, text: t("runeMatch.tip1") },
            { step: 2, text: t("runeMatch.tip2") },
            { step: 3, text: t("runeMatch.tip3") },
            { step: 4, text: t("runeMatch.tip4") },
          ]}
        >
          <MonsterSelection onSelect={(type) => {
            handleStartGame();
            setTimeout(() => handleSelectMonster(type), 0);
          }} />
        </GameStartScreen>
      </div>
    );
  }

  if (!assets || !gameState || dimensions.width === 0) {
    return (
      <div
        ref={mergedRef}
        data-testid="rune-match-container"
        className="relative h-[60vh] w-full overflow-hidden rounded-2xl bg-slate-950 flex items-center justify-center border border-white/10 md:aspect-video md:h-auto"
      >
        <div className="flex flex-col items-center gap-4 text-center p-4">
          {loadError ? (
            <>
              <AlertCircle className="h-12 w-12 text-red-500 mb-2" />
              <p className="text-sm text-red-400 font-medium">{loadError}</p>
              <Button
                onClick={() => setRetryCount((c) => c + 1)}
                variant="outline"
                size="sm"
                className="mt-2 text-white border-white/20 hover:bg-white/10"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Retry Loading
              </Button>
            </>
          ) : (
            <>
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white"></div>
              <p className="text-sm text-white/60">Loading assets...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const renderHealthBar = (
    x: number,
    y: number,
    width: number,
    current: number,
    max: number,
    color: string,
    label: string,
  ) => {
    const height = 20;
    const progress = Math.max(0, Math.min(1, current / max));
    return (
      <Group x={x} y={y}>
        <Rect
          width={width}
          height={height}
          fill="rgba(0, 0, 0, 0.5)"
          cornerRadius={height / 2}
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth={1}
        />
        <Rect
          width={Math.max(height, width * progress)}
          height={height}
          fill={color}
          cornerRadius={height / 2}
        />
        <Text
          text={`${label}: ${Math.ceil(current)}/${max}`}
          width={width}
          height={height}
          fontSize={getEffectiveTextSize(16)}
          fill="white"
          align="center"
          verticalAlign="middle"
          fontStyle="bold"
          fontFamily="Arial"
        />
      </Group>
    );
  };

  return (
    <div
      ref={mergedRef}
      data-testid="rune-match-container"
      className="relative h-[80vh] w-full overflow-hidden rounded-2xl bg-slate-900/40 backdrop-blur-sm border border-white/10 md:aspect-video md:h-auto"
    >
      <AnimatePresence mode="wait">
        {gameState.status === "selection" && (
          <motion.div
            key="selection"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-start justify-center bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
          >
            <MonsterSelection onSelect={handleSelectMonster} />
          </motion.div>
        )}
        {gameState.status === "victory" && (
          <GameEndScreen
            status="victory"
            score={gameState.monster?.xp || 0}
            xp={calculateXP(
              gameState.monster?.xp || 0,
              gameState.correctAnswers,
              gameState.totalAttempts,
            )}
            accuracy={
              gameState.totalAttempts > 0
                ? gameState.correctAnswers / gameState.totalAttempts
                : 1
            }
            onRestart={handleRestart}
            onExit={handleExit}
            customStats={[
              {
                label: "Monster",
                value: gameState.monster?.type || "",
              },
              {
                label: "Difficulty",
                value:
                  MONSTER_DIFFICULTY[
                    (gameState.monster?.type || "goblin") as MonsterType
                  ],
              },
            ]}
          />
        )}
        {gameState.status === "defeat" && (
          <GameEndScreen
            status="defeat"
            score={0}
            xp={0}
            accuracy={
              gameState.totalAttempts > 0
                ? gameState.correctAnswers / gameState.totalAttempts
                : 0
            }
            onRestart={handleRestart}
            onExit={handleExit}
            customStats={[
              {
                label: "Monster",
                value: gameState.monster?.type || "",
              },
              {
                label: "Difficulty",
                value:
                  MONSTER_DIFFICULTY[
                    (gameState.monster?.type || "goblin") as MonsterType
                  ],
              },
            ]}
          />
        )}
      </AnimatePresence>
      <Stage width={dimensions.width} height={dimensions.height}>
        <Layer>
          <Group
            x={gameState.shakeIntensity * (Math.random() * 10 - 5)}
            y={gameState.shakeIntensity * (Math.random() * 10 - 5)}
          >
            <KonvaImage
              image={assets.background}
              width={dimensions.width}
              height={dimensions.height}
              opacity={0.2}
            />
            {(gameState.status === "playing" ||
              gameState.status === "victory" ||
              gameState.status === "defeat") && (
              <Group>
                {/* Desktop: Left Sidebar */}
                {!layout.isMobile && (
                  <Group>
                    <Rect
                      x={0}
                      y={0}
                      width={layout.sidebarWidth}
                      height={dimensions.height}
                      fill="rgba(0, 0, 0, 0.3)"
                    />
                    {gameState.monster && (
                      <Group>
                        <KonvaImage
                          image={assets.monsters[gameState.monster.type]}
                          x={(layout.sidebarWidth - 80) / 2}
                          y={20}
                          width={80}
                          height={80}
                          crop={{
                            x:
                              monsterAnimFrame *
                              (assets.monsters[gameState.monster.type].width /
                                3),
                            y:
                              (gameState.monsterState === "idle"
                                ? 0
                                : gameState.monsterState === "attack"
                                  ? 1
                                  : gameState.monsterState === "hurt"
                                    ? 2
                                    : 3) *
                              (assets.monsters[gameState.monster.type].height /
                                4),
                            width:
                              assets.monsters[gameState.monster.type].width / 3,
                            height:
                              assets.monsters[gameState.monster.type].height /
                              4,
                          }}
                        />
                        {renderHealthBar(
                          10,
                          110,
                          layout.sidebarWidth - 20,
                          gameState.monster.hp,
                          gameState.monster.maxHp,
                          "#ef4444",
                          gameState.monster.type.toUpperCase(),
                        )}
                      </Group>
                    )}
                    <Text
                      text="POWER WORD"
                      x={10}
                      y={160}
                      width={layout.sidebarWidth - 20}
                      fontSize={getEffectiveTextSize(16)}
                      fill="#94a3b8"
                      fontStyle="bold"
                      align="center"
                      fontFamily="Arial"
                    />
                    <Text
                      text={gameState.powerWord?.toUpperCase() || ""}
                      x={10}
                      y={175}
                      width={layout.sidebarWidth - 20}
                      fontSize={getEffectiveTextSize(16)}
                      fill="#facc15"
                      fontStyle="bold"
                      align="center"
                      fontFamily="Sarabun, Arial"
                    />
                    {renderHealthBar(
                      10,
                      210,
                      layout.sidebarWidth - 20,
                      gameState.player.hp,
                      gameState.player.maxHp,
                      "#22c55e",
                      "PLAYER",
                    )}
                    {gameState.player.hasShield && (
                      <Text
                        text="🛡️ SHIELD"
                        x={10}
                        y={240}
                        width={layout.sidebarWidth - 20}
                        fontSize={getEffectiveTextSize(16)}
                        fill="#60a5fa"
                        fontStyle="bold"
                        align="center"
                      />
                    )}
                    {/* Combo Display */}
                    {gameState.currentStreak > 0 && (
                      <Text
                        text={`🔥 COMBO x${gameState.currentStreak}`}
                        x={10}
                        y={260}
                        width={layout.sidebarWidth - 20}
                        fontSize={getEffectiveTextSize(16)}
                        fill="#fb923c"
                        fontStyle="bold"
                        align="center"
                      />
                    )}
                    {/* Skills Header */}
                    <Text
                      text="SKILLS"
                      x={10}
                      y={290}
                      width={layout.sidebarWidth - 20}
                      fontSize={getEffectiveTextSize(16)}
                      fill="#94a3b8"
                      fontStyle="bold"
                      align="center"
                      fontFamily="Arial"
                    />

                    {/* Skill Buttons Grid */}
                    {(() => {
                      const gap = 10;
                      const cols = 2;
                      const width =
                        (layout.sidebarWidth - 20 - gap * (cols - 1)) / cols;
                      const height = 50;
                      const startY = 310;

                      const renderButton = (
                        index: number,
                        label: string,
                        icon: string,
                        count: number,
                        color: string,
                        onClick?: () => void,
                      ) => {
                        const col = index % cols;
                        const row = Math.floor(index / cols);
                        const x = 10 + col * (width + gap);
                        const y = startY + row * (height + gap);
                        const isDisabled = count <= 0;

                        return (
                          <Group
                            key={label}
                            x={x}
                            y={y}
                            onClick={!isDisabled ? onClick : undefined}
                            onTap={!isDisabled ? onClick : undefined}
                            opacity={isDisabled ? 0.5 : 1}
                          >
                            <Rect
                              width={width}
                              height={height}
                              fill="#1e293b"
                              stroke={isDisabled ? "#334155" : color}
                              strokeWidth={1}
                              cornerRadius={8}
                              shadowColor={isDisabled ? "transparent" : color}
                              shadowBlur={isDisabled ? 0 : 5}
                              shadowOpacity={0.2}
                            />
                            <Text
                              text={icon}
                              x={0}
                              y={8}
                              width={width}
                              align="center"
                              fontSize={20}
                            />
                            <Text
                              text={label}
                              x={0}
                              y={32}
                              width={width}
                              align="center"
                              fontSize={getEffectiveTextSize(16)}
                              fill="#cbd5e1"
                              fontStyle="bold"
                            />
                            <Group x={width - 18} y={-5}>
                              <Circle radius={9} fill={color} />
                              <Text
                                text={count.toString()}
                                x={-9}
                                y={-5}
                                width={18}
                                align="center"
                                fontSize={getEffectiveTextSize(16)}
                                fill="#000000"
                                fontStyle="bold"
                              />
                            </Group>
                          </Group>
                        );
                      };

                      return (
                        <Group>
                          {renderButton(
                            0,
                            "Shuffle",
                            "🔀",
                            gameState.specialMoves.shuffle,
                            "#22c55e",
                            handleShuffle,
                          )}
                          {renderButton(
                            1,
                            "Bomb",
                            "💣",
                            gameState.specialMoves.bomb,
                            "#f59e0b" /* No handler yet */,
                          )}
                          {renderButton(
                            2,
                            "Freeze",
                            "❄️",
                            gameState.specialMoves.freeze,
                            "#60a5fa",
                            handleFreeze,
                          )}
                          {(gameState.selectedMonster === "goblin" ||
                            gameState.selectedMonster === "skeleton") &&
                            renderButton(
                              3,
                              "Hint",
                              "💡",
                              gameState.hintsRemaining,
                              "#facc15",
                              handleHint,
                            )}
                        </Group>
                      );
                    })()}
                  </Group>
                )}

                {/* Mobile: Top Bar */}
                {layout.isMobile && (
                  <Group>
                    <Rect
                      x={0}
                      y={0}
                      width={dimensions.width}
                      height={layout.monsterAreaHeight}
                      fill="rgba(0, 0, 0, 0.3)"
                    />
                    {gameState.monster && (
                      <Group>
                        <KonvaImage
                          image={assets.monsters[gameState.monster.type]}
                          x={dimensions.width / 2 - 40}
                          y={5}
                          width={80}
                          height={80}
                          crop={{
                            x:
                              monsterAnimFrame *
                              (assets.monsters[gameState.monster.type].width /
                                3),
                            y:
                              (gameState.monsterState === "idle"
                                ? 0
                                : gameState.monsterState === "attack"
                                  ? 1
                                  : gameState.monsterState === "hurt"
                                    ? 2
                                    : 3) *
                              (assets.monsters[gameState.monster.type].height /
                                4),
                            width:
                              assets.monsters[gameState.monster.type].width / 3,
                            height:
                              assets.monsters[gameState.monster.type].height /
                              4,
                          }}
                        />
                        {renderHealthBar(
                          dimensions.width / 2 - 100,
                          90,
                          200,
                          gameState.monster.hp,
                          gameState.monster.maxHp,
                          "#ef4444",
                          gameState.monster.type.toUpperCase(),
                        )}
                      </Group>
                    )}
                    <Text
                      text={`POWER: ${gameState.powerWord?.toUpperCase() || ""}`}
                      x={dimensions.width / 2 - 100}
                      y={125}
                      width={200}
                      fontSize={getEffectiveTextSize(16)}
                      fill="#facc15"
                      fontStyle="bold"
                      align="center"
                      fontFamily="Sarabun, Arial"
                    />
                    {renderHealthBar(
                      dimensions.width / 2 - 100,
                      145,
                      200,
                      gameState.player.hp,
                      gameState.player.maxHp,
                      "#22c55e",
                      "PLAYER",
                    )}
                  </Group>
                )}
                <Rect
                  x={layout.gridX - 8}
                  y={layout.gridY - 8}
                  width={layout.gridWidth + 16}
                  height={layout.gridHeight + 16}
                  fill="rgba(0, 0, 0, 0.4)"
                  cornerRadius={12}
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth={2}
                />
                {gameState.grid.map((row, r) =>
                  row.map((rune, c) => {
                    const isSelected =
                      gameState.selectedCell?.row === r &&
                      gameState.selectedCell?.col === c;
                    const runeSize = layout.cellSize - 4;
                    const spriteSheet =
                      rune.type === "vocabulary"
                        ? assets.runes.base
                        : rune.type === "heal"
                          ? assets.runes.heal
                          : assets.runes.shield;
                    const fw = spriteSheet.width / 3;
                    const fh = spriteSheet.height / 2;
                    const crop = {
                      x: animFrame * fw,
                      y: 0,
                      width: fw,
                      height: fh,
                    };
                    const isHinted = gameState.hintCells.some(
                      (cell) => cell.row === r && cell.col === c,
                    );
                    return (
                      <Group
                        key={rune.id}
                        x={layout.gridX + c * layout.cellSize + 2}
                        y={layout.gridY + r * layout.cellSize + 2}
                        onClick={() => handleCellClick(r, c)}
                        onTap={() => handleCellClick(r, c)}
                      >
                        {/* Hint highlight */}
                        {isHinted && (
                          <Rect
                            width={runeSize + 8}
                            height={runeSize + 8}
                            x={-4}
                            y={-4}
                            fill="rgba(250, 204, 21, 0.3)"
                            cornerRadius={8}
                            stroke="#facc15"
                            strokeWidth={3}
                          />
                        )}
                        {isSelected && (
                          <Rect
                            width={runeSize + 8}
                            height={runeSize + 8}
                            x={-4}
                            y={-4}
                            fill="rgba(96, 165, 250, 0.3)"
                            cornerRadius={8}
                            stroke="#60a5fa"
                            strokeWidth={2}
                          />
                        )}
                        <KonvaImage
                          image={spriteSheet}
                          width={runeSize}
                          height={runeSize}
                          cornerRadius={6}
                          crop={crop}
                        />
                        {rune.type === "vocabulary" && (
                          <Text
                            text={rune.text}
                            width={runeSize - 4}
                            height={runeSize - 4}
                            x={2}
                            y={2}
                            fontSize={Math.max(
                              16,
                              Math.min(
                                layout.cellSize / 3,
                                (runeSize - 8) /
                                  Math.max(1, rune.text.length / 2),
                              ),
                            )}
                            fill="#0f172a"
                            align="center"
                            verticalAlign="middle"
                            fontFamily="Sarabun, Arial"
                            fontStyle="bold"
                          />
                        )}
                      </Group>
                    );
                  }),
                )}
              </Group>
            )}

            {layout.isMobile && gameState.status === "playing" && (
              <Group y={layout.gridY + layout.gridHeight + 25}>
                {(() => {
                  const gap = 8;
                  const cols = 4;
                  const availableWidth = dimensions.width - 20; // Padding 10px each side
                  const buttonWidth =
                    (availableWidth - gap * (cols - 1)) / cols;
                  const height = 50;

                  const renderButton = (
                    index: number,
                    label: string,
                    icon: string,
                    count: number,
                    color: string,
                    onClick?: () => void,
                  ) => {
                    const x = 10 + index * (buttonWidth + gap);
                    const y = 0;
                    const isDisabled = count <= 0;

                    return (
                      <Group
                        key={label}
                        x={x}
                        y={y}
                        onClick={!isDisabled ? onClick : undefined}
                        onTap={!isDisabled ? onClick : undefined}
                        opacity={isDisabled ? 0.5 : 1}
                      >
                        <Rect
                          width={buttonWidth}
                          height={height}
                          fill="#1e293b"
                          stroke={isDisabled ? "#334155" : color}
                          strokeWidth={1}
                          cornerRadius={8}
                          shadowColor={isDisabled ? "transparent" : color}
                          shadowBlur={isDisabled ? 0 : 5}
                          shadowOpacity={0.2}
                        />
                        <Text
                          text={icon}
                          x={0}
                          y={8}
                          width={buttonWidth}
                          align="center"
                          fontSize={20}
                        />
                        <Text
                          text={label}
                          x={0}
                          y={32}
                          width={buttonWidth}
                          align="center"
                          fontSize={getEffectiveTextSize(16)}
                          fill="#cbd5e1"
                          fontStyle="bold"
                        />
                        <Group x={buttonWidth - 16} y={-5}>
                          <Circle radius={8} fill={color} />
                          <Text
                            text={count.toString()}
                            x={-8}
                            y={-5}
                            width={16}
                            align="center"
                            fontSize={getEffectiveTextSize(16)}
                            fill="#000000"
                            fontStyle="bold"
                          />
                        </Group>
                      </Group>
                    );
                  };

                  return (
                    <Group>
                      {renderButton(
                        0,
                        "Shuffle",
                        "🔀",
                        gameState.specialMoves.shuffle,
                        "#22c55e",
                        handleShuffle,
                      )}
                      {renderButton(
                        1,
                        "Bomb",
                        "💣",
                        gameState.specialMoves.bomb,
                        "#f59e0b" /* No handler yet */,
                      )}
                      {renderButton(
                        2,
                        "Freeze",
                        "❄️",
                        gameState.specialMoves.freeze,
                        "#60a5fa",
                        handleFreeze,
                      )}
                      {(gameState.selectedMonster === "goblin" ||
                        gameState.selectedMonster === "skeleton") &&
                        renderButton(
                          3,
                          "Hint",
                          "💡",
                          gameState.hintsRemaining,
                          "#facc15",
                          handleHint,
                        )}
                    </Group>
                  );
                })()}
              </Group>
            )}
            {gameState.floatingTexts.map((ft) => {
              let screenX = dimensions.width / 2;
              let screenY = layout.monsterAreaHeight / 2;
              if (ft.x !== -1) {
                screenX =
                  layout.gridX + ft.x * layout.cellSize + layout.cellSize / 2;
                screenY =
                  layout.gridY + ft.y * layout.cellSize + layout.cellSize / 2;
              }
              return (
                <Text
                  key={ft.id}
                  text={ft.text}
                  x={screenX + ft.offsetX}
                  y={screenY + ft.offsetY - 20}
                  fontSize={28}
                  scaleX={ft.scale}
                  scaleY={ft.scale}
                  fill={ft.color}
                  opacity={ft.opacity}
                  fontStyle="bold"
                  fontFamily="Arial"
                  align="center"
                  shadowColor="black"
                  shadowBlur={4}
                  shadowOpacity={0.8}
                  offsetX={50}
                />
              );
            })}
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
