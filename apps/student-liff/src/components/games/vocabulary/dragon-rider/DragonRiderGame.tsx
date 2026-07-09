"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useScopedI18n } from "@/locales/client";
import Konva from "konva";
import { Group, Image as KonvaImage, Layer, Rect, Stage } from "react-konva";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Flame,
  Shield,
  Sparkles,
  Wand2,
  Trophy,
} from "lucide-react";
import { withBasePath } from "@/lib/games/basePath";
import { t as appT } from "@/lib/i18n";
import {
  advanceDragonRiderTime,
  calculateBossPower,
  createDragonRiderState,
  getDragonRiderResults,
} from "@/lib/games/dragonRider";
import type {
  DragonRiderResults,
  DragonRiderRound,
  DragonRiderState,
  GateSide,
} from "@/lib/games/dragonRider";
import type { VocabularyItem } from "@/store/useGameStore";
import { useInterval } from "@/hooks/useInterval";
import { useSound } from "@/hooks/useSound";
import { useGameFullscreen } from "@/hooks/useGameFullscreen";
import { useAccessibilitySettings } from "@/hooks/useAccessibilitySettings";
import { GameEndScreen } from "@/components/games/game/GameEndScreen";
import { GameStartScreen } from "@/components/games/game/GameStartScreen";
import { RankingDialog } from "@/components/games/vocabulary/dragon-flight/RankingDialog";

type DragonRiderAssets = {
  gates: HTMLImageElement;
  boss: HTMLImageElement;
  player: HTMLImageElement;
  playerCamera: HTMLImageElement;
  army: HTMLImageElement;
  parallaxTop: HTMLImageElement;
  parallaxMiddle: HTMLImageElement;
  parallaxBottom: HTMLImageElement;
  loadingBackground: HTMLImageElement | null;
};

export type Difficulty = "easy" | "medium" | "hard";

export type DragonRiderGameProps = {
  vocabulary: VocabularyItem[];
  onComplete: (results: DragonRiderResults) => void;
  preloadedAssets?: DragonRiderAssets | null;
  durationMs?: number;
  autoStart?: boolean;
};

type GateFeedback = {
  pairId: string;
  side: GateSide;
  outcome: "correct" | "incorrect";
};

type GatePair = {
  id: string;
  round: DragonRiderRound;
  y: number;
  gateRow: number;
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
    "/games/vocabulary/dragon-rider/gates-3x3-sheet-facing-up.png",
  ),
  boss: withBasePath(
    "/games/vocabulary/dragon-rider/boss-3x3-sheet-facing-up.png",
  ),
  player: withBasePath(
    "/games/vocabulary/dragon-rider/player-3x3-sheet-facing-down.png",
  ),
  playerCamera: withBasePath(
    "/games/vocabulary/dragon-rider/player-3x3-sheet-facing-camera.png",
  ),
  army: withBasePath(
    "/games/vocabulary/dragon-rider/dragon-army-3x3-sheet-facing-up.png",
  ),
  parallaxTop: withBasePath(
    "/games/vocabulary/dragon-rider/parallax-top-tiling.png",
  ),
  parallaxMiddle: withBasePath(
    "/games/vocabulary/dragon-rider/parallax-middle-tiling.png",
  ),
  parallaxBottom: withBasePath(
    "/games/vocabulary/dragon-rider/parallax-bottom-tiling.png",
  ),
  loadingBackground: withBasePath(
    "/games/vocabulary/dragon-rider/loading-screen-background.png",
  ),
};

const DEFAULT_STAGE: StageSize = { width: 960, height: 540 };
const TICK_MS = 60;
// const GATE_TRAVEL_MS = 7200 // Moved to dynamic calculation
const PLAYER_LERP = 0.22;
const PLAYER_ANIM_MS = 120;
const BOSS_ANIM_MS = 180;
const BOSS_HEALTH_TICK_MS = 1800;
const RESULTS_REVEAL_MS = 900;
const GATE_SCALE_FACTOR = 0.5;
const PLAYER_BASE_SCALE = 0.22;
const BOSS_BASE_SCALE = 0.55;
const ARMY_BASE_SCALE = 0.12;
const MAX_ROUND_WORDS = 10;
const MS_PER_WORD = 5000;

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

