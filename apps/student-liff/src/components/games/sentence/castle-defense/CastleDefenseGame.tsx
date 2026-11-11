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
import { useSound, type GameSoundType } from "@/hooks/useSound";
import { getCachedGameImage, loadGameImage } from "@/lib/games/gameAssetPreloader";
import { createRoundClock } from "@/lib/games/roundClock";
import { SENTENCE_REPLAY_LABEL, useSentencePrompt } from "@/lib/games/useSentencePrompt";

import {
  TILE_SIZE,
  ANIMATION_FRAME_MS,
  createCastleDefenseState,
  advanceCastleDefenseTime,
  CastleDefenseState,
  calculateCastleDefenseXP,
  castleCue,
  computeCastleDefenseCamera,
  edgeChipsForWords,
  nearestFreeSlot,
  shuffleForClass,
  wordsInPlay,
  type CastleCue,
  type CastleDefenseCameraFit,
  type EdgeChipSide,
  type SentenceItem,
  getCastleWordProgress,
  parseSentenceWords,
} from "@/lib/games/castleDefense";
import { BackgroundLayer, CASTLE_BACKGROUND_PATHS } from "./BackgroundLayer";
import { WordOrb } from "./WordOrb";
import { GameAssetLoadFailure, GameAssetLoading } from "@/components/games/GameAssetLoadFailure";
import { MAX_GAME_POINTS, pickShortSentences, roundWordBudget } from "@/lib/games/sentenceRound";
import { tx } from "@/lib/games/gameText";

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
  onComplete?: (results: RoundResult) => void;
  autoStart?: boolean;
  restartOnComplete?: boolean;
  tutorialMode?: boolean;
  /**
   * "cover" (default) fills the container and follows the player; "contain"
   * letterboxes the whole board below the HUD (presenter demo stage).
   */
  fit?: CastleDefenseCameraFit;
  /** "contain" only: px at the bottom kept clear of the board (host overlays). */
  insetBottom?: number;
};

const GAME_DURATION_MS = 60_000;
const MAX_ROUND_SENTENCES = 10;
// Full marks. Measured on a phone: a flawless bot gets here in 30 to 50 seconds at any
// level. A bot that knows every answer but pauses 1.2 s per word collects 20 to 24 in 60,
// and a bot that walks the orbs without reading collects 1 to 3.
const ROUND_WORD_BUDGET = 24;
const MAX_SENTENCE_WORDS = 12;
// The word row stays this long however long the sentence is, with the next word in it.
const MAX_SHOWN_BLANKS = 12;
// Portrait: the stick and BUILD take the bottom of the screen, so the board stays above them.
const PORTRAIT_CONTROLS_INSET = 136;
const CHIP_CONTROLS_CLEARANCE = 120;
// Where the stick and BUILD sit on screen, measured from the bottom corners.
const CONTROL_ZONE_PX = 140;
const WRONG_MESSAGE_MS = 1_400;
const WRONG_FLASH_MS = 500;
const CASTLE_LOW_SHARE = 0.3;
// The final picture stays up this long, then the result goes to the lesson.
const END_HOLD_MS = 1_200;
const ORB_FONT_SIZE = 17;
// A very slow link starts without the map rather than wait for it forever.
const MAP_WAIT_MS = 8_000;
const GRASS_BACKDROP = "/games/sentence/castle-defense/grass_A.webp";
const CASTLE_ASSET_PATHS = {
  player: "/games/sentence/castle-defense/player_3x3_pose_sheet.webp",
  soldier: "/games/sentence/castle-defense/goblin_3x3_pose_sheet.webp",
  tank: "/games/sentence/castle-defense/orc_3x3_pose_sheet.webp",
  boss: "/games/sentence/castle-defense/troll_3x3_pose_sheet.webp",
  towerBase: "/games/sentence/castle-defense/tower-base.webp",
  towerBuilt: "/games/sentence/castle-defense/tower-built.webp",
  base: "/games/sentence/castle-defense/player-castle.webp",
};

const countCastleWords = (term: string) => parseSentenceWords(term).length;

const buildRoundSentences = (items: SentenceItem[]) =>
  shuffleForClass(pickShortSentences(items, MAX_SENTENCE_WORDS)).slice(0, MAX_ROUND_SENTENCES);

