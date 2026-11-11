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
  Circle,
} from "react-konva";
import {
  createEnchantedLibraryState,
  advanceEnchantedLibraryTime,
  calculateEnchantedLibraryXP,
  computeLibraryCamera,
  countFirstTryWords,
  countFoundWords,
  libraryBookArea,
  libraryInsets,
  listReviewWords,
  placeEdgeChips,
  rectsOverlap,
  replaceBoard,
  takeFixedSteps,
  BOOK_LABEL_HEIGHT_PX,
  BOOK_LABEL_OFFSET,
  BOOK_LABEL_WIDTH_PX,
  FIXED_STEP_MS,
  GAME_WIDTH,
  GAME_HEIGHT,
  type EnchantedLibraryConfig,
  type EnchantedLibraryState,
  type LibraryEvent,
  type Point,
  type ScreenRect,
} from "@/lib/games/enchantedLibrary";
import { createRoundClock, MAX_CATCH_UP_MS } from "@/lib/games/roundClock";
import { estimateTextWidth, fitText, type MeasureText } from "@/lib/games/textFit";
import type { VocabularyItem } from "@/store/useGameStore";
import { useSound } from "@/hooks/useSound";
import { useInterval } from "@/hooks/useInterval";
import { useDirectionalInput } from "@/hooks/useDirectionalInput";
import { useAccessibilitySettings } from "@/hooks/useAccessibilitySettings";
import { VirtualDPad } from "@/components/ui/VirtualDPad";
import { getCachedGameImage, loadGameImage } from "@/lib/games/gameAssetPreloader";
import { GameAssetLoadFailure } from "@/components/games/GameAssetLoadFailure";
import { motion } from "framer-motion";
import { ArrowUp, Book, BookOpen, Ghost, Shield, Sparkles } from "lucide-react";

import { useScopedI18n } from "@/locales/client";
import { SparkleBurst } from "./SparkleBurst";
import { BookPickupBurst } from "./BookPickupBurst";
import { mapInputVectorToDirectional } from "./enchantedLibraryInput";
import { VocabularyProgress } from "./VocabularyProgress";
import { GameEndScreen } from "@/components/games/game/GameEndScreen";
import { GameStartScreen } from "@/components/games/game/GameStartScreen";
import { RankingDisplay } from "./RankingDisplay";
import { tx } from "@/lib/games/gameText";

export type EnchantedLibraryGameResult = {
  xp: number;
  accuracy: number;
  gameTime: number;
  correctAnswers?: number;
  totalAttempts?: number;
  durationMs?: number;
  /** For the student's result card: never sent to the server. */
  review?: {
    heading: string;
    missed: { term: string; meaning: string }[];
  };
};

interface RankingEntry {
  userId: string;
  name: string;
  image: string | null;
  xp: number;
}

interface EnchantedLibraryGameProps {
  vocabulary: VocabularyItem[];
  onComplete: (results: EnchantedLibraryGameResult) => void;
  difficulty: import("@/lib/games/enchantedLibrary").Difficulty;
  onDifficultyChange: (
    difficulty: import("@/lib/games/enchantedLibrary").Difficulty,
  ) => void;
  rankings: Record<
    import("@/lib/games/enchantedLibrary").Difficulty,
    RankingEntry[]
  >;
  autoStart?: boolean;
  restartOnComplete?: boolean;
  tutorialMode?: boolean;
  /** Above 1 on a projected stage: words and the HUD are drawn bigger. Phones never set this. */
  presenterScale?: number;
  tutorialStep?: number;
  fullscreen?: boolean;
}

const LIVE_GAME_DURATION_MS = 60_000;
const TIME_WARNING_MS = 10_000;
const FIRST_BOARD_FIT_MS = 1_000;
const MAX_ROUND_WORDS = 10;
const CHIP_SIZE = { width: 120, height: 44 };
const GHOST_MARKER_SIZE = { width: 62, height: 34 };
const LABEL_MAX_FONT_PX = 15;
const LABEL_MIN_FONT_PX = 12;
const LABEL_LINE_HEIGHT = 1.3;
const LABEL_PADDING_X_PX = 7;
const LABEL_PADDING_Y_PX = 3;
// The map already enlarges labels a little on a big screen.
const LABEL_PRESENTER_BOOST = 0.85;
const LIBRARY_ASSET_PATHS = {
  player: "/games/vocabulary/enchanted-library/player_3x3_pose_sheet.webp",
  spirit: "/games/vocabulary/enchanted-library/spirit_3x3_pose_sheet.webp",
  book: "/games/vocabulary/enchanted-library/book_3x1_sheet.webp",
  floor: "/games/vocabulary/enchanted-library/library_background.webp",
};

/** Up to 10 different words in random order. A word listed twice could never be found twice. */
const buildRoundVocabulary = (items: VocabularyItem[]) => {
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = item.term.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  return unique.slice(0, MAX_ROUND_WORDS);
};

const getCachedLibraryAssets = () => {
  const player = getCachedGameImage(LIBRARY_ASSET_PATHS.player);
  const spirit = getCachedGameImage(LIBRARY_ASSET_PATHS.spirit);
  const book = getCachedGameImage(LIBRARY_ASSET_PATHS.book);
  const floor = getCachedGameImage(LIBRARY_ASSET_PATHS.floor);
  return player && spirit && book && floor ? { player, spirit, book, floor } : null;
};

// Sprite Helper
const buildSpriteGrid = (width: number, height: number) => {
  const fw = width / 3;
  const fh = height / 3;
  return { fw, fh };
};

const buildBookSpriteGrid = (width: number, height: number) => {
  const fw = width / 3;
  const fh = height;
  return { fw, fh };
};

const getSpriteCrop = (fw: number, fh: number, frame: number, row = 0) => ({
  x: frame * fw,
  y: row * fh,
  width: fw,
  height: fh,
});

let labelCanvas: CanvasRenderingContext2D | null | undefined;
/** Same font as the canvas labels, so lines fit what is drawn. */
const measureLabel: MeasureText = (text, fontSize) => {
  if (labelCanvas === undefined) {
    labelCanvas = document.createElement("canvas").getContext("2d");
  }
  if (!labelCanvas) return estimateTextWidth(text, fontSize);
  labelCanvas.font = `bold ${fontSize}px Arial`;
  return labelCanvas.measureText(text).width;
};