const buildAssets = async (): Promise<DragonRiderAssets> => {
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

const getGateLabels = (round: DragonRiderState["round"]) => {
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

const shuffleVocabulary = (vocabulary: VocabularyItem[]) =>
  [...vocabulary].sort(() => Math.random() - 0.5);

const buildGateRound = (
  vocabulary: VocabularyItem[],
  preferredItem?: VocabularyItem,
): DragonRiderRound => {
  if (vocabulary.length === 0) {
    return {
      term: "",
      correctTranslation: "",
      decoyTranslation: "",
      correctSide: "left",
    };
  }

  const correctItem =
    preferredItem ?? vocabulary[pickRandomIndex(vocabulary.length)];
  const correctIndex = Math.max(
    0,
    vocabulary.findIndex((item) => item.id === correctItem.id && item.term === correctItem.term),
  );
  let decoyIndex = pickRandomIndex(vocabulary.length);
  if (decoyIndex === correctIndex && vocabulary.length > 1) {
    decoyIndex = (correctIndex + 1) % vocabulary.length;
  }

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

export function DragonRiderGame({
  vocabulary,
  onComplete,
  preloadedAssets,
  durationMs,
  autoStart = false,
}: DragonRiderGameProps) {
  const t = useScopedI18n("pages.student.gamesPage.dragonRider");
  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen();
  const { getEffectiveTextSize } = useAccessibilitySettings();
  const gameVocabulary = useMemo(
    () => shuffleVocabulary(vocabulary).slice(0, MAX_ROUND_WORDS),
    [vocabulary],
  );
  const gameDurationMs =
    durationMs ?? Math.max(MS_PER_WORD, gameVocabulary.length * MS_PER_WORD);

  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [gamePhase, setGamePhase] = useState<"start" | "playing" | "ended">(
    autoStart ? "playing" : "start",
  );
  const [showRanking, setShowRanking] = useState(false);
  const [results, setResults] = useState<DragonRiderResults | null>(null);
  const [stageSize, setStageSize] = useState<StageSize>(DEFAULT_STAGE);
  const [assets, setAssets] = useState<DragonRiderAssets | null>(
    preloadedAssets ?? null,
  );
  const [isLoading, setIsLoading] = useState(!preloadedAssets);
  const [state, setState] = useState<DragonRiderState>(() => {
    return createDragonRiderState(gameVocabulary, {
      durationMs: gameDurationMs,
    });
  });
  const initialRoundRef = useRef<DragonRiderRound>(state.round);
  const [gatePairs, setGatePairs] = useState<GatePair[]>([]);
  const gateIdRef = useRef(0);
  const [feedback, setFeedback] = useState<GateFeedback | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [playerFrame, setPlayerFrame] = useState(0);
  const [bossFrame, setBossFrame] = useState(0);
  const [playerX, setPlayerX] = useState(DEFAULT_STAGE.width / 2);

  const [lockedPairId, setLockedPairId] = useState<string | null>(null);
  const [displayDragonCount, setDisplayDragonCount] = useState(1);
  const [bossHealth, setBossHealth] = useState(0);
  const [bossY, setBossY] = useState(DEFAULT_STAGE.height * 0.28);
  const [bossSequenceDone, setBossSequenceDone] = useState(false);
  const [bossBattleStarted, setBossBattleStarted] = useState(false);
  const { playSound } = useSound();
  const resultsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSelectionRef = useRef<PendingSelection | null>(null);
  const playerTargetRef = useRef<number | null>(null);
  const answeredPairIdsRef = useRef<Set<string>>(new Set());
  const questionQueueRef = useRef<VocabularyItem[]>([]);

  const getNextVocabularyItem = useCallback(() => {
    if (gameVocabulary.length === 0) return undefined;
    if (questionQueueRef.current.length === 0) {
      questionQueueRef.current = shuffleVocabulary(gameVocabulary);
    }
    return questionQueueRef.current.shift();
  }, [gameVocabulary]);

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
  }, [containerRef]);

  useEffect(() => {
    let isMounted = true;

    if (preloadedAssets) return;

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
    const nextState = createDragonRiderState(gameVocabulary, {
      durationMs: gameDurationMs,
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
    setBossBattleStarted(false);
    pendingSelectionRef.current = null;
    playerTargetRef.current = null;
    answeredPairIdsRef.current = new Set();
    questionQueueRef.current = shuffleVocabulary(gameVocabulary);
  }, [gameDurationMs, gameVocabulary]);

  useEffect(() => {
    resetGame();
    setGamePhase(autoStart ? "playing" : "start");
  }, [autoStart, resetGame]);

  useEffect(() => {
    if (gamePhase === "playing") {
      enterFullscreen();
    } else if (gamePhase === "ended") {
      exitFullscreen();
    }
  }, [gamePhase, enterFullscreen, exitFullscreen]);

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
  }, [isLoading, measureStage, containerRef]);

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
      setState((prev) => advanceDragonRiderTime(prev, TICK_MS));

      if (!layout) return;

      const gateStartY = -layout.leftGate.height;
      const gateEndY = stageSize.height + layout.leftGate.height;

      const gateSpeed = (gateEndY - gateStartY) / (MS_PER_WORD / 1000);
      const deltaSeconds = TICK_MS / 1000;

      setGatePairs((prev) => {
        const nextPairs = prev
          .map((pair) => ({ ...pair, y: pair.y + gateSpeed * deltaSeconds }))
          .filter((pair) => pair.y <= gateEndY);
        const nextPairIds = new Set(nextPairs.map((pair) => pair.id));
        answeredPairIdsRef.current.forEach((pairId) => {
          if (!nextPairIds.has(pairId)) {
            answeredPairIdsRef.current.delete(pairId);
          }
        });

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
          setState((prevState) => ({
            ...prevState,
            attempts: prevState.attempts + 1,
            correctAnswers:
              prevState.correctAnswers +
              (pending.outcome === "correct" ? 1 : 0),
            dragonCount:
              pending.outcome === "correct"
                ? prevState.dragonCount + 1
                : Math.max(1, prevState.dragonCount - 1),
          }));
          playSound(pending.outcome === "correct" ? "success" : "error");
          playerTargetRef.current = layout.playerX;
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
    state.status === "running" && layout && gamePhase === "playing"
      ? TICK_MS
      : null,
  );

  const createGatePair = useCallback(
    (round?: DragonRiderRound) => {
      if (!layout || gameVocabulary.length === 0) return null;

      gateIdRef.current += 1;
      const nextWord = round ? undefined : getNextVocabularyItem();
      return {
        id: `gate-${gateIdRef.current}`,
        round: round ?? buildGateRound(gameVocabulary, nextWord),
        y: -layout.leftGate.height,
        gateRow: Math.floor(Math.random() * 3), // Random gate visual (0, 1, or 2)
      };
    },
    [gameVocabulary, getNextVocabularyItem, layout],
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
      setPlayerFrame((prev) => (prev + 1) % 6);
    },
    gamePhase === "playing" && state.status === "running"
      ? PLAYER_ANIM_MS
      : null,
  );

  useInterval(
    () => {
      setBossFrame((prev) => (prev + 1) % 3);
    },
    state.status === "boss" && gamePhase === "playing" ? BOSS_ANIM_MS : null,
  );

  useInterval(
    () => {
      if (!layout) return;
      const gateStartY = -layout.leftGate.height;
      const gateEndY = stageSize.height + layout.leftGate.height;

      const gateSpeed = (gateEndY - gateStartY) / (MS_PER_WORD / 1000);
      const deltaSeconds = TICK_MS / 1000;
      const targetY = stageSize.height * 0.45; // Stop boss at 45% down the screen

      setBossY((prev) => {
        const next = prev + gateSpeed * deltaSeconds;
        return next >= targetY ? targetY : next;
      });
    },
    state.status === "boss" && layout && gamePhase === "playing"
      ? TICK_MS
      : null,
  );

  useInterval(
    () => {
      setBossHealth((prev) => Math.max(0, prev - 1));
      setDisplayDragonCount((prev) => Math.max(0, prev - 1));
    },
    state.status === "boss" &&
      bossBattleStarted &&
      bossHealth > 0 &&
      displayDragonCount > 0 &&
      gamePhase === "playing"
      ? BOSS_HEALTH_TICK_MS
      : null,
  );

  useEffect(() => {
    if (state.status === "boss" && !bossBattleStarted) {
      const targetY = stageSize.height * 0.45;
      // Start battle when boss reaches target position
      if (bossY >= targetY - 10) {
        setBossBattleStarted(true);
      }
    }
  }, [state.status, bossBattleStarted, bossY, stageSize.height]);

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
    if (state.status !== "boss") return;
    const battleOver = bossHealth <= 0 || displayDragonCount <= 0;
    if (bossBattleStarted && battleOver) {
      setBossSequenceDone(true);
    }
  }, [bossHealth, displayDragonCount, state.status, bossBattleStarted]);

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

    const nextResults = getDragonRiderResults({
      correctAnswers: state.correctAnswers,
      totalAttempts: state.attempts,
      dragonCount: state.dragonCount,
    });
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
    onComplete,
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

  useEffect(() => {
    if (showResults) {
      setGamePhase("ended");
    }
  }, [showResults]);

  const activePair = useMemo(() => {
    if (lockedPairId) {
      return gatePairs.find((pair) => pair.id === lockedPairId) ?? null;
    }
    return getActiveGatePair(gatePairs);
  }, [gatePairs, lockedPairId]);

  const handleGateSelection = useCallback(
    (side: GateSide) => {
      if (gamePhase !== "playing") return;
      if (state.status !== "running") return;
      if (pendingSelectionRef.current) return;
      if (lockedPairId) return;

      const pair = activePair;
      if (!pair || !layout) return;
      if (answeredPairIdsRef.current.has(pair.id)) return;

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
      answeredPairIdsRef.current.add(pair.id);
      playerTargetRef.current = targetX;

      setLockedPairId(pair.id);
      setFeedback(null);
    },
    [activePair, gamePhase, layout, lockedPairId, state.status],
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (gamePhase !== "playing") return;
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
  }, [handleGateSelection, gamePhase, state.status]);

  const promptRound = activePair?.round ?? state.round;
  const remainingRatio =
    state.durationMs > 0
      ? Math.max(0, 1 - state.elapsedMs / state.durationMs)
      : 0;

  const dragonCountDisplay =
    state.status === "boss" ? displayDragonCount : state.dragonCount;
  const activePairId = activePair?.id ?? null;
  const statusLabel =
    gamePhase === "ended"
      ? "results"
      : gamePhase === "playing"
        ? state.status
        : "ready";

  if (!assets && !isLoading) {
    return (
      <div className="rounded-3xl border border-red-500/40 bg-red-950/30 p-6 text-sm text-red-200">
        {appT("interactivePlay.dragonRiderAssetError")}
      </div>
    );
  }

  const canRenderGame = Boolean(gamePhase !== "start" && layout && assets);
  const gateLabels =
    canRenderGame && activePair ? getGateLabels(activePair.round) : null;
  const gateLabelTop = canRenderGame
    ? activePair
      ? activePair.y + layout!.leftGate.height + 8
      : layout!.leftGate.top + layout!.leftGate.height + 8
    : 0;
  const arrowSize = canRenderGame
    ? clamp(layout!.leftGate.width * 0.45, 64, 120)
    : 0;
  const arrowOffsetX = canRenderGame
    ? clamp(layout!.leftGate.width * 0.75, 110, 190)
    : 0;
  const arrowTop = canRenderGame
    ? clamp(
        layout!.playerY - arrowSize / 2,
        140,
        stageSize.height - arrowSize - 80,
      )
    : 0;
  const leftArrowX = canRenderGame
    ? clamp(
        layout!.playerX - arrowOffsetX - arrowSize / 2,
        12,
        stageSize.width - arrowSize - 12,
      )
    : 0;
  const rightArrowX = canRenderGame
    ? clamp(
        layout!.playerX + arrowOffsetX - arrowSize / 2,
        12,
        stageSize.width - arrowSize - 12,
      )
    : 0;

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden bg-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.45)] ${
        gamePhase === "start"
          ? "h-[80vh] min-h-[320px] max-h-[760px] rounded-3xl border border-slate-800 sm:min-h-[400px] md:min-h-[480px]"
          : "h-dvh min-h-0 max-h-none touch-none select-none rounded-none border-0"
      }`}
      data-testid="dragon-rider"
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
        <DragonRiderCanvas
          stageSize={stageSize}
          assets={assets!}
          feedback={feedback}
          gatePairs={gatePairs}
          activePairId={activePairId}
          layout={layout!}
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
        <div className="absolute inset-0 z-10 pointer-events-none">
          <div className="absolute left-0 right-0 top-0 z-20">
            <div
              className="h-2 w-full overflow-hidden bg-white/10"
              role="progressbar"
              aria-label="Run timer"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(remainingRatio * 100)}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400"
                initial={{ width: "100%" }}
                animate={{ width: `${remainingRatio * 100}%` }}
                transition={{ duration: 0.2, ease: "linear" }}
                data-testid="dragon-rider-timer"
              />
            </div>
          </div>

          <div className="flex items-start justify-end p-2 sm:p-4 md:p-6">
            <div className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-white/10 bg-white/10 px-2 sm:px-4 py-1.5 sm:py-2 text-white backdrop-blur">
              <Flame
                className="h-3 w-3 sm:h-4 sm:w-4 text-amber-300"
                aria-hidden="true"
              />
              <span className="hidden xs:inline text-base uppercase tracking-[0.2em] text-white/70" style={{ fontSize: getEffectiveTextSize(16) }}>
                {appT("interactivePlay.dragons")}
              </span>
              <motion.span
                key={dragonCountDisplay}
                data-testid="dragon-rider-dragon-count"
                className="text-base sm:text-lg font-semibold"
                initial={{ scale: 0.9, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {dragonCountDisplay}
              </motion.span>
            </div>
          </div>

          <div className="absolute left-1/2 top-14 sm:top-16 md:top-20 w-[min(520px,calc(100%-48px))] -translate-x-1/2 text-center">
            <div className="rounded-[28px] border border-white/20 bg-slate-950/75 px-5 py-3 shadow-2xl backdrop-blur-md">
              <div
                className="text-[10px] sm:text-xs uppercase tracking-[0.24em] text-sky-200/75"
                style={{ fontSize: getEffectiveTextSize(11) }}
              >
                {appT("interactivePlay.chooseMeaning")}
              </div>
              <div
                className="mt-1 break-words text-2xl sm:text-3xl md:text-4xl font-black leading-tight text-white"
                style={{ fontSize: getEffectiveTextSize(30) }}
              >
                {promptRound.term || "—"}
              </div>
            </div>
          </div>

          {state.status === "running" && (
            <>
              <button
                type="button"
                className="absolute flex items-center justify-center rounded-2xl border border-white/20 bg-white/20 text-white backdrop-blur-sm transition active:scale-95 pointer-events-auto"
                style={{
                  width: arrowSize,
                  height: arrowSize,
                  left: leftArrowX,
                  top: arrowTop,
                }}
                onPointerDown={() => handleGateSelection("left")}
                aria-label={appT("interactivePlay.chooseLeftGate")}
              >
                <ArrowLeft size={arrowSize * 0.55} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="absolute flex items-center justify-center rounded-2xl border border-white/20 bg-white/20 text-white backdrop-blur-sm transition active:scale-95 pointer-events-auto"
                style={{
                  width: arrowSize,
                  height: arrowSize,
                  left: rightArrowX,
                  top: arrowTop,
                }}
                onPointerDown={() => handleGateSelection("right")}
                aria-label={appT("interactivePlay.chooseRightGate")}
              >
                <ArrowRight size={arrowSize * 0.55} aria-hidden="true" />
              </button>
            </>
          )}

          {gateLabels && layout && (
            <>
              <div
                className="absolute -translate-x-1/2 rounded-xl border border-white/10 bg-black/80 px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 md:py-2 text-base sm:text-lg md:text-2xl font-semibold text-white shadow-lg max-w-[120px] sm:max-w-[180px] md:max-w-none truncate sm:truncate-none"
                style={{
                  left: layout.leftGate.left + layout.leftGate.width / 2,
                  top: gateLabelTop,
                  fontSize: getEffectiveTextSize(16),
                }}
              >
                {gateLabels?.left}
              </div>
              <div
                className="absolute -translate-x-1/2 rounded-xl border border-white/10 bg-black/80 px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 md:py-2 text-base sm:text-lg md:text-2xl font-semibold text-white shadow-lg max-w-[120px] sm:max-w-[180px] md:max-w-none truncate sm:truncate-none"
                style={{
                  left: layout.rightGate.left + layout.rightGate.width / 2,
                  top: gateLabelTop,
                  fontSize: getEffectiveTextSize(16),
                }}
              >
                {gateLabels?.right}
              </div>
            </>
          )}

          <AnimatePresence>
            {feedback && (
              <motion.div
                className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-base font-semibold text-white backdrop-blur"
                style={{ fontSize: getEffectiveTextSize(16) }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                {feedback.outcome === "correct" ? appT("interactivePlay.plusDragon") : appT("interactivePlay.minusDragon")}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {canRenderGame && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <AnimatePresence>
            {state.status === "boss" && bossBattleStarted && !showResults && (
              <React.Fragment key="boss-battle">
                <motion.div
                  className="absolute inset-x-0 top-12 sm:top-16 mx-auto flex w-fit items-center gap-2 sm:gap-3 rounded-full border border-red-500/40 bg-red-950/70 px-3 sm:px-6 py-2 sm:py-3 text-base sm:text-xl font-bold uppercase tracking-[0.1em] sm:tracking-[0.2em] text-red-200"
                  style={{ fontSize: getEffectiveTextSize(16) }}
                  initial={{ opacity: 0, scale: 0.8, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.4, type: "spring" }}
                >
                  ⚔️ Big Boss Battle! ⚔️
                </motion.div>
                <motion.div
                  className="absolute inset-x-0 top-24 sm:top-36 mx-auto w-40 sm:w-64 md:w-80 px-2 sm:px-0"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <div className="rounded-lg border border-white/10 bg-slate-900/70 p-2 sm:p-3 backdrop-blur">
                    <div className="text-base uppercase tracking-[0.2em] text-white/70 mb-1" style={{ fontSize: getEffectiveTextSize(16) }}>
                      {appT("interactivePlay.bossHealth")}
                    </div>
                    <div className="h-4 w-full overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-600"
                        initial={{ width: "100%" }}
                        animate={{
                          width: `${Math.max(0, (bossHealth / calculateBossPower(state.attempts)) * 100)}%`,
                        }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <div className="mt-1 text-base text-white/60 text-center" style={{ fontSize: getEffectiveTextSize(16) }}>
                      {bossHealth} / {calculateBossPower(state.attempts)}
                    </div>
                  </div>
                </motion.div>
              </React.Fragment>
            )}
          </AnimatePresence>
        </div>
      )}

      {gamePhase === "start" && (
        <GameStartScreen
          gameTitle={t("startScreen.title")}
          gameSubtitle={t("startScreen.description")}
          vocabulary={gameVocabulary}
          instructions={[
            {
              step: 1,
              text: t("instructionsScreen.gameplay.gatesDesc"),
              icon: Shield,
            },
            {
              step: 2,
              text: `${t("instructionsScreen.controls.move")}: ${t("instructionsScreen.controls.moveKeys")}`,
              icon: Wand2,
            },
            {
              step: 3,
              text: t("instructionsScreen.gameplay.bossDesc"),
              icon: Sparkles,
            },
          ]}
          proTip={t("instructionsScreen.gameplay.objectiveDesc")}
          controls={[
            {
              label: t("instructionsScreen.controls.move"),
              keys: t("instructionsScreen.controls.moveKeys"),
              color: "bg-amber-500",
            },
            { label: "Select", keys: "Tap Gate", color: "bg-emerald-500" },
          ]}
          startButtonText={
            isLoading ? t("startScreen.loading") : t("startScreen.startButton")
          }
          onStart={() => {
            if (isLoading) return;
            resetGame();
            setGamePhase("playing");
          }}
        >
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-slate-900/80 p-1 rounded-lg border border-white/10">
              {(["easy", "medium", "hard"] as Difficulty[]).map(
                (d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`px-3 py-1.5 rounded-md text-base uppercase font-bold tracking-wider transition-colors ${
                      difficulty === d
                        ? "bg-amber-500 text-slate-900"
                        : "text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                    style={{ fontSize: getEffectiveTextSize(16) }}
                  >
                    {t(
                      `startScreen.difficulty${d.charAt(0).toUpperCase() + d.slice(1)}`,
                    )}
                  </button>
                ),
              )}
            </div>
            <button
              onClick={() => setShowRanking(true)}
              className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors border border-white/10"
              title={t("startScreen.rankingButton")}
            >
              <Trophy className="w-5 h-5" />
            </button>
          </div>
        </GameStartScreen>
      )}

      <RankingDialog
        open={showRanking}
        onOpenChange={setShowRanking}
        apiEndpoint="/api/v1/games/dragon-rider/ranking"
        translationNamespace="dragonRider"
      />

      {gamePhase === "ended" && results && (
        <GameEndScreen
          status={results.victory ? "victory" : "defeat"}
          score={results.correctAnswers}
          xp={results.xp}
          accuracy={results.accuracy}
          customStats={[
            {
              label: t("resultsScreen.wordsCollected"),
              value: results.dragonCount,
            },
            {
              label: t("gameplayScreen.hud.bossHealth"),
              value: results.bossPower,
            },
          ]}
          onRestart={() => {
            resetGame();
            setGamePhase("start");
          }}
        />
      )}
    </div>
  );
}

