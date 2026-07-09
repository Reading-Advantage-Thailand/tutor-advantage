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
  GAME_WIDTH,
  GAME_HEIGHT,
  type EnchantedLibraryState,
} from "@/lib/games/enchantedLibrary";
import type { VocabularyItem } from "@/store/useGameStore";
import { useSound } from "@/hooks/useSound";
import { useInterval } from "@/hooks/useInterval";
import { useDirectionalInput } from "@/hooks/useDirectionalInput";
import { useGameFullscreen } from "@/hooks/useGameFullscreen";
import { useAccessibilitySettings } from "@/hooks/useAccessibilitySettings";
import { VirtualDPad } from "@/components/ui/VirtualDPad";
import { getCachedGameImage, loadGameImage } from "@/lib/games/gameAssetPreloader";
import { motion } from "framer-motion";
import { Book, BookOpen, Shield, Sparkles } from "lucide-react";

import { useScopedI18n } from "@/locales/client";
import { SparkleBurst } from "./SparkleBurst";
import { BookPickupBurst } from "./BookPickupBurst";
import { mapInputVectorToDirectional } from "./enchantedLibraryInput";
import { VocabularyProgress } from "./VocabularyProgress";
import { GameEndScreen } from "@/components/games/game/GameEndScreen";
import { GameStartScreen } from "@/components/games/game/GameStartScreen";
import { RankingDisplay } from "./RankingDisplay";

export type EnchantedLibraryGameResult = {
  xp: number;
  accuracy: number;
  gameTime: number;
  correctAnswers?: number;
  totalAttempts?: number;
  durationMs?: number;
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
}

const LIVE_GAME_DURATION_MS = 60_000;
const MAX_ROUND_WORDS = 10;
const LIBRARY_ASSET_PATHS = {
  player: "/games/vocabulary/enchanted-library/player_3x3_pose_sheet.png",
  spirit: "/games/vocabulary/enchanted-library/spirit_3x3_pose_sheet.png",
  book: "/games/vocabulary/enchanted-library/book_3x1_sheet.png",
  floor: "/games/vocabulary/enchanted-library/library_background.png",
};

const buildRoundVocabulary = (items: VocabularyItem[]) =>
  [...items].sort(() => Math.random() - 0.5).slice(0, MAX_ROUND_WORDS);

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

const getSpriteCrop = (fw: number, fh: number, col: number, row: number) => ({
  x: col * fw,
  y: row * fh,
  width: fw,
  height: fh,
});