/** Thai breaks only between words and the background fits the lines. Sizes are in screen pixels. */
const layoutBookLabel = (translation: string) => {
  const fitInto = (height: number) =>
    fitText(translation, {
      width: BOOK_LABEL_WIDTH_PX - LABEL_PADDING_X_PX * 2,
      height,
      maxFontSize: LABEL_MAX_FONT_PX,
      minFontSize: LABEL_MIN_FONT_PX,
      lineHeight: LABEL_LINE_HEIGHT,
      measure: measureLabel,
    });
  const usual = fitInto(BOOK_LABEL_HEIGHT_PX - LABEL_PADDING_Y_PX * 2);
  // A very long meaning grows the label rather than shrinking below a readable size.
  const fit = usual.fontSize >= LABEL_MIN_FONT_PX ? usual : fitInto(BOOK_LABEL_HEIGHT_PX * 2);
  const textWidth = Math.max(...fit.lines.map((line) => measureLabel(line, fit.fontSize)), 0);
  return {
    text: fit.text,
    fontSize: fit.fontSize,
    width: Math.ceil(textWidth) + LABEL_PADDING_X_PX * 2,
    height: Math.ceil(fit.lines.length * fit.fontSize * LABEL_LINE_HEIGHT) + LABEL_PADDING_Y_PX * 2,
  };
};

const buzz = (pattern: number) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // No vibration on this device.
  }
};

