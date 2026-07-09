"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Konva from "konva";
import { Group, Image as KonvaImage, Layer, Rect, Stage } from "react-konva";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Flame, Trophy } from "lucide-react";
import { RankingDialog } from "./RankingDialog";
import { useScopedI18n } from "@/locales/client";

import { withBasePath } from "@/lib/games/basePath";
import {
  advanceDragonFlightTime,
  calculateBossPower,
  createDragonFlightState,
  getDragonFlightResults,
} from "@/lib/games/dragonFlight";
import type {
  DragonFlightResults,
  DragonFlightRound,
  DragonFlightState,
  GateSide,
} from "@/lib/games/dragonFlight";
import type { VocabularyItem } from "@/store/useGameStore";
import { useInterval } from "@/hooks/useInterval";
import { useSound } from "@/hooks/useSound";
import { useAdaptiveDifficulty } from "@/hooks/useAdaptiveDifficulty";
import { registerDifficultyParams } from "@/lib/adaptive-difficulty/registerDifficultyParams";

type DragonFlightAssets = {
  gates: HTMLImageElement;
  boss: HTMLImageElement;
  player: HTMLImageElement;
  playerCamera: HTMLImageElement;
  army: HTMLImageElement;
  parallaxTop: HTMLImageElement;
  parallaxMiddle: HTMLImageElement;
  parallaxBottom: HTMLImageElement;
  loadingBackground: HTMLImageElement | null;
  projectileFireball: HTMLImageElement;
  projectileBoss: HTMLImageElement;
};

type DragonFlightGameProps = {
  vocabulary: VocabularyItem[];
  durationMs?: number;
  onComplete?: (results: DragonFlightResults) => void;
  onRestart?: () => void;
  preloadedAssets?: DragonFlightAssets;
  adaptive?: boolean;
};

type GateFeedback = {
  pairId: string;
  side: GateSide;
  outcome: "correct" | "incorrect";
};

type GatePair = {
  id: string;
  round: DragonFlightRound;
  y: number;
};

type PendingSelection = {
  pairId: string;
  side: GateSide;
  outcome: "correct" | "incorrect";
};

type SpriteGrid = {
  columns: number[];
  rows: number[];
  columnOffsets: number[];
  rowOffsets: number[];
};

type StageSize = {
  width: number;
  height: number;
};

type GateLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type FlightLayout = {
  leftGate: GateLayout;
  rightGate: GateLayout;
  gateScale: number;
  gateFrameWidth: number;
  gateFrameHeight: number;
  playerScale: number;
  playerFrameWidth: number;
  playerFrameHeight: number;
  bossScale: number;
  bossFrameWidth: number;
  bossFrameHeight: number;
  armyScale: number;
  armyFrameWidth: number;
  armyFrameHeight: number;
  playerX: number;
  playerY: number;
  bossX: number;
  bossY: number;
};

const ASSETS = {
  gates: withBasePath(
    "/games/vocabulary/dragon-flight/gates-3x3-sheet-facing-up.png",
  ),
  boss: withBasePath(
    "/games/vocabulary/dragon-flight/boss-3x3-sheet-facing-up.png",
  ),
  player: withBasePath(
    "/games/vocabulary/dragon-flight/player-3x3-sheet-facing-down.png",
  ),
  playerCamera: withBasePath(
    "/games/vocabulary/dragon-flight/player-3x3-sheet-facing-camera.png",
  ),
  army: withBasePath(
    "/games/vocabulary/dragon-flight/dragon-army-3x3-sheet-facing-up.png",
  ),
  parallaxTop: withBasePath(
    "/games/vocabulary/dragon-flight/parallax-top-tiling.png",
  ),
  parallaxMiddle: withBasePath(
    "/games/vocabulary/dragon-flight/parallax-middle-tiling.png",
  ),
  parallaxBottom: withBasePath(
    "/games/vocabulary/dragon-flight/parallax-bottom-tiling.png",
  ),
  loadingBackground: withBasePath(
    "/games/vocabulary/dragon-flight/loading-screen-background.png",
  ),
  projectileFireball: withBasePath(
    "/games/vocabulary/dragon-flight/projectile-fireball.png",
  ),
  projectileBoss: withBasePath(
    "/games/vocabulary/dragon-flight/projectile-boss.png",
  ),
};

const DEFAULT_STAGE: StageSize = { width: 960, height: 540 };
const TICK_MS = 60;
const GATE_ANIM_MS = 160;
const GATE_TRAVEL_MS = 7200;
const PLAYER_LERP = 0.22;
const PLAYER_ANIM_MS = 120;
const BOSS_ANIM_MS = 180;
const BOSS_HEALTH_TICK_MS = 450;
const RESULTS_REVEAL_MS = 900;
const GATE_SCALE_FACTOR = 0.5;
const PLAYER_BASE_SCALE = 0.22;
const BOSS_BASE_SCALE = 0.55;
const ARMY_BASE_SCALE = 0.12;

export type Difficulty = "easy" | "normal" | "hard" | "extreme";

type DifficultySetting = {
  durationMs: number;
  penalty: number;
  gameOverOnMiss: boolean;
  label: string;
  description: string;
  color: string;
};

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

const getDifficultySettings = (
  t: TranslateFn,
): Record<Difficulty, DifficultySetting> => ({
  easy: {
    durationMs: 30000,
    penalty: 1,
    gameOverOnMiss: false,
    label: t("dragonFlight.difficulty.easy"),
    description: t("dragonFlight.difficulty.easyDesc"),
    color: "bg-emerald-500",
  },
  normal: {
    durationMs: 60000,
    penalty: 1,
    gameOverOnMiss: false,
    label: t("dragonFlight.difficulty.normal"),
    description: t("dragonFlight.difficulty.normalDesc"),
    color: "bg-blue-500",
  },
  hard: {
    durationMs: 90000,
    penalty: 2,
    gameOverOnMiss: false,
    label: t("dragonFlight.difficulty.hard"),
    description: t("dragonFlight.difficulty.hardDesc"),
    color: "bg-orange-500",
  },
  extreme: {
    durationMs: 120000,
    penalty: 0,
    gameOverOnMiss: true,
    label: t("dragonFlight.difficulty.extreme"),
    description: t("dragonFlight.difficulty.extremeDesc"),
    color: "bg-red-600",
  },
});

const buildSpriteGrid = (width: number, height: number): SpriteGrid => {
  const columnBase = Math.floor(width / 3);
  const rowBase = Math.floor(height / 3);
  const columnRemainder = width % 3;
  const rowRemainder = height % 3;
  const columns = [0, 1, 2].map(
    (index) => columnBase + (index < columnRemainder ? 1 : 0),
  );
  const rows = [0, 1, 2].map(
    (index) => rowBase + (index < rowRemainder ? 1 : 0),
  );
  const columnOffsets = columns.reduce<number[]>((acc, _value, index) => {
    const nextValue = index === 0 ? 0 : acc[index - 1] + columns[index - 1];
    acc.push(nextValue);
    return acc;
  }, []);
  const rowOffsets = rows.reduce<number[]>((acc, _value, index) => {
    const nextValue = index === 0 ? 0 : acc[index - 1] + rows[index - 1];
    acc.push(nextValue);
    return acc;
  }, []);

  return { columns, rows, columnOffsets, rowOffsets };
};

const getSpriteCrop = (grid: SpriteGrid, col: number, row: number) => ({
  x: grid.columnOffsets[col] ?? 0,
  y: grid.rowOffsets[row] ?? 0,
  width: grid.columns[col] ?? 0,
  height: grid.rows[row] ?? 0,
});

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });

const buildAssets = async (): Promise<DragonFlightAssets> => {
  const [
    gates,
    boss,
    player,
    playerCamera,
    army,
    parallaxTop,
    parallaxMiddle,
    parallaxBottom,
    loadingBackground,
    projectileFireball,
    projectileBoss,
  ] = await Promise.all([
    loadImage(ASSETS.gates),
    loadImage(ASSETS.boss),
    loadImage(ASSETS.player),
    loadImage(ASSETS.playerCamera),
    loadImage(ASSETS.army),
    loadImage(ASSETS.parallaxTop),
    loadImage(ASSETS.parallaxMiddle),
    loadImage(ASSETS.parallaxBottom),
    loadImage(ASSETS.loadingBackground),
    loadImage(ASSETS.projectileFireball),
    loadImage(ASSETS.projectileBoss),
  ]);

  return {
    gates,
    boss,
    player,
    playerCamera,
    army,
    parallaxTop,
    parallaxMiddle,
    parallaxBottom,
    loadingBackground,
    projectileFireball,
    projectileBoss,
  };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const buildLayout = (
  stage: StageSize,
  gateGrid: SpriteGrid,
  playerGrid: SpriteGrid,
  bossGrid: SpriteGrid,
  armyGrid: SpriteGrid,
): FlightLayout => {
  const gateFrameWidth = gateGrid.columns[0] ?? 1;
  const gateFrameHeight = gateGrid.rows[0] ?? 1;
  const gateWidth = clamp(stage.width * 0.32, 180, 320) * GATE_SCALE_FACTOR;
  const gateScale = gateWidth / gateFrameWidth;
  const gateHeight = gateFrameHeight * gateScale;
  const gateTop = clamp(
    stage.height * 0.55 - gateHeight / 2,
    120,
    stage.height * 0.7,
  );

  const leftGate = {
    left: clamp(
      stage.width * 0.28 - gateWidth / 2,
      24,
      stage.width - gateWidth - 24,
    ),
    top: gateTop,
    width: gateWidth,
    height: gateHeight,
  };
  const rightGate = {
    left: clamp(
      stage.width * 0.72 - gateWidth / 2,
      24,
      stage.width - gateWidth - 24,
    ),
    top: gateTop,
    width: gateWidth,
    height: gateHeight,
  };

  const playerFrameWidth = playerGrid.columns[0] ?? 1;
  const playerFrameHeight = playerGrid.rows[0] ?? 1;
  const playerScale = clamp(
    (stage.width * PLAYER_BASE_SCALE) / playerFrameWidth,
    0.12,
    0.3,
  );

  const bossFrameWidth = bossGrid.columns[0] ?? 1;
  const bossFrameHeight = bossGrid.rows[0] ?? 1;
  const bossScale = clamp(
    (stage.width * BOSS_BASE_SCALE) / bossFrameWidth,
    0.25,
    0.65,
  );

  const armyFrameWidth = armyGrid.columns[0] ?? 1;
  const armyFrameHeight = armyGrid.rows[0] ?? 1;
  const armyScale = clamp(
    (stage.width * ARMY_BASE_SCALE) / armyFrameWidth,
    0.06,
    0.18,
  );

  return {
    leftGate,
    rightGate,
    gateScale,
    gateFrameWidth,
    gateFrameHeight,
    playerScale,
    playerFrameWidth,
    playerFrameHeight,
    bossScale,
    bossFrameWidth,
    bossFrameHeight,
    armyScale,
    armyFrameWidth,
    armyFrameHeight,
    playerX: stage.width / 2,
    playerY: stage.height * 0.78,
    bossX: stage.width / 2,
    bossY: stage.height * 0.28,
  };
};

const getGateLabels = (round: DragonFlightState["round"]) => {
  const left =
    round.correctSide === "left"
      ? round.correctTranslation
      : round.decoyTranslation;
  const right =
    round.correctSide === "right"
      ? round.correctTranslation
      : round.decoyTranslation;
  return { left, right };
};

const pickRandomIndex = (max: number) =>
  Math.min(max - 1, Math.floor(Math.random() * max));

const buildGateRound = (vocabulary: VocabularyItem[]): DragonFlightRound => {
  if (vocabulary.length === 0) {
    return {
      term: "",
      correctTranslation: "",
      decoyTranslation: "",
      correctSide: "left",
    };
  }

  const correctIndex = pickRandomIndex(vocabulary.length);
  let decoyIndex = pickRandomIndex(vocabulary.length);
  if (decoyIndex === correctIndex && vocabulary.length > 1) {
    decoyIndex = (correctIndex + 1) % vocabulary.length;
  }

  const correctItem = vocabulary[correctIndex];
  const decoyItem = vocabulary[decoyIndex];

  return {
    term: correctItem.term,
    correctTranslation: correctItem.translation,
    decoyTranslation: decoyItem.translation,
    correctSide: Math.random() < 0.5 ? "left" : "right",
  };
};

const getActiveGatePair = (pairs: GatePair[]) => {
  if (pairs.length === 0) return null;
  return pairs.reduce(
    (current, pair) => (pair.y > current.y ? pair : current),
    pairs[0],
  );
};

export function DragonFlightGame({
  vocabulary,
  durationMs,
  onComplete,
  onRestart,
  preloadedAssets,
  adaptive = false,
}: DragonFlightGameProps) {
  const t = useScopedI18n("pages.student.gamesPage");
  const [DIFFICULTY_SETTINGS] = useState(() => getDifficultySettings(t));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [showRanking, setShowRanking] = useState(false);

  const [stageSize, setStageSize] = useState<StageSize>(DEFAULT_STAGE);
  const [assets, setAssets] = useState<DragonFlightAssets | null>(
    preloadedAssets ?? null,
  );
  const [isLoading, setIsLoading] = useState(!preloadedAssets);
  const [state, setState] = useState<DragonFlightState>(() => {
    return createDragonFlightState(vocabulary, {
      durationMs: durationMs ?? DIFFICULTY_SETTINGS.normal.durationMs,
    });
  });

  // Register adaptive difficulty params for dragon-flight
  useMemo(() => {
    registerDifficultyParams('dragon-flight', {
      durationMs: { current: durationMs ?? DIFFICULTY_SETTINGS.normal.durationMs, min: 15000, max: 120000, default: DIFFICULTY_SETTINGS.normal.durationMs, step: 5000 },
    });
  }, [durationMs, DIFFICULTY_SETTINGS.normal.durationMs]);

  const { recordResponse: recordAdaptiveResponse } = useAdaptiveDifficulty({
    gameId: 'dragon-flight',
    adaptive,
  });

  const initialRoundRef = useRef<DragonFlightRound>(state.round);
  const [gatePairs, setGatePairs] = useState<GatePair[]>([]);
  const gateIdRef = useRef(0);
  const [feedback, setFeedback] = useState<GateFeedback | null>(null);
  const [results, setResults] = useState<DragonFlightResults | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [gateFrame, setGateFrame] = useState(0);
  const [playerFrame, setPlayerFrame] = useState(0);
  const [bossFrame, setBossFrame] = useState(0);
  const [playerX, setPlayerX] = useState(DEFAULT_STAGE.width / 2);
  const [hasStarted, setHasStarted] = useState(false);
  const [lockedPairId, setLockedPairId] = useState<string | null>(null);
  const [displayDragonCount, setDisplayDragonCount] = useState(1);
  const [bossHealth, setBossHealth] = useState(0);
  const [bossY, setBossY] = useState(DEFAULT_STAGE.height * 0.28);
  const [bossSequenceDone, setBossSequenceDone] = useState(false);

  useEffect(() => {
    if (!hasStarted) {
      const settings = DIFFICULTY_SETTINGS[difficulty];
      setState((prev) =>
        prev.durationMs === settings.durationMs
          ? prev
          : { ...prev, durationMs: settings.durationMs },
      );
    }
  }, [difficulty, hasStarted, DIFFICULTY_SETTINGS]);
  const { playSound } = useSound();
  const resultsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSelectionRef = useRef<PendingSelection | null>(null);
  const playerTargetRef = useRef<number | null>(null);

  const measureStage = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    const { width, height } = element.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    const nextWidth = Math.round(width);
    const nextHeight = Math.round(height);
    setStageSize((prev) =>
      prev.width === nextWidth && prev.height === nextHeight
        ? prev
        : { width: nextWidth, height: nextHeight },
    );
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (preloadedAssets) {
      setAssets(preloadedAssets);
      setIsLoading(false);
      return () => undefined;
    }

    setIsLoading(true);
    buildAssets()
      .then((loadedAssets) => {
        if (!isMounted) return;
        setAssets(loadedAssets);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setAssets(null);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [preloadedAssets]);

  const resetGame = useCallback(() => {
    const settings = DIFFICULTY_SETTINGS[difficulty];
    const nextState = createDragonFlightState(vocabulary, {
      durationMs: durationMs ?? settings.durationMs,
    });
    initialRoundRef.current = nextState.round;
    setState(nextState);
    setGatePairs([]);
    setFeedback(null);
    setResults(null);
    setShowResults(false);
    setLockedPairId(null);
    setPlayerX(DEFAULT_STAGE.width / 2);
    setDisplayDragonCount(1);
    setBossHealth(0);
    setBossSequenceDone(false);
    pendingSelectionRef.current = null;
    playerTargetRef.current = null;
  }, [vocabulary, difficulty, DIFFICULTY_SETTINGS, durationMs]);

  // Initialize game on mount only - do not auto-reset to avoid loops
  // hasStarted is already false from useState(false)

  useEffect(() => {
    if (isLoading) return;
    if (!containerRef.current) return;
    measureStage();
    let frameId = 0;
    const handleResize = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(() => {
        frameId = 0;
        measureStage();
      });
    };

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(handleResize);
      observer.observe(containerRef.current);
    }

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    const viewport = window.visualViewport;
    if (viewport) {
      viewport.addEventListener("resize", handleResize);
      viewport.addEventListener("scroll", handleResize);
    }

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      if (viewport) {
        viewport.removeEventListener("resize", handleResize);
        viewport.removeEventListener("scroll", handleResize);
      }
    };
  }, [isLoading, measureStage]);

  const gateGrid = useMemo(
    () =>
      assets ? buildSpriteGrid(assets.gates.width, assets.gates.height) : null,
    [assets],
  );
  const playerGrid = useMemo(
    () =>
      assets
        ? buildSpriteGrid(assets.player.width, assets.player.height)
        : null,
    [assets],
  );
  const bossGrid = useMemo(
    () =>
      assets ? buildSpriteGrid(assets.boss.width, assets.boss.height) : null,
    [assets],
  );
  const armyGrid = useMemo(
    () =>
      assets ? buildSpriteGrid(assets.army.width, assets.army.height) : null,
    [assets],
  );
  const layout = useMemo(() => {
    if (!gateGrid || !playerGrid || !bossGrid || !armyGrid) return null;
    return buildLayout(stageSize, gateGrid, playerGrid, bossGrid, armyGrid);
  }, [stageSize, gateGrid, playerGrid, bossGrid, armyGrid]);

  useEffect(() => {
    if (!layout) return;
    if (playerTargetRef.current !== null) return;
    setPlayerX((prev) =>
      Math.abs(prev - layout.playerX) > 1 ? layout.playerX : prev,
    );
  }, [layout]);

  useEffect(() => {
    if (!layout) return;
    if (state.status === "boss") {
      setBossY(-layout.bossFrameHeight * layout.bossScale);
      setBossHealth(calculateBossPower(state.attempts));
      setDisplayDragonCount(state.dragonCount);
      setBossSequenceDone(false);
    } else {
      setBossY(layout.bossY);
      setBossHealth(0);
      setBossSequenceDone(false);
    }
  }, [layout, state.status, state.attempts, state.dragonCount]);

  useEffect(() => {
    if (state.status === "boss") return;
    setDisplayDragonCount(state.dragonCount);
  }, [state.dragonCount, state.status]);

  useInterval(
    () => {
      setState((prev) => advanceDragonFlightTime(prev, TICK_MS));

      if (!layout) return;

      const gateStartY = -layout.leftGate.height;
      const gateEndY = stageSize.height + layout.leftGate.height;
      const gateSpeed = (gateEndY - gateStartY) / (GATE_TRAVEL_MS / 1000);
      const deltaSeconds = TICK_MS / 1000;

      setGatePairs((prev) => {
        const nextPairs = prev
          .map((pair) => ({ ...pair, y: pair.y + gateSpeed * deltaSeconds }))
          .filter((pair) => pair.y <= gateEndY);

        if (nextPairs.length === 0) {
          const nextPair = createGatePair();
          return nextPair ? [nextPair] : nextPairs;
        }

        return nextPairs.slice(0, 1);
      });

      setPlayerX((prev) => {
        const target = playerTargetRef.current ?? layout.playerX;
        const next = prev + (target - prev) * PLAYER_LERP;
        const isNearTarget = Math.abs(target - next) < 1.5;

        if (isNearTarget && pendingSelectionRef.current) {
          const pending = pendingSelectionRef.current;
          pendingSelectionRef.current = null;

          setFeedback({
            pairId: pending.pairId,
            side: pending.side,
            outcome: pending.outcome,
          });

          setState((prevState) => {
            const settings = DIFFICULTY_SETTINGS[difficulty];
            let nextDragonCount = prevState.dragonCount;
            let nextCorrectAnswers = prevState.correctAnswers;
            let isGameOver = false;

            if (pending.outcome === "correct") {
              nextDragonCount += 1;
              nextCorrectAnswers += 1;
            } else {
              if (settings.gameOverOnMiss) {
                isGameOver = true;
              } else {
                nextDragonCount = Math.max(
                  1,
                  prevState.dragonCount - settings.penalty,
                );
              }
            }

            if (isGameOver) {
              return {
                ...prevState,
                dragonCount: 0,
                status: "boss",
                attempts: prevState.attempts + 1,
              };
            }

            return {
              ...prevState,
              attempts: prevState.attempts + 1,
              correctAnswers: nextCorrectAnswers,
              dragonCount: nextDragonCount,
            };
          });

          playSound(pending.outcome === "correct" ? "success" : "error");

          // Record adaptive difficulty response
          recordAdaptiveResponse(
            pending.outcome === "correct",
            1500, // Approximate response time
          );

          // Delay return to center to let player reach the gate first
          setTimeout(() => {
            playerTargetRef.current = layout.playerX;
          }, 1500); // Wait 1500ms before returning to center
        }

        if (
          isNearTarget &&
          playerTargetRef.current !== null &&
          !pendingSelectionRef.current
        ) {
          playerTargetRef.current = null;
        }

        return isNearTarget ? target : next;
      });
    },
    state.status === "running" && layout && hasStarted ? TICK_MS : null,
  );

  const createGatePair = useCallback(
    (round?: DragonFlightRound) => {
      if (!layout || vocabulary.length === 0) return null;

      gateIdRef.current += 1;
      return {
        id: `gate-${gateIdRef.current}`,
        round: round ?? buildGateRound(vocabulary),
        y: -layout.leftGate.height,
      };
    },
    [layout, vocabulary],
  );

  useEffect(() => {
    if (!layout || gatePairs.length > 0) return;
    const initialPair = createGatePair(initialRoundRef.current);
    if (initialPair) {
      setGatePairs([initialPair]);
    }
  }, [layout, createGatePair, gatePairs.length]);

  useInterval(
    () => {
      setGateFrame((prev) => (prev + 1) % 3);
    },
    hasStarted ? GATE_ANIM_MS : null,
  );

  useInterval(
    () => {
      setPlayerFrame((prev) => (prev + 1) % 9);
    },
    hasStarted ? PLAYER_ANIM_MS : null,
  );

  useInterval(
    () => {
      setBossFrame((prev) => (prev + 1) % 3);
    },
    state.status === "boss" && hasStarted ? BOSS_ANIM_MS : null,
  );

  useInterval(
    () => {
      if (!layout) return;
      const gateStartY = -layout.leftGate.height;
      const gateEndY = stageSize.height + layout.leftGate.height;
      const gateSpeed = (gateEndY - gateStartY) / (GATE_TRAVEL_MS / 1000);
      const deltaSeconds = TICK_MS / 1000;
      const targetY = layout.playerY;

      setBossY((prev) => {
        const next = prev + gateSpeed * deltaSeconds;
        return next >= targetY ? targetY : next;
      });
    },
    state.status === "boss" && layout && hasStarted ? TICK_MS : null,
  );

  useInterval(
    () => {
      setBossHealth((prev) => Math.max(0, prev - 1));
      setDisplayDragonCount((prev) => Math.max(0, prev - 1));
    },
    state.status === "boss" &&
      bossHealth > 0 &&
      displayDragonCount > 0 &&
      hasStarted
      ? BOSS_HEALTH_TICK_MS
      : null,
  );

  useEffect(() => {
    if (feedback) {
      const timeout = setTimeout(() => {
        setFeedback(null);
        setLockedPairId(null);
      }, 450);
      return () => clearTimeout(timeout);
    }
    return () => undefined;
  }, [feedback]);

  useEffect(() => {
    if (state.status !== "boss" || !layout) return;
    const bossHit = bossY >= layout.playerY;
    const battleOver = bossHealth <= 0 || displayDragonCount <= 0;
    if (bossHit && battleOver) {
      setBossSequenceDone(true);
    }
  }, [bossHealth, bossY, displayDragonCount, layout, state.status]);

  useEffect(() => {
    if (resultsTimeoutRef.current) {
      clearTimeout(resultsTimeoutRef.current);
      resultsTimeoutRef.current = null;
    }

    if (state.status !== "boss") {
      setResults(null);
      setShowResults(false);
      setBossSequenceDone(false);
      return () => undefined;
    }

    const nextResults = getDragonFlightResults(
      {
        correctAnswers: state.correctAnswers,
        totalAttempts: state.attempts,
        dragonCount: state.dragonCount,
        difficulty,
      },
      state.elapsedMs,
    ); // Pass elapsed time
    setResults(nextResults);
    setShowResults(false);

    if (onComplete) {
      onComplete(nextResults);
    }

    return () => undefined;
  }, [
    state.status,
    state.correctAnswers,
    state.attempts,
    state.dragonCount,
    state.elapsedMs,
    onComplete,
    difficulty,
  ]);

  useEffect(() => {
    if (!bossSequenceDone) return;
    resultsTimeoutRef.current = setTimeout(() => {
      setShowResults(true);
    }, RESULTS_REVEAL_MS);
    return () => {
      if (resultsTimeoutRef.current) {
        clearTimeout(resultsTimeoutRef.current);
        resultsTimeoutRef.current = null;
      }
    };
  }, [bossSequenceDone]);

  const activePair = useMemo(() => {
    if (lockedPairId) {
      return gatePairs.find((pair) => pair.id === lockedPairId) ?? null;
    }
    return getActiveGatePair(gatePairs);
  }, [gatePairs, lockedPairId]);

  const handleGateSelection = useCallback(
    (side: GateSide) => {
      if (!hasStarted) return;
      if (state.status !== "running") return;
      if (pendingSelectionRef.current) return;
      if (lockedPairId) return;

      const pair = activePair;
      if (!pair || !layout) return;

      const isCorrect = side === pair.round.correctSide;
      const targetX =
        side === "left"
          ? layout.leftGate.left + layout.leftGate.width / 2
          : layout.rightGate.left + layout.rightGate.width / 2;

      pendingSelectionRef.current = {
        pairId: pair.id,
        side,
        outcome: isCorrect ? "correct" : "incorrect",
      };
      playerTargetRef.current = targetX;

      setLockedPairId(pair.id);
      setFeedback(null);
    },
    [activePair, hasStarted, layout, lockedPairId, state.status],
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!hasStarted) return;
      if (state.status !== "running") return;
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        handleGateSelection("left");
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        handleGateSelection("right");
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleGateSelection, hasStarted, state.status]);

  const promptRound = activePair?.round ?? state.round;
  const remainingRatio =
    state.durationMs > 0
      ? Math.max(0, 1 - state.elapsedMs / state.durationMs)
      : 0;

  const dragonCountDisplay =
    state.status === "boss" ? displayDragonCount : state.dragonCount;
  const activePairId = activePair?.id ?? null;
  const statusLabel = showResults
    ? "results"
    : hasStarted
      ? state.status
      : "ready";

  if (!assets && !isLoading) {
    return (
      <div className="rounded-3xl border border-red-500/40 bg-red-950/30 p-6 text-sm text-red-200">
        Unable to load Dragon Flight assets. Please refresh to try again.
      </div>
    );
  }

  const canRenderGame = Boolean(hasStarted && layout && assets);
  const gateLabels =
    canRenderGame && activePair ? getGateLabels(activePair.round) : null;
  const gateLabelTop = canRenderGame
    ? activePair
      ? activePair.y + layout!.leftGate.height + 8
      : layout!.leftGate.top + layout!.leftGate.height + 8
    : 0;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[calc(90svh-56px)] sm:h-[70vh] min-h-[480px] sm:max-h-[760px] overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.45)] ${hasStarted ? "touch-none select-none" : ""}`}
      data-testid="dragon-flight"
      data-status={statusLabel}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${ASSETS.loadingBackground})`,
        }}
      />
      <div className="absolute inset-0 bg-slate-950/55" />

      {canRenderGame && (
        <DragonFlightCanvas
          stageSize={stageSize}
          assets={assets!}
          feedback={feedback}
          gatePairs={gatePairs}
          activePairId={activePairId}
          layout={layout!}
          gateFrame={gateFrame}
          playerFrame={playerFrame}
          playerX={playerX}
          dragonCount={dragonCountDisplay}
          bossFrame={bossFrame}
          bossY={bossY}
          bossHealth={bossHealth}
          onSelectGate={handleGateSelection}
          showBoss={state.status === "boss"}
        />
      )}

      {canRenderGame && (
        <div className="absolute inset-0 z-10 pointer-events-none p-2 sm:p-6 flex flex-col justify-between">
          {/* Top HUD Bar */}
          <div className="flex w-full items-start justify-between gap-2 sm:gap-4">
            {/* Left: Prompt */}
            <div className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 sm:px-5 sm:py-3 backdrop-blur-md shadow-lg">
              <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-white/60 mb-0.5">
                {t("dragonFlight.prompt")}
              </div>
              <div className="text-base sm:text-2xl font-bold text-white leading-none">
                {promptRound.term || "—"}
              </div>
            </div>

            {/* Center: Progress Bar */}
            <div className="mt-1 sm:mt-4 flex-1 max-w-2xl px-2 sm:px-4">
              <div
                className="relative h-5 sm:h-6 w-full overflow-hidden rounded-full bg-black/30 backdrop-blur-sm border border-white/10"
                role="progressbar"
                aria-label="Run timer"
                aria-valuenow={Math.max(0, Math.ceil((state.durationMs - state.elapsedMs) / 1000))}
                aria-valuemin={0}
                aria-valuemax={Math.ceil(state.durationMs / 1000)}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 box-shadow-glow"
                  initial={{ width: "100%" }}
                  animate={{ width: `${remainingRatio * 100}%` }}
                  transition={{ duration: 0.2, ease: "linear" }}
                  style={{ borderRadius: 999 }}
                />
                <div className="absolute inset-0 z-10 flex items-center justify-center text-xs font-bold text-white drop-shadow-md tracking-widest">
                  {Math.max(
                    0,
                    Math.ceil((state.durationMs - state.elapsedMs) / 1000),
                  )}
                  s
                </div>
              </div>
            </div>

            {/* Right: Dragon Count */}
            <div className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 sm:px-5 sm:py-3 backdrop-blur-md shadow-lg text-right">
              <div className="flex items-center justify-end gap-1 sm:gap-1.5 mb-0.5">
                <Flame className="h-3 w-3 text-amber-400" />
                <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-white/60">
                  {t("dragonFlight.dragons")}
                </span>
              </div>
              <motion.div
                key={dragonCountDisplay}
                data-testid="dragon-flight-dragon-count"
                className="text-base sm:text-2xl font-bold text-white leading-none"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
              >
                {dragonCountDisplay}
              </motion.div>
            </div>
          </div>

          {/* Navigation Arrows (Bottom Center) - Only show when running */}
          {state.status === "running" && (
            <div className="absolute bottom-14 sm:bottom-24 left-0 right-0 flex justify-center gap-16 sm:gap-32 pointer-events-auto">
              <button
                type="button"
                className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95 shadow-lg"
                onPointerDown={() => handleGateSelection("left")}
                aria-label="Choose left gate"
              >
                <ArrowLeft size={24} className="sm:hidden" />
                <ArrowLeft size={32} className="hidden sm:block" />
              </button>
              <button
                type="button"
                className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95 shadow-lg"
                onPointerDown={() => handleGateSelection("right")}
                aria-label="Choose right gate"
              >
                <ArrowRight size={24} className="sm:hidden" />
                <ArrowRight size={32} className="hidden sm:block" />
              </button>
            </div>
          )}

          {/* Gate Labels (Absolute positioning based on canvas) */}
          {gateLabels && layout && state.status !== "boss" && (
            <>
              <div
                className="absolute -translate-x-1/2 rounded-xl border border-white/10 bg-black/80 px-3 py-2 sm:px-6 sm:py-3 text-sm sm:text-2xl font-bold text-white shadow-xl backdrop-blur-md"
                style={{
                  left: layout.leftGate.left + layout.leftGate.width / 2,
                  top: gateLabelTop,
                }}
              >
                {gateLabels?.left}
              </div>
              <div
                className="absolute -translate-x-1/2 rounded-xl border border-white/10 bg-black/80 px-3 py-2 sm:px-6 sm:py-3 text-sm sm:text-2xl font-bold text-white shadow-xl backdrop-blur-md"
                style={{
                  left: layout.rightGate.left + layout.rightGate.width / 2,
                  top: gateLabelTop,
                }}
              >
                {gateLabels?.right}
              </div>
            </>
          )}

          <AnimatePresence>
            {feedback && (
              <motion.div
                className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                {feedback.outcome === "correct"
                  ? "+1 Dragon"
                  : DIFFICULTY_SETTINGS[difficulty].gameOverOnMiss
                    ? "GAME OVER"
                    : `-${DIFFICULTY_SETTINGS[difficulty].penalty} Dragons`}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {canRenderGame && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <AnimatePresence>
            {state.status === "boss" && !showResults && (
              <motion.div
                className="absolute inset-x-0 top-24 mx-auto flex w-fit items-center gap-3 rounded-full border border-white/10 bg-slate-900/70 px-5 py-2 text-sm uppercase tracking-[0.2em] text-white"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                data-testid="dragon-flight-boss"
              >
                Skeleton King Approaches
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showResults && results && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center bg-background/95 backdrop-blur-sm px-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                data-testid="dragon-flight-results"
              >
                <motion.div
                  className="w-full max-w-lg rounded-xl border bg-card shadow-2xl overflow-hidden"
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                >
                  {/* Header */}
                  <div
                    className={`px-6 py-8 text-center ${
                      results.victory
                        ? "bg-gradient-to-br from-emerald-500/20 to-green-500/10"
                        : "bg-gradient-to-br from-red-500/20 to-rose-500/10"
                    }`}
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        delay: 0.2,
                        type: "spring",
                        stiffness: 150,
                      }}
                      className="text-6xl mb-3"
                    >
                      {results.victory ? "⚔️" : "💀"}
                    </motion.div>
                    <motion.h2
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className={`text-3xl font-bold ${
                        results.victory
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {results.victory
                        ? t("dragonFlight.victory")
                        : t("dragonFlight.defeat")}
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="text-sm text-muted-foreground mt-1"
                    >
                      {results.victory
                        ? t("dragonFlight.victoryDesc")
                        : t("dragonFlight.defeatDesc")}
                    </motion.p>
                  </div>

                  {/* Content */}
                  <div className="p-6 space-y-5">
                    {/* XP Badge */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 }}
                      className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 p-4 text-center"
                    >
                      <div className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">
                        {t("dragonFlight.xpEarned")}
                      </div>
                      <div className="text-4xl font-bold text-emerald-700 dark:text-emerald-300">
                        +{results.xp}
                      </div>
                    </motion.div>

                    {/* Stats Grid */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                      className="grid grid-cols-2 gap-3"
                    >
                      <div className="rounded-lg border bg-muted/50 p-3 text-center">
                        <div className="text-xs font-medium uppercase text-muted-foreground">
                          {t("dragonFlight.accuracy")}
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                          {Math.round(results.accuracy * 100)}%
                        </div>
                      </div>
                      <div className="rounded-lg border bg-muted/50 p-3 text-center">
                        <div className="text-xs font-medium uppercase text-muted-foreground">
                          {t("dragonFlight.correct")}
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                          {results.correctAnswers}/{results.totalAttempts}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-muted/50 p-3 text-center">
                        <div className="text-xs font-medium uppercase text-muted-foreground">
                          {t("dragonFlight.dragons")}
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                          {results.dragonCount}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-muted/50 p-3 text-center">
                        <div className="text-xs font-medium uppercase text-muted-foreground">
                          {t("dragonFlight.time")}
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                          {results.timeTaken}s
                        </div>
                      </div>
                    </motion.div>

                    {/* Play Again Button */}
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onRestart) {
                          onRestart();
                        } else {
                          window.location.reload();
                        }
                      }}
                      className="w-full rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.98] pointer-events-auto cursor-pointer"
                    >
                      {t("dragonFlight.playAgain")}
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {!hasStarted && (
        <div className="relative z-20 flex h-full flex-col">
          {/* Header Section */}
          <div className="px-4 py-4 sm:px-6 sm:py-5">
            <div className="text-xs uppercase tracking-[0.3em] text-white/60 mb-1">
              Dragon Flight
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-3xl font-bold text-white truncate">
                  {t("dragonFlight.flightBriefing")}
                </h2>
                <p className="text-xs sm:text-sm text-white/70 mt-1">
                  {t("dragonFlight.briefingDesc")}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <button
                  onClick={() => setShowRanking(true)}
                  className="rounded-full border border-white/20 bg-white/10 p-2 text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-yellow-400"
                  title="Leaderboard"
                >
                  <Trophy className="h-5 w-5" />
                </button>
                <div className="rounded-md border border-white/20 bg-white/10 px-2 py-1.5 sm:px-4 sm:py-2 text-xs uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm">
                  {isLoading ? "Loading Assets" : "Ready"}
                </div>
              </div>
            </div>

            {/* Difficulty Preview (Hidden in center, shown in footer now) */}
          </div>

          {/* Content Section */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              {/* Dragon Info Card */}
              <div className="flex flex-row sm:flex-col items-center justify-start sm:justify-center gap-4 rounded-3xl border border-white/15 bg-white/10 p-4 sm:p-6 sm:text-center backdrop-blur-md">
                {/* Circular Dragon Image with Ornate Frame */}
                <div className="relative shrink-0">
                  {/* Decorative outer ring - rotating slowly */}
                  <div
                    className="absolute inset-0 rounded-full border-2 border-white/20 animate-ring-rotate-slow"
                    style={{ transform: "scale(1.15)" }}
                  />
                  <div
                    className="absolute inset-0 rounded-full border border-white/10 animate-ring-rotate-reverse"
                    style={{ transform: "scale(1.25)" }}
                  />
                  {/* Pulsing glow ring */}
                  <div
                    className="absolute inset-0 rounded-full border border-white/5 animate-ring-pulse"
                    style={{ transform: "scale(1.35)" }}
                  />
                  {/* Animated sprite container */}
                  <div className="h-20 w-20 sm:h-44 sm:w-44 rounded-full border-4 border-white/30 shadow-xl shadow-black/30 overflow-hidden">
                    <div
                      className="w-full h-full animate-dragon-sprite"
                      style={{
                        backgroundImage: `url(/games/vocabulary/dragon-flight/player-3x3-sheet-facing-camera.png)`,
                        backgroundSize: "300% 300%",
                        imageRendering: "pixelated",
                      }}
                    />
                  </div>
                  {/* Inner glow - pulsing */}
                  <div className="absolute inset-2 rounded-full border border-white/10 animate-ring-pulse-subtle" />
                </div>
                <style jsx>{`
                  @keyframes dragon-sprite-anim {
                    0% {
                      background-position: 0% 0%;
                    }
                    11.11% {
                      background-position: 50% 0%;
                    }
                    22.22% {
                      background-position: 100% 0%;
                    }
                    33.33% {
                      background-position: 0% 50%;
                    }
                    44.44% {
                      background-position: 50% 50%;
                    }
                    55.55% {
                      background-position: 100% 50%;
                    }
                    66.66% {
                      background-position: 0% 100%;
                    }
                    77.77% {
                      background-position: 50% 100%;
                    }
                    88.88% {
                      background-position: 100% 100%;
                    }
                    100% {
                      background-position: 0% 0%;
                    }
                  }
                  .animate-dragon-sprite {
                    animation: dragon-sprite-anim 1.2s steps(1) infinite;
                  }
                  @keyframes ring-rotate {
                    from {
                      transform: scale(1.15) rotate(0deg);
                    }
                    to {
                      transform: scale(1.15) rotate(360deg);
                    }
                  }
                  @keyframes ring-rotate-rev {
                    from {
                      transform: scale(1.25) rotate(0deg);
                    }
                    to {
                      transform: scale(1.25) rotate(-360deg);
                    }
                  }
                  @keyframes ring-pulse-anim {
                    0%,
                    100% {
                      transform: scale(1.35);
                      opacity: 0.3;
                    }
                    50% {
                      transform: scale(1.4);
                      opacity: 0.6;
                    }
                  }
                  @keyframes ring-pulse-subtle-anim {
                    0%,
                    100% {
                      opacity: 0.3;
                    }
                    50% {
                      opacity: 0.6;
                    }
                  }
                  .animate-ring-rotate-slow {
                    animation: ring-rotate 20s linear infinite;
                  }
                  .animate-ring-rotate-reverse {
                    animation: ring-rotate-rev 15s linear infinite;
                  }
                  .animate-ring-pulse {
                    animation: ring-pulse-anim 3s ease-in-out infinite;
                  }
                  .animate-ring-pulse-subtle {
                    animation: ring-pulse-subtle-anim 2s ease-in-out infinite;
                  }
                `}</style>

                <div className="sm:mt-2 sm:text-center">
                  <h3 className="text-sm sm:text-lg font-semibold text-white">
                    {t("dragonFlight.gateRunBegins")}
                  </h3>
                  <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-white/70 max-w-xs">
                    {t("dragonFlight.gateRunDesc")}
                  </p>
                </div>
              </div>

              {/* Vocabulary Preview Card */}
              <div className="rounded-3xl border border-white/15 bg-slate-900/60 p-5 backdrop-blur-md sm:p-6">
                <div className="text-xs uppercase tracking-[0.3em] text-white/60 mb-4">
                  {t("dragonFlight.vocabularyPreview")}
                </div>
                <div className="max-h-64 overflow-y-auto rounded-xl">
                  {vocabulary.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-white/60">
                      {t("dragonFlight.noVocabularyLoaded")}
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {vocabulary.slice(0, 8).map((item, index) => (
                        <div
                          key={`${item.term}-${index}`}
                          className="flex items-center justify-between border-b border-white/10 px-4 py-3 last:border-b-0 hover:bg-white/5 transition-colors"
                        >
                          <span className="font-medium text-white text-base">
                            {item.term}
                          </span>
                          <span className="text-white/60 text-sm">
                            {item.translation}
                          </span>
                        </div>
                      ))}
                      {vocabulary.length > 8 && (
                        <div className="px-4 py-2 text-center text-xs text-white/50">
                          +{vocabulary.length - 8} {t("dragonFlight.moreWords")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer with Progress Bar */}
          <div className="border-t border-white/10 bg-slate-950/60 px-3 py-3 sm:px-6 sm:py-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 sm:gap-4">
              {/* Progress section */}
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                {/* Dragon icon */}
                <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 shrink-0">
                  <Flame className="h-5 w-5 text-white/70" />
                </div>
                {/* Progress bar */}

                <div className="flex-1 min-w-0">
                  {/* Difficulty Selector */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">
                      {t("dragonFlight.difficultyLabel")}
                    </span>
                    {(Object.keys(DIFFICULTY_SETTINGS) as Difficulty[]).map(
                      (diff) => (
                        <button
                          key={diff}
                          onClick={() => setDifficulty(diff)}
                          disabled={isLoading}
                          className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all border ${
                            difficulty === diff
                              ? `${DIFFICULTY_SETTINGS[diff].color} text-white border-transparent bg-opacity-100 shadow-md`
                              : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white/80"
                          }`}
                        >
                          {DIFFICULTY_SETTINGS[diff].label}
                        </button>
                      ),
                    )}
                  </div>

                  {/* Status & Bar */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/60 truncate">
                      {isLoading
                        ? t("dragonFlight.summoning")
                        : DIFFICULTY_SETTINGS[difficulty].description}
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLoading
                          ? "bg-white/40 animate-pulse"
                          : DIFFICULTY_SETTINGS[difficulty].color
                      }`}
                      style={{ width: isLoading ? "60%" : "100%" }}
                    />
                  </div>
                </div>
              </div>

              {/* Start button */}
              <button
                type="button"
                className={`shrink-0 flex items-center gap-2 rounded-full px-4 py-2 sm:px-6 sm:py-2.5 text-sm font-semibold transition-all ${
                  isLoading
                    ? "cursor-not-allowed bg-white/10 text-white/50"
                    : "bg-white/10 border border-white/20 text-white hover:bg-white/20 shadow-lg"
                }`}
                onClick={() => {
                  if (isLoading) return;
                  resetGame();
                  setHasStarted(true);
                }}
                disabled={isLoading}
              >
                {isLoading
                  ? t("dragonFlight.loading")
                  : t("dragonFlight.start")}
                <Flame className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      <RankingDialog open={showRanking} onOpenChange={setShowRanking} />
    </div>
  );
}

type DragonFlightCanvasProps = {
  stageSize: StageSize;
  assets: DragonFlightAssets;
  feedback: GateFeedback | null;
  gatePairs: GatePair[];
  activePairId: string | null;
  layout: FlightLayout;
  gateFrame: number;
  playerFrame: number;
  playerX: number;
  dragonCount: number;
  bossFrame: number;
  bossY: number;
  bossHealth: number;
  onSelectGate: (side: GateSide) => void;
  showBoss: boolean;
};

type ParallaxRefs = {
  topA: Konva.Image | null;
  topB: Konva.Image | null;
  middleA: Konva.Image | null;
  middleB: Konva.Image | null;
  bottomA: Konva.Image | null;
  bottomB: Konva.Image | null;
};

const buildParallaxMetrics = (image: HTMLImageElement, stageWidth: number) => {
  const scale = stageWidth / image.width;
  return {
    scale,
    height: image.height * scale,
  };
};

type Projectile = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "player" | "boss";
  rotation: number;
};
const PROJECTILE_SPEED = 600;

const DragonFlightCanvas = ({
  stageSize,
  assets,
  feedback,
  gatePairs,
  activePairId,
  layout,
  gateFrame,
  playerFrame,
  playerX,
  dragonCount,
  bossFrame,
  bossY,
  bossHealth,
  onSelectGate,
  showBoss,
}: DragonFlightCanvasProps) => {
  const bottomLayerRef = useRef<Konva.Layer | null>(null);
  const middleLayerRef = useRef<Konva.Layer | null>(null);
  const topLayerRef = useRef<Konva.Layer | null>(null);
  const projectileLayerRef = useRef<Konva.Layer | null>(null);

  const parallaxRefs = useRef<ParallaxRefs>({
    topA: null,
    topB: null,
    middleA: null,
    middleB: null,
    bottomA: null,
    bottomB: null,
  });
  const parallaxOffsets = useRef({ top: 0, middle: 0, bottom: 0 });
  const projectilesRef = useRef<Projectile[]>([]);
  const projectileSpritesRef = useRef<Map<number, Konva.Image>>(new Map());
  const lastFireTimeRef = useRef<{ player: number; boss: number }>({
    player: 0,
    boss: 0,
  });

  // Ref to hold latest state for animation loop to avoid re-creation
  const gameStateRef = useRef({
    bossY,
    bossHealth,
    showBoss,
    layout,
    dragonCount,
  });

  useEffect(() => {
    gameStateRef.current = {
      bossY,
      bossHealth,
      showBoss,
      layout,
      dragonCount,
    };
  }, [bossY, bossHealth, showBoss, layout, dragonCount]);

  const gateGrid = useMemo(
    () => buildSpriteGrid(assets.gates.width, assets.gates.height),
    [assets],
  );
  const playerGrid = useMemo(
    () => buildSpriteGrid(assets.player.width, assets.player.height),
    [assets],
  );
  const bossGrid = useMemo(
    () => buildSpriteGrid(assets.boss.width, assets.boss.height),
    [assets],
  );
  const armyGrid = useMemo(
    () => buildSpriteGrid(assets.army.width, assets.army.height),
    [assets],
  );

  useEffect(() => {
    if (
      !bottomLayerRef.current ||
      !middleLayerRef.current ||
      !topLayerRef.current ||
      !projectileLayerRef.current
    )
      return;

    const topMetrics = buildParallaxMetrics(
      assets.parallaxTop,
      stageSize.width,
    );
    const middleMetrics = buildParallaxMetrics(
      assets.parallaxMiddle,
      stageSize.width,
    );
    const bottomMetrics = buildParallaxMetrics(
      assets.parallaxBottom,
      stageSize.width,
    );

    const animation = new Konva.Animation(
      (frame) => {
        if (!frame) return;
        const delta = frame.timeDiff / 1000;
        const now = Date.now();

        // Use ref for latest state to avoid loop restarts
        const { bossY, bossHealth, showBoss, layout } =
          gameStateRef.current;

        // --- Parallax ---
        parallaxOffsets.current.top =
          (parallaxOffsets.current.top + delta * 40) % topMetrics.height;
        parallaxOffsets.current.middle =
          (parallaxOffsets.current.middle + delta * 28) % middleMetrics.height;
        parallaxOffsets.current.bottom =
          (parallaxOffsets.current.bottom + delta * 18) % bottomMetrics.height;

        const { topA, topB, middleA, middleB, bottomA, bottomB } =
          parallaxRefs.current;
        if (topA && topB) {
          topA.y(parallaxOffsets.current.top);
          topB.y(parallaxOffsets.current.top - topMetrics.height);
        }
        if (middleA && middleB) {
          middleA.y(parallaxOffsets.current.middle);
          middleB.y(parallaxOffsets.current.middle - middleMetrics.height);
        }
        if (bottomA && bottomB) {
          bottomA.y(parallaxOffsets.current.bottom);
          bottomB.y(parallaxOffsets.current.bottom - bottomMetrics.height);
        }

        // --- Projectiles ---
        if (showBoss && bossHealth > 0 && layout) {
          // Spawn Player Projectile
          if (
            now - lastFireTimeRef.current.player >
            400 + Math.random() * 200
          ) {
            const id = now + Math.random();
            projectilesRef.current.push({
              id,
              x: layout.playerX,
              y: layout.playerY - 50,
              vx: 0,
              vy: -PROJECTILE_SPEED,
              type: "player",
              rotation: -90,
            });
            lastFireTimeRef.current.player = now;

            const sprite = new Konva.Image({
              image: assets.projectileFireball,
              width: 32,
              height: 32,
              offsetX: 16,
              offsetY: 16,
              x: -100,
              y: -100,
            });
            projectileLayerRef.current?.add(sprite);
            projectileSpritesRef.current.set(id, sprite);
          }

          // Spawn Boss Projectile
          if (
            bossY > 50 &&
            now - lastFireTimeRef.current.boss > 1200 + Math.random() * 500
          ) {
            const id = now + Math.random();
            projectilesRef.current.push({
              id,
              x: layout.bossX,
              y: bossY + 80, // Spawn slightly lower
              vx: (Math.random() - 0.5) * 150,
              vy: PROJECTILE_SPEED * 0.7,
              type: "boss",
              rotation: 90,
            });
            lastFireTimeRef.current.boss = now;

            const sprite = new Konva.Image({
              image: assets.projectileBoss,
              width: 64,
              height: 64,
              offsetX: 32,
              offsetY: 32,
              x: -100,
              y: -100,
            });
            projectileLayerRef.current?.add(sprite);
            projectileSpritesRef.current.set(id, sprite);
          }
        }

        // Update Projectiles
        const toRemove = new Set<number>();
        projectilesRef.current.forEach((p) => {
          p.x += p.vx * delta;
          p.y += p.vy * delta;
          p.rotation += 300 * delta; // Spin effect

          // Check collisions / bounds
          let hit = false;
          // Access latest state for collision
          const { bossY, bossHealth, showBoss, layout } = gameStateRef.current;

          if (showBoss && bossHealth > 0 && layout) {
            if (
              p.type === "player" &&
              Math.abs(p.y - bossY) < 60 &&
              Math.abs(p.x - layout.bossX) < 80
            ) {
              hit = true;
            }
          }

          if (p.y < -100 || p.y > stageSize.height + 100 || hit) {
            toRemove.add(p.id);
          }

          // Update Sprite
          const sprite = projectileSpritesRef.current.get(p.id);
          if (sprite) {
            sprite.position({ x: p.x, y: p.y });
            sprite.rotation(p.rotation);
          }
        });

        // Cleanup
        if (toRemove.size > 0) {
          projectilesRef.current = projectilesRef.current.filter(
            (p) => !toRemove.has(p.id),
          );
          toRemove.forEach((id) => {
            const sprite = projectileSpritesRef.current.get(id);
            if (sprite) {
              sprite.destroy();
              projectileSpritesRef.current.delete(id);
            }
          });
        }
      },
      [
        bottomLayerRef.current,
        middleLayerRef.current,
        topLayerRef.current,
        projectileLayerRef.current,
      ],
    );

    animation.start();
    return () => {
      animation.stop();
    };
  }, [assets, stageSize.width, stageSize.height]);

  const playerRow = Math.floor(playerFrame / 3);
  const playerCol = playerFrame % 3;

  const bossRow =
    showBoss && bossHealth <= 0
      ? 2
      : showBoss && bossY > layout.bossY * 0.3
        ? 1
        : 0;
  const bossCol = bossFrame % 3;

  const armyCount = Math.min(dragonCount, 12);
  const armyItems = Array.from({ length: armyCount }, (_, index) => ({
    index,
    row: Math.floor(index / 3) % 3,
    col: index % 3,
  }));

  const topMetrics = buildParallaxMetrics(assets.parallaxTop, stageSize.width);
  const middleMetrics = buildParallaxMetrics(
    assets.parallaxMiddle,
    stageSize.width,
  );
  const bottomMetrics = buildParallaxMetrics(
    assets.parallaxBottom,
    stageSize.width,
  );

  return (
    <Stage width={stageSize.width} height={stageSize.height}>
      <Layer ref={bottomLayerRef}>
        <KonvaImage
          image={assets.parallaxBottom}
          x={0}
          y={0}
          scaleX={bottomMetrics.scale}
          scaleY={bottomMetrics.scale}
          ref={(node) => {
            parallaxRefs.current.bottomA = node;
          }}
        />
        <KonvaImage
          image={assets.parallaxBottom}
          x={0}
          y={bottomMetrics.height * -1}
          scaleX={bottomMetrics.scale}
          scaleY={bottomMetrics.scale}
          ref={(node) => {
            parallaxRefs.current.bottomB = node;
          }}
        />
      </Layer>
      <Layer ref={middleLayerRef}>
        <KonvaImage
          image={assets.parallaxMiddle}
          x={0}
          y={0}
          scaleX={middleMetrics.scale}
          scaleY={middleMetrics.scale}
          opacity={0.85}
          ref={(node) => {
            parallaxRefs.current.middleA = node;
          }}
        />
        <KonvaImage
          image={assets.parallaxMiddle}
          x={0}
          y={middleMetrics.height * -1}
          scaleX={middleMetrics.scale}
          scaleY={middleMetrics.scale}
          opacity={0.85}
          ref={(node) => {
            parallaxRefs.current.middleB = node;
          }}
        />
      </Layer>
      <Layer ref={topLayerRef}>
        <KonvaImage
          image={assets.parallaxTop}
          x={0}
          y={0}
          scaleX={topMetrics.scale}
          scaleY={topMetrics.scale}
          opacity={0.7}
          ref={(node) => {
            parallaxRefs.current.topA = node;
          }}
        />
        <KonvaImage
          image={assets.parallaxTop}
          x={0}
          y={topMetrics.height * -1}
          scaleX={topMetrics.scale}
          scaleY={topMetrics.scale}
          opacity={0.7}
          ref={(node) => {
            parallaxRefs.current.topB = node;
          }}
        />
      </Layer>

      <Layer ref={projectileLayerRef} />

      <Layer>
        {armyItems.map((army) => {
          const offsetX =
            (army.index % 4) * (layout.armyFrameWidth * layout.armyScale * 0.9);
          const offsetY =
            Math.floor(army.index / 4) *
            (layout.armyFrameHeight * layout.armyScale * 0.6);
          const crop = getSpriteCrop(armyGrid, army.col, army.row);
          return (
            <KonvaImage
              key={`army-${army.index}`}
              image={assets.army}
              crop={crop}
              x={playerX - layout.armyFrameWidth * layout.armyScale + offsetX}
              y={
                layout.playerY -
                layout.armyFrameHeight * layout.armyScale -
                40 +
                offsetY
              }
              width={crop.width}
              height={crop.height}
              scaleX={layout.armyScale}
              scaleY={-layout.armyScale}
              offsetY={crop.height}
              opacity={0.85}
            />
          );
        })}

        <KonvaImage
          image={assets.player}
          crop={getSpriteCrop(playerGrid, playerCol, playerRow)}
          x={playerX}
          y={layout.playerY}
          width={layout.playerFrameWidth}
          height={layout.playerFrameHeight}
          offsetX={layout.playerFrameWidth / 2}
          offsetY={layout.playerFrameHeight / 2}
          scaleX={layout.playerScale}
          scaleY={-layout.playerScale}
        />

        {showBoss && (
          <>
            {/* Red flash effect when boss appears */}
            <Rect
              x={0}
              y={0}
              width={stageSize.width}
              height={stageSize.height}
              fill="red"
              opacity={bossY < layout.bossY * 0.5 ? 0.2 : 0}
            />

            {/* Boss sprite with enhanced effects */}
            <KonvaImage
              image={assets.boss}
              crop={getSpriteCrop(bossGrid, bossCol, bossRow)}
              x={layout.bossX}
              y={bossY}
              width={layout.bossFrameWidth}
              height={layout.bossFrameHeight}
              offsetX={layout.bossFrameWidth / 2}
              offsetY={layout.bossFrameHeight / 2}
              scaleX={layout.bossScale * (bossHealth <= 0 ? 0.9 : 1.05)}
              scaleY={layout.bossScale * (bossHealth <= 0 ? 0.9 : 1.05)}
              opacity={bossHealth <= 0 ? 0.7 : 0.95}
              shadowColor="black"
              shadowBlur={20}
              shadowOpacity={0.8}
            />

            {/* Dark vignette effect during boss fight */}
            <Rect
              x={0}
              y={0}
              width={stageSize.width}
              height={stageSize.height}
              fillRadialGradientStartPoint={{
                x: stageSize.width / 2,
                y: stageSize.height / 2,
              }}
              fillRadialGradientEndPoint={{
                x: stageSize.width / 2,
                y: stageSize.height / 2,
              }}
              fillRadialGradientStartRadius={0}
              fillRadialGradientEndRadius={stageSize.width * 0.8}
              fillRadialGradientColorStops={[
                0,
                "rgba(0,0,0,0)",
                0.7,
                "rgba(0,0,0,0)",
                1,
                "rgba(0,0,0,0.6)",
              ]}
              listening={false}
            />
          </>
        )}
        {!showBoss &&
          gatePairs.map((pair) => {
            const gateCenterY = pair.y + layout.leftGate.height / 2;
            const isActive = pair.id === activePairId;
            const isFeedbackPair = feedback?.pairId === pair.id;
            const leftRow = isFeedbackPair
              ? pair.round.correctSide === "left"
                ? 1
                : 2
              : 0;
            const rightRow = isFeedbackPair
              ? pair.round.correctSide === "right"
                ? 1
                : 2
              : 0;
            const gateOpacity = isActive ? 1 : 0.7;

            return (
              <React.Fragment key={pair.id}>
                <Group
                  x={layout.leftGate.left + layout.leftGate.width / 2}
                  y={gateCenterY}
                  scaleX={layout.gateScale}
                  scaleY={layout.gateScale}
                  opacity={gateOpacity}
                  listening={isActive}
                  onPointerDown={
                    isActive ? () => onSelectGate("left") : undefined
                  }
                >
                  <KonvaImage
                    image={assets.gates}
                    crop={getSpriteCrop(gateGrid, gateFrame, leftRow)}
                    width={layout.gateFrameWidth}
                    height={layout.gateFrameHeight}
                    offsetX={layout.gateFrameWidth / 2}
                    offsetY={layout.gateFrameHeight / 2}
                  />
                  {isFeedbackPair && (
                    <Rect
                      width={layout.gateFrameWidth}
                      height={layout.gateFrameHeight}
                      offsetX={layout.gateFrameWidth / 2}
                      offsetY={layout.gateFrameHeight / 2}
                      fill={
                        leftRow === 1
                          ? "rgba(34,197,94,0.2)"
                          : "rgba(239,68,68,0.2)"
                      }
                    />
                  )}
                </Group>

                <Group
                  x={layout.rightGate.left + layout.rightGate.width / 2}
                  y={gateCenterY}
                  scaleX={layout.gateScale}
                  scaleY={layout.gateScale}
                  opacity={gateOpacity}
                  listening={isActive}
                  onPointerDown={
                    isActive ? () => onSelectGate("right") : undefined
                  }
                >
                  <KonvaImage
                    image={assets.gates}
                    crop={getSpriteCrop(gateGrid, gateFrame, rightRow)}
                    width={layout.gateFrameWidth}
                    height={layout.gateFrameHeight}
                    offsetX={layout.gateFrameWidth / 2}
                    offsetY={layout.gateFrameHeight / 2}
                  />
                  {isFeedbackPair && (
                    <Rect
                      width={layout.gateFrameWidth}
                      height={layout.gateFrameHeight}
                      offsetX={layout.gateFrameWidth / 2}
                      offsetY={layout.gateFrameHeight / 2}
                      fill={
                        rightRow === 1
                          ? "rgba(34,197,94,0.2)"
                          : "rgba(239,68,68,0.2)"
                      }
                    />
                  )}
                </Group>
              </React.Fragment>
            );
          })}
      </Layer>
    </Stage>
  );
};