type DragonRiderCanvasProps = {
  stageSize: StageSize;
  assets: DragonRiderAssets;
  feedback: GateFeedback | null;
  gatePairs: GatePair[];
  activePairId: string | null;
  layout: FlightLayout;
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

const buildParallaxMetrics = (
  image: HTMLImageElement,
  stageWidth: number,
  stageHeight: number,
) => {
  // Scale must cover BOTH width and height so the tile fills the full canvas
  // on tall portrait screens (mobile) where height > width.
  const scaleX = stageWidth / image.width;
  const scaleY = stageHeight / image.height;
  const scale = Math.max(scaleX, scaleY);
  return {
    scale,
    height: image.height * scale,
  };
};

const DragonRiderCanvas = ({
  stageSize,
  assets,
  feedback,
  gatePairs,
  activePairId,
  layout,
  playerFrame,
  playerX,
  dragonCount,
  bossFrame,
  bossY,
  bossHealth,
  onSelectGate,
  showBoss,
}: DragonRiderCanvasProps) => {
  const bottomLayerRef = useRef<Konva.Layer | null>(null);
  const middleLayerRef = useRef<Konva.Layer | null>(null);
  const topLayerRef = useRef<Konva.Layer | null>(null);
  const parallaxRefs = useRef<ParallaxRefs>({
    topA: null,
    topB: null,
    middleA: null,
    middleB: null,
    bottomA: null,
    bottomB: null,
  });
  const parallaxOffsets = useRef({ top: 0, middle: 0, bottom: 0 });

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
      !topLayerRef.current
    )
      return;

    const topMetrics = buildParallaxMetrics(
      assets.parallaxTop,
      stageSize.width,
      stageSize.height,
    );
    const middleMetrics = buildParallaxMetrics(
      assets.parallaxMiddle,
      stageSize.width,
      stageSize.height,
    );
    const bottomMetrics = buildParallaxMetrics(
      assets.parallaxBottom,
      stageSize.width,
      stageSize.height,
    );

    const animation = new Konva.Animation(
      (frame) => {
        if (!frame) return;
        const delta = frame.timeDiff / 1000;
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
      },
      [bottomLayerRef.current, middleLayerRef.current, topLayerRef.current],
    );

    animation.start();
    return () => {
      animation.stop();
    };
  }, [assets, stageSize.width, stageSize.height]);

  // During flight: use rows 0-1 from animation
  // During boss battle: use row 2 with state-based columns
  const playerRow = showBoss ? 2 : Math.floor(playerFrame / 3);
  const playerCol = showBoss
    ? dragonCount < bossHealth
      ? 2
      : bossHealth > 0
        ? 1
        : 0 // losing : attacking : idle
    : playerFrame % 3;

  const bossRow = showBoss && bossHealth <= 0 ? 2 : 0;
  const bossCol = bossFrame % 3;

  const armyCount = Math.min(dragonCount, 12);
  const armyItems = Array.from({ length: armyCount }, (_, index) => ({
    index,
    row: Math.floor(index / 3) % 3,
    col: index % 3,
  }));

  const topMetrics = buildParallaxMetrics(
    assets.parallaxTop,
    stageSize.width,
    stageSize.height,
  );
  const middleMetrics = buildParallaxMetrics(
    assets.parallaxMiddle,
    stageSize.width,
    stageSize.height,
  );
  const bottomMetrics = buildParallaxMetrics(
    assets.parallaxBottom,
    stageSize.width,
    stageSize.height,
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
              scaleY={layout.armyScale}
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
          scaleY={layout.playerScale}
        />

        {showBoss && (
          <KonvaImage
            image={assets.boss}
            crop={getSpriteCrop(bossGrid, bossCol, bossRow)}
            x={layout.bossX}
            y={bossY}
            width={layout.bossFrameWidth}
            height={layout.bossFrameHeight}
            offsetX={layout.bossFrameWidth / 2}
            offsetY={layout.bossFrameHeight / 2}
            scaleX={layout.bossScale}
            scaleY={layout.bossScale}
            opacity={0.95}
          />
        )}
        {gatePairs.map((pair) => {
          const gateCenterY = pair.y + layout.leftGate.height / 2;
          const isActive = pair.id === activePairId;
          const isFeedbackPair = feedback?.pairId === pair.id;
          const leftColumn = isFeedbackPair
            ? pair.round.correctSide === "left"
              ? 1
              : 2
            : 0;
          const rightColumn = isFeedbackPair
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
                  crop={getSpriteCrop(gateGrid, leftColumn, pair.gateRow)}
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
                      leftColumn === 1
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
                  crop={getSpriteCrop(gateGrid, rightColumn, pair.gateRow)}
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
                      rightColumn === 1
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
