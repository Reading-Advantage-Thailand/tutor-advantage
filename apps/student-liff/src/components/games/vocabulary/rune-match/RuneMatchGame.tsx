"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Stage, Rect, Text, Group, Circle } from "react-konva";
import {
  createRuneMatchState,
  initializeGrid,
  advanceTime,
  applyHint,
  findPossibleMoves,
  needsFastTick,
  RUNE_RULE_LINES,
  shuffleGrid,
  tapRune,
  type RuneMatchState,
} from "@/lib/games/runeMatch";
import {
  RUNE_MATCH_CONFIG,
  MONSTER_DIFFICULTY,
  type MonsterType,
} from "@/lib/games/runeMatchConfig";
import type { VocabularyItem } from "@/store/useGameStore";
import { GameAssetLoadFailure } from "@/components/games/GameAssetLoadFailure";
import { loadGameImage } from "@/lib/games/gameAssetPreloader";
import { createRoundClock, type RoundClock } from "@/lib/games/roundClock";
import { useGameFullscreen } from "@/hooks/useGameFullscreen";
import { useAccessibilitySettings } from "@/hooks/useAccessibilitySettings";
import { playGameSound } from "@/hooks/useSound";
import { calculateXP } from "@/lib/games/xp";
import {
  cellPosition,
  clampLabelCenter,
  computeRuneMatchLayout,
  fitRuneLabel,
  getTimePresentation,
  type RuneLabelPresentation,
  type RuneMatchLayout,
} from "@/lib/games/runeMatchPresentation";
import { tx } from "@/lib/games/gameText";
import { BackdropLayer, BoardLayer, messageColor, StatusLayer } from "./RuneMatchLayers";

export type RuneMatchGameResult = {
  xp: number;
  accuracy: number;
  score: number;
  correctAnswers: number;
  totalAttempts: number;
  durationMs?: number;
  monsterType?: string;
  difficulty?: string;
};

export type RuneMatchGameProps = {
  vocabulary: VocabularyItem[];
  tutorialMode?: boolean;
  tutorialStep?: number;
  disableAutoFullscreen?: boolean;
  restartOnComplete?: boolean;
  /**
   * Small note shown by the host (e.g. the tutor's "demo mode" banner). On
   * wide layouts it sits at the foot of the sidebar so the board keeps the
   * full height; on narrow layouts a strip is reserved for it under the board.
   */
  statusBanner?: React.ReactNode;
  /** Set only by the tutor's projected demo. Phones never pass this. */
  presenter?: RuneMatchPresenter;
  onComplete: (result: RuneMatchGameResult) => void;
};

export type RuneMatchPresenter = {
  /** Stage scale. Above 1, the time, the pair count and each pair's meaning also show large. */
  scale: number;
  /** The demo round stays on its last frame instead of restarting, and the host decides what comes next. */
  onRoundEnd?: (result: { won: boolean; correctAnswers: number }) => void;
};

/** Checks the clock this often, but only redraws at this rate while something is moving. */
const GAME_TICK_INTERVAL_MS = 50;
/** With nothing moving the screen only needs the seconds to stay right. */
const IDLE_TICK_MS = 250;
/** Long enough to see the goblin fall or read "time's up" before the score screen. */
const END_OF_ROUND_HOLD_MS = 1_200;
const DEMO_RESTART_MS = 1_500;

const RUNE_MATCH_TUTORIAL_STEPS = [
  {
    title: "1. สังเกตรูนคำศัพท์ & คำแปลคู่ตรงกัน",
    detail: "ดูคู่รูนภาษาอังกฤษและภาษาไทยที่มีความหมายตรงกัน (มีกรอบแดง/ทองชี้นำ)",
  },
  {
    title: "2. แตะ 2 แผ่นที่อยู่ติดกัน",
    detail: "แตะแผ่นแรก แล้วแตะแผ่นที่ติดกัน (บน-ล่าง หรือ ซ้าย-ขวา) ที่เป็นคำศัพท์กับคำแปลของกัน",
  },
  {
    title: "3. จับคู่ถูกได้ 1 คะแนน",
    detail: "คู่ถูกแล้วรูนจะแตก มอนสเตอร์เลือดลด จับให้ครบ 10 คู่ภายใน 60 วินาที ถ้าผิด แผ่นจะหยุดรับการแตะสักครู่",
  },
  {
    title: "4. ใช้ปุ่มช่วยเมื่อหาคู่ไม่เจอ",
    detail: "แตะ สลับกระดาน 🔀 เพื่อเปลี่ยนแผ่นใหม่ หรือ คำใบ้ 💡 เพื่อดูคู่ที่จับได้",
  },
];

