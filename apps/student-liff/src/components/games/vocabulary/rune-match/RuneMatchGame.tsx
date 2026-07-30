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
import { AlertCircle, RefreshCcw } from "lucide-react";
import {
  createRuneMatchState,
  initializeGrid,
  swapRunes,
  applyPairMatchResult,
  isRunePairMatch,
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
import { Button } from "@/components/ui/button";
import { useGameFullscreen } from "@/hooks/useGameFullscreen";
import { useAccessibilitySettings } from "@/hooks/useAccessibilitySettings";
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
  tutorialMode?: boolean;
  tutorialStep?: number;
  disableAutoFullscreen?: boolean;
  onComplete: (result: RuneMatchGameResult) => void;
};

const RUNE_MATCH_TUTORIAL_STEPS = [
  {
    title: "1. สังเกตรูนคำศัพท์ & คำแปลคู่ตรงกัน",
    detail: "ดูคู่รูนภาษาอังกฤษและภาษาไทยที่มีความหมายตรงกัน (มีกรอบแดง/ทองชี้นำ)",
  },
  {
    title: "2. แตะเลือก 2 แผ่นติดกันเพื่อสลับจับคู่",
    detail: "แตะแผ่นแรกให้เกิดกรอบเลือก แล้วแตะแผ่นที่สองที่อยู่ติดกันเพื่อสลับตำแหน่ง",
  },
  {
    title: "3. รูนระเบิดยิงเวทมนตร์โจมทีมอนสเตอร์",
    detail: "เมื่อจับคู่ถูกต้อง รูนจะระเบิดเป็นลำแสงพลังเวทยิงลดเลือด (HP) มอนสเตอร์ด้านบน",
  },
  {
    title: "4. ใช้สกิลสลับกระดาน / แช่แข็งมอนสเตอร์",
    detail: "แตะปุ่ม Skill ด้านข้าง เช่น Freeze ❄️ เพื่อหยุดมอนสเตอร์ หรือ Shuffle 🔀 เพื่อสลับกระดาน",
  },
];

const MOBILE_GAME_CONTAINER_CLASS =
  "relative h-dvh min-h-[520px] w-full overflow-hidden rounded-none border border-white/10 bg-slate-900/40 backdrop-blur-sm sm:h-[80vh] sm:rounded-2xl md:aspect-video md:h-auto";

