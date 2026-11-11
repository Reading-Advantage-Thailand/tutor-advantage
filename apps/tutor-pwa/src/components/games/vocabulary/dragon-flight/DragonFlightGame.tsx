"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Konva from "konva";
import { Group, Image as KonvaImage, Layer, Rect, Stage } from "react-konva";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Flame, Trophy, X } from "lucide-react";
import { RankingDialog } from "./RankingDialog";
import { useScopedI18n } from "@/locales/client";

import { withBasePath } from "@/lib/games/basePath";
import { loadGameImage } from "@/lib/games/gameAssetPreloader";
import { GameAssetLoadFailure, GameAssetLoading } from "@/components/games/GameAssetLoadFailure";
import {
  answerGate,
  applyGateAnswer,
  bossFightTiming,
  bossHealthAt,
  createDragonFlightState,
  createGateQueue,
  endDragonFlightRound,
  gateLabelTopAt,
  gateOpensAt,
  gateYAt,
  getDragonFlightResults,
  isGateGone,
  MS_PER_WORD,
  setDragonFlightTimeLeft,
  startGate,
  stepGate,
} from "@/lib/games/dragonFlight";
import type {
  DragonFlightResults,
  DragonFlightState,
  DragonGate,
  GateQueue,
  GateSide,
} from "@/lib/games/dragonFlight";
import { createRoundClock, splitFrameTime } from "@/lib/games/roundClock";
import type { RoundClock } from "@/lib/games/roundClock";
import type { VocabularyItem } from "@/store/useGameStore";
import { useInterval } from "@/hooks/useInterval";
import { useSound } from "@/hooks/useSound";
import { useTtsPlayer } from "@/hooks/useTtsPlayer";
import { useAdaptiveDifficulty } from "@/hooks/useAdaptiveDifficulty";
import { registerDifficultyParams } from "@/lib/adaptive-difficulty/registerDifficultyParams";
import { t as appT } from "@/lib/i18n";
import { tx } from "@/lib/games/gameText";

type DragonFlightAssets = {
  gates: HTMLImageElement;
  boss: HTMLImageElement;
  player: HTMLImageElement;
  army: HTMLImageElement;
  parallaxTop: HTMLImageElement;
  parallaxMiddle: HTMLImageElement;
  parallaxBottom: HTMLImageElement;
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
  autoStart?: boolean;
  tutorialMode?: boolean;
};

type FeedbackPill = {
  id: string;
  tone: "correct" | "incorrect" | "missed";
  text: string;
};

type GatePair = DragonGate & { y: number };

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
  gates: "/games/vocabulary/dragon-flight/gates-3x3-sheet-facing-up.webp",
  boss: "/games/vocabulary/dragon-flight/boss-3x3-sheet-facing-up.webp",
  player: "/games/vocabulary/dragon-flight/player-3x3-sheet-facing-down.webp",
  army: "/games/vocabulary/dragon-flight/dragon-army-3x3-sheet-facing-up.webp",
  parallaxTop: "/games/vocabulary/dragon-flight/parallax-top-tiling.webp",
  parallaxMiddle: "/games/vocabulary/dragon-flight/parallax-middle-tiling.webp",
  parallaxBottom: "/games/vocabulary/dragon-flight/parallax-bottom-tiling.webp",
  loadingBackground: "/games/vocabulary/dragon-flight/loading-screen-background.webp",
  projectileFireball: "/games/vocabulary/dragon-flight/projectile-fireball.png",
  projectileBoss: "/games/vocabulary/dragon-flight/projectile-boss.png",
};

const DEFAULT_STAGE: StageSize = { width: 960, height: 540 };
const TICK_MS = 1000 / 60;
const GATE_ANIM_MS = 220;
const MAX_ROUND_WORDS = 10;
const PLAYER_LERP = 0.22;
const PLAYER_ANIM_MS = 120;
const BOSS_ANIM_MS = 180;
const RESULTS_REVEAL_MS = 900;
const GATE_SCALE_FACTOR = 0.5;
const PLAYER_BASE_SCALE = 0.22;
const BOSS_BASE_SCALE = 0.55;
const ARMY_BASE_SCALE = 0.12;
const FEEDBACK_PILL_MS = 900;
// How long the runtime keeps the boss finish on screen. The score is already safe by then.
const BOSS_OUTRO_MS = 3200;

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

const blankImage = () => {
  const blank = document.createElement("canvas");
  blank.width = 1;
  blank.height = 1;
  return blank as unknown as HTMLImageElement;
};

// Scenery and boss art must not stop a round: a missing or stalled one draws as nothing.
const OPTIONAL_ART_WAIT_MS = 8_000;
const loadOptionalImage = (src: string) =>
  Promise.race([
    loadGameImage(src).catch(blankImage),
    new Promise<HTMLImageElement>((resolve) => {
      setTimeout(() => resolve(blankImage()), OPTIONAL_ART_WAIT_MS);
    }),
  ]);