const MOBILE_GAME_CONTAINER_CLASS =
  // Fill the frame the runtime/presenter gives us (h-dvh arcade root, presenter
  // stage); a fixed 80vh box left a band below the board or cut its bottom off.
  "relative h-full min-h-[420px] w-full overflow-hidden rounded-none border border-sky-200/30 bg-slate-800 shadow-2xl backdrop-blur-sm sm:rounded-2xl";

/** What a canvas sidebar cannot show from the back of a room: the time, the pairs, and which pair just matched. */
function RunePresenterOverlay({
  state,
  layout,
  stageWidth,
  scale,
}: {
  state: RuneMatchState;
  layout: RuneMatchLayout;
  stageWidth: number;
  scale: number;
}) {
  const gutter = stageWidth - (layout.gridX + layout.gridWidth);
  const seconds = Math.ceil(state.player.hp / 1000);
  const pair = state.message && state.message.tone !== "info" ? state.message : null;
  return (
    <>
      {gutter >= 110 && (
        <div
          data-testid="rune-presenter-hud"
          className="pointer-events-none absolute top-3 z-30 flex flex-col items-center gap-2 font-black tabular-nums text-white"
          style={{ left: layout.gridX + layout.gridWidth + gutter / 2, transform: "translateX(-50%)", fontSize: 22 * scale }}
        >
          <span className={`rounded-2xl border border-white/15 bg-slate-950/85 px-4 py-1 ${seconds <= 10 ? "text-rose-300" : "text-emerald-300"}`}>⏱ {seconds}</span>
          <span className="rounded-2xl border border-white/15 bg-slate-950/85 px-4 py-1">
            {state.correctAnswers}/{RUNE_MATCH_CONFIG.game.targetMatches}
          </span>
        </div>
      )}
      {pair && (
        <div
          data-testid="rune-presenter-pair"
          className={`pointer-events-none absolute z-30 w-max max-w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 bg-slate-950/95 px-6 py-3 text-center font-black shadow-2xl ${
            pair.tone === "good" ? "border-emerald-300 text-emerald-200" : "border-rose-300 text-rose-200"
          }`}
          style={{ left: layout.gridX + layout.gridWidth / 2, top: layout.gridY + layout.gridHeight / 2, fontSize: 24 * scale }}
        >
          {pair.text}
        </div>
      )}
    </>
  );
}

const getRuneMatchScore = (state: RuneMatchState) => {
  return Math.min(10, state.correctAnswers);
};

// Rounds always fight the goblin, so only these three images are ever drawn.
type RuneMatchAssets = {
  monster: HTMLImageElement;
  rune: HTMLImageElement;
  background: HTMLImageElement;
};