export function EnchantedLibraryGame({
  vocabulary,
  onComplete,
  difficulty,
  rankings,
  autoStart = false,
  restartOnComplete = true,
  tutorialMode = false,
  tutorialStep = 0,
  fullscreen = false,
  presenterScale = 1,
}: EnchantedLibraryGameProps) {
  const { playSound } = useSound();
  const { input, setVirtualInput, triggerCast, consumeCast } =
    useDirectionalInput();
  const { getEffectiveTouchTarget } = useAccessibilitySettings();
  // A reconnect hands over a new copy of the same lesson. Only different words start a new round.
  const vocabularyKey = vocabulary.map((item) => `${item.term}\u0000${item.translation}`).join("\u0001");
  const gameVocabulary = useMemo(
    () => buildRoundVocabulary(vocabulary),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vocabularyKey],
  );
  // Live lesson rounds run on a real deadline. A demo has no round to end.
  const isLiveRound = autoStart && !tutorialMode && !restartOnComplete;

  // Use a ref for authoritative game state to avoid stale closure issues in the game loop
  const gameStateRef = useRef<EnchantedLibraryState | null>(null);

  // Sync state for rendering
  const [gameState, setGameState] = useState<EnchantedLibraryState | null>(
    null,
  );

  const [gamePhase, setGamePhase] = useState<"start" | "playing" | "ended">(
    autoStart ? "playing" : "start",
  );
  const [results, setResults] = useState<EnchantedLibraryGameResult | null>(
    null,
  );
  const hasReportedRef = useRef(false);
  // Each new round needs its own clock, even when nothing else about the game changed.
  const [roundNumber, setRoundNumber] = useState(0);
  const [showGrimoire, setShowGrimoire] = useState(false);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const t = useScopedI18n("pages.student.gamesPage.enchantedLibrary");
  const [sparkles, setSparkles] = useState<
    Array<{ id: number; x: number; y: number }>
  >([]);
  const sparkleIdRef = useRef(0);
  const [pickupBursts, setPickupBursts] = useState<
    Array<{
      id: number;
      x: number;
      y: number;
      frameIndex: number;
      variant: "glow" | "close";
    }>
  >([]);
  const pickupIdRef = useRef(0);

  const [assets, setAssets] = useState<{
    player: HTMLImageElement;
    spirit: HTMLImageElement;
    book: HTMLImageElement;
    floor: HTMLImageElement;
  } | null>(() => getCachedLibraryAssets());
  const hasAssets = Boolean(assets);
  const [assetLoadFailed, setAssetLoadFailed] = useState(false);
  const [assetLoadAttempt, setAssetLoadAttempt] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const shieldRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  // The HUD and controls on screen, so the chips and markers can keep off them.
  const [blockedRects, setBlockedRects] = useState<ScreenRect[]>([]);

  // The lesson shell owns fullscreen so the teacher toolbar remains available.
  const mergedContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
    },
    [],
  );

  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });

  // Refs for rAF loop to avoid stale closures
  const inputRef = useRef(input);
  const assetsRef = useRef(assets);
  const vocabularyRef = useRef(gameVocabulary);
  const difficultyRef = useRef(difficulty);
  const dimensionsRef = useRef(dimensions);
  const gamePhaseRef = useRef(gamePhase);
  const playSoundRef = useRef(playSound);
  const consumeCastRef = useRef(consumeCast);
  const rafRef = useRef<number>(0);

  // Depend on the values: the hook returns a new object on every render, and that
  // would overwrite the tutorial driver's walking every frame.
  useEffect(() => {
    inputRef.current = input;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.dx, input.dy, input.cast]);
  useEffect(() => { assetsRef.current = assets; }, [assets]);
  useEffect(() => { vocabularyRef.current = gameVocabulary; }, [gameVocabulary]);
  useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);
  useEffect(() => { dimensionsRef.current = dimensions; }, [dimensions]);
  useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);
  useEffect(() => { playSoundRef.current = playSound; }, [playSound]);
  useEffect(() => { consumeCastRef.current = consumeCast; }, [consumeCast]);

  const computeCamera = useCallback(
    (state: EnchantedLibraryState) =>
      computeLibraryCamera(dimensions, state.player, libraryInsets(dimensions, { fullscreen })),
    [dimensions, fullscreen],
  );
  const bookArea = useCallback(
    (player: Point) =>
      dimensions.width > 0 && dimensions.height > 0
        ? libraryBookArea(dimensions, player, libraryInsets(dimensions, { fullscreen }))
        : null,
    [dimensions, fullscreen],
  );
  const computeCameraRef = useRef(computeCamera);
  const bookAreaRef = useRef(bookArea);
  useEffect(() => { computeCameraRef.current = computeCamera; }, [computeCamera]);
  useEffect(() => { bookAreaRef.current = bookArea; }, [bookArea]);

  // Tutorial is a watch-only scripted demonstration: do not let keyboard input
  // replace the movement and shield actions supplied by the tutorial driver.
  useEffect(() => {
    if (!tutorialMode) return;
    const blockGameplayKeys = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD", "Space", "Enter"].includes(event.code)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", blockGameplayKeys, true);
    window.addEventListener("keyup", blockGameplayKeys, true);
    return () => {
      window.removeEventListener("keydown", blockGameplayKeys, true);
      window.removeEventListener("keyup", blockGameplayKeys, true);
    };
  }, [tutorialMode]);

  // Scripted Tutorial Auto-walking and Skill Driver (6 Steps)
  useEffect(() => {
    if (!tutorialMode || gamePhase !== "playing") return;

    const interval = setInterval(() => {
      const state = gameStateRef.current;
      if (!state) return;

      const targetBook = state.books.find((b) => b.isCorrect);

      if (tutorialStep === 0) {
        // Step 1: Read Target Word
        inputRef.current = { dx: 0, dy: 0, cast: false };
      } else if (tutorialStep === 1) {
        // Step 2: Practice D-Pad Movement (Walk Right -> Down -> Left -> Up)
        const timeTick = Math.floor(Date.now() / 650) % 4;
        if (timeTick === 0) inputRef.current = { dx: 1, dy: 0, cast: false };
        else if (timeTick === 1) inputRef.current = { dx: 0, dy: 1, cast: false };
        else if (timeTick === 2) inputRef.current = { dx: -1, dy: 0, cast: false };
        else inputRef.current = { dx: 0, dy: -1, cast: false };
      } else if (tutorialStep === 2 && targetBook) {
        // Step 3: Locate & Walk toward Target Book
        const dx = Math.abs(targetBook.x - state.player.x) < 20 ? 0 : targetBook.x > state.player.x ? 1 : -1;
        const dy = Math.abs(targetBook.y - state.player.y) < 20 ? 0 : targetBook.y > state.player.y ? 1 : -1;
        inputRef.current = { dx, dy, cast: false };
      } else if (tutorialStep === 3 && targetBook) {
        // Step 4: Collect Target Book
        const dx = Math.abs(targetBook.x - state.player.x) < 5 ? 0 : targetBook.x > state.player.x ? 1 : -1;
        const dy = Math.abs(targetBook.y - state.player.y) < 5 ? 0 : targetBook.y > state.player.y ? 1 : -1;
        inputRef.current = { dx, dy, cast: false };
      } else if (tutorialStep === 4) {
        // Step 5: Watch Spirits & Evade
        const timeTick = Math.floor(Date.now() / 700) % 2;
        inputRef.current = { dx: timeTick === 0 ? 1 : -1, dy: 0, cast: false };
      } else if (tutorialStep === 5) {
        // Step 6: Trigger Shield
        const trigger = Date.now() % 1500 < 100;
        inputRef.current = { dx: 0, dy: 0, cast: trigger };
      }
    }, 80);

    return () => clearInterval(interval);
  }, [tutorialMode, gamePhase, tutorialStep]);

  // Animation Frames
  const [playerFrame, setPlayerFrame] = useState(0);
  const [spiritFrame, setSpiritFrame] = useState(0);
  const BOOK_FRAME_CLOSED = 0;
  const BOOK_FRAME_GLOW = 2;

  // Asset Loading
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [player, spirit, book, floor] = await Promise.all([
          loadGameImage(LIBRARY_ASSET_PATHS.player),
          loadGameImage(LIBRARY_ASSET_PATHS.spirit),
          loadGameImage(LIBRARY_ASSET_PATHS.book),
          loadGameImage(LIBRARY_ASSET_PATHS.floor),
        ]);
        if (mounted) setAssets((current) => current ?? { player, spirit, book, floor });
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
    if (hasReportedRef.current) return;
    hasReportedRef.current = true;
    onComplete({
      xp: 0,
      accuracy: 0,
      gameTime: 0,
      correctAnswers: 0,
      totalAttempts: Math.max(gameVocabulary.length, 1),
      durationMs: 0,
    });
  }, [gameVocabulary.length, onComplete]);

  const resetGame = useCallback(() => {
    if (gameVocabulary.length > 0) {
      const initialState = createEnchantedLibraryState(gameVocabulary, {
        difficulty,
        bookArea: bookAreaRef.current,
      });
      const nextState = autoStart
        ? { ...initialState, timeRemaining: LIVE_GAME_DURATION_MS }
        : initialState;
      gameStateRef.current = nextState;
      setGameState(nextState);
      setRoundNumber((round) => round + 1);
      setTotalAttempts(0);
      setCorrectAnswers(0);
      setShowGrimoire(false);
      setSparkles([]);
      setPickupBursts([]);
      setResults(null);
      hasReportedRef.current = false;
    }
  }, [autoStart, gameVocabulary, difficulty]);

  useEffect(() => {
    resetGame();
    setGamePhase(autoStart ? "playing" : "start");
  }, [autoStart, resetGame]);

  // Animation Loop
  useInterval(() => {
    if (gamePhase === "playing") {
      setPlayerFrame((f) => (f + 1) % 3);
      setSpiritFrame((f) => (f + 1) % 3);
    }
  }, 150);

  const hasScreen = dimensions.width > 0 && dimensions.height > 0;

  // The first board is laid out before the screen size is known, and the loading
  // placeholder reports a different size from the game. Lay it out for the real
  // screen while the child has not started on it.
  useEffect(() => {
    const state = gameStateRef.current;
    if (!state || !hasScreen || state.status !== "playing") return;
    if (state.gameTime > FIRST_BOARD_FIT_MS || state.pauseMs > 0) return;
    const fitted = replaceBoard(state, vocabularyRef.current, { bookArea: bookAreaRef.current });
    gameStateRef.current = fitted;
    setGameState(fitted);
    setCamera(computeCameraRef.current(fitted));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions.width, dimensions.height, hasAssets]);

  // Game Loop with requestAnimationFrame
  useEffect(() => {
    const startState = gameStateRef.current;
    if (
      !startState ||
      startState.status !== "playing" ||
      !assetsRef.current ||
      gamePhaseRef.current !== "playing" ||
      !hasScreen
    ) {
      return;
    }

    const config = (): EnchantedLibraryConfig => ({
      vocabulary: vocabularyRef.current,
      difficulty: difficultyRef.current,
      masteryTarget: autoStart ? 1 : 2,
      isTutorial: tutorialMode,
      tutorialMode: tutorialMode,
      bookArea: bookAreaRef.current,
    });

    const roundLengthMs = LIVE_GAME_DURATION_MS;
    // A live round ends on a real deadline, even with the app hidden and no frames running.
    const clock = isLiveRound
      ? createRoundClock({
          durationMs: roundLengthMs,
          onExpire: () => {
            const current = gameStateRef.current;
            if (!current || current.status !== "playing") return;
            const ended: EnchantedLibraryState = {
              ...current,
              status: "gameover",
              timeRemaining: 0,
              gameTime: roundLengthMs,
            };
            gameStateRef.current = ended;
            setGameState(ended);
          },
        })
      : null;
    clock?.start();

    let lastFrame: number | null = null;
    let leftoverMs = 0;

    const handleEvent = (event: LibraryEvent, nextCamera: { x: number; y: number; scale: number }) => {
      const quiet = tutorialMode;
      if (event.kind === "shield") {
        if (!quiet) playSoundRef.current("clinking");
        return;
      }
      if (event.kind === "hit" || event.kind === "exhausted") {
        if (!quiet) {
          playSoundRef.current(event.kind === "hit" ? "missile-hit" : "angry-grunt");
          buzz(event.kind === "hit" ? 80 : 160);
        }
        return;
      }

      const correct = event.kind === "correct";
      if (correct) setCorrectAnswers((c) => c + 1);
      setTotalAttempts((a) => a + 1);
      if (!quiet) {
        playSoundRef.current(correct ? "success" : "error");
        buzz(correct ? 25 : 80);
      }

      const { width, height } = dimensionsRef.current;
      const percentX = Math.max(0, Math.min(100, ((event.x * nextCamera.scale + nextCamera.x) / width) * 100));
      const percentY = Math.max(0, Math.min(100, ((event.y * nextCamera.scale + nextCamera.y) / height) * 100));
      const pickupId = pickupIdRef.current++;
      setPickupBursts((prev) => [
        ...prev,
        {
          id: pickupId,
          x: percentX,
          y: percentY,
          frameIndex: correct ? BOOK_FRAME_GLOW : BOOK_FRAME_CLOSED,
          variant: correct ? "glow" : "close",
        },
      ]);
      if (correct) {
        const sparkleId = sparkleIdRef.current++;
        setSparkles((prev) => [...prev, { id: sparkleId, x: percentX, y: percentY }]);
      }
    };

    const loop = (timestamp: number) => {
      let frameMs: number;
      let remainingMs: number | null = null;
      if (clock) {
        const frame = clock.tick(timestamp);
        frameMs = frame.stepsMs.reduce((sum, step) => sum + step, 0);
        remainingMs = frame.remainingMs;
      } else {
        frameMs = lastFrame === null ? 0 : Math.min(timestamp - lastFrame, MAX_CATCH_UP_MS);
        lastFrame = timestamp;
      }

      const prevState = gameStateRef.current;
      if (!prevState || prevState.status !== "playing") return;

      // Fixed steps: a 30, 60 or 120 Hz phone all walk and dodge at the same speed.
      const { steps, leftoverMs: nextLeftover } = takeFixedSteps(leftoverMs + frameMs);
      leftoverMs = nextLeftover;
      if (steps === 0) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const currentInput = inputRef.current;
      const wantsCast = Boolean(currentInput.cast);
      const firstInput = mapInputVectorToDirectional(currentInput);
      const laterInput = { ...firstInput, cast: false };
      const stepConfig = config();

      let nextState = prevState;
      const events: LibraryEvent[] = [];
      for (let i = 0; i < steps && nextState.status === "playing"; i++) {
        nextState = advanceEnchantedLibraryTime(
          nextState,
          i === 0 ? firstInput : laterInput,
          FIXED_STEP_MS,
          stepConfig,
        );
        if (nextState.events.length > 0) events.push(...nextState.events);
      }
      if (remainingMs !== null) {
        nextState = {
          ...nextState,
          timeRemaining: remainingMs,
          gameTime: roundLengthMs - remainingMs,
        };
      }
      gameStateRef.current = nextState;
      setGameState(nextState);

      if (wantsCast) {
        consumeCastRef.current();
        inputRef.current = { ...currentInput, cast: false };
      }

      const nextCamera = computeCameraRef.current(nextState);
      setCamera(nextCamera);
      events.forEach((event) => handleEvent(event, nextCamera));

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clock?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, tutorialMode, gamePhase, assets, gameState?.status, hasScreen, isLiveRound, roundNumber]);

  useEffect(() => {
    if (!gameState) return;
    if (gameState.status !== "victory" && gameState.status !== "gameover") return;

    // The round is over: all words found, or the time ran out.
    const totalWords = Math.max(gameVocabulary.length, 1);
    const correctWords = autoStart || tutorialMode
      ? countFirstTryWords(gameState)
      : correctAnswers;
    const resultTotal = autoStart || tutorialMode ? totalWords : Math.max(totalAttempts, 1);
    const accuracy = resultTotal > 0 ? correctWords / resultTotal : 0;
    const xp = calculateEnchantedLibraryXP(
      gameState,
      correctWords,
      resultTotal,
    );
    const missed = listReviewWords(gameState, gameVocabulary);
    let heading = "หมดเวลา";
    if (gameState.status === "victory") {
      heading = missed.length === 0 ? "เก่งมาก! ถูกครบทุกคำ" : "เก็บครบทุกคำแล้ว";
    }
    const nextResults: EnchantedLibraryGameResult = {
      xp,
      accuracy,
      gameTime: gameState.gameTime,
      correctAnswers: correctWords,
      totalAttempts: resultTotal,
      durationMs: Math.min(gameState.gameTime, LIVE_GAME_DURATION_MS),
      review: { heading, missed },
    };
    setResults(nextResults);
    if (!hasReportedRef.current) {
      onComplete(nextResults);
      hasReportedRef.current = true;
    }
    if (restartOnComplete && (autoStart || tutorialMode)) {
      resetGame();
      setGamePhase("playing");
    } else {
      setGamePhase("ended");
    }
  }, [autoStart, restartOnComplete, tutorialMode, gameState, correctAnswers, gameVocabulary, totalAttempts, onComplete, resetGame]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setDimensions((prev) => {
          if (prev.width === width && prev.height === height) return prev;
          return { width, height };
        });
      }
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });

    observer.observe(containerRef.current);
    const interval = setInterval(updateDimensions, 200);
    const timeout = setTimeout(() => clearInterval(interval), 2000);
    updateDimensions();

    return () => {
      observer.disconnect();
      clearInterval(interval);
      clearTimeout(timeout);
    };
    // The loading placeholder and the game root are different elements: observe
    // whichever is mounted, or the stage keeps the placeholder's size (the board
    // sat in the top 320px of the presenter frame with an empty band below).
  }, [hasAssets]);

  // Memoize sprite grids
  const grids = useMemo(() => {
    if (!assets) return null;
    return {
      player: buildSpriteGrid(assets.player.width, assets.player.height),
      spirit: buildSpriteGrid(assets.spirit.width, assets.spirit.height),
      book: buildBookSpriteGrid(assets.book.width, assets.book.height),
    };
  }, [assets]);

  const targetWord = gameState?.targetWord;
  const foundWords = gameState ? countFoundWords(gameState) : 0;
  const hasAnswered = foundWords > 0 || (gameState?.missedWords.size ?? 0) > 0;
  useEffect(() => {
    const measure = () => {
      const root = containerRef.current?.getBoundingClientRect();
      if (!root) return;
      const rects: ScreenRect[] = [];
      [hudRef, promptRef, stickRef, shieldRef].forEach((ref) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        rects.push({
          left: Math.round(rect.left - root.left) - 2,
          top: Math.round(rect.top - root.top) - 2,
          right: Math.round(rect.right - root.left) + 2,
          bottom: Math.round(rect.bottom - root.top) + 2,
        });
      });
      setBlockedRects((prev) => (JSON.stringify(prev) === JSON.stringify(rects) ? prev : rects));
    };
    measure();
    // Once more after the board's opening scale-in has settled.
    const settle = setTimeout(measure, 500);
    return () => clearTimeout(settle);
  }, [dimensions, targetWord, hasAnswered, gamePhase, hasAssets]);

  // The label's text only changes with the board, so lay it out once per board.
  const boardLabelsKey = gameState?.books.map((book) => book.translation).join("\u0001") ?? "";
  const boardLabels = useMemo(() => {
    const layouts = new Map<string, ReturnType<typeof layoutBookLabel>>();
    if (typeof document === "undefined") return layouts;
    boardLabelsKey.split("\u0001").forEach((translation) => {
      if (translation) layouts.set(translation, layoutBookLabel(translation));
    });
    return layouts;
  }, [boardLabelsKey]);

  if (!assets) {
    return (
      <div
        ref={mergedContainerRef}
        className="relative h-[50vh] sm:h-[60vh] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-amber-100 to-amber-200 flex items-center justify-center border border-amber-300 md:aspect-video md:h-auto"
      >
        {assetLoadFailed ? (
          <GameAssetLoadFailure
            onRetry={() => {
              setAssetLoadFailed(false);
              setAssetLoadAttempt((attempt) => attempt + 1);
            }}
            onGiveUp={autoStart && !tutorialMode && !restartOnComplete ? giveUpLoading : undefined}
          />
        ) : (
          <div className="text-amber-800 animate-pulse font-mono tracking-widest uppercase text-base">
            {t("loading")}
          </div>
        )}
      </div>
    );
  }

  // Labels keep their size on screen at any zoom, and grow with a big presenter screen.
  const labelUnit = (Math.max(camera.scale, 1) / camera.scale) * Math.max(1, presenterScale * LABEL_PRESENTER_BOOST);
  const viewLeft = -camera.x / camera.scale;
  const viewRight = (dimensions.width - camera.x) / camera.scale;
  const toScreen = (point: Point) => ({
    x: point.x * camera.scale + camera.x,
    y: point.y * camera.scale + camera.y,
  });
  const playerOnScreen = gameState ? toScreen(gameState.player) : { x: 0, y: 0 };
  const steering = tutorialMode ? inputRef.current : input;

  const isHidden = (point: { x: number; y: number }) =>
    point.x < 8 ||
    point.x > dimensions.width - 8 ||
    point.y < 8 ||
    point.y > dimensions.height - 8 ||
    blockedRects.some((rect) =>
      rectsOverlap({ left: point.x, top: point.y, right: point.x + 1, bottom: point.y + 1 }, rect),
    );

  // A book the child cannot read right now gets a chip with its meaning and the way to walk.
  const isBookHidden = (book: Point) => isHidden(toScreen(book));
  const hiddenBooks =
    gameState && !gameState.reveal
      ? gameState.books.flatMap((book) => {
          const onScreen = toScreen(book);
          const label = toScreen({ x: book.x, y: book.y + BOOK_LABEL_OFFSET + 12 * labelUnit });
          if (!isHidden(onScreen) && !isHidden(label)) return [];
          return [{ id: book.id, x: onScreen.x, y: onScreen.y, book }];
        })
      : [];
  // Chips keep off the labels of books that are in view.
  const labelLeft = (bookX: number, width: number) =>
    Math.max(viewLeft + 2, Math.min(viewRight - width - 2, bookX - width / 2));
  const visibleLabelRects: ScreenRect[] = gameState
    ? gameState.books.flatMap((book) => {
        const label = boardLabels.get(book.translation);
        if (!label || isBookHidden(book)) return [];
        const width = label.width * labelUnit;
        const topLeft = toScreen({ x: labelLeft(book.x, width), y: book.y + BOOK_LABEL_OFFSET });
        return [{
          left: topLeft.x,
          top: topLeft.y,
          right: topLeft.x + width * camera.scale,
          bottom: topLeft.y + label.height * labelUnit * camera.scale,
        }];
      })
    : [];
  const bookChips = placeEdgeChips(hiddenBooks, dimensions, [...blockedRects, ...visibleLabelRects], CHIP_SIZE);
  const ghostMarkers = gameState
    ? placeEdgeChips(
        gameState.spirits
          .filter((spirit) => spirit.warnMs > 0)
          .map((spirit) => ({ id: spirit.id, ...toScreen(spirit) })),
        dimensions,
        [
          ...blockedRects,
          ...bookChips.map((chip) => ({
            left: chip.left,
            top: chip.top,
            right: chip.left + CHIP_SIZE.width,
            bottom: chip.top + CHIP_SIZE.height,
          })),
        ],
        GHOST_MARKER_SIZE,
      )
    : [];
  const ghostWarning = ghostMarkers.length > 0;
  const bookGlow = gameState ? 0.5 + 0.5 * Math.sin(gameState.gameTime / 260) : 0;

  return (
    <div
      ref={mergedContainerRef}
      style={{ minHeight: "320px" }}
      className={`relative w-full overflow-hidden bg-slate-950 shadow-2xl touch-none ${
        fullscreen
          ? "h-full min-h-0 flex-1 rounded-none shadow-none"
          : "h-full min-h-[320px] rounded-3xl"
      }`}
    >
      {gamePhase === "start" && !autoStart && !tutorialMode && (
        <GameStartScreen
          gameTitle={t("title")}
          gameSubtitle={t("subtitle")}
          vocabulary={gameVocabulary}
          instructions={[
            {
              step: 1,
              text: t("instructions.step1"),
              icon: BookOpen,
            },
            {
              step: 2,
              text: t("instructions.step2"),
              icon: Sparkles,
            },
            {
              step: 3,
              text: t("instructions.step3"),
              icon: Shield,
            },
            {
              step: 4,
              text: t("instructions.step4"),
              icon: Book,
            },
          ]}
          proTip={t("proTip")}
          controls={[
            {
              label: t("controls.move"),
              keys: t("controls.moveKeys"),
              color: "bg-amber-500",
            },
            {
              label: t("controls.shield"),
              keys: t("controls.shieldKeys"),
              color: "bg-emerald-500",
            },
          ]}
          startButtonText={t("startButton")}
          icon={BookOpen}
          onStart={() => {
            resetGame();
            setGamePhase("playing");
          }}
        />
      )}

      {gamePhase === "playing" && gameState && grids && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="absolute inset-0"
        >
          {/* HUD Overlay */}
          <div
            className={`absolute inset-x-2 z-10 flex items-start gap-2 pointer-events-none sm:inset-x-4 ${
              tutorialMode ? "top-32" : "top-2 sm:top-4"
            }`}
            style={{ zoom: presenterScale }}
          >
            <div
              ref={hudRef}
              className="flex shrink-0 flex-col gap-1 text-amber-900 font-bold text-sm md:text-xl drop-shadow-[0_2px_4px_rgba(255,255,255,0.8)]"
            >
              <motion.div
                key={`mana-${gameState.mana}`}
                initial={{ scale: 1.25 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.25 }}
                className={`origin-left px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg ${
                  gameState.mana <= 10 ? "bg-red-500/90 text-white" : "bg-white/80"
                }`}
                data-testid="hud-mana"
              >
                {t("hud.mana")}: {gameState.mana}
              </motion.div>
              <div
                className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg ${
                  gameState.timeRemaining <= TIME_WARNING_MS
                    ? "bg-red-500/90 text-white animate-pulse"
                    : "bg-white/80"
                }`}
                data-testid="hud-time"
              >
                {t("hud.time")}: {Math.floor(Math.ceil(gameState.timeRemaining / 1000) / 60)}:
                {String(Math.ceil(gameState.timeRemaining / 1000) % 60).padStart(2, "0")}
              </div>
              <div className="bg-white/80 px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg" data-testid="hud-found">
                พบแล้ว {foundWords}/{gameVocabulary.length}
              </div>
              <div className="bg-white/80 px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg text-blue-600 flex items-center gap-0.5 sm:gap-1">
                {t("hud.shields")}:{" "}
                {Array(gameState.player.maxShieldCharges)
                  .fill(0)
                  .map((_, i) => (
                    <span
                      key={i}
                      className={
                        i < gameState.player.shieldCharges
                          ? "opacity-100"
                          : "opacity-30"
                      }
                    >
                      🛡️
                    </span>
                  ))}
              </div>
            </div>

            <div className="flex min-w-0 flex-1 justify-center">
              <div
                ref={promptRef}
                className="max-w-full rounded-2xl border border-yellow-300 bg-gradient-to-r from-yellow-400 to-amber-500 px-3 py-1.5 text-center shadow-lg sm:max-w-[420px] sm:px-5"
                data-testid="target-prompt"
              >
                <span className="block text-sm font-bold leading-tight text-amber-950 sm:text-base">
                  {t("hud.find")}
                </span>
                <span
                  className={`block break-words font-black leading-tight text-amber-950 ${
                    gameState.targetWord.length > 18 ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"
                  }`}
                >
                  {gameState.targetWord}
                </span>
                {!hasAnswered && (
                  <span className="block text-xs font-bold leading-tight text-amber-950/85 sm:text-sm">
                    เดินไปชนหนังสือคำแปลที่ถูก
                  </span>
                )}
              </div>
            </div>

            {!autoStart && (
              <button
                onClick={() => setShowGrimoire(true)}
                disabled={tutorialMode}
                className="pointer-events-auto shrink-0 bg-white/90 p-2 sm:p-3 rounded-full text-amber-900 shadow-lg border-2 border-amber-300 hover:scale-110 transition-transform active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center disabled:cursor-default disabled:opacity-70"
                title={tx("My Grimoire")}
              >
                <Book className="w-6 h-6" />
              </button>
            )}
          </div>

          {!autoStart && (
            <VocabularyProgress
              vocabulary={gameVocabulary}
              progress={gameState.vocabularyProgress}
              isOpen={showGrimoire}
              onClose={() => setShowGrimoire(false)}
            />
          )}

          <div className="absolute inset-0 z-20 pointer-events-none">
            {sparkles.map((sparkle) => (
              <SparkleBurst
                key={sparkle.id}
                x={sparkle.x}
                y={sparkle.y}
                onComplete={() =>
                  setSparkles((prev) =>
                    prev.filter((item) => item.id !== sparkle.id),
                  )
                }
              />
            ))}
            {pickupBursts.map((burst) => (
              <BookPickupBurst
                key={burst.id}
                x={burst.x}
                y={burst.y}
                spriteUrl={assets.book.src}
                frameIndex={burst.frameIndex}
                variant={burst.variant}
                onComplete={() =>
                  setPickupBursts((prev) =>
                    prev.filter((item) => item.id !== burst.id),
                  )
                }
              />
            ))}
          </div>

          {/* The answer after a pick, while the world holds still */}
          {gameState.reveal && (
            <div
              className="absolute inset-x-3 top-[38%] z-30 flex justify-center pointer-events-none"
              role="status"
              data-testid="answer-reveal"
              data-kind={gameState.reveal.kind}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15 }}
                className={`max-w-full rounded-2xl border-2 px-4 py-3 text-center text-white shadow-2xl ${
                  gameState.reveal.kind === "correct"
                    ? "border-emerald-200 bg-emerald-600"
                    : "border-red-200 bg-red-600"
                }`}
              >
                <p className="text-base font-black leading-tight">
                  {gameState.reveal.kind === "correct" ? "ถูกต้อง! +10" : "ผิด -5"}
                </p>
                <p className="mt-1 break-words text-xl font-black leading-snug">
                  {gameState.reveal.term} = {gameState.reveal.meaning}
                </p>
              </motion.div>
            </div>
          )}

          {/* A ghost hit: flash, and what it cost */}
          {gameState.stunMs > 0 && (
            <>
              <div className="absolute inset-0 z-[15] bg-red-500/25 pointer-events-none" />
              <div
                className="absolute z-30 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-red-600 px-2.5 py-0.5 text-lg font-black text-white shadow-lg pointer-events-none"
                style={{ left: playerOnScreen.x, top: playerOnScreen.y - 30 * camera.scale }}
                data-testid="hit-feedback"
              >
                {gameState.stunReason === "exhausted" ? "มานาหมด พักแป๊บ" : "ผีชน -10"}
              </div>
            </>
          )}

          {/* Books out of reach: meaning and the way to walk */}
          <div className="absolute inset-0 z-10 pointer-events-none">
            {bookChips.map((chip) => {
              const angle = Math.atan2(chip.y - playerOnScreen.y, chip.x - playerOnScreen.x);
              return (
                <div
                  key={`indicator-${chip.id}`}
                  className="absolute flex items-center gap-1 rounded-xl border-2 border-amber-300 bg-amber-500/95 px-1 shadow-lg"
                  style={{
                    left: chip.left,
                    top: chip.top,
                    width: CHIP_SIZE.width,
                    height: CHIP_SIZE.height,
                  }}
                  data-testid="book-chip"
                >
                  <ArrowUp
                    className="h-5 w-5 shrink-0 text-amber-950"
                    strokeWidth={3}
                    style={{ transform: `rotate(${(angle * 180) / Math.PI + 90}deg)` }}
                    data-testid="book-chip-arrow"
                  />
                  <span className="line-clamp-2 min-w-0 text-xs font-bold leading-tight text-amber-950">
                    {chip.book.translation}
                  </span>
                </div>
              );
            })}
            {ghostMarkers.map((marker) => (
              <div
                key={`ghost-${marker.id}`}
                className="absolute flex items-center justify-center gap-1 rounded-full border-2 border-red-200 bg-red-600 text-sm font-black text-white shadow-lg animate-pulse"
                style={{
                  left: marker.left,
                  top: marker.top,
                  width: GHOST_MARKER_SIZE.width,
                  height: GHOST_MARKER_SIZE.height,
                }}
                data-testid="ghost-warning"
              >
                <Ghost className="h-4 w-4" />
                ผี!
              </div>
            ))}
          </div>

          {/* Virtual Controls */}
          <div ref={stickRef} style={{ zoom: presenterScale }} className={`absolute z-20 ${tutorialMode ? "pointer-events-none" : ""} bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-3 sm:left-6 ${
            tutorialMode && (tutorialStep === 1 || tutorialStep === 2 || tutorialStep === 3)
              ? "ring-4 ring-cyan-400/80 rounded-full p-2 bg-cyan-500/20 backdrop-blur-sm scale-105 transition-all duration-300"
              : ""
          }`}>
            <div style={{ transform: `scale(${getEffectiveTouchTarget(136) / 128})`, transformOrigin: "bottom left" }}>
              <VirtualDPad onInput={setVirtualInput} activeVector={tutorialMode ? inputRef.current : undefined} />
            </div>
            {tutorialMode && (tutorialStep === 1 || tutorialStep === 2 || tutorialStep === 3) && (
              <span className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-cyan-300 px-3.5 py-1 text-xs font-black text-slate-950 shadow-xl animate-bounce">
                🎮 {inputRef.current.dx === 1 ? "กดขวา ►" : inputRef.current.dx === -1 ? "กดซ้าย ◄" : inputRef.current.dy === 1 ? "กดลง ▼" : inputRef.current.dy === -1 ? "กดขึ้น ▲" : "ปุ่มทิศทาง"}
              </span>
            )}
          </div>
          <div ref={shieldRef} style={{ zoom: presenterScale }} className="absolute z-20 bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] right-4 sm:bottom-7 sm:right-7">
            <button
              type="button"
              // Pointer down, not click: a click never comes while the other thumb holds the stick.
              onPointerDown={(event) => {
                event.preventDefault();
                triggerCast();
              }}
              disabled={tutorialMode || gameState.player.shieldCharges === 0}
              style={{
                width: getEffectiveTouchTarget(82),
                height: getEffectiveTouchTarget(82),
              }}
              className={`rounded-full border-2 flex flex-col items-center justify-center gap-0.5 font-black text-[12px] uppercase tracking-wide transition-all active:scale-95 touch-none select-none ${
                tutorialMode && tutorialStep === 5
                  ? "bg-blue-500 border-blue-200 text-white ring-8 ring-blue-400/80 scale-110 shadow-[0_0_30px_rgba(59,130,246,0.9)] animate-pulse"
                  : gameState.player.shieldCharges > 0
                  ? `bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] ${
                      ghostWarning && !gameState.shieldActive ? "ring-4 ring-red-400 animate-pulse" : ""
                    }`
                  : "bg-slate-400 border-slate-300 text-slate-600 opacity-50"
              }`}
              data-testid="shield-button"
            >
              <Shield className="h-5 w-5" />
              {t("controls.shield")}
            </button>
            {tutorialMode && tutorialStep === 5 && (
              <span className="absolute -top-9 right-0 whitespace-nowrap rounded-full bg-blue-300 px-3.5 py-1 text-xs font-black text-slate-950 shadow-xl animate-bounce">
                🛡️ 6. กดเปิดเกราะบาเรีย
              </span>
            )}
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
              x={camera.x}
              y={camera.y}
              listening={false}
            >
              {/* Library Background */}
              <KonvaImage
                x={0}
                y={0}
                image={assets.floor}
                width={GAME_WIDTH}
                height={GAME_HEIGHT}
              />
              {/* A touch darker, so the real books stand out from the painted ones */}
              <Rect
                x={0}
                y={0}
                width={GAME_WIDTH}
                height={GAME_HEIGHT}
                fill="rgba(2,6,23,0.18)"
              />

              <Group>
                {/* Books */}
                {gameState.books.map((book) => {
                  const faded = Boolean(gameState.reveal) && !book.isCorrect;
                  const revealed = Boolean(gameState.reveal) && book.isCorrect;
                  return (
                    <Group key={book.id} x={book.x} y={book.y} opacity={faded ? 0.35 : 1}>
                      <Circle
                        radius={32}
                        fill={revealed ? "rgba(52,211,153,0.4)" : "rgba(253,224,71,0.28)"}
                      />
                      <Circle
                        radius={31 + bookGlow * 4}
                        stroke={revealed ? "#34d399" : "#fde047"}
                        strokeWidth={3}
                        opacity={0.5 + bookGlow * 0.5}
                      />
                      <KonvaImage
                        image={assets.book}
                        name="book"
                        width={62}
                        height={60}
                        offsetX={31}
                        offsetY={30}
                        crop={getSpriteCrop(
                          grids.book.fw,
                          grids.book.fh,
                          BOOK_FRAME_CLOSED,
                          0,
                        )}
                      />
                    </Group>
                  );
                })}

                {/* Player */}
                <Group opacity={gameState.stunMs > 0 && Math.floor(gameState.gameTime / 90) % 2 === 0 ? 0.35 : 1}>
                  <KonvaImage
                    image={assets.player}
                    name="player"
                    x={gameState.player.x}
                    y={gameState.player.y}
                    width={64}
                    height={64}
                    offsetX={32}
                    offsetY={32}
                    scaleX={steering.dx < 0 ? -1 : 1}
                    crop={getSpriteCrop(
                      grids.player.fw,
                      grids.player.fh,
                      playerFrame,
                      steering.dx === 0 && steering.dy === 0 ? 1 : 0,
                    )}
                  />
                  {/* Shield Visual */}
                  {gameState.shieldActive && (
                    <Circle
                      x={gameState.player.x}
                      y={gameState.player.y}
                      radius={50}
                      stroke="cyan"
                      strokeWidth={3}
                      opacity={0.6}
                      name="shield"
                      shadowColor="#67e8f9"
                      shadowBlur={18}
                      shadowOpacity={0.8}
                    />
                  )}
                </Group>

                {/* Labels: above the wizard, and touching their own book */}
                {gameState.books.map((book) => {
                  const label = boardLabels.get(book.translation);
                  // Off screen its chip says it. Pulled into view, it would sit on other labels.
                  if (!label || isBookHidden(book)) return null;
                  const width = label.width * labelUnit;
                  return (
                    <Group
                      key={`label-${book.id}`}
                      x={labelLeft(book.x, width)}
                      y={book.y + BOOK_LABEL_OFFSET}
                      opacity={gameState.reveal && !book.isCorrect ? 0.35 : 1}
                    >
                      <Rect
                        width={width}
                        height={label.height * labelUnit}
                        fill={gameState.reveal && book.isCorrect ? "rgba(4,120,87,0.95)" : "rgba(0,0,0,0.78)"}
                        cornerRadius={5 * labelUnit}
                      />
                      <Text
                        text={label.text}
                        x={LABEL_PADDING_X_PX * labelUnit}
                        y={LABEL_PADDING_Y_PX * labelUnit}
                        width={(label.width - LABEL_PADDING_X_PX * 2) * labelUnit}
                        fontSize={label.fontSize * labelUnit}
                        lineHeight={LABEL_LINE_HEIGHT}
                        wrap="none"
                        fill="white"
                        align="center"
                        fontStyle="bold"
                      />
                    </Group>
                  );
                })}

                {/* Spirits */}
                {gameState.spirits.map((spirit, i) => (
                  <KonvaImage
                    key={spirit.id}
                    image={assets.spirit}
                    name="spirit"
                    x={spirit.x}
                    y={spirit.y}
                    width={48}
                    height={48}
                    offsetX={24}
                    offsetY={24}
                    scaleX={spirit.velocityX < 0 ? -1 : 1}
                    crop={getSpriteCrop(
                      grids.spirit.fw,
                      grids.spirit.fh,
                      (spiritFrame + i) % 3,
                      0,
                    )}
                    opacity={spirit.warnMs > 0 ? 0.35 : 0.9}
                  />
                ))}
              </Group>
            </Layer>
          </Stage>
        </motion.div>
      )}
      {gamePhase === "ended" && !autoStart && gameState && results && (
        <>
          <GameEndScreen
            status="complete"
            title={t("messages.victory")}
            subtitle={t("messages.victoryDesc")}
            score={results.xp}
            xp={results.xp}
            accuracy={results.accuracy}
            customStats={[
              {
                label: t("messages.wordsMastered"),
                value: `${Array.from(gameState.vocabularyProgress.values()).filter((count) => count >= 2).length}/${gameVocabulary.length}`,
              },
              { label: t("messages.correctBooks"), value: correctAnswers },
              {
                label: tx("Difficulty"),
                value: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
              },
            ]}
            onRestart={() => {
              resetGame();
              setGamePhase("start");
            }}
            onExit={() => {
              window.location.href = "/student/games";
            }}
          />

          {/* Rankings Display */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-4xl px-6 max-h-[40vh] overflow-y-auto">
            <RankingDisplay
              rankings={rankings}
              currentDifficulty={difficulty}
            />
          </div>
        </>
      )}
    </div>
  );
}