export function EnchantedLibraryGame({
  vocabulary,
  onComplete,
  difficulty,
  rankings,
  autoStart = false,
}: EnchantedLibraryGameProps) {
  const { playSound } = useSound();
  const { input, setVirtualInput, triggerCast, consumeCast } =
    useDirectionalInput();
  const { containerRef: fullscreenRef, enterFullscreen, exitFullscreen } =
    useGameFullscreen();
  const { getEffectiveTouchTarget } = useAccessibilitySettings();
  const gameVocabulary = useMemo(
    () => buildRoundVocabulary(vocabulary),
    [vocabulary],
  );

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

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Merge container ref with fullscreen ref
  const mergedContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      (fullscreenRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [fullscreenRef],
  );

  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });

  // Refs for rAF loop to avoid stale closures
  const inputRef = useRef(input);
  const assetsRef = useRef(assets);
  const vocabularyRef = useRef(vocabulary);
  const difficultyRef = useRef(difficulty);
  const dimensionsRef = useRef(dimensions);
  const cameraRef = useRef(camera);
  const gamePhaseRef = useRef(gamePhase);
  const playSoundRef = useRef(playSound);
  const consumeCastRef = useRef(consumeCast);
  const lastFrameRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => { inputRef.current = input; }, [input]);
  useEffect(() => { assetsRef.current = assets; }, [assets]);
  useEffect(() => { vocabularyRef.current = gameVocabulary; }, [gameVocabulary]);
  useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);
  useEffect(() => { dimensionsRef.current = dimensions; }, [dimensions]);
  useEffect(() => { cameraRef.current = camera; }, [camera]);
  useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);
  useEffect(() => { playSoundRef.current = playSound; }, [playSound]);
  useEffect(() => { consumeCastRef.current = consumeCast; }, [consumeCast]);

  // Animation Frames
  const [playerFrame, setPlayerFrame] = useState(0);
  const [spiritFrame, setSpiritFrame] = useState(0);
  const BOOK_FRAME_OPEN = 1;
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
        if (mounted) setAssets({ player, spirit, book, floor });
      } catch (e) {
        console.error("Failed to load assets", e);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const resetGame = useCallback(() => {
    if (gameVocabulary.length > 0) {
      const initialState = createEnchantedLibraryState(gameVocabulary, {
        difficulty,
      });
      const nextState = autoStart
        ? { ...initialState, timeRemaining: LIVE_GAME_DURATION_MS }
        : initialState;
      gameStateRef.current = nextState;
      setGameState(nextState);
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

  // Fullscreen management
  useEffect(() => {
    if (gamePhase === "playing") {
      enterFullscreen();
    } else if (gamePhase === "ended") {
      exitFullscreen();
    }
  }, [gamePhase, enterFullscreen, exitFullscreen]);

  // Animation Loop
  useInterval(() => {
    if (gamePhase === "playing") {
      setPlayerFrame((f) => (f + 1) % 3);
      setSpiritFrame((f) => (f + 1) % 3);
    }
  }, 150);

  // Game Loop with requestAnimationFrame
  useEffect(() => {
    if (
      !gameStateRef.current ||
      gameStateRef.current.status !== "playing" ||
      !assetsRef.current ||
      gamePhaseRef.current !== "playing"
    ) {
      return;
    }

    lastFrameRef.current = 0;

    const loop = (timestamp: number) => {
      const delta = lastFrameRef.current
        ? timestamp - lastFrameRef.current
        : 16;
      lastFrameRef.current = timestamp;
      const clampedDelta = Math.min(delta, 50);

      const prevState = gameStateRef.current;
      if (!prevState || prevState.status !== "playing") {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const prevMana = prevState.mana;
      const prevVocabProgress = prevState.vocabularyProgress;
      const currentInput = inputRef.current;
      const currentVocabulary = vocabularyRef.current;
      const currentDifficulty = difficultyRef.current;
      const currentDimensions = dimensionsRef.current;
      const currentCamera = cameraRef.current;

      const directionalInput = mapInputVectorToDirectional(currentInput);

      // Advance authoritative state
      const nextState = advanceEnchantedLibraryTime(
        prevState,
        directionalInput,
        clampedDelta,
        {
          vocabulary: currentVocabulary,
          difficulty: currentDifficulty,
          masteryTarget: autoStart ? 1 : 2,
        },
      );
      gameStateRef.current = nextState;
      setGameState(nextState);

      // Track attempts and accuracy
      if (nextState.mana !== prevMana) {
        let progressIncreased = false;
        for (const [word, count] of nextState.vocabularyProgress.entries()) {
          if (count > (prevVocabProgress.get(word) || 0)) {
            progressIncreased = true;
            break;
          }
        }

        if (progressIncreased) {
          setCorrectAnswers((c) => c + 1);
          setTotalAttempts((a) => a + 1);
        } else if (nextState.mana < prevMana) {
          setTotalAttempts((a) => a + 1);
        }
      }

      if (currentInput.cast) {
        consumeCastRef.current();
        playSoundRef.current("success");
      }

      let nextCamera = currentCamera;
      if (currentDimensions.width > 0 && currentDimensions.height > 0) {
        nextCamera = computeCameraRef.current(nextState);
        setCamera(nextCamera);
      }

      // Check for book collection events
      const collectedBook = findCollectedBookRef.current(prevState, nextState);
      if (collectedBook && currentDimensions.width > 0 && currentDimensions.height > 0) {
        const screenX = collectedBook.x * nextCamera.scale + nextCamera.x;
        const screenY = collectedBook.y * nextCamera.scale + nextCamera.y;
        const percentX = Math.max(
          0,
          Math.min(100, (screenX / currentDimensions.width) * 100),
        );
        const percentY = Math.max(
          0,
          Math.min(100, (screenY / currentDimensions.height) * 100),
        );

        const pickupId = pickupIdRef.current++;
        const variant = collectedBook.isCorrect ? "glow" : "close";
        const frameIndex = collectedBook.isCorrect
          ? BOOK_FRAME_GLOW
          : BOOK_FRAME_CLOSED;

        setPickupBursts((prev) => [
          ...prev,
          { id: pickupId, x: percentX, y: percentY, frameIndex, variant },
        ]);

        if (collectedBook.isCorrect) {
          const sparkleId = sparkleIdRef.current++;
          setSparkles((prev) => [
            ...prev,
            { id: sparkleId, x: percentX, y: percentY },
          ]);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [autoStart, gamePhase, assets, gameState?.status]);

  useEffect(() => {
    if (!gameState) return;

    // Handle victory
    if (gameState.status === "victory") {
      const totalWords = Math.max(gameVocabulary.length, 1);
      const correctWords = autoStart
        ? Array.from(gameState.vocabularyProgress.values()).filter((count) => count >= 1).length
        : correctAnswers;
      const resultTotal = autoStart ? totalWords : Math.max(totalAttempts, 1);
      const accuracy = resultTotal > 0 ? correctWords / resultTotal : 0;
      const xp = calculateEnchantedLibraryXP(
        gameState,
        correctWords,
        resultTotal,
      );
      const nextResults = {
        xp,
        accuracy,
        gameTime: gameState.gameTime,
        correctAnswers: correctWords,
        totalAttempts: resultTotal,
        durationMs: Math.min(gameState.gameTime, LIVE_GAME_DURATION_MS),
      };
      setResults(nextResults);
      if (!hasReportedRef.current) {
        onComplete(nextResults);
        hasReportedRef.current = true;
      }
      setGamePhase("ended");
    }

    // Handle game over (mana depleted or time ran out)
    if (gameState.status === "gameover") {
      const totalWords = Math.max(gameVocabulary.length, 1);
      const correctWords = autoStart
        ? Array.from(gameState.vocabularyProgress.values()).filter((count) => count >= 1).length
        : correctAnswers;
      const resultTotal = autoStart ? totalWords : Math.max(totalAttempts, 1);
      const accuracy = resultTotal > 0 ? correctWords / resultTotal : 0;
      const xp = calculateEnchantedLibraryXP(
        gameState,
        correctWords,
        resultTotal,
      );
      const nextResults = {
        xp,
        accuracy,
        gameTime: gameState.gameTime,
        correctAnswers: correctWords,
        totalAttempts: resultTotal,
        durationMs: Math.min(gameState.gameTime, LIVE_GAME_DURATION_MS),
      };
      setResults(nextResults);
      if (!hasReportedRef.current) {
        onComplete(nextResults);
        hasReportedRef.current = true;
      }
      setGamePhase("ended");
    }
  }, [autoStart, gameState, correctAnswers, gameVocabulary.length, totalAttempts, onComplete]);

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
  }, []);

  // Memoize sprite grids
  const grids = useMemo(() => {
    if (!assets) return null;
    return {
      player: buildSpriteGrid(assets.player.width, assets.player.height),
      spirit: buildSpriteGrid(assets.spirit.width, assets.spirit.height),
      book: buildBookSpriteGrid(assets.book.width, assets.book.height),
    };
  }, [assets]);

  const computeCamera = useCallback(
    (state: EnchantedLibraryState) => {
      const scaleY = dimensions.height / GAME_HEIGHT;
      const scale = Math.max(scaleY, 0.8);

      let camX = dimensions.width / 2 - state.player.x * scale;
      let camY = dimensions.height / 2 - state.player.y * scale;

      const minX = dimensions.width - GAME_WIDTH * scale;
      const minY = dimensions.height - GAME_HEIGHT * scale;

      if (minX > 0) camX = (dimensions.width - GAME_WIDTH * scale) / 2;
      else camX = Math.max(minX, Math.min(0, camX));

      if (minY > 0) camY = (dimensions.height - GAME_HEIGHT * scale) / 2;
      else camY = Math.max(minY, Math.min(0, camY));

      return { x: camX, y: camY, scale };
    },
    [dimensions],
  );

  // Helper to detect book collection between states
  const findCollectedBook = useCallback(
    (prevState: EnchantedLibraryState, nextState: EnchantedLibraryState) => {
      // If mana is same, no collection or hit happened
      if (prevState.mana === nextState.mana) return null;

      // If mana changed, check if books changed
      const booksChanged = prevState.books.some((book, index) => {
        const nextBook = nextState.books[index];
        // Book collected if:
        // 1. nextBook is undefined (fewer books?) - unlikely with current spawn logic
        // 2. word changed (respawned)
        // 3. position changed (respawned)
        return (
          !nextBook ||
          nextBook.word !== book.word ||
          nextBook.x !== book.x ||
          nextBook.y !== book.y
        );
      });

      if (!booksChanged) return null;

      // Find the book that the player was close to in the PREVIOUS state
      const player = prevState.player; // Use player position from PREV state when collision happened
      return (
        prevState.books.find((book) => {
          const dx = player.x - book.x;
          const dy = player.y - book.y;
          // Use slightly larger radius to ensure we catch it, as physics might have been tight
          return Math.hypot(dx, dy) < player.radius + book.radius + 5;
        }) || null
      );
    },
    [],
  );

  const computeCameraRef = useRef(computeCamera);
  const findCollectedBookRef = useRef(findCollectedBook);

  useEffect(() => { computeCameraRef.current = computeCamera; }, [computeCamera]);
  useEffect(() => { findCollectedBookRef.current = findCollectedBook; }, [findCollectedBook]);

  if (!assets) {
    return (
      <div
        ref={mergedContainerRef}
        className="relative h-[50vh] sm:h-[60vh] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-amber-100 to-amber-200 flex items-center justify-center border border-amber-300 md:aspect-video md:h-auto"
      >
        <div className="text-amber-800 animate-pulse font-mono tracking-widest uppercase text-base">
          Loading Library...
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mergedContainerRef}
      style={{ minHeight: "320px" }}
      className={`relative w-full overflow-hidden bg-slate-950 shadow-2xl touch-none ${
        autoStart
          ? "h-dvh rounded-none"
          : "h-[80vh] rounded-3xl sm:h-[70vh] md:aspect-video md:h-auto"
      }`}
    >
      {gamePhase === "start" && !autoStart && (
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
          <div className="absolute top-2 sm:top-4 left-2 sm:left-4 z-10 flex flex-col gap-1 text-amber-900 font-bold text-base md:text-xl pointer-events-none drop-shadow-[0_2px_4px_rgba(255,255,255,0.8)]">
            <div className="bg-white/80 px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg">
              {t("hud.mana")}: {gameState.mana}
            </div>
            <div
              className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg ${
                gameState.timeRemaining <= 30000
                  ? "bg-red-500/90 text-white animate-pulse"
                  : "bg-white/80"
              }`}
            >
              {t("hud.time")}: {Math.floor(gameState.timeRemaining / 60000)}:
              {String(
                Math.floor((gameState.timeRemaining % 60000) / 1000),
              ).padStart(2, "0")}
            </div>
            <div className="bg-white/80 px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg text-blue-600 text-base flex items-center gap-0.5 sm:gap-1">
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

          <div className="absolute right-3 top-24 z-10 max-w-[42vw] rounded-2xl border border-yellow-300 bg-gradient-to-r from-yellow-400 to-amber-500 px-3 py-2 text-right shadow-lg backdrop-blur-sm pointer-events-none sm:right-5 sm:top-28 sm:max-w-[320px] sm:px-4">
            <span className="block text-[10px] uppercase tracking-[0.18em] text-white/80 sm:text-xs">
              Find:
            </span>
            <span className="block break-words text-sm font-bold leading-tight text-white drop-shadow-md sm:text-lg">
              {gameState.targetWord}
            </span>
          </div>

          <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-20">
            <button
              onClick={() => setShowGrimoire(true)}
              className="bg-white/90 p-2 sm:p-3 rounded-full text-amber-900 shadow-lg border-2 border-amber-300 hover:scale-110 transition-transform active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="My Grimoire"
            >
              <Book className="w-6 h-6" />
            </button>
          </div>

          {gameState && (
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
                frameWidth={grids.book.fw}
                frameHeight={grids.book.fh}
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

          {/* Off-screen Indicators */}
          <div className="absolute inset-0 z-10 pointer-events-none">
            {gameState.books.map((book) => {
              const screenX = book.x * camera.scale + camera.x;
              const screenY = book.y * camera.scale + camera.y;
              const isOffScreen =
                screenX < -20 ||
                screenX > dimensions.width + 20 ||
                screenY < -20 ||
                screenY > dimensions.height + 20;
              if (!isOffScreen) return null;

              const clampedX = Math.max(
                24,
                Math.min(dimensions.width - 24, screenX),
              );
              const clampedY = Math.max(
                24,
                Math.min(dimensions.height - 24, screenY),
              );
              const angle = Math.atan2(
                screenY - dimensions.height / 2,
                screenX - dimensions.width / 2,
              );
              const rotation = (angle * 180) / Math.PI;

              return (
                <div
                  key={`indicator-${book.id}`}
                  className="absolute flex items-center justify-center w-8 h-8 bg-amber-500/90 rounded-full border-2 border-amber-300 shadow-lg"
                  style={{
                    left: clampedX - 16,
                    top: clampedY - 16,
                    transform: `rotate(${rotation}deg)`,
                  }}
                >
                  <span className="text-white text-xs font-bold">↑</span>
                </div>
              );
            })}
          </div>

          {/* Virtual Controls */}
          <div className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2 sm:bottom-1">
            <div style={{ transform: `scale(${getEffectiveTouchTarget(136) / 128})`, transformOrigin: "bottom center" }}>
              <VirtualDPad onInput={setVirtualInput} />
            </div>
          </div>
          <div className="absolute bottom-6 right-4 z-20 sm:bottom-7 sm:right-7">
            <button
              onClick={() => triggerCast()}
              disabled={gameState.player.shieldCharges === 0}
              style={{
                width: getEffectiveTouchTarget(82),
                height: getEffectiveTouchTarget(82),
              }}
              className={`rounded-full border-2 flex flex-col items-center justify-center gap-0.5 font-black text-[12px] uppercase tracking-wide transition-all active:scale-95 ${
                gameState.player.shieldCharges > 0
                  ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                  : "bg-slate-400 border-slate-300 text-slate-600 opacity-50"
              }`}
            >
              <Shield className="h-5 w-5" />
              Shield
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
              x={camera.x}
              y={camera.y}
            >
              {/* Library Background */}
              <KonvaImage
                x={0}
                y={0}
                image={assets.floor}
                width={GAME_WIDTH}
                height={GAME_HEIGHT}
              />

              <Group>
                {/* Books */}
                {gameState.books.map((book) => (
                  <Group key={book.id} x={book.x} y={book.y}>
                    <KonvaImage
                      image={assets.book}
                      name="book"
                      width={50}
                      height={50}
                      offsetX={25}
                      offsetY={25}
                      crop={getSpriteCrop(
                        grids.book.fw,
                        grids.book.fh,
                        BOOK_FRAME_OPEN,
                        0,
                      )}
                      shadowColor="#fbbf24"
                      shadowBlur={12}
                      shadowOpacity={0.9}
                    />
                    <Group offsetX={50} offsetY={-40}>
                      <Rect
                        width={100}
                        height={20}
                        fill="rgba(0,0,0,0.7)"
                        cornerRadius={4}
                        offsetX={0}
                        offsetY={0}
                      />
                      <Text
                        text={book.translation}
                        fontSize={14}
                        fill="white"
                        align="center"
                        width={100}
                        offsetY={-3}
                        fontStyle="bold"
                      />
                    </Group>
                  </Group>
                ))}

                {/* Player */}
                <Group>
                  <KonvaImage
                    image={assets.player}
                    name="player"
                    x={gameState.player.x}
                    y={gameState.player.y}
                    width={64}
                    height={64}
                    offsetX={32}
                    offsetY={32}
                    scaleX={input.dx < 0 ? -1 : 1}
                    crop={getSpriteCrop(
                      grids.player.fw,
                      grids.player.fh,
                      playerFrame,
                      input.dx === 0 && input.dy === 0 ? 1 : 0,
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
                    opacity={0.9}
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
                label: "Difficulty",
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