const buildAssets = async (): Promise<DragonFlightAssets> => {
  const [
    gates,
    player,
    army,
    boss,
    parallaxTop,
    parallaxMiddle,
    parallaxBottom,
    projectileFireball,
    projectileBoss,
  ] = await Promise.all([
    loadGameImage(ASSETS.gates),
    loadGameImage(ASSETS.player),
    loadGameImage(ASSETS.army),
    loadOptionalImage(ASSETS.boss),
    loadOptionalImage(ASSETS.parallaxTop),
    loadOptionalImage(ASSETS.parallaxMiddle),
    loadOptionalImage(ASSETS.parallaxBottom),
    loadOptionalImage(ASSETS.projectileFireball),
    loadOptionalImage(ASSETS.projectileBoss),
  ]);

  return {
    gates,
    boss,
    player,
    army,
    parallaxTop,
    parallaxMiddle,
    parallaxBottom,
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

const shuffleVocabulary = (items: VocabularyItem[]) =>
  [...items].sort(() => Math.random() - 0.5);

// Terms and Thai meanings vary a lot in length, so the longest ones get a smaller size rather than a cut.
const termSizeClass = (term: string) => {
  if (term.length <= 12) return "text-3xl sm:text-4xl";
  if (term.length <= 18) return "text-2xl sm:text-3xl";
  if (term.length <= 26) return "text-xl sm:text-2xl";
  return "text-base sm:text-xl";
};

const labelSizeClass = (text: string) => {
  if (text.length <= 16) return "text-lg sm:text-2xl";
  if (text.length <= 44) return "text-base sm:text-xl";
  return "text-sm sm:text-lg";
};

export function DragonFlightGame({
  vocabulary,
  durationMs,
  onComplete,
  onRestart,
  preloadedAssets,
  adaptive = false,
  autoStart = false,
  tutorialMode = false,
}: DragonFlightGameProps) {
  const t = useScopedI18n("pages.student.gamesPage");
  const [DIFFICULTY_SETTINGS] = useState(() => getDifficultySettings(t));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const arrowsRef = useRef<HTMLDivElement | null>(null);
  const leftLabelRef = useRef<HTMLDivElement | null>(null);
  const rightLabelRef = useRef<HTMLDivElement | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [showRanking, setShowRanking] = useState(false);
  const gameVocabulary = useMemo(
    () => shuffleVocabulary(vocabulary).slice(0, MAX_ROUND_WORDS),
    [vocabulary],
  );
  const gameDurationMs = tutorialMode
    ? 60 * 60 * 1000
    : durationMs ?? Math.max(MS_PER_WORD, gameVocabulary.length * MS_PER_WORD);

  const [stageSize, setStageSize] = useState<StageSize>(DEFAULT_STAGE);
  const [assets, setAssets] = useState<DragonFlightAssets | null>(
    preloadedAssets ?? null,
  );
  const [isLoading, setIsLoading] = useState(!preloadedAssets);
  const [assetLoadAttempt, setAssetLoadAttempt] = useState(0);
  const [state, setState] = useState<DragonFlightState>(() => {
    return createDragonFlightState(gameVocabulary, {
      durationMs: gameDurationMs,
    });
  });

  // Register adaptive difficulty params for dragon-flight
  useMemo(() => {
    registerDifficultyParams('dragon-flight', {
      durationMs: { current: gameDurationMs, min: MS_PER_WORD, max: MAX_ROUND_WORDS * MS_PER_WORD, default: MAX_ROUND_WORDS * MS_PER_WORD, step: MS_PER_WORD },
    });
  }, [gameDurationMs]);

  const { recordResponse: recordAdaptiveResponse } = useAdaptiveDifficulty({
    gameId: 'dragon-flight',
    adaptive,
  });

  const [gate, setGate] = useState<DragonGate | null>(null);
  const gateRef = useRef<DragonGate | null>(null);
  const gateIdRef = useRef(0);
  const queueRef = useRef<GateQueue | null>(null);
  const clockRef = useRef<RoundClock | null>(null);
  const [pill, setPill] = useState<FeedbackPill | null>(null);
  const [reveal, setReveal] = useState<{ term: string; meaning: string } | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [chrome, setChrome] = useState({ hudBottom: 0, arrowsTop: DEFAULT_STAGE.height });
  const [labelHeight, setLabelHeight] = useState(48);
  const [results, setResults] = useState<DragonFlightResults | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [gateFrame, setGateFrame] = useState(0);
  const [playerFrame, setPlayerFrame] = useState(0);
  const [bossFrame, setBossFrame] = useState(0);
  const [playerX, setPlayerX] = useState(DEFAULT_STAGE.width / 2);
  const [hasStarted, setHasStarted] = useState(autoStart || tutorialMode);
  const [tutorialStep, setTutorialStep] = useState(0);
  const tutorialSelectionRef = useRef<(side: GateSide) => void>(() => undefined);
  const [bossHealth, setBossHealth] = useState(1);
  const [bossY, setBossY] = useState(-1000);
  const [bossSequenceDone, setBossSequenceDone] = useState(false);

  useEffect(() => {
    if (!hasStarted && !autoStart) {
      const settings = DIFFICULTY_SETTINGS[difficulty];
      setState((prev) =>
        prev.durationMs === settings.durationMs
          ? prev
          : { ...prev, durationMs: settings.durationMs },
      );
    }
  }, [autoStart, difficulty, hasStarted, DIFFICULTY_SETTINGS]);
  const { playSound } = useSound();
  const { speak: speakWord } = useTtsPlayer();
  const resultsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerTargetRef = useRef<GateSide | null>(null);
  // Words still wrong or missed. Getting one right in the bonus gates takes it off the list.
  const missedWordsRef = useRef<Map<string, string>>(new Map());

  const spawnGate = useCallback(() => {
    if (!queueRef.current) {
      // Wrong answers may come from the whole lesson, which also makes elimination harder.
      queueRef.current = createGateQueue(gameVocabulary, vocabulary);
    }
    const entry = queueRef.current.next();
    gateIdRef.current += 1;
    const next = entry ? startGate(entry, `gate-${gateIdRef.current}`) : null;
    gateRef.current = next;
    playerTargetRef.current = null;
    setGate(next);
  }, [gameVocabulary, vocabulary]);

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
  }, [preloadedAssets, assetLoadAttempt]);

  const resetGame = useCallback(() => {
    const nextState = createDragonFlightState(gameVocabulary, {
      durationMs: gameDurationMs,
    });
    clockRef.current?.stop();
    clockRef.current = null;
    queueRef.current = null;
    gateRef.current = null;
    playerTargetRef.current = null;
    missedWordsRef.current = new Map();
    setState(nextState);
    setGate(null);
    setPill(null);
    setReveal(null);
    setHasAnswered(false);
    setResults(null);
    setShowResults(false);
    setPlayerX(DEFAULT_STAGE.width / 2);
    setBossHealth(1);
    setBossY(-1000);
    setBossSequenceDone(false);
  }, [gameVocabulary, gameDurationMs]);

  // Initialize game on mount only - do not auto-reset to avoid loops
  // hasStarted is already false from useState(false)

  useEffect(() => {
    if (autoStart && !hasStarted) {
      resetGame();
      setHasStarted(true);
    }
  }, [autoStart, hasStarted, resetGame]);

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
  const canRenderGame = Boolean(hasStarted && layout && assets);

  useEffect(() => {
    if (!layout) return;
    if (playerTargetRef.current !== null) return;
    setPlayerX((prev) =>
      Math.abs(prev - layout.playerX) > 1 ? layout.playerX : prev,
    );
  }, [layout]);

  // Answer labels stop below the top bar and above the arrows, so both have to be measured.
  const measureChrome = useCallback(() => {
    const root = containerRef.current?.getBoundingClientRect();
    if (!root) return;
    const hud = hudRef.current?.getBoundingClientRect();
    const arrows = arrowsRef.current?.getBoundingClientRect();
    const hudBottom = hud ? Math.round(hud.bottom - root.top) : 0;
    const arrowsTop = arrows ? Math.round(arrows.top - root.top) : Math.round(root.height);
    setChrome((prev) =>
      prev.hudBottom === hudBottom && prev.arrowsTop === arrowsTop
        ? prev
        : { hudBottom, arrowsTop },
    );
  }, []);

  useLayoutEffect(() => {
    if (!canRenderGame) return undefined;
    measureChrome();
    if (typeof ResizeObserver === "undefined" || !hudRef.current) return undefined;
    const observer = new ResizeObserver(measureChrome);
    observer.observe(hudRef.current);
    return () => observer.disconnect();
  }, [canRenderGame, measureChrome, stageSize]);

  const currentGateId = gate?.id;
  useLayoutEffect(() => {
    const tallest = Math.max(
      leftLabelRef.current?.offsetHeight ?? 0,
      rightLabelRef.current?.offsetHeight ?? 0,
    );
    if (tallest > 0) setLabelHeight(tallest);
  }, [currentGateId, stageSize]);

  useEffect(() => {
    if (state.status !== "running" || !layout || !hasStarted) {
      return () => undefined;
    }

    // Time left is real time, so every phone ends together and a hidden tab still
    // ends its round. Tutorials have no round to end.
    if (!tutorialMode && !clockRef.current) {
      clockRef.current = createRoundClock({
        durationMs: state.durationMs,
        onExpire: () => setState(endDragonFlightRound),
      });
      clockRef.current.start();
    }

    let frameId = 0;
    let lastFrameTime: number | null = null;

    const closeGate = (closed: DragonGate) => {
      queueRef.current?.review(closed.item);
      missedWordsRef.current.set(closed.round.term, closed.round.correctTranslation);
      setPill({ id: closed.id, tone: "missed", text: "หมดเวลา" });
      setReveal({ term: closed.round.term, meaning: closed.round.correctTranslation });
    };

    const moveGate = (stepMs: number) => {
      const current = gateRef.current;
      if (!current) return;
      const moved = stepGate(current, stepMs);
      if (isGateGone(moved)) {
        spawnGate();
        return;
      }
      if (moved.outcome === "missed" && !current.outcome) closeGate(moved);
      gateRef.current = moved;
    };

    const tick = (frameTime: number) => {
      let stepsMs: number[];
      const clock = clockRef.current;
      if (clock) {
        const frame = clock.tick(frameTime);
        stepsMs = frame.stepsMs;
        setState((prev) => setDragonFlightTimeLeft(prev, frame.remainingMs));
        if (frame.isOver) return;
      } else {
        stepsMs = splitFrameTime(lastFrameTime === null ? 0 : frameTime - lastFrameTime);
        lastFrameTime = frameTime;
      }

      stepsMs.forEach(moveGate);
      setGate(gateRef.current);

      const movedMs = stepsMs.reduce((sum, stepMs) => sum + stepMs, 0);
      const targetSide = playerTargetRef.current;
      const target =
        targetSide === "left"
          ? layout.leftGate.left + layout.leftGate.width / 2
          : targetSide === "right"
            ? layout.rightGate.left + layout.rightGate.width / 2
            : layout.playerX;
      const lerpAmount = 1 - Math.pow(1 - PLAYER_LERP, movedMs / TICK_MS);
      setPlayerX((prev) => {
        const next = prev + (target - prev) * lerpAmount;
        return Math.abs(target - next) < 1.5 ? target : next;
      });

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [hasStarted, layout, spawnGate, state.durationMs, state.status, tutorialMode]);

  useEffect(
    () => () => {
      clockRef.current?.stop();
      clockRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!layout || !hasStarted || state.status !== "running" || gateRef.current) return;
    spawnGate();
  }, [gate, hasStarted, layout, spawnGate, state.status]);

  useInterval(
    () => {
      // Only the two blue frames: the third is orange, too close to the wrong-answer gate.
      setGateFrame((prev) => (prev + 1) % 2);
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

  // The boss finish is display only: the result has already gone to the runtime.
  useEffect(() => {
    if (state.status !== "boss" || !layout || !hasStarted) {
      return () => undefined;
    }

    const startY = -layout.bossFrameHeight * layout.bossScale;
    const { enterMs } = bossFightTiming(state.dragonCount);
    const startedAt = performance.now();
    let frameId = 0;

    const tick = (frameTime: number) => {
      const elapsedMs = Math.max(frameTime - startedAt, 0);
      const entered = Math.min(elapsedMs / enterMs, 1);
      const health = bossHealthAt(elapsedMs, state.dragonCount);
      setBossY(startY + (layout.bossY - startY) * entered);
      setBossHealth(health);
      if (entered < 1 || health > 0) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [hasStarted, layout, state.dragonCount, state.status]);

  useEffect(() => {
    if (!pill) return undefined;
    const timeout = setTimeout(() => setPill(null), FEEDBACK_PILL_MS);
    return () => clearTimeout(timeout);
  }, [pill]);

  useEffect(() => {
    if (state.status !== "boss" || !layout) return;
    if (bossY >= layout.bossY && bossHealth <= 0) {
      setBossSequenceDone(true);
    }
  }, [bossHealth, bossY, layout, state.status]);

  // Keep the latest onComplete without making it an effect dependency: parents
  // (AdvantageArcadeRuntime, the play page) pass a fresh callback every render.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const isBossPhase = state.status === "boss";

  // Reset results only when the boss phase ends (or on mount). This used to run
  // on every animation frame (it depended on state.elapsedMs) and call setState
  // from a passive effect each time, which tripped React's "Maximum update depth
  // exceeded" warning after ~50 consecutive frames.
  useEffect(() => {
    if (isBossPhase) return;
    if (resultsTimeoutRef.current) {
      clearTimeout(resultsTimeoutRef.current);
      resultsTimeoutRef.current = null;
    }
    setResults(null);
    setShowResults(false);
    setBossSequenceDone(false);
  }, [isBossPhase]);

  useEffect(() => {
    if (!isBossPhase) return;
    clockRef.current?.stop();
    // Every word of the round counts, so skipping one costs the same as missing it.
    const totalWords = Math.max(gameVocabulary.length, 1);
    const nextResults = getDragonFlightResults(
      {
        correctAnswers: Math.min(state.correctAnswers, totalWords),
        totalAttempts: totalWords,
        dragonCount: state.dragonCount,
        difficulty,
      },
      state.elapsedMs,
    );
    setResults(nextResults);
    setShowResults(false);
    onCompleteRef.current?.({
      ...nextResults,
      // Nobody is watching a hidden page, so its result goes straight through.
      outroMs: document.visibilityState === "hidden" ? 0 : BOSS_OUTRO_MS,
      review: {
        heading: nextResults.correctAnswers > 0 ? "ปราบบอสสำเร็จ!" : "จบเกมแล้ว!",
        missed: Array.from(missedWordsRef.current, ([term, meaning]) => ({ term, meaning })),
      },
    });
  }, [
    gameVocabulary.length,
    isBossPhase,
    state.correctAnswers,
    state.dragonCount,
    state.elapsedMs,
    difficulty,
  ]);

  useEffect(() => {
    // In a lesson the runtime takes over after the boss finish; only a practice round has this card.
    if (!bossSequenceDone || autoStart) return;
    resultsTimeoutRef.current = setTimeout(() => {
      setShowResults(true);
    }, RESULTS_REVEAL_MS);
    return () => {
      if (resultsTimeoutRef.current) {
        clearTimeout(resultsTimeoutRef.current);
        resultsTimeoutRef.current = null;
      }
    };
  }, [autoStart, bossSequenceDone]);

  const dragonCount = state.dragonCount;
  const dragonPenalty = DIFFICULTY_SETTINGS[difficulty].penalty;
  const gameOverOnMiss = DIFFICULTY_SETTINGS[difficulty].gameOverOnMiss;

  const handleGateSelection = useCallback(
    (side: GateSide) => {
      if (!hasStarted || !layout) return;
      if (state.status !== "running") return;

      const current = gateRef.current;
      if (!current) return;
      const label =
        side === current.round.correctSide
          ? current.round.correctTranslation
          : current.round.decoyTranslation;
      if (!label) return;

      const answered = answerGate(
        current,
        side,
        gateOpensAt(layout.leftGate.height, stageSize.height),
      );
      if (!answered) return;

      // The answer counts now. The dragon flying to the gate is only animation.
      const isCorrect = answered.outcome === "correct";
      gateRef.current = answered;
      playerTargetRef.current = side;
      setGate(answered);
      setHasAnswered(true);
      setState((prev) =>
        applyGateAnswer(prev, {
          correct: isCorrect,
          bonus: current.bonus,
          penalty: dragonPenalty,
          gameOverOnMiss,
        }),
      );

      const wrongText = gameOverOnMiss
        ? tx("GAME OVER")
        : dragonCount > 1
          ? `ผิด -${Math.min(dragonPenalty, dragonCount - 1)} มังกร`
          : "ผิด";
      setPill({
        id: answered.id,
        tone: isCorrect ? "correct" : "incorrect",
        text: isCorrect ? "ถูก! +1 มังกร" : wrongText,
      });
      if (isCorrect) {
        missedWordsRef.current.delete(current.round.term);
      } else {
        queueRef.current?.review(current.item);
        missedWordsRef.current.set(current.round.term, current.round.correctTranslation);
        setReveal({ term: current.round.term, meaning: current.round.correctTranslation });
      }

      playSound(isCorrect ? "success" : "error");
      // A tap is the one moment a phone reliably lets a word play out loud.
      if (!tutorialMode) speakWord(current.item.term, current.item.audioUrl);

      // Record adaptive difficulty response
      recordAdaptiveResponse(
        isCorrect,
        1500, // Approximate response time
      );
    },
    [
      dragonCount,
      dragonPenalty,
      gameOverOnMiss,
      hasStarted,
      layout,
      playSound,
      recordAdaptiveResponse,
      speakWord,
      stageSize.height,
      state.status,
      tutorialMode,
    ],
  );

  useEffect(() => {
    tutorialSelectionRef.current = handleGateSelection;
  }, [handleGateSelection]);

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

  const remainingRatio =
    state.durationMs > 0
      ? Math.max(0, 1 - state.elapsedMs / state.durationMs)
      : 0;

  const activePairId = gate?.id ?? null;
  const activeCorrectSide = gate?.round.correctSide;

  useEffect(() => {
    if (!tutorialMode || !activePairId || !activeCorrectSide) return;
    const correctSide = activeCorrectSide;
    setTutorialStep(0);
    const timers = [
      window.setTimeout(() => setTutorialStep(1), 1300),
      window.setTimeout(() => setTutorialStep(2), 2600),
      window.setTimeout(() => tutorialSelectionRef.current(correctSide), 3700),
      window.setTimeout(() => setTutorialStep(3), 4100),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [activeCorrectSide, activePairId, tutorialMode]);
  const statusLabel = showResults
    ? "results"
    : hasStarted
      ? state.status
      : "ready";

  const gateHeight = layout?.leftGate.height ?? 0;
  // Keep the label out of the viewport while the gate is still entering from
  // above. This prevents iOS Safari from showing the answer before its gate.
  const gateLabelVisible = Boolean(
    gate && layout && gate.progress >= gateOpensAt(gateHeight, stageSize.height),
  );
  const gateIsOpen = gateLabelVisible && !gate?.outcome;

  // The last wrong or missed word stays up until the next gate's answers appear.
  useEffect(() => {
    if (gateIsOpen) setReveal(null);
  }, [gateIsOpen]);

  if (!assets && !isLoading) {
    const giveUpLoading = () => {
      const totalWords = Math.max(gameVocabulary.length, 1);
      onCompleteRef.current?.(
        getDragonFlightResults({ correctAnswers: 0, totalAttempts: totalWords, dragonCount: 0, difficulty }, 0),
      );
    };
    return (
      <div className="relative h-dvh min-h-0 w-full bg-slate-950">
        <GameAssetLoadFailure
          onRetry={() => {
            setIsLoading(true);
            setAssetLoadAttempt((attempt) => attempt + 1);
          }}
          onGiveUp={autoStart && !tutorialMode ? giveUpLoading : undefined}
        />
      </div>
    );
  }

  const gateY = gate ? gateYAt(gate.progress, gateHeight, stageSize.height) : 0;
  const gatePairs: GatePair[] = gate ? [{ ...gate, y: gateY }] : [];
  const gateLabels = canRenderGame && gate ? getGateLabels(gate.round) : null;
  // Labels stay where they were once the gate is answered, so the right answer can be read.
  const gateLabelTop = gate
    ? gateLabelTopAt({
        gateY: gateYAt(gate.settledAt ?? gate.progress, gateHeight, stageSize.height),
        gateHeight,
        hudBottom: chrome.hudBottom,
        arrowsTop: chrome.arrowsTop,
        labelHeight,
      })
    : 0;
  const labelAbove = gateLabelTop - 48;
  const pillTop = labelAbove > chrome.hudBottom + 8 ? labelAbove : gateLabelTop + labelHeight + 12;

  // Two equal boxes that cannot touch each other or the screen edge, each under its gate.
  const labelWidth = Math.min(stageSize.width / 2 - 12, 420);
  const labelX: Record<GateSide, number> = layout
    ? {
        left: clamp(
          layout.leftGate.left + layout.leftGate.width / 2 - labelWidth / 2,
          8,
          stageSize.width / 2 - 4 - labelWidth,
        ),
        right: clamp(
          layout.rightGate.left + layout.rightGate.width / 2 - labelWidth / 2,
          stageSize.width / 2 + 4,
          stageSize.width - 8 - labelWidth,
        ),
      }
    : { left: 8, right: 8 };

  const isTutorialTarget = (side: GateSide) =>
    tutorialMode &&
    (tutorialStep === 1 || (tutorialStep === 2 && gate?.round.correctSide === side));

  const labelTone = (side: GateSide) => {
    if (!gate?.outcome) {
      return isTutorialTarget(side)
        ? "border-amber-300 bg-black/80 ring-8 ring-amber-300/25"
        : "border-white/10 bg-black/80";
    }
    if (gate.round.correctSide === side) {
      return "border-emerald-300 bg-emerald-800/95 ring-2 ring-emerald-300/70";
    }
    return gate.picked === side
      ? "border-rose-300 bg-rose-800/95 ring-2 ring-rose-300/70"
      : "border-white/10 bg-black/70";
  };

  const bossDown = isBossPhase && bossHealth <= 0;
  const bossAttacking = isBossPhase && Boolean(layout) && bossY >= (layout?.bossY ?? 0);
  const bossMessage = bossDown
    ? `มังกร ${dragonCount} ตัว ปราบบอสได้แล้ว!`
    : bossAttacking
      ? `มังกร ${dragonCount} ตัว กำลังโจมตีบอส!`
      : appT("interactivePlay.bossApproaches");

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden bg-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.45)] ${
        hasStarted
          ? "h-dvh min-h-0 max-h-none touch-none select-none rounded-none border-0"
          : "h-[calc(90svh-56px)] min-h-[480px] rounded-3xl border border-slate-800 sm:h-[70vh] sm:max-h-[760px]"
      }`}
      data-testid="dragon-flight"
      data-status={statusLabel}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${withBasePath(ASSETS.loadingBackground)})`,
        }}
      />
      <div className="absolute inset-0 bg-slate-950/55" />
      {hasStarted && !assets && <GameAssetLoading />}

      {canRenderGame && (
        <DragonFlightCanvas
          stageSize={stageSize}
          assets={assets!}
          gatePairs={gatePairs}
          layout={layout!}
          gateFrame={gateFrame}
          playerFrame={playerFrame}
          playerX={playerX}
          dragonCount={dragonCount}
          bossFrame={bossFrame}
          bossY={bossY}
          bossHealth={bossHealth}
          showBoss={isBossPhase}
        />
      )}

      {canRenderGame && (
        <div className="absolute inset-0 z-10 pointer-events-none p-2 sm:p-6 [@media(max-height:500px)]:p-2">
          {/* The whole left or right half of the screen answers, so nobody has to aim at a moving gate. */}
          {state.status === "running" && (
            <>
              <div
                aria-hidden="true"
                data-testid="dragon-flight-zone-left"
                className="pointer-events-auto absolute bottom-0 left-0 w-1/2"
                style={{ top: chrome.hudBottom }}
                onPointerDown={() => handleGateSelection("left")}
              />
              <div
                aria-hidden="true"
                data-testid="dragon-flight-zone-right"
                className="pointer-events-auto absolute bottom-0 right-0 w-1/2"
                style={{ top: chrome.hudBottom }}
                onPointerDown={() => handleGateSelection("right")}
              />
            </>
          )}

          {/* Top bar */}
          <div
            ref={hudRef}
            className="relative z-20 flex w-full flex-col gap-1.5 sm:gap-3 [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:items-start [@media(max-height:500px)]:gap-2"
          >
            {/* Time and dragons */}
            <div className="flex items-center gap-2 sm:gap-4 [@media(max-height:500px)]:order-2 [@media(max-height:500px)]:w-2/5 [@media(max-height:500px)]:shrink-0">
              <div
                className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-full border border-white/15 bg-black/55 backdrop-blur-sm sm:h-8"
                role="progressbar"
                aria-label={appT("interactivePlay.runTimer")}
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
                <div className="absolute inset-0 z-10 flex items-center justify-center text-sm font-bold text-white drop-shadow-md tracking-widest">
                  {Math.max(
                    0,
                    Math.ceil((state.durationMs - state.elapsedMs) / 1000),
                  )}
                  s
                </div>
              </div>
              <div className={`flex shrink-0 items-center gap-1.5 rounded-full border bg-black/60 px-3 py-1 shadow-lg backdrop-blur-md transition-all sm:px-4 sm:py-1.5 ${tutorialMode && tutorialStep === 3 ? "border-amber-300 ring-8 ring-amber-300/25" : "border-white/15"}`}>
                <Flame className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-semibold text-white/80 sm:text-sm">
                  {t("dragonFlight.dragons")}
                </span>
                <motion.div
                  key={dragonCount}
                  data-testid="dragon-flight-dragon-count"
                  className="text-lg font-bold leading-none text-white sm:text-2xl"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                >
                  {dragonCount}
                </motion.div>
              </div>
            </div>

            {/* The word to read */}
            <div className={`min-w-0 flex-1 rounded-2xl border bg-slate-950/85 px-3 py-1.5 shadow-lg backdrop-blur-md transition-all sm:px-5 sm:py-3 ${tutorialMode && tutorialStep === 0 ? "border-amber-300 ring-8 ring-amber-300/25" : "border-white/15"}`}>
              {isBossPhase ? (
                <div data-testid="dragon-flight-boss" className="py-1.5 text-center text-lg font-bold leading-tight text-white sm:text-2xl">
                  {bossMessage}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-white/80 sm:text-sm">
                    <span>{gate?.bonus ? "รอบโบนัส เก็บมังกรเพิ่ม" : t("dragonFlight.prompt")}</span>
                    {gate && !gate.bonus && (
                      <span data-testid="dragon-flight-word-number" className="tabular-nums">
                        คำที่ {gate.wordNumber}/{gameVocabulary.length}
                      </span>
                    )}
                  </div>
                  <div
                    data-testid="dragon-flight-word"
                    className={`text-center font-bold leading-tight text-white break-words ${termSizeClass(gate?.round.term ?? "")} [@media(max-height:500px)]:text-xl`}
                  >
                    {gate?.round.term || "—"}
                  </div>
                </>
              )}
            </div>

            {/* The meaning of the word just missed. It floats, so the top bar keeps its height. */}
            {reveal && !isBossPhase && (
              <div
                data-testid="dragon-flight-reveal"
                className="absolute inset-x-0 top-full mt-1 rounded-xl border border-emerald-300/70 bg-slate-950/95 px-3 py-1 text-center text-sm font-bold text-white shadow-lg sm:text-lg"
              >
                {reveal.term} = <span className="text-emerald-300">{reveal.meaning}</span>
              </div>
            )}
          </div>

          {/* Navigation arrows - only while running, always above the labels */}
          {state.status === "running" && (
            <div
              ref={arrowsRef}
              className="pointer-events-none absolute bottom-14 sm:bottom-24 left-0 right-0 z-20 flex justify-center gap-16 sm:gap-32 [@media(max-height:500px)]:bottom-2 [@media(max-height:500px)]:justify-between [@media(max-height:500px)]:px-3"
            >
              <button
                type="button"
                className={`pointer-events-auto flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95 shadow-lg [@media(max-height:500px)]:h-12 [@media(max-height:500px)]:w-12 ${tutorialMode && tutorialStep === 2 && gate?.round.correctSide === "left" ? "border-amber-300 ring-8 ring-amber-300/35 animate-pulse" : "border-white/20"}`}
                onPointerDown={() => handleGateSelection("left")}
                aria-label={appT("interactivePlay.chooseLeftGate")}
              >
                <ArrowLeft size={24} className="sm:hidden" />
                <ArrowLeft size={32} className="hidden sm:block" />
              </button>
              <button
                type="button"
                className={`pointer-events-auto flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95 shadow-lg [@media(max-height:500px)]:h-12 [@media(max-height:500px)]:w-12 ${tutorialMode && tutorialStep === 2 && gate?.round.correctSide === "right" ? "border-amber-300 ring-8 ring-amber-300/35 animate-pulse" : "border-white/20"}`}
                onPointerDown={() => handleGateSelection("right")}
                aria-label={appT("interactivePlay.chooseRightGate")}
              >
                <ArrowRight size={24} className="sm:hidden" />
                <ArrowRight size={32} className="hidden sm:block" />
              </button>
            </div>
          )}

          {/* Gate labels, positioned from the canvas layout */}
          {gateLabels && layout && gate && state.status !== "boss" &&
            (["left", "right"] as const).map((side) => {
              const text = gateLabels[side];
              if (!text) return null;
              const isRight = gate.outcome && gate.round.correctSide === side;
              const isPickedWrong = gate.outcome && gate.picked === side && !isRight;
              const isOtherWrong = gate.outcome && !isRight && !isPickedWrong;
              return (
                <div
                  key={side}
                  ref={side === "left" ? leftLabelRef : rightLabelRef}
                  data-testid={`dragon-flight-label-${side}`}
                  data-mark={isRight ? "right" : isPickedWrong ? "wrong" : "none"}
                  className={`absolute z-10 rounded-xl border px-2 py-2 text-center font-bold leading-snug text-white shadow-xl backdrop-blur-md transition-[border-color,box-shadow,background-color] [text-wrap:balance] sm:px-6 sm:py-3 ${labelSizeClass(text)} [@media(max-height:500px)]:py-1 [@media(max-height:500px)]:text-sm ${labelTone(side)} ${!gateLabelVisible ? "opacity-0" : isOtherWrong ? "opacity-70" : "opacity-100"}`}
                  style={{
                    left: labelX[side],
                    top: 0,
                    width: labelWidth,
                    transform: `translate3d(0, ${gateLabelTop}px, 0)`,
                    willChange: "transform",
                  }}
                >
                  {isRight && <Check className="mr-1 inline size-4 align-[-2px]" strokeWidth={3} aria-label="คำตอบที่ถูก" />}
                  {isPickedWrong && <X className="mr-1 inline size-4 align-[-2px]" strokeWidth={3} aria-label="ตอบผิด" />}
                  {text}
                </div>
              );
            })}

          {state.status === "running" && !hasAnswered && !tutorialMode && gateIsOpen && (
            <div className="absolute inset-x-0 bottom-3 z-10 text-center sm:bottom-8 [@media(max-height:500px)]:bottom-4">
              <span data-testid="dragon-flight-hint" className="rounded-full bg-black/75 px-4 py-1.5 text-sm font-bold text-white shadow-lg sm:text-base">
                แตะฝั่งคำตอบที่ถูก
              </span>
            </div>
          )}

          {/* Answer feedback, next to the labels the student is reading */}
          <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-center" style={{ top: pillTop }}>
            <AnimatePresence>
              {pill && !isBossPhase && (
                <motion.div
                  key={`${pill.id}-${pill.tone}`}
                  data-testid="dragon-flight-feedback"
                  data-tone={pill.tone}
                  className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-base font-bold shadow-xl ${
                    pill.tone === "correct"
                      ? "bg-emerald-600 text-white"
                      : pill.tone === "incorrect"
                        ? "bg-rose-600 text-white"
                        : "bg-amber-400 text-slate-950"
                  }`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.08 }}
                >
                  {pill.tone === "correct" && <Check className="size-5" strokeWidth={3} aria-hidden="true" />}
                  {pill.tone === "incorrect" && <X className="size-5" strokeWidth={3} aria-hidden="true" />}
                  {pill.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {tutorialMode && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 mx-auto flex max-w-xl items-center gap-3 rounded-3xl border border-amber-300/35 bg-slate-950/90 p-4 text-white shadow-2xl backdrop-blur sm:bottom-5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-lg font-black text-slate-950">{tutorialStep + 1}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">{tx("Dragon Flight Tutorial")}</p>
                <p className="mt-0.5 text-sm font-black sm:text-base">{[
                  "อ่านคำศัพท์เป้าหมายด้านบน",
                  "เปรียบเทียบความหมายของประตูทั้งสองฝั่ง",
                  "สคริปต์กำลังพามังกรบินเข้าประตูที่ถูก",
                  "ตอบถูกแล้ว ฝูงมังกรเพิ่มขึ้น 1 ตัว",
                ][tutorialStep]}</p>
              </div>
              <div className="flex gap-1">{[0, 1, 2, 3].map((step) => <span key={step} className={`h-2 rounded-full transition-all ${step === tutorialStep ? "w-7 bg-amber-300" : "w-2 bg-white/20"}`} />)}</div>
            </div>
          )}
        </div>
      )}

      {canRenderGame && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          {isBossPhase && !bossDown && layout && (
            <div
              data-testid="dragon-flight-boss-health"
              className="absolute left-1/2 h-3 w-40 -translate-x-1/2 overflow-hidden rounded-full border border-white/50 bg-black/70"
              style={{
                top: Math.max(
                  bossY - (layout.bossFrameHeight * layout.bossScale) / 2 - 20,
                  chrome.hudBottom + 4,
                ),
              }}
            >
              <div className="h-full bg-rose-500" style={{ width: `${bossHealth * 100}%` }} />
            </div>
          )}

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
              {tx("Dragon Flight")}
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
                  title={tx("Leaderboard")}
                >
                  <Trophy className="h-5 w-5" />
                </button>
                <div className="rounded-md border border-white/20 bg-white/10 px-2 py-1.5 sm:px-4 sm:py-2 text-xs uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm">
                  {isLoading ? tx("Loading Assets") : tx("Ready")}
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
  gatePairs: GatePair[];
  layout: FlightLayout;
  gateFrame: number;
  playerFrame: number;
  playerX: number;
  dragonCount: number;
  bossFrame: number;
  bossY: number;
  bossHealth: number;
  showBoss: boolean;
};

const PARALLAX_SPEEDS = { bottom: 18, middle: 28, top: 40 } as const;
type ParallaxKey = keyof typeof PARALLAX_SPEEDS;
const PARALLAX_KEYS = Object.keys(PARALLAX_SPEEDS) as ParallaxKey[];

// A glow follows the gate's shape, where a tint would draw a box around it.
const gateGlow = (row: number) => {
  if (row === 0) return {};
  return { shadowColor: row === 1 ? "#34d399" : "#f43f5e", shadowBlur: 45, shadowOpacity: 1 };
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
  gatePairs,
  layout,
  gateFrame,
  playerFrame,
  playerX,
  dragonCount,
  bossFrame,
  bossY,
  bossHealth,
  showBoss,
}: DragonFlightCanvasProps) => {
  const bottomLayerRef = useRef<Konva.Layer | null>(null);
  const middleLayerRef = useRef<Konva.Layer | null>(null);
  const topLayerRef = useRef<Konva.Layer | null>(null);
  const projectileLayerRef = useRef<Konva.Layer | null>(null);

  const parallaxGroups = useRef<Record<ParallaxKey, Konva.Group | null>>({
    bottom: null,
    middle: null,
    top: null,
  });
  const parallaxOffsets = useRef<Record<ParallaxKey, number>>({ bottom: 0, middle: 0, top: 0 });
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

    const parallaxPeriods: Record<ParallaxKey, number> = {
      top: buildParallaxMetrics(assets.parallaxTop, stageSize.width).height * 2,
      middle: buildParallaxMetrics(assets.parallaxMiddle, stageSize.width).height * 2,
      bottom: buildParallaxMetrics(assets.parallaxBottom, stageSize.width).height * 2,
    };

    // Whole device pixels only: a join on a fraction of a pixel shows as a hairline.
    const pixelRatio = window.devicePixelRatio || 1;

    const animation = new Konva.Animation(
      (frame) => {
        if (!frame) return;
        const delta = frame.timeDiff / 1000;
        const now = Date.now();

        // Use ref for latest state to avoid loop restarts
        const { bossY, bossHealth, showBoss, layout, dragonCount } =
          gameStateRef.current;

        // --- Parallax ---
        PARALLAX_KEYS.forEach((key) => {
          const period = parallaxPeriods[key];
          parallaxOffsets.current[key] =
            (parallaxOffsets.current[key] + delta * PARALLAX_SPEEDS[key]) % period;
          parallaxGroups.current[key]?.y(
            Math.round((parallaxOffsets.current[key] - period) * pixelRatio) / pixelRatio,
          );
        });

        // --- Projectiles ---
        if (showBoss && bossHealth > 0 && layout && bossY >= layout.bossY) {
          // Spawn Player Projectile: the bigger the flock, the more fireballs
          const flockSize = Math.max(dragonCount, 1);
          if (
            now - lastFireTimeRef.current.player >
            Math.max(90, 420 - (flockSize - 1) * 40) + Math.random() * 80
          ) {
            const id = now + Math.random();
            const spread = Math.min(flockSize, 12) * 8;
            projectilesRef.current.push({
              id,
              x: layout.playerX + (Math.random() - 0.5) * spread,
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
  // A fallen boss stays down instead of looping its fall.
  const bossCol = bossHealth <= 0 ? 2 : bossFrame % 3;

  // The lead dragon is one of the count, so what is drawn matches the number on screen.
  const armyCount = Math.min(Math.max(dragonCount - 1, 0), 12);
  const armyItems = Array.from({ length: armyCount }, (_, index) => ({
    index,
    row: Math.floor(index / 3) % 3,
    col: index % 3,
  }));

  // Enough tile copies for any screen height. Every other copy is flipped, so
  // each join meets its own mirror image and no hard seam shows.
  const renderParallax = (
    key: ParallaxKey,
    image: HTMLImageElement,
    opacity: number,
    layerRef: React.RefObject<Konva.Layer | null>,
  ) => {
    const { scale, height } = buildParallaxMetrics(image, stageSize.width);
    const copies = Math.ceil(stageSize.height / height) + 2;
    // A solid layer overlaps its neighbour by a pixel so nothing shows through at a join.
    const scaleY = opacity === 1 ? scale * ((height + 1) / height) : scale;
    return (
      <Layer ref={layerRef} listening={false}>
        <Group
          y={height * -2}
          ref={(node) => {
            parallaxGroups.current[key] = node;
          }}
        >
          {Array.from({ length: copies }, (_, index) => {
            const flipped = index % 2 === 1;
            return (
              <KonvaImage
                key={index}
                image={image}
                x={0}
                y={flipped ? (index + 1) * height : index * height}
                scaleX={scale}
                scaleY={flipped ? -scaleY : scaleY}
                opacity={opacity}
              />
            );
          })}
        </Group>
      </Layer>
    );
  };

  return (
    <Stage width={stageSize.width} height={stageSize.height} listening={false}>
      {renderParallax("bottom", assets.parallaxBottom, 1, bottomLayerRef)}
      {renderParallax("middle", assets.parallaxMiddle, 0.85, middleLayerRef)}
      {renderParallax("top", assets.parallaxTop, 0.7, topLayerRef)}

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
            {/* Dims the clouds so the dark boss art reads against them */}
            <Rect
              x={0}
              y={0}
              width={stageSize.width}
              height={stageSize.height}
              fill="black"
              opacity={0.4}
            />

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
            // Once answered or closed the gate stays marked until it leaves the screen.
            const revealed = Boolean(pair.outcome);
            const leftRow = revealed
              ? pair.round.correctSide === "left"
                ? 1
                : 2
              : 0;
            const rightRow = revealed
              ? pair.round.correctSide === "right"
                ? 1
                : 2
              : 0;

            return (
              <React.Fragment key={pair.id}>
                <Group
                  x={layout.leftGate.left + layout.leftGate.width / 2}
                  y={gateCenterY}
                  scaleX={layout.gateScale}
                  scaleY={layout.gateScale}
                >
                  <KonvaImage
                    image={assets.gates}
                    crop={getSpriteCrop(gateGrid, gateFrame, leftRow)}
                    width={layout.gateFrameWidth}
                    height={layout.gateFrameHeight}
                    offsetX={layout.gateFrameWidth / 2}
                    offsetY={layout.gateFrameHeight / 2}
                    {...gateGlow(leftRow)}
                  />
                </Group>

                <Group
                  x={layout.rightGate.left + layout.rightGate.width / 2}
                  y={gateCenterY}
                  scaleX={layout.gateScale}
                  scaleY={layout.gateScale}
                >
                  <KonvaImage
                    image={assets.gates}
                    crop={getSpriteCrop(gateGrid, gateFrame, rightRow)}
                    width={layout.gateFrameWidth}
                    height={layout.gateFrameHeight}
                    offsetX={layout.gateFrameWidth / 2}
                    offsetY={layout.gateFrameHeight / 2}
                    {...gateGlow(rightRow)}
                  />
                </Group>
              </React.Fragment>
            );
          })}
      </Layer>
    </Stage>
  );
};