const CUE_SOUNDS: Record<CastleCue, GameSoundType> = {
  word: "clinking",
  wrong: "error",
  sentence: "success",
  tower: "missile-hit",
};

const CHIP_POSITION: Record<EdgeChipSide, { arrow: string; transform: string }> = {
  left: { arrow: "◀", transform: "translate(0, -50%)" },
  right: { arrow: "▶", transform: "translate(-100%, -50%)" },
  top: { arrow: "▲", transform: "translate(-50%, 0)" },
  bottom: { arrow: "▼", transform: "translate(-50%, -100%)" },
};

type RoundResult = {
  xp: number;
  score?: number;
  accuracy: number;
  correctAnswers?: number;
  totalAttempts?: number;
  difficulty: string;
  durationMs?: number;
};

type RoundOutcome = "castle-fell" | "time-up" | "all-words";

const outcomeOf = (state: CastleDefenseState): RoundOutcome => {
  if (state.status === "gameover") return "castle-fell";
  return state.wordBudget !== null && getCastleWordProgress(state) >= state.wordBudget ? "all-words" : "time-up";
};

const resultOf = (state: CastleDefenseState): RoundResult => {
  const totalAttempts = state.correctWordCollections + state.incorrectWordCollections;
  return {
    xp: calculateCastleDefenseXP(state),
    score: state.score,
    accuracy: totalAttempts > 0 ? state.correctWordCollections / totalAttempts : 0,
    correctAnswers: state.score,
    totalAttempts: MAX_GAME_POINTS,
    difficulty: state.difficulty,
    durationMs: Math.min(GAME_DURATION_MS, Math.max(0, state.gameTime)),
  };
};

const getCachedCastleAssets = (): GameAssets | null => {
  // Sprites cached while the map is still coming must not start the clock.
  if (!CASTLE_BACKGROUND_PATHS.every((src) => getCachedGameImage(src))) return null;
  const player = getCachedGameImage(CASTLE_ASSET_PATHS.player);
  const soldier = getCachedGameImage(CASTLE_ASSET_PATHS.soldier);
  const tank = getCachedGameImage(CASTLE_ASSET_PATHS.tank);
  const boss = getCachedGameImage(CASTLE_ASSET_PATHS.boss);
  const towerBase = getCachedGameImage(CASTLE_ASSET_PATHS.towerBase);
  const towerBuilt = getCachedGameImage(CASTLE_ASSET_PATHS.towerBuilt);
  const base = getCachedGameImage(CASTLE_ASSET_PATHS.base);
  return player && soldier && tank && boss && towerBase && towerBuilt && base
    ? { player, soldier, tank, boss, towerBase, towerBuilt, base }
    : null;
};