const getRuneMatchScore = (state: RuneMatchState) => {
  return Math.min(10, state.correctAnswers);
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

export function RuneMatchGame({
  vocabulary,
  tutorialMode = false,
  tutorialStep = 0,
  disableAutoFullscreen = false,
  onComplete,
}: RuneMatchGameProps) {
  const [gameState, setGameState] = useState<RuneMatchState | null>(null);
  const [assets, setAssets] = useState<RuneMatchAssets | null>(null);

  const targetTutorialMove = useMemo(() => {
    if (!gameState || gameState.grid.length === 0) return null;
    const moves = findPossibleMoves(gameState.grid);
    return moves.length > 0 ? moves[0] : null;
  }, [gameState?.grid]);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const hasReportedRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [animFrame, setAnimFrame] = useState(0);
  const [monsterAnimFrame, setMonsterAnimFrame] = useState(0);
  const [tutProgress, setTutProgress] = useState(0);

  const { containerRef: fullscreenRef, enterFullscreen, exitFullscreen } = useGameFullscreen();
  const { getEffectiveTextSize } = useAccessibilitySettings();

  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      (fullscreenRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [fullscreenRef],
  );

  const layout = useMemo(() => {
    const padding = 12;
    const bottomOffset = disableAutoFullscreen || tutorialMode ? 90 : 0;
    const isMobile = dimensions.width < 768;

    if (isMobile) {
      const monsterAreaHeight = Math.min(110, (dimensions.height - bottomOffset) * 0.2);
      const availableGridArea = dimensions.height - monsterAreaHeight - bottomOffset - 65;
      const availableGridWidth = dimensions.width - padding * 2;
      const availableGridHeight = Math.max(180, availableGridArea);
      const cellSize = Math.min(
        availableGridWidth / RUNE_MATCH_CONFIG.grid.columns,
        availableGridHeight / RUNE_MATCH_CONFIG.grid.rows,
      );
      const gridWidth = cellSize * RUNE_MATCH_CONFIG.grid.columns;
      const gridHeight = cellSize * RUNE_MATCH_CONFIG.grid.rows;
      const gridX = (dimensions.width - gridWidth) / 2;
      const gridY = monsterAreaHeight + Math.max(0, (availableGridHeight - gridHeight) / 2);
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
      const sidebarWidth = Math.min(200, dimensions.width * 0.25);
      const gridAreaWidth = dimensions.width - sidebarWidth - padding * 2;
      const availableHeight = dimensions.height - bottomOffset - padding * 2;
      const cellSize = Math.min(
        gridAreaWidth / RUNE_MATCH_CONFIG.grid.columns,
        availableHeight / RUNE_MATCH_CONFIG.grid.rows,
      );
      const gridWidth = cellSize * RUNE_MATCH_CONFIG.grid.columns;
      const gridHeight = cellSize * RUNE_MATCH_CONFIG.grid.rows;
      const gridX = sidebarWidth + (gridAreaWidth - gridWidth) / 2 + padding;
      const gridY = Math.max(28, (availableHeight - gridHeight) / 2 + padding / 2);
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
  }, [dimensions, disableAutoFullscreen, tutorialMode]);

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
    if (!tutorialMode) return;
    setTutProgress(0);
    setGameState((prev) => (prev ? { ...prev, selectedCell: null, hintCells: [] } : prev));
    const interval = setInterval(() => {
      setTutProgress((p) => (p + 1.5) % 100);
    }, 45);
    return () => clearInterval(interval);
  }, [tutorialMode, tutorialStep]);

  useEffect(() => {
    if (disableAutoFullscreen || tutorialMode) return;
    if (gameState?.status === "playing") {
      enterFullscreen();
    } else {
      exitFullscreen();
    }
    return () => {
      exitFullscreen();
    };
  }, [gameState?.status, enterFullscreen, exitFullscreen, disableAutoFullscreen, tutorialMode]);

  useEffect(() => {
    let lastTime = performance.now();
    let frameId: number;
    const tick = (now: number) => {
      const rawDt = now - lastTime;
      lastTime = now;
      const dt = Math.min(rawDt, 50);
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

  const createPlayingGame = useCallback((monsterType: MonsterType = "goblin") => {
    const config = RUNE_MATCH_CONFIG.monsters[monsterType];
    const initialState = createRuneMatchState(vocabulary);
    const vocabToUse = initialState.activeVocabulary || initialState.vocabulary;
    return {
      ...initialState,
      status: "playing" as const,
      selectedMonster: monsterType,
      monster: {
        type: monsterType,
        hp: config.hp,
        maxHp: config.hp,
        attack: config.attack,
        xp: config.xp,
      },
      grid: initializeGrid(vocabToUse, { rng: initialState.rng }),
    };
  }, [vocabulary]);

  useEffect(() => {
    if (vocabulary.length === 0) return;
    hasReportedRef.current = false;
    setGameState(createPlayingGame("goblin"));
  }, [createPlayingGame, vocabulary.length]);

  const handleCellClick = useCallback((row: number, col: number) => {
    setGameState((prev) => {
      if (!prev || prev.status !== "playing") return prev;
      const selected = prev.selectedCell;
      if (!selected) return { ...prev, selectedCell: { row, col } };

      if (selected.row === row && selected.col === col) {
        return { ...prev, selectedCell: null };
      }

      const isAdjacent =
        (Math.abs(selected.row - row) === 1 && selected.col === col) ||
        (Math.abs(selected.col - col) === 1 && selected.row === row);

      if (!isAdjacent) {
        return { ...prev, selectedCell: { row, col } };
      }

      const gridAfterSwap = swapRunes(prev.grid, selected, { row, col });
      const firstRune = gridAfterSwap[selected.row]?.[selected.col];
      const secondRune = gridAfterSwap[row]?.[col];

      if (isRunePairMatch(firstRune, secondRune)) {
        const vocabToUse = prev.activeVocabulary || prev.vocabulary;
        const newState = {
          ...applyPairMatchResult(
            { ...prev, grid: gridAfterSwap },
            selected,
            { row, col },
          ),
          currentStreak: prev.currentStreak + 1,
          hintCells: [],
        };

        if (findPossibleMoves(newState.grid).length === 0) {
          newState.grid = initializeGrid(vocabToUse, { rng: prev.rng });
          newState.floatingTexts = [
            ...newState.floatingTexts,
            {
              id: Math.random().toString(36).substring(2, 9),
              text: "RESHUFFLE!",
              x: -1,
              y: -1,
              offsetX: 0,
              offsetY: 0,
              color: "#22c55e",
              opacity: 1,
              scale: 1,
              duration: 1600,
              maxDuration: 1600,
            },
          ];
        }

        if (newState.isFrozen) {
          newState.isFrozen = false;
        }

        newState.powerWord =
          prev.vocabulary[
            Math.floor(prev.rng() * prev.vocabulary.length)
          ].translation;

        return newState;
      }

      return {
        ...prev,
        selectedCell: null,
        totalAttempts:
          firstRune?.type === "vocabulary" && secondRune?.type === "vocabulary"
            ? prev.totalAttempts + 1
            : prev.totalAttempts,
        currentStreak: 0,
        floatingTexts: [
          ...prev.floatingTexts,
          {
            id: Math.random().toString(36).substring(2, 9),
            text: "WRONG PAIR",
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
        shakeIntensity: 0.5,
      };
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
      if (
        prev.selectedMonster !== "goblin" &&
        prev.selectedMonster !== "skeleton"
      )
        return prev;

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

  useEffect(() => {
    if (!gameState) return;
    if (hasReportedRef.current) return;
    if (gameState.status === "victory" || gameState.status === "defeat") {
      hasReportedRef.current = true;
      if (tutorialMode || disableAutoFullscreen) {
        const timer = setTimeout(() => {
          hasReportedRef.current = false;
          setGameState(createPlayingGame("goblin"));
        }, 1500);
        return () => clearTimeout(timer);
      }
      const score = getRuneMatchScore(gameState);
      const xp =
        gameState.status === "victory"
          ? calculateXP(
              score,
              gameState.correctAnswers,
              gameState.totalAttempts,
            )
          : 0;
      onComplete({
        xp,
        accuracy:
          gameState.totalAttempts > 0
            ? gameState.correctAnswers / gameState.totalAttempts
            : gameState.status === "victory"
              ? 1
              : 0,
        score,
        correctAnswers: gameState.correctAnswers,
        totalAttempts: gameState.totalAttempts,
        monsterType: gameState.monster?.type,
        difficulty:
          MONSTER_DIFFICULTY[
            (gameState.monster?.type || "goblin") as MonsterType
          ],
      });
    }
  }, [gameState, onComplete, tutorialMode, disableAutoFullscreen, createPlayingGame]);

  const tutVisuals = useMemo(() => {
    if (!tutorialMode || !gameState || gameState.grid.length === 0) return null;
    const move = targetTutorialMove || findPossibleMoves(gameState.grid)[0];
    if (!move) return null;

    const fromX = layout.gridX + move.from.col * layout.cellSize + layout.cellSize / 2;
    const fromY = layout.gridY + move.from.row * layout.cellSize + layout.cellSize / 2;
    const toX = layout.gridX + move.to.col * layout.cellSize + layout.cellSize / 2;
    const toY = layout.gridY + move.to.row * layout.cellSize + layout.cellSize / 2;

    const fromRow = move.from.row;
    const toRow = move.to.row;

    const fromBadgeY = fromRow === 0 ? fromY + layout.cellSize / 2 + 4 : fromY - layout.cellSize / 2 - 26;
    const toBadgeY = toRow === 0 ? toY + layout.cellSize / 2 + 4 : toY - layout.cellSize / 2 - 26;

    const isMobile = layout.isMobile;
    const skillX = isMobile ? dimensions.width / 2 - 35 : 50;
    const skillY = isMobile ? layout.gridY + layout.gridHeight + 30 : 340;

    let handX = fromX;
    let handY = fromY;
    let handScale = 1;
    let isTapping = false;

    const step = tutorialStep % 4;

    if (step === 0) {
      const t = (tutProgress % 50) / 50;
      handX = fromX + Math.sin(t * Math.PI * 2) * 8;
      handY = fromY + 12 + Math.cos(t * Math.PI * 2) * 5;
    } else if (step === 1) {
      if (tutProgress < 35) {
        const t = tutProgress / 35;
        handX = fromX - 30 + t * 30;
        handY = fromY + 15 - t * 15;
      } else if (tutProgress < 50) {
        handX = fromX;
        handY = fromY;
        isTapping = true;
        handScale = 0.78;
      } else if (tutProgress < 80) {
        const t = (tutProgress - 50) / 30;
        handX = fromX + (toX - fromX) * t;
        handY = fromY + (toY - fromY) * t;
      } else {
        handX = toX;
        handY = toY;
        isTapping = true;
        handScale = 0.78;
      }
    } else if (step === 2) {
      handX = (fromX + toX) / 2;
      handY = (fromY + toY) / 2;
    } else if (step === 3) {
      if (tutProgress < 50) {
        const t = tutProgress / 50;
        handX = fromX + (skillX - fromX) * t;
        handY = fromY + (skillY - fromY) * t;
      } else {
        handX = skillX;
        handY = skillY;
        isTapping = tutProgress < 80;
        if (isTapping) handScale = 0.8;
      }
    }

    return {
      move,
      fromX,
      fromY,
      toX,
      toY,
      fromBadgeY,
      toBadgeY,
      handX,
      handY,
      handScale,
      isTapping,
      step,
    };
  }, [tutorialMode, gameState, targetTutorialMove, layout, dimensions, tutorialStep, tutProgress]);

  if (!assets || !gameState || dimensions.width === 0) {
    return (
      <div
        ref={mergedRef}
        data-testid="rune-match-container"
        className="relative flex h-dvh min-h-[420px] w-full items-center justify-center overflow-hidden rounded-none border border-white/10 bg-slate-950 sm:h-[60vh] sm:rounded-2xl md:aspect-video md:h-auto"
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
    const displayValue =
      label === "TIME"
        ? `${Math.ceil(current / 1000)}s`
        : `${Math.ceil(current)}/${max}`;
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
          text={`${label}: ${displayValue}`}
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
      className={MOBILE_GAME_CONTAINER_CLASS}
    >
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
                      "TIME",
                    )}
                    <Text
                      text={`MATCHES ${gameState.correctAnswers}/${RUNE_MATCH_CONFIG.game.targetMatches}`}
                      x={10}
                      y={238}
                      width={layout.sidebarWidth - 20}
                      fontSize={getEffectiveTextSize(16)}
                      fill="#22c55e"
                      fontStyle="bold"
                      align="center"
                    />
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
                            <Group x={width - 16} y={-5}>
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
                            "#f59e0b",
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

                {/* Mobile Header Top Bar */}
                {layout.isMobile && (
                  <Group>
                    {gameState.monster && (
                      <Group>
                        <KonvaImage
                          image={assets.monsters[gameState.monster.type]}
                          x={dimensions.width / 2 - 35}
                          y={5}
                          width={70}
                          height={70}
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
                          dimensions.width / 2 - 90,
                          78,
                          180,
                          gameState.monster.hp,
                          gameState.monster.maxHp,
                          "#ef4444",
                          gameState.monster.type.toUpperCase(),
                        )}
                      </Group>
                    )}
                  </Group>
                )}

                {/* Grid */}
                <Rect
                  x={layout.gridX - 6}
                  y={layout.gridY - 6}
                  width={layout.gridWidth + 12}
                  height={layout.gridHeight + 12}
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
                              14,
                              Math.min(
                                layout.cellSize / 3.2,
                                (runeSize - 6) /
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

                {/* Mobile Bottom Skill Bar */}
                {layout.isMobile && (
                  <Group y={layout.gridY + layout.gridHeight + 10}>
                    {(() => {
                      const gap = 8;
                      const cols = 4;
                      const availableWidth = dimensions.width - 20;
                      const buttonWidth =
                        (availableWidth - gap * (cols - 1)) / cols;
                      const height = 44;

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
                              shadowBlur={isDisabled ? 0 : 4}
                              shadowOpacity={0.2}
                            />
                            <Text
                              text={icon}
                              x={0}
                              y={6}
                              width={buttonWidth}
                              align="center"
                              fontSize={16}
                            />
                            <Text
                              text={label}
                              x={0}
                              y={26}
                              width={buttonWidth}
                              align="center"
                              fontSize={11}
                              fill="#cbd5e1"
                              fontStyle="bold"
                            />
                            <Group x={buttonWidth - 14} y={-4}>
                              <Circle radius={7} fill={color} />
                              <Text
                                text={count.toString()}
                                x={-7}
                                y={-4}
                                width={14}
                                align="center"
                                fontSize={10}
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
                            "#f59e0b",
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

                {/* Animated Tutorial Overlay Elements */}
                {tutorialMode && tutVisuals && (
                  <Group>
                    {/* Steps 0 & 1: Clean Red & Gold Glowing Frames around target runes */}
                    {(tutVisuals.step === 0 || tutVisuals.step === 1) && (
                      <Group>
                        {/* Glowing Red Frame around Cell 1 */}
                        <Rect
                          x={tutVisuals.fromX - layout.cellSize / 2 - 2}
                          y={tutVisuals.fromY - layout.cellSize / 2 - 2}
                          width={layout.cellSize + 4}
                          height={layout.cellSize + 4}
                          fill="rgba(239, 68, 68, 0.25)"
                          stroke="#ef4444"
                          strokeWidth={4}
                          cornerRadius={10}
                          shadowColor="#ef4444"
                          shadowBlur={16}
                        />
                        {/* Glowing Gold Frame around Cell 2 */}
                        <Rect
                          x={tutVisuals.toX - layout.cellSize / 2 - 2}
                          y={tutVisuals.toY - layout.cellSize / 2 - 2}
                          width={layout.cellSize + 4}
                          height={layout.cellSize + 4}
                          fill="rgba(250, 204, 21, 0.25)"
                          stroke="#facc15"
                          strokeWidth={4}
                          cornerRadius={10}
                          shadowColor="#facc15"
                          shadowBlur={16}
                        />
                        {/* Floating badge over Cell 1 */}
                        <Group x={tutVisuals.fromX - 45} y={tutVisuals.fromBadgeY}>
                          <Rect
                            width={90}
                            height={22}
                            fill="#991b1b"
                            stroke="#fca5a5"
                            strokeWidth={1.5}
                            cornerRadius={11}
                            shadowColor="#ef4444"
                            shadowBlur={8}
                          />
                          <Text
                            text="1️⃣ เลือกแผ่นนี้"
                            width={90}
                            height={22}
                            fontSize={12}
                            fill="#fef2f2"
                            fontStyle="bold"
                            align="center"
                            verticalAlign="middle"
                          />
                        </Group>
                        {/* Floating badge over Cell 2 */}
                        <Group x={tutVisuals.toX - 45} y={tutVisuals.toBadgeY}>
                          <Rect
                            width={90}
                            height={22}
                            fill="#854d0e"
                            stroke="#fde047"
                            strokeWidth={1.5}
                            cornerRadius={11}
                            shadowColor="#facc15"
                            shadowBlur={8}
                          />
                          <Text
                            text="2️⃣ คู่ตรงกัน"
                            width={90}
                            height={22}
                            fontSize={12}
                            fill="#fefce8"
                            fontStyle="bold"
                            align="center"
                            verticalAlign="middle"
                          />
                        </Group>
                      </Group>
                    )}

                    {/* Step 2: Clean Attack Indicator at Monster HP */}
                    {tutVisuals.step === 2 && (
                      <Group>
                        <Circle
                          x={dimensions.width / 2}
                          y={layout.isMobile ? 45 : 80}
                          radius={24}
                          fill="rgba(239, 68, 68, 0.35)"
                          stroke="#ef4444"
                          strokeWidth={3}
                          shadowColor="#ef4444"
                          shadowBlur={14}
                        />
                        <Text
                          text="💥 ATTACK! -100 HP"
                          x={dimensions.width / 2 - 100}
                          y={layout.isMobile ? 75 : 115}
                          width={200}
                          fontSize={16}
                          fill="#f87171"
                          fontStyle="bold"
                          align="center"
                          shadowColor="black"
                          shadowBlur={6}
                        />
                      </Group>
                    )}

                    {/* Step 3: Skill Highlight Ring */}
                    {tutVisuals.step === 3 && (
                      <Group x={tutVisuals.handX} y={tutVisuals.handY}>
                        <Circle radius={26} fill="rgba(239, 68, 68, 0.3)" stroke="#ef4444" strokeWidth={3} shadowColor="#ef4444" shadowBlur={12} />
                        <Text
                          text="กดตรงนี้!"
                          x={-40}
                          y={-42}
                          width={80}
                          fontSize={12}
                          fill="#fca5a5"
                          fontStyle="bold"
                          align="center"
                        />
                      </Group>
                    )}

                    {/* Animated Hand Cursor Pointer Icon 👆 */}
                    <Group
                      x={tutVisuals.handX}
                      y={tutVisuals.handY}
                      scaleX={tutVisuals.handScale}
                      scaleY={tutVisuals.handScale}
                    >
                      <Circle
                        radius={20}
                        fill={tutVisuals.isTapping ? "rgba(239, 68, 68, 0.5)" : "rgba(99, 102, 241, 0.4)"}
                        stroke={tutVisuals.isTapping ? "#ef4444" : "#818cf8"}
                        strokeWidth={3}
                        shadowColor={tutVisuals.isTapping ? "#ef4444" : "#818cf8"}
                        shadowBlur={10}
                      />
                      <Text
                        text="👆"
                        x={-13}
                        y={-13}
                        fontSize={26}
                      />
                    </Group>
                  </Group>
                )}
              </Group>
            )}

            {/* Floating Texts */}
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
      {tutorialMode && (
        <div
          className="absolute z-40 w-[92%] max-w-lg -translate-x-1/2 pointer-events-none transition-all duration-300"
          style={{
            left: layout.sidebarWidth > 0 ? `${layout.gridX + layout.gridWidth / 2}px` : "50%",
            bottom: disableAutoFullscreen ? "16px" : "8px",
          }}
        >
          <div className="flex items-center gap-3.5 rounded-2xl border border-indigo-400/50 bg-slate-950/95 p-3.5 shadow-2xl backdrop-blur-md">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-lg shadow-lg shadow-indigo-500/25">
              {(tutorialStep % 4) + 1}
            </div>
            <div className="min-w-0 flex-1 text-white">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-indigo-300 border border-indigo-500/30">
                  Rune Match Tutorial · ขั้นตอน {(tutorialStep % 4) + 1} / 4
                </span>
              </div>
              <p className="mt-0.5 text-base font-black leading-tight text-white">
                {RUNE_MATCH_TUTORIAL_STEPS[tutorialStep % 4].title}
              </p>
              <p className="text-xs font-semibold text-white/70 leading-snug mt-0.5">
                {RUNE_MATCH_TUTORIAL_STEPS[tutorialStep % 4].detail}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