export function RuneMatchGame({
  vocabulary,
  tutorialMode = false,
  tutorialStep = 0,
  disableAutoFullscreen = false,
  restartOnComplete = false,
  statusBanner,
  presenter,
  onComplete,
}: RuneMatchGameProps) {
  const [gameState, setGameState] = useState<RuneMatchState | null>(null);
  const [roundId, setRoundId] = useState(0);
  const [assets, setAssets] = useState<RuneMatchAssets | null>(null);

  const targetTutorialMove = useMemo(() => {
    const grid = gameState?.grid;
    if (!tutorialMode || !grid || grid.length === 0) return null;
    const moves = findPossibleMoves(grid);
    return moves.length > 0 ? moves[0] : null;
  }, [tutorialMode, gameState?.grid]);

  const [loadFailed, setLoadFailed] = useState(false);
  const boardReadyRef = useRef(false);
  const [retryCount, setRetryCount] = useState(0);
  const hasReportedRef = useRef(false);
  const instructionsId = useId();

  const containerRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [tutProgress, setTutProgress] = useState(0);

  const { containerRef: fullscreenRef, enterFullscreen, exitFullscreen } = useGameFullscreen();
  const { settings } = useAccessibilitySettings();
  const textScale = settings.textSizeMultiplier;

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  const onDemoRoundEndRef = useRef(presenter?.onRoundEnd);
  useEffect(() => {
    onDemoRoundEndRef.current = presenter?.onRoundEnd;
  }, [presenter?.onRoundEnd]);

  const gameStateRef = useRef<RuneMatchState | null>(null);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const clockRef = useRef<RoundClock | null>(null);
  const roundStartedAtRef = useRef(0);

  // A reconnect hands the game a new list with the same words. Only different
  // words may restart the round, or a dropped connection would wipe the score.
  const vocabularyKey = vocabulary.map((item) => `${item.term}\u0000${item.translation}`).join("\u0001");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableVocabulary = useMemo(() => vocabulary, [vocabularyKey]);

  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      (fullscreenRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [fullscreenRef],
  );

  const hasStatusBanner = Boolean(statusBanner);
  const layout = useMemo(
    () => computeRuneMatchLayout(dimensions.width, dimensions.height, { tutorialMode, hasStatusBanner }),
    [dimensions.width, dimensions.height, tutorialMode, hasStatusBanner],
  );

  useEffect(() => {
    if (!tutorialMode) return;
    setTutProgress(0);
    setGameState((prev) => (prev ? { ...prev, selectedCell: null, hintCells: [] } : prev));
    const interval = setInterval(() => {
      setTutProgress((p) => (p + 1.5) % 100);
    }, 45);
    return () => clearInterval(interval);
  }, [tutorialMode, tutorialStep]);

  // Stays full screen through the end-of-round moment; leaving the game exits.
  const inRound = Boolean(gameState && gameState.status !== "selection");
  useEffect(() => {
    if (disableAutoFullscreen || tutorialMode || !inRound) return;
    enterFullscreen();
    return () => {
      exitFullscreen();
    };
  }, [inRound, enterFullscreen, exitFullscreen, disableAutoFullscreen, tutorialMode]);

  const boardReady = Boolean(assets) && dimensions.width > 0 && Boolean(gameState);
  const isLiveRound = !tutorialMode && !restartOnComplete;

  useEffect(() => {
    boardReadyRef.current = boardReady;
  }, [boardReady]);

  // The round's time only runs once the student can see the board. Demos have no
  // round to end, so they keep counting frames and start over by themselves.
  useEffect(() => {
    if (!boardReady || !isLiveRound) return;
    const clock = createRoundClock({
      durationMs: RUNE_MATCH_CONFIG.game.durationMs,
      onExpire: () => setGameState((current) => (current ? advanceTime(current, 0, 0) : current)),
    });
    clock.start();
    clockRef.current = clock;
    roundStartedAtRef.current = performance.now();
    return () => {
      clock.stop();
      clockRef.current = null;
    };
  }, [boardReady, isLiveRound, roundId]);

  useEffect(() => {
    let lastTime = performance.now();
    let owedMs = 0;
    const intervalId = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(now - lastTime, 250);
      lastTime = now;
      if (!boardReadyRef.current) return;
      const current = gameStateRef.current;
      if (!current || current.status !== "playing") {
        owedMs = 0;
        return;
      }
      owedMs += dt;
      if (owedMs < IDLE_TICK_MS && !needsFastTick(current)) return;
      const step = owedMs;
      owedMs = 0;
      // The tutorial explains the game with time standing still, as the others do.
      const remainingMs = tutorialMode ? RUNE_MATCH_CONFIG.game.durationMs : clockRef.current?.tick().remainingMs;
      setGameState((state) => (state ? advanceTime(state, step, remainingMs) : state));
    }, GAME_TICK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [tutorialMode]);

  useEffect(() => {
    let mounted = true;
    setLoadFailed(false);
    const load = async () => {
      try {
        const [monster, rune, background] = await Promise.all([
          loadGameImage("/games/vocabulary/rune-match/monsters/goblin_3x4_pose_sheet.webp"),
          loadGameImage("/games/vocabulary/rune-match/runes/rune_base_3x2_pose_sheet.webp"),
          loadGameImage("/games/vocabulary/rune-match/ui/background-tiled.webp"),
        ]);
        if (mounted) setAssets({ monster, rune, background });
      } catch (e) {
        console.error("Failed to load assets", e);
        if (mounted) setLoadFailed(true);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [retryCount]);

  const giveUpLoading = useCallback(() => {
    if (hasReportedRef.current) return;
    hasReportedRef.current = true;
    onCompleteRef.current({
      xp: 0,
      accuracy: 0,
      score: 0,
      correctAnswers: 0,
      totalAttempts: RUNE_MATCH_CONFIG.game.targetMatches,
      monsterType: "goblin",
      difficulty: MONSTER_DIFFICULTY.goblin,
    });
  }, []);

  const createPlayingGame = useCallback((monsterType: MonsterType = "goblin") => {
    const config = RUNE_MATCH_CONFIG.monsters[monsterType];
    const initialState = createRuneMatchState(stableVocabulary);
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
      grid: initializeGrid(initialState.activeVocabulary, { rng: initialState.rng }),
    };
  }, [stableVocabulary]);

  useEffect(() => {
    if (stableVocabulary.length === 0) return;
    hasReportedRef.current = false;
    setGameState(createPlayingGame("goblin"));
    setRoundId((id) => id + 1);
  }, [createPlayingGame, stableVocabulary]);

  const handleTileTap = useCallback((row: number, col: number) => {
    const nowMs = performance.now();
    setGameState((prev) => (prev ? tapRune(prev, { row, col }, nowMs) : prev));
  }, []);

  const handleShuffle = useCallback(() => {
    setGameState((prev) => (prev ? shuffleGrid(prev) : prev));
  }, []);

  const handleHint = useCallback(() => {
    setGameState((prev) => (prev ? applyHint(prev) : prev));
  }, []);

  const correctAnswers = gameState?.correctAnswers ?? 0;
  useEffect(() => {
    if (correctAnswers > 0) playGameSound("success");
  }, [correctAnswers]);

  // A wrong pair: a small shake of the whole stage, moved by the browser so no canvas redraws.
  const wrongAttempts = gameState?.wrongAttempts ?? 0;
  useEffect(() => {
    if (wrongAttempts === 0) return;
    playGameSound("error");
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    shakeRef.current?.animate?.(
      [
        { transform: "translate(0, 0)" },
        { transform: "translate(-4px, 1px)" },
        { transform: "translate(4px, -1px)" },
        { transform: "translate(-2px, 0)" },
        { transform: "translate(0, 0)" },
      ],
      { duration: 240 },
    );
  }, [wrongAttempts]);

  const hasGameView = Boolean(assets && gameState) && dimensions.width > 0;
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
    // The loading box and the game root are different elements: re-observe
    // when the game view mounts, or the stage keeps the loading box's size.
  }, [hasGameView]);

  const roundOver = gameState?.status === "victory" || gameState?.status === "defeat";
  useEffect(() => {
    if (!roundOver || hasReportedRef.current) return;
    hasReportedRef.current = true;

    if (tutorialMode || restartOnComplete) {
      const timer = setTimeout(() => {
        const ended = gameStateRef.current;
        if (!tutorialMode && onDemoRoundEndRef.current && ended) {
          onDemoRoundEndRef.current({ won: ended.status === "victory", correctAnswers: ended.correctAnswers });
          return;
        }
        hasReportedRef.current = false;
        setGameState(createPlayingGame("goblin"));
        setRoundId((id) => id + 1);
      }, DEMO_RESTART_MS);
      return () => clearTimeout(timer);
    }

    const ended = gameStateRef.current;
    if (!ended) return;
    clockRef.current?.stop();
    const score = getRuneMatchScore(ended);
    const result: RuneMatchGameResult = {
      xp: ended.status === "victory" ? calculateXP(score, ended.correctAnswers, ended.totalAttempts) : 0,
      accuracy:
        ended.totalAttempts > 0
          ? ended.correctAnswers / ended.totalAttempts
          : ended.status === "victory"
            ? 1
            : 0,
      score,
      correctAnswers: ended.correctAnswers,
      // Read as pairs out of the round's target; wrong tries live in accuracy.
      totalAttempts: RUNE_MATCH_CONFIG.game.targetMatches,
      // Measured here: the moment on screen below must not count as play time.
      durationMs: Math.round(performance.now() - roundStartedAtRef.current),
      monsterType: ended.monster?.type,
      difficulty: MONSTER_DIFFICULTY[(ended.monster?.type || "goblin") as MonsterType],
    };

    // Hold the last frame so the round has an ending, and never lose the score:
    // leaving or being replaced during the hold hands it over at once.
    let sent = false;
    const send = () => {
      if (sent) return;
      sent = true;
      onCompleteRef.current(result);
    };
    const sendIfHidden = () => {
      if (document.visibilityState === "hidden") send();
    };
    const timer = setTimeout(send, END_OF_ROUND_HOLD_MS);
    document.addEventListener("visibilitychange", sendIfHidden);
    window.addEventListener("pagehide", send);
    sendIfHidden();
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", sendIfHidden);
      window.removeEventListener("pagehide", send);
      send();
    };
  }, [roundOver, roundId, tutorialMode, restartOnComplete, createPlayingGame]);

  const tutVisuals = useMemo(() => {
    if (!tutorialMode || !gameState || gameState.grid.length === 0) return null;
    const move = targetTutorialMove;
    if (!move) return null;

    const half = layout.cellSize / 2;
    const fromCell = cellPosition(layout, move.from.row, move.from.col);
    const toCell = cellPosition(layout, move.to.row, move.to.col);
    const fromX = fromCell.x + half;
    const fromY = fromCell.y + half;
    const toX = toCell.x + half;
    const toY = toCell.y + half;

    const badgeY = (cell: { y: number }, centerY: number) =>
      cell.y - layout.gridY < layout.cellSize / 2 ? centerY + half + 4 : centerY - half - 26;
    const fromBadgeY = badgeY(fromCell, fromY);
    const toBadgeY = badgeY(toCell, toY);

    // The hand ends on สลับกระดาน, the first of the two buttons.
    const skillX = layout.skills.x + layout.skills.width / 4;
    const skillY = layout.skills.y + layout.skills.height / 2;

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
  }, [tutorialMode, gameState, targetTutorialMove, layout, tutorialStep, tutProgress]);

  // Words come back on the board again and again; measuring text is the slow part.
  const labelCache = useMemo(
    () => new Map<string, RuneLabelPresentation>(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout.cellSize, settings.textSizeMultiplier],
  );
  const grid = gameState?.grid;
  const runeLabels = useMemo(() => {
    const labels = new Map<string, RuneLabelPresentation>();
    if (!grid) return labels;
    for (const row of grid) {
      for (const rune of row) {
        let label = labelCache.get(rune.text);
        if (!label) {
          label = fitRuneLabel(rune.text, layout.cellSize, settings.textSizeMultiplier);
          labelCache.set(rune.text, label);
        }
        labels.set(rune.id, label);
      }
    }
    return labels;
  }, [grid, labelCache, layout.cellSize, settings.textSizeMultiplier]);

  if (!assets || !gameState || dimensions.width === 0) {
    return (
      <div
        ref={mergedRef}
        data-testid="rune-match-container"
        className="relative flex h-full min-h-[420px] w-full items-center justify-center overflow-hidden rounded-none border border-white/10 bg-slate-950 sm:rounded-2xl"
      >
        <div className="flex flex-col items-center gap-4 text-center p-4">
          {loadFailed ? (
            <GameAssetLoadFailure
              onRetry={() => setRetryCount((c) => c + 1)}
              onGiveUp={!tutorialMode && !restartOnComplete ? giveUpLoading : undefined}
            />
          ) : (
            <>
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white"></div>
              <p className="text-sm text-white/60">{tx("Loading assets...")}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const { monster } = gameState;
  const timePresentation = getTimePresentation(gameState.player.hp, gameState.player.maxHp);
  const selectedRune = gameState.selectedCell
    ? gameState.grid[gameState.selectedCell.row]?.[gameState.selectedCell.col]
    : null;

  // The strip states the rule until there is something more useful to say.
  const stripText = roundOver
    ? ""
    : gameState.message?.text ??
      (selectedRune
        ? `เลือก “${selectedRune.text}” แล้วแตะแผ่นที่ติดกัน`
        : RUNE_RULE_LINES.join(layout.isMobile ? " " : "\n"));
  const stripColor = gameState.message
    ? messageColor(gameState.message.tone)
    : selectedRune
      ? "#fef08a"
      : "#e2e8f0";

  return (
    <div
      ref={mergedRef}
      data-testid="rune-match-container"
      className={MOBILE_GAME_CONTAINER_CLASS}
      role="application"
      aria-describedby={instructionsId}
    >
      <div ref={shakeRef} className="absolute inset-0">
        <Stage width={dimensions.width} height={dimensions.height}>
          <BackdropLayer
            width={dimensions.width}
            height={dimensions.height}
            background={assets.background}
            layout={layout}
          />
          <BoardLayer
            grid={gameState.grid}
            selectedCell={gameState.selectedCell}
            hintCells={gameState.hintCells}
            layout={layout}
            labels={runeLabels}
            sheet={assets.rune}
            shuffleCount={gameState.specialMoves.shuffle}
            hintCount={gameState.hintsRemaining}
            textScale={textScale}
            onTileTap={handleTileTap}
            onShuffle={handleShuffle}
            onHint={handleHint}
          />
          <StatusLayer
            state={gameState}
            layout={layout}
            stageWidth={dimensions.width}
            monsterImage={assets.monster}
            monsterLabel={monster ? `${tx("Goblin")}: ${monster.hp}/${monster.maxHp}` : ""}
            timeLabel={`${timePresentation.seconds} วินาที`}
            timeColor={timePresentation.color}
            timeBackground={timePresentation.background}
            timeBarText={`${tx("Time")}: ${tx("{seconds}s", { seconds: timePresentation.seconds })}`}
            matchesText={tx("MATCHES {correctAnswers}/{targetMatches}", {
              correctAnswers: gameState.correctAnswers,
              targetMatches: RUNE_MATCH_CONFIG.game.targetMatches,
            })}
            comboText={
              gameState.currentStreak > 0
                ? tx("🔥 COMBO x{currentStreak}", { currentStreak: gameState.currentStreak })
                : null
            }
            stripText={stripText}
            stripColor={stripColor}
            targetMatches={RUNE_MATCH_CONFIG.game.targetMatches}
            textScale={textScale}
          >
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
                      perfectDrawEnabled={false}
                      shadowForStrokeEnabled={false}
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
                      perfectDrawEnabled={false}
                      shadowForStrokeEnabled={false}
                    />
                    {/* Floating badge over Cell 1 */}
                    <Group x={clampLabelCenter(tutVisuals.fromX, 90, dimensions.width) - 45} y={tutVisuals.fromBadgeY}>
                      <Rect
                        width={90}
                        height={22}
                        fill="#991b1b"
                        stroke="#fca5a5"
                        strokeWidth={1.5}
                        cornerRadius={11}
                        perfectDrawEnabled={false}
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
                    <Group x={clampLabelCenter(tutVisuals.toX, 90, dimensions.width) - 45} y={tutVisuals.toBadgeY}>
                      <Rect
                        width={90}
                        height={22}
                        fill="#854d0e"
                        stroke="#fde047"
                        strokeWidth={1.5}
                        cornerRadius={11}
                        perfectDrawEnabled={false}
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

                {/* Step 2: Attack indicator on the goblin */}
                {tutVisuals.step === 2 && (
                  <Group>
                    <Circle
                      x={layout.goblin.x + layout.goblin.width / 2}
                      y={layout.goblin.y + layout.goblin.height / 2}
                      radius={Math.min(layout.goblin.width, layout.goblin.height) / 2}
                      fill="rgba(239, 68, 68, 0.35)"
                      stroke="#ef4444"
                      strokeWidth={3}
                      perfectDrawEnabled={false}
                    />
                    <Text
                      text="💥 โจมตี!"
                      x={layout.goblin.x + layout.goblin.width / 2 - 60}
                      y={layout.goblin.y + layout.goblin.height}
                      width={120}
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
                    <Circle radius={26} fill="rgba(239, 68, 68, 0.3)" stroke="#ef4444" strokeWidth={3} perfectDrawEnabled={false} />
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
                    perfectDrawEnabled={false}
                  />
                  <Text text="👆" x={-13} y={-13} fontSize={26} />
                </Group>
              </Group>
            )}
          </StatusLayer>
        </Stage>
      </div>
      <p id={instructionsId} className="sr-only">
        จับคู่รูน: แตะรูนสองแผ่นที่อยู่ติดกัน บน-ล่าง หรือ ซ้าย-ขวา ที่เป็นคำศัพท์กับคำแปลของกัน
        จับให้ครบ 10 คู่ภายใน 60 วินาที ดูเวลาและจำนวนคู่ได้จากแถบสถานะ
        ปุ่มสลับกระดานและคำใบ้ใช้ได้จำนวนจำกัด
      </p>
      {presenter && presenter.scale > 1 && !layout.isMobile && (
        <RunePresenterOverlay state={gameState} layout={layout} stageWidth={dimensions.width} scale={presenter.scale} />
      )}
      {statusBanner && !tutorialMode && (
        <div
          className="absolute z-40 pointer-events-none"
          style={
            layout.isMobile
              ? { left: 12, right: 12, bottom: 12 }
              : { left: 10, bottom: 12, width: layout.sidebarWidth - 20 }
          }
        >
          {statusBanner}
        </div>
      )}
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
                  สอนเล่นจับคู่รูน · ขั้นตอน {(tutorialStep % 4) + 1} / 4
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