export function CastleDefenseGame({ vocabulary, onComplete, autoStart = false, restartOnComplete = true, tutorialMode = false, fit = "cover", insetBottom = 0 }: Props) {
  const t = useScopedI18n("pages.student.gamesPage.castleDefense");
  const gameVocabulary = useMemo(() => buildRoundSentences(vocabulary), [vocabulary]);

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
  const difficulty: "easy" | "medium" | "hard" = "medium";
  const [showRanking, setShowRanking] = useState(false);
  const [assets, setAssets] = useState<GameAssets | null>(() => getCachedCastleAssets());
  const [assetLoadFailed, setAssetLoadFailed] = useState(false);
  const [assetLoadAttempt, setAssetLoadAttempt] = useState(0);
  // A new round gets a new clock.
  const [roundId, setRoundId] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(GAME_DURATION_MS / 1000));
  const [endOutcome, setEndOutcome] = useState<RoundOutcome | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [hasStarted, setHasStarted] = useState(false);
  const [buildEffects, setBuildEffects] = useState<
    { id: string; x: number; y: number; createdAt: number }[]
  >([]);

  const [playerFrame, setPlayerFrame] = useState(0);
  const [enemyFrame, setEnemyFrame] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const sentencePanelRef = useRef<HTMLDivElement>(null);
  // Height of the top HUD (relative to the game root). In "contain" mode the
  // board is laid out below it so the HUD never covers word orbs.
  const [hudInset, setHudInset] = useState(0);
  const cameraOptionsRef = useRef({ fit, insetTop: 0, insetBottom });
  const dimensionsRef = useRef(dimensions);
  const previousTowerIds = useRef<string[]>([]);
  const animTimerRef = useRef<number>(0);
  const buildEffectsRef = useRef(buildEffects);
  // The round's state lives here so the loop and the clock read the same round;
  // setGameState only asks React to draw it.
  const gameStateRef = useRef(gameState);
  const gameVocabularyRef = useRef(gameVocabulary);
  const onCompleteRef = useRef(onComplete);
  const pendingResultRef = useRef<RoundResult | null>(null);
  const completedRef = useRef(false);
  // Keep input in a ref so the game loop doesn't restart on every D-pad move
  const inputRef = useRef({ dx: 0, dy: 0, cast: false });
  const { enterFullscreen, exitFullscreen } = useGameFullscreen();
  const { getEffectiveTextSize } = useAccessibilitySettings();
  const { playSound } = useSound();

  const { input, setVirtualInput, triggerCast, consumeCast } = useDirectionalInput();

  const currentSentenceTerm = gameState?.status === "playing" ? gameState.currentSentenceEnglish : null;
  const currentSentence = useMemo(
    () => gameVocabulary.find((item) => item.term === currentSentenceTerm) ?? null,
    [gameVocabulary, currentSentenceTerm],
  );
  const prompt = useSentencePrompt(currentSentence, { enabled: !tutorialMode });

  // Sync input into a ref so the game loop reads it without depending on it
  useEffect(() => {
    inputRef.current = { dx: input.dx, dy: input.dy, cast: !!input.cast };
  });

  // Keep buildEffects ref in sync
  useEffect(() => {
    buildEffectsRef.current = buildEffects;
  }, [buildEffects]);

  useEffect(() => {
    gameVocabularyRef.current = gameVocabulary;
  }, [gameVocabulary]);

  useEffect(() => {
    dimensionsRef.current = dimensions;
  }, [dimensions]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const isPortrait = dimensions.height > dimensions.width;
  const boardInsetBottom = fit === "contain" ? insetBottom : isPortrait ? PORTRAIT_CONTROLS_INSET : 0;
  useEffect(() => {
    cameraOptionsRef.current = { fit, insetTop: hudInset, insetBottom: boardInsetBottom };
  }, [fit, hudInset, boardInsetBottom]);

  const hasGameState = gameState !== null;
  useEffect(() => {
    const hud = hudRef.current;
    if (!hud) return;
    const measure = () => setHudInset(Math.ceil(hud.offsetTop + hud.offsetHeight + 8));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(hud);
    return () => observer.disconnect();
  }, [hasStarted, assets, hasGameState]);

  const handleBackToMenu = useCallback(() => {
    setHasStarted(false);
    gameStateRef.current = null;
    setGameState(null);
    completedRef.current = false;
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const mapReady = Promise.race([
          Promise.allSettled(CASTLE_BACKGROUND_PATHS.map((src) => loadGameImage(src))),
          new Promise((resolve) => setTimeout(resolve, MAP_WAIT_MS)),
        ]);
        const [player, soldier, tank, boss, towerBase, towerBuilt, base] =
          await Promise.all([
            loadGameImage(CASTLE_ASSET_PATHS.player),
            loadGameImage(CASTLE_ASSET_PATHS.soldier),
            loadGameImage(CASTLE_ASSET_PATHS.tank),
            loadGameImage(CASTLE_ASSET_PATHS.boss),
            loadGameImage(CASTLE_ASSET_PATHS.towerBase),
            loadGameImage(CASTLE_ASSET_PATHS.towerBuilt),
            loadGameImage(CASTLE_ASSET_PATHS.base),
          ]);
        await mapReady;
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
        if (mounted) setAssetLoadFailed(true);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [assetLoadAttempt]);

  const giveUpLoading = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current?.({
      xp: 0,
      score: 0,
      accuracy: 0,
      correctAnswers: 0,
      totalAttempts: MAX_GAME_POINTS,
      difficulty,
      durationMs: 0,
    });
  }, [difficulty]);

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
  }, [hasStarted, assets]);

  const startRound = useCallback(() => {
    completedRef.current = false;
    const round = createCastleDefenseState(gameVocabulary, {
      difficulty,
      maxSentences: Math.min(MAX_ROUND_SENTENCES, gameVocabulary.length || 1),
      durationMs: GAME_DURATION_MS,
      wordBudget: roundWordBudget(gameVocabulary, ROUND_WORD_BUDGET, countCastleWords),
    });
    gameStateRef.current = round;
    setGameState(round);
    setEndOutcome(null);
    setSecondsLeft(Math.ceil(GAME_DURATION_MS / 1000));
    setRoundId((id) => id + 1);
  }, [gameVocabulary, difficulty]);

  const startGame = useCallback(() => {
    startRound();
    setHasStarted(true);
    enterFullscreen();
  }, [startRound, enterFullscreen]);

  // Hands the result over once. Everything that can end the wait comes through here.
  const deliverResult = useCallback(() => {
    const result = pendingResultRef.current;
    if (!result) return;
    pendingResultRef.current = null;
    onCompleteRef.current?.(result);
    if (restartOnComplete && (autoStart || tutorialMode)) {
      startRound();
    } else {
      exitFullscreen();
    }
  }, [autoStart, exitFullscreen, restartOnComplete, startRound, tutorialMode]);
  const deliverResultRef = useRef(deliverResult);
  useEffect(() => {
    deliverResultRef.current = deliverResult;
  }, [deliverResult]);

  const finishRound = useCallback((finalState: CastleDefenseState) => {
    gameStateRef.current = finalState;
    setGameState(finalState);
    if (completedRef.current) return;
    completedRef.current = true;
    pendingResultRef.current = resultOf(finalState);
    if (autoStart && document.visibilityState !== "hidden") {
      setEndOutcome(outcomeOf(finalState));
    } else {
      deliverResultRef.current();
    }
  }, [autoStart]);
  const finishRoundRef = useRef(finishRound);
  useEffect(() => {
    finishRoundRef.current = finishRound;
  }, [finishRound]);

  // Show how the round ended, then report. Leaving early reports at once, so a
  // tutor moving on or a student switching apps cannot lose the result.
  useEffect(() => {
    if (!endOutcome) return;
    const deliver = () => deliverResultRef.current();
    const deliverIfHidden = () => {
      if (document.visibilityState === "hidden") deliver();
    };
    const timer = window.setTimeout(deliver, END_HOLD_MS);
    document.addEventListener("visibilitychange", deliverIfHidden);
    window.addEventListener("pagehide", deliver);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", deliverIfHidden);
      window.removeEventListener("pagehide", deliver);
      deliver();
    };
  }, [endOutcome]);

  useEffect(() => {
    if (!autoStart || hasStarted || gameVocabulary.length === 0) return;
    startGame();
  }, [autoStart, gameVocabulary.length, hasStarted, startGame]);

  // Game loop: frames move the game, the clock ends the round on real time.
  useEffect(() => {
    if (!gameStateRef.current || gameStateRef.current.status !== "playing" || !assets || !hasStarted) {
      return;
    }

    const clock = createRoundClock({
      durationMs: GAME_DURATION_MS,
      // Also fires in a hidden tab, where frames have stopped.
      onExpire: () => {
        const current = gameStateRef.current;
        if (current?.status !== "playing") return;
        setSecondsLeft(0);
        finishRoundRef.current({ ...current, status: "victory", gameTime: GAME_DURATION_MS });
      },
    });
    clock.start();
    let rafId = 0;

    const loop = (timestamp: number) => {
      const frame = clock.tick(timestamp);
      // The tick may have just ended the round.
      const current = gameStateRef.current;
      if (!current || current.status !== "playing") return;

      const { dx, dy, cast } = inputRef.current;
      let next = current;
      let drop = cast;
      let elapsedMs = 0;
      for (const stepMs of frame.stepsMs) {
        next = advanceCastleDefenseTime(next, stepMs, { dx, dy, drop }, gameVocabularyRef.current);
        drop = false;
        elapsedMs += stepMs;
        if (next.status !== "playing") break;
      }
      if (cast && frame.stepsMs.length > 0) {
        inputRef.current = { dx, dy, cast: false };
        consumeCast();
      }

      gameStateRef.current = next;
      setGameState(next);
      setSecondsLeft(Math.ceil(frame.remainingMs / 1000));

      // Update camera (always sized to the measured container, never the viewport)
      const view = dimensionsRef.current;
      if (view.width > 0 && view.height > 0) {
        setCamera(computeCastleDefenseCamera(view, next.player, cameraOptionsRef.current));
      }

      // Animation frames
      animTimerRef.current += elapsedMs;
      if (animTimerRef.current >= ANIMATION_FRAME_MS) {
        animTimerRef.current = 0;
        setPlayerFrame((f) => (f + 1) % 3);
        setEnemyFrame((f) => (f + 1) % 3);
      }

      // Build effects cleanup
      setBuildEffects((prev) => {
        if (prev.length === 0) return prev;
        return prev.filter((effect) => Date.now() - effect.createdAt < 600);
      });

      const cue = castleCue(current, next);
      if (cue) playSound(CUE_SOUNDS[cue]);

      if (next.status !== "playing") {
        clock.stop();
        finishRoundRef.current(next);
        return;
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      clock.stop();
    };
  }, [roundId, assets, hasStarted, consumeCast, playSound]);

  // A wrong touch shakes the sentence, because that is where the loss shows.
  const lastWrongAt = gameState?.lastWrongHit?.at;
  useEffect(() => {
    if (lastWrongAt === undefined) return;
    sentencePanelRef.current?.animate?.(
      [-7, 7, -5, 5, -2, 0].map((x) => ({ transform: `translateX(${x}px)` })),
      { duration: 360 },
    );
  }, [lastWrongAt]);

  const grids = useMemo(() => {
    if (!assets) return null;
    return {
      player: buildSpriteGrid(assets.player.width, assets.player.height),
      soldier: buildSpriteGrid(assets.soldier.width, assets.soldier.height),
      tank: buildSpriteGrid(assets.tank.width, assets.tank.height),
      boss: buildSpriteGrid(assets.boss.width, assets.boss.height),
    };
  }, [assets]);

  if (assetLoadFailed) {
    return (
      <div className="relative h-full min-h-0 w-full bg-slate-950">
        <GameAssetLoadFailure
          onRetry={() => {
            setAssetLoadFailed(false);
            setAssetLoadAttempt((attempt) => attempt + 1);
          }}
          onGiveUp={autoStart && !restartOnComplete && !tutorialMode ? giveUpLoading : undefined}
        />
      </div>
    );
  }

  if (!assets) {
    if (autoStart) {
      return (
        <div className="relative h-full min-h-0 w-full bg-slate-950">
          <GameAssetLoading />
        </div>
      );
    }
    return (
      <div className="relative h-[60vh] w-full overflow-hidden rounded-2xl bg-slate-950 flex items-center justify-center border border-white/10 md:aspect-video md:h-auto">
        <div className="text-white animate-pulse font-mono tracking-widest uppercase" style={{ fontSize: getEffectiveTextSize(16) }}>
          {t("loading")}
        </div>
      </div>
    );
  }

  if (!hasStarted) {
    if (autoStart) {
      return <div className="h-full min-h-0 w-full bg-slate-950" />;
    }
    return (
      <div className="relative h-[60vh] w-full overflow-hidden rounded-2xl bg-slate-950 border border-white/10 md:aspect-video md:h-auto">
        <GameStartScreen
          gameTitle={t("title")}
          gameSubtitle={t("subtitle")}
          icon={Shield}
          vocabulary={gameVocabulary}
          instructions={CASTLE_DEFENSE_INSTRUCTIONS}
          proTip={t("proTip")}
          controls={CASTLE_DEFENSE_CONTROLS}
          startButtonText={t("startButton")}
          onStart={startGame}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRanking(true)}
              className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors border border-white/10"
              title={tx("Leaderboard")}
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

  if ((gameState?.status === "gameover" || gameState?.status === "victory") && !autoStart && !tutorialMode) {

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

  const nextWordIndex = gameState?.collectedWordIndices.length ?? 0;
  const blankCount = gameState?.sentenceWords.length ?? 0;
  const firstShownBlank = Math.max(0, Math.min(nextWordIndex - 3, blankCount - MAX_SHOWN_BLANKS));
  const lastWrongHit = gameState?.lastWrongHit ?? null;
  const wrongAge = gameState && lastWrongHit ? gameState.gameTime - lastWrongHit.at : Infinity;
  const ringPulse = gameState ? (Math.sin(gameState.gameTime / 160) + 1) / 2 : 0;
  const nearestRing = gameState?.sentenceCompleted
    ? nearestFreeSlot(gameState.towerSlots, gameState.towers, gameState.player)
    : null;
  const orbsInPlay = gameState
    ? wordsInPlay(gameState.words, gameState.sentenceWords, gameState.collectedWordIndices)
    : [];
  const edgeChips = gameState && fit === "cover" && gameState.status === "playing"
    ? edgeChipsForWords(
        nearestRing
          ? [{ id: nearestRing.id, x: nearestRing.x, y: nearestRing.y, term: t("hud.buildHere"), isCollected: false }]
          : orbsInPlay,
        gameState.player,
        camera,
        dimensions,
        {
          insetTop: hudInset,
          insetBottom: boardInsetBottom,
          chipBottomLimit: dimensions.height - CHIP_CONTROLS_CLEARANCE,
          covered: [
            { x: 0, y: dimensions.height - CONTROL_ZONE_PX, width: CONTROL_ZONE_PX, height: CONTROL_ZONE_PX },
            { x: dimensions.width - CONTROL_ZONE_PX, y: dimensions.height - CONTROL_ZONE_PX, width: CONTROL_ZONE_PX, height: CONTROL_ZONE_PX },
          ],
        },
      )
    : [];
  const castleIsLow = gameState
    ? gameState.status === "playing" && gameState.base.hp <= gameState.base.maxHp * CASTLE_LOW_SHARE
    : false;

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-0 w-full overflow-hidden bg-lime-800 touch-none select-none rounded-none"
      // The grass carries on past the board on a tall phone, darker so the edge of the play area shows.
      style={{
        backgroundImage: `linear-gradient(rgba(20, 40, 10, 0.5), rgba(20, 40, 10, 0.5)), url(${GRASS_BACKDROP})`,
        backgroundSize: `auto, ${TILE_SIZE * camera.scale}px`,
      }}
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
                      radius={TILE_SIZE * 0.6 + ringPulse * 8}
                      fill="rgba(250, 204, 21, 0.18)"
                      stroke="rgba(250, 204, 21, 0.95)"
                      strokeWidth={3 + ringPulse * 2}
                      dash={[6, 5]}
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
                    y={enemy.y - size * 0.42}
                    width={30}
                    height={4}
                    fill="#333"
                    cornerRadius={2}
                  />
                  <Rect
                    x={enemy.x - 15}
                    y={enemy.y - size * 0.42}
                    width={30 * (enemy.hp / enemy.maxHp)}
                    height={4}
                    fill={enemy.hp > enemy.maxHp * 0.5 ? "#22c55e" : "#ef4444"}
                    cornerRadius={2}
                  />
                </Group>
              );
            })}

            {orbsInPlay.map((word) => (
              <WordOrb
                key={word.id}
                word={word}
                fontSize={getEffectiveTextSize(ORB_FONT_SIZE)}
                flash={wrongAge < WRONG_FLASH_MS && lastWrongHit?.wordId === word.id}
              />
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
        <div ref={hudRef} className="absolute top-[max(0.5rem,env(safe-area-inset-top))] inset-x-0 z-20 pointer-events-none flex flex-col items-center gap-1 px-3 [@media(orientation:landscape)_and_(max-height:500px)]:flex-row [@media(orientation:landscape)_and_(max-height:500px)]:items-start [@media(orientation:landscape)_and_(max-height:500px)]:gap-2">

          {/* Top status bar: Score | Timer, words, wave | Castle HP */}
          <div className="flex w-full items-center justify-between gap-2 [@media(orientation:landscape)_and_(max-height:500px)]:w-auto [@media(orientation:landscape)_and_(max-height:500px)]:shrink-0">
            {/* Score */}
            <div className="flex flex-col items-center bg-slate-950/80 border border-white/10 px-2.5 py-1 rounded-xl shadow-lg backdrop-blur min-w-[52px]">
              <span className="text-[11px] font-bold text-slate-300 leading-none">{t("hud.score")}</span>
              <span className="text-sm font-black text-white leading-tight">{gameState.score}</span>
            </div>

            {/* Center: Timer + Words + Wave */}
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5">
                <div className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-0.5 text-[12px] font-black text-white shadow-lg backdrop-blur">
                  ⏱ {secondsLeft}s
                </div>
                <div className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-0.5 text-[12px] font-black text-white shadow-lg backdrop-blur">
                  {gameState.wordBudget === null
                    ? `${gameState.completedSentences}/${gameState.maxSentences}`
                    : `${Math.min(getCastleWordProgress(gameState), gameState.wordBudget)}/${gameState.wordBudget} คำ`}
                </div>
              </div>
              <div className="whitespace-nowrap rounded-full border border-white/10 bg-slate-950/70 px-3 py-0.5 text-[11px] font-bold text-white shadow-lg">
                {t("hud.wave", {
                  current: gameState.wave,
                  killed: gameState.enemiesKilledThisWave,
                  total: gameState.totalEnemiesThisWave,
                })}
              </div>
            </div>

            {/* Castle HP */}
            <div className="flex flex-col items-center bg-slate-950/80 border border-white/10 px-2.5 py-1 rounded-xl shadow-lg backdrop-blur min-w-[52px]">
              <span className="text-[11px] font-bold text-slate-300 leading-none">{t("hud.castleHp")}</span>
              <span className="text-sm font-black text-rose-400 leading-tight">{gameState.base.hp}</span>
              <div className="w-10 h-1 bg-slate-700 rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full bg-rose-500 transition-all duration-300"
                  style={{ width: `${((gameState.base.hp || 0) / (gameState.base.maxHp || 100)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* The sentence: what to build, and how far along it is */}
          <div
            ref={sentencePanelRef}
            data-testid="castle-sentence"
            className="w-full min-w-0 rounded-2xl border border-blue-400/40 bg-blue-950/90 px-3 py-1.5 shadow-xl backdrop-blur-md"
          >
            {prompt.kind !== "none" && (
              <div className="grid min-h-[1.625rem]">
                {/* Hidden text keeps its space, so the board does not jump when the sentence hides. */}
                <div
                  className={`[grid-area:1/1] text-center font-black leading-snug text-white ${prompt.hidden ? "invisible line-clamp-2" : ""}`}
                  aria-hidden={prompt.hidden}
                  style={{ fontSize: getEffectiveTextSize(15) }}
                >
                  {prompt.hidden ? gameState.currentSentenceEnglish : prompt.text}
                </div>
                {prompt.hidden && (
                  <button
                    type="button"
                    onClick={prompt.replay}
                    className="pointer-events-auto [grid-area:1/1] self-center justify-self-center rounded-full border border-sky-200/60 bg-sky-500 px-3 py-0.5 text-xs font-black text-white shadow-lg active:scale-95"
                  >
                    {SENTENCE_REPLAY_LABEL}
                  </button>
                )}
              </div>
            )}
            <div className="mt-0.5 flex max-h-[2.6rem] flex-wrap items-center justify-center gap-x-1.5 overflow-hidden text-[13px] font-bold leading-tight">
              {firstShownBlank > 0 && <span className="text-slate-400">…</span>}
              {gameState.sentenceWords
                .slice(firstShownBlank, firstShownBlank + MAX_SHOWN_BLANKS)
                .map((word, offset) => {
                  const idx = firstShownBlank + offset;
                  const collected = gameState.collectedWordIndices.includes(idx);
                  return (
                    <span
                      key={`${word}-${idx}`}
                      className={
                        collected
                          ? "text-emerald-300"
                          : idx === nextWordIndex
                            ? "font-black text-amber-300"
                            : "text-slate-400"
                      }
                    >
                      {collected ? word : "___"}
                    </span>
                  );
                })}
              {firstShownBlank + MAX_SHOWN_BLANKS < blankCount && <span className="text-slate-400">…</span>}
            </div>
          </div>
        </div>
      )}

      {/* Short messages under the HUD. They sit outside it, so the board never moves for them. */}
      {gameState?.status === "playing" && (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-1 px-3 text-center text-xs font-black text-white"
          style={{ top: hudInset }}
        >
          {wrongAge < WRONG_MESSAGE_MS && (
            <div data-testid="castle-wrong" className="rounded-full border border-red-200/70 bg-red-600 px-3 py-1 shadow-lg">
              {t(lastWrongHit?.lostWord ? "messages.wrongWordLost" : "messages.wrongWord")}
            </div>
          )}
          {gameState.sentenceCompleted && (
            <div data-testid="castle-sentence-done" className="rounded-full border border-emerald-300/60 bg-emerald-600 px-3 py-1 shadow-lg">
              {t("messages.sentenceComplete")}
            </div>
          )}
          {gameState.waveResult && (
            <div data-testid="castle-wave" className="whitespace-nowrap rounded-full border border-amber-200/60 bg-amber-600 px-3 py-1 shadow-lg">
              {gameState.waveResult.breached
                ? t("messages.waveNext")
                : t("messages.waveDefended", { wave: gameState.waveResult.wave })}
            </div>
          )}
          {castleIsLow && (
            <div data-testid="castle-low" className="animate-pulse rounded-full border border-rose-200/70 bg-rose-700 px-3 py-1 shadow-lg">
              {t("messages.castleLow")}
            </div>
          )}
        </div>
      )}

      {/* Words and rings the camera cannot show. Every word gets the same chip. */}
      {edgeChips.map((chip) => (
        <div
          key={chip.id}
          data-testid="castle-edge-chip"
          className={`pointer-events-none absolute z-[15] flex max-w-[45%] items-center gap-1 rounded-full border border-slate-900 px-1.5 text-xs font-bold leading-5 text-slate-950 shadow-md ${nearestRing ? "bg-amber-300" : "bg-white"}`}
          style={{ left: chip.x, top: chip.y, transform: CHIP_POSITION[chip.side].transform }}
        >
          {(chip.side === "left" || chip.side === "top") && <span aria-hidden="true">{CHIP_POSITION[chip.side].arrow}</span>}
          <span className="truncate">{chip.label}</span>
          {(chip.side === "right" || chip.side === "bottom") && <span aria-hidden="true">{CHIP_POSITION[chip.side].arrow}</span>}
        </div>
      ))}

      {endOutcome && (
        <div
          data-testid="castle-end"
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-slate-950/50 px-6 text-center"
        >
          <p className="rounded-3xl border border-white/20 bg-slate-950/90 px-6 py-4 text-2xl font-black text-white shadow-2xl">
            {endOutcome === "castle-fell"
              ? t("messages.castleFell")
              : endOutcome === "time-up"
                ? t("messages.timeUp")
                : t("messages.allWords")}
          </p>
        </div>
      )}

      {/* Bottom-left: the wizard walks the centre column, and a thumb rests here in both orientations. */}
      <div
        className="absolute bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-3 z-30 origin-bottom-left scale-90 pointer-events-auto md:left-6 md:scale-100"
        data-testid="virtual-dpad"
      >
        <VirtualDPad onInput={setVirtualInput} />
      </div>

      <button
        type="button"
        data-testid="castle-build"
        aria-disabled={!gameState?.sentenceCompleted}
        onPointerDown={(event) => {
          event.preventDefault();
          triggerCast();
        }}
        className={`absolute bottom-[calc(env(safe-area-inset-bottom)+2.25rem)] right-5 z-30 flex size-16 items-center justify-center rounded-full border-2 border-emerald-300/60 text-sm font-black text-white shadow-2xl shadow-emerald-950/40 active:scale-95 md:bottom-8 md:right-8 md:size-20 ${
          gameState?.sentenceCompleted ? "animate-pulse bg-emerald-500 ring-4 ring-amber-300" : "bg-emerald-800/70 opacity-60"
        }`}
      >
        {t("controls.build")}
      </button>
    </div>
  );
}
