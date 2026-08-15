import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Group, Rect, Text } from "react-konva";
import { usePotionRushStore, SentenceItem } from "@/store/usePotionRushStore";
import { withBasePath } from "@/lib/games/basePath";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { Beaker, Hand, MousePointer2, RotateCcw, Trash2, Trophy } from "lucide-react";
import { GameStartScreen } from "@/components/games/game/GameStartScreen";
import { useScopedI18n } from "@/locales/client";
import { useGameFullscreen } from "@/hooks/useGameFullscreen";
import { useAccessibilitySettings } from "@/hooks/useAccessibilitySettings";

import ConveyorBelt from "./ConveyorBelt";
import CauldronStation from "./CauldronStation";
import CustomerQueue from "./CustomerQueue";
import TrashPortal from "./TrashPortal";
import PotionRushEffectsLayer from "./PotionRushEffectsLayer";
import PotionRushSoundController from "./PotionRushSoundController";

export interface PotionRushGameResult {
  xp: number;
  accuracy: number;
  difficulty: "easy" | "normal" | "hard" | "extreme";
  score: number;
  correctAnswers?: number;
  totalAttempts?: number;
  durationMs?: number;
}

interface PotionRushGameProps {
  vocabList: SentenceItem[];
  difficulty: "easy" | "normal" | "hard" | "extreme";
  onComplete: (results: PotionRushGameResult) => void;
  autoStart?: boolean;
  tutorialMode?: boolean;
  manageFullscreen?: boolean;
}

export default function PotionRushGame({
  vocabList,
  difficulty,
  onComplete,
  autoStart = false,
  tutorialMode = false,
  manageFullscreen = true,
}: PotionRushGameProps) {
  const t = useScopedI18n("pages.student.gamesPage.potionRush");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const { containerRef: fsContainerRef, enterFullscreen, exitFullscreen } = useGameFullscreen();
  useAccessibilitySettings(); // Verify hook is integrated

  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  const assetsLoaded = Object.keys(images).length === 3;
  const showControls = autoStart || tutorialMode;


  useEffect(() => {
    const assets = {
      wall: withBasePath("/games/sentence/potion-rush/shop-wall.png"),
      floor: withBasePath("/games/sentence/potion-rush/shop-floor.png"),
      counter: withBasePath("/games/sentence/potion-rush/shop-counter.png"),
    };

    const loadedImgs: Record<string, HTMLImageElement> = {};
    let count = 0;
    const sources = Object.entries(assets);

    sources.forEach(([key, src]) => {
      const img = new window.Image();
      img.src = src;
      img.onload = () => {
        loadedImgs[key] = img;
        count++;
        if (count === sources.length) {
          setImages(loadedImgs);
        }
      };
      img.onerror = () => {
        console.error(`Failed to load: ${src}`);
        count++;
        if (count === sources.length) {
          setImages(loadedImgs);
        }
      };
    });
  }, []);

  const startGame = usePotionRushStore((state) => state.startGame);
  const tick = usePotionRushStore((state) => state.tick);
  const gameState = usePotionRushStore((state) => state.gameState);
  const reset = usePotionRushStore((state) => state.reset);
  const score = usePotionRushStore((state) => state.score);
  const reputation = usePotionRushStore((state) => state.reputation);
  const completedSentences = usePotionRushStore(
    (state) => state.completedSentences,
  );
  const totalXpEarned = usePotionRushStore((state) => state.totalXpEarned);
  const gameTime = usePotionRushStore((state) => state.gameTime);

  const controls = useAnimation();
  const prevReputation = useRef(reputation);
  const completionReported = useRef(false);

  useEffect(() => {
    if (reputation < prevReputation.current) {
      controls.start("damage");
    }
    prevReputation.current = reputation;
  }, [reputation, controls]);

  useEffect(() => {
    if (gameState === "PLAYING") {
      completionReported.current = false;
      return;
    }

    if (gameState !== "GAME_OVER" || completionReported.current) return;

    // autoStart only controls the initial launch. Restarting here caused the
    // teaching game to silently begin another 60-second round at time-out.
    completionReported.current = true;
    if (manageFullscreen) exitFullscreen();
    onComplete({
      xp: totalXpEarned,
      accuracy: Math.max(0, Math.min(reputation, 100)) / 100,
      difficulty,
      score,
      correctAnswers: completedSentences,
      totalAttempts: Math.min(10, vocabList.length || 10),
      durationMs: Math.round(gameTime * 1000),
    });
  }, [gameState, manageFullscreen, totalXpEarned, reputation, difficulty, score, completedSentences, vocabList.length, gameTime, onComplete, exitFullscreen]);

  // Keep the original portrait scene as the minimum layout, but let a wide
  // viewport grow horizontally instead of leaving most of the screen empty.
  const BASE_VIRTUAL_WIDTH = 390;
  const VIRTUAL_HEIGHT = 844;

  const scaleX = dimensions.width / BASE_VIRTUAL_WIDTH;
  const scaleY = dimensions.height / VIRTUAL_HEIGHT;
  const isLandscape = dimensions.width >= dimensions.height;
  const scale = isLandscape ? scaleY : Math.min(scaleX, scaleY);
  const virtualWidth = Math.max(
    BASE_VIRTUAL_WIDTH,
    dimensions.width / Math.max(scale, 0.001),
  );

  const stageX = Math.max(0, (dimensions.width - virtualWidth * scale) / 2);
  const stageY = (dimensions.height - VIRTUAL_HEIGHT * scale) / 2;

  const LAYOUT = {
    wallH: 420,
    floorH: 424,
    counterY: 300,
    customerY: 301,
    cauldronY: 400,
    beltY: 720,
    trashX: virtualWidth / 2,
    trashY: 620,
    isPortrait: !isLandscape,
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Game loop with requestAnimationFrame
  const lastFrameRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const isRunning = gameState === "PLAYING" && dimensions.width > 0 && dimensions.height > 0;
    if (!isRunning) {
      lastFrameRef.current = 0;
      return;
    }

    const loop = (timestamp: number) => {
      const delta = lastFrameRef.current ? timestamp - lastFrameRef.current : 16.67;
      lastFrameRef.current = timestamp;
      const clampedDelta = Math.min(delta, 50);
      tick(clampedDelta / 1000, virtualWidth);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, dimensions.width, dimensions.height, virtualWidth, tick]);

  useEffect(() => {
    return () => reset();
  }, [reset]);

  useEffect(() => {
    if ((autoStart || tutorialMode) && assetsLoaded && !hasStarted && vocabList.length > 0) {
      setHasStarted(true);
      if (manageFullscreen) enterFullscreen();
      startGame(vocabList, difficulty);
    }
  }, [autoStart, tutorialMode, manageFullscreen, assetsLoaded, hasStarted, vocabList, difficulty, enterFullscreen, startGame]);

  const setFullscreenContainerRef = (node: HTMLDivElement | null) => {
    (fsContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  if (dimensions.width === 0) {
    return (
      <div
        ref={setFullscreenContainerRef}
        className="flex h-dvh w-screen overflow-hidden bg-slate-950"
      >
        {showControls && <PotionRushControlPanel variant="sidebar" />}
        <div ref={containerRef} className="h-full min-w-0 flex-1 bg-slate-950" />
      </div>
    );
  }

  return (
    <div
      ref={setFullscreenContainerRef}
      className="relative flex h-dvh w-screen overflow-hidden bg-slate-950 font-sans touch-none select-none"
    >
      <PotionRushSoundController />
      {showControls && <PotionRushControlPanel variant="sidebar" />}

      <div
        ref={containerRef}
        className="relative h-full min-w-0 flex-1 overflow-hidden bg-slate-950"
      >

      <AnimatePresence>
        {!hasStarted && !autoStart && !tutorialMode && (
          <GameStartScreen
            gameTitle={t("title")}
            gameSubtitle={t("gameSubtitle")}
            icon={Beaker}
            vocabulary={vocabList}
            instructions={[
              { step: 1, text: t("instructions.step1") },
              { step: 2, text: t("instructions.step2") },
              { step: 3, text: t("instructions.step3") },
            ]}
            proTip={t("proTip")}
            controls={[
              {
                label: t("controls.match"),
                keys: t("controls.matchKeys"),
                color: "bg-amber-500",
              },
              {
                label: t("controls.drag"),
                keys: t("controls.dragKeys"),
                color: "bg-emerald-500",
              },
            ]}
            startButtonText={t("startButton")}
            onStart={() => {
              setHasStarted(true);
              enterFullscreen();
              startGame(vocabList, difficulty);
            }}
          />
        )}
      </AnimatePresence>

      {hasStarted && (
        <div className="absolute inset-x-0 top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-start gap-2 p-2 text-white pointer-events-none sm:p-4">
          <div>
            <div className="text-base sm:text-xl font-bold text-amber-400 drop-shadow-lg">
              Score: {score}
            </div>
            <div className="text-xs sm:text-sm text-slate-300 drop-shadow-md">
              Reputation: {Math.max(0, Math.round(reputation))}%
            </div>
          </div>
          <div className="justify-self-center text-lg sm:text-2xl font-bold text-amber-400 drop-shadow-lg bg-black/40 border border-amber-500/35 px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
            ⏱️ {Math.max(0, Math.ceil(60 - gameTime))}s
          </div>
          <div className="justify-self-end text-right text-lg sm:text-2xl font-bold text-white drop-shadow-lg bg-black/30 px-2 sm:px-4 py-1 rounded-full">
            Served: {completedSentences}
          </div>
        </div>
      )}

      <motion.div
        animate={controls}
        variants={{
          default: { x: 0 },
          damage: {
            x: [0, -10, 10, -10, 10, 0],
            transition: { duration: 0.4 },
          },
        }}
        className="relative"
      >
        <Stage
          width={dimensions.width}
          height={dimensions.height}
          scaleX={scale}
          scaleY={scale}
          x={stageX}
          y={stageY}
        >
          <Layer>
            {images.wall && (
              <KonvaImage
                image={images.wall}
                width={virtualWidth}
                height={LAYOUT.wallH}
              />
            )}

            {images.floor && (
              <KonvaImage
                image={images.floor}
                y={LAYOUT.wallH}
                width={virtualWidth}
                height={LAYOUT.floorH}
              />
            )}

            <CustomerQueue y={LAYOUT.customerY} width={virtualWidth} />

            {images.counter && (
              <KonvaImage
                image={images.counter}
                y={LAYOUT.counterY}
                width={virtualWidth}
                height={160}
              />
            )}

            <CauldronStation
              y={LAYOUT.cauldronY}
              width={virtualWidth}
              layout={LAYOUT}
            />

            <TrashPortal x={LAYOUT.trashX} y={LAYOUT.trashY} />

            {/* Word Holding Area (3 slots) */}
            <Group y={510}>
              {[0, 1, 2].map((i) => {
                const slotX = (virtualWidth * (i + 0.5)) / 3;
                return (
                  <Group key={i} x={slotX}>
                    <Rect
                      x={-40}
                      y={-30}
                      width={80}
                      height={60}
                      fill="rgba(0, 0, 0, 0.4)"
                      stroke="rgba(255, 255, 255, 0.25)"
                      strokeWidth={2}
                      cornerRadius={10}
                      dash={[6, 4]}
                    />
                    <Text
                      text="HOLD"
                      fontSize={11}
                      fontStyle="bold"
                      fill="rgba(255, 255, 255, 0.35)"
                      align="center"
                      width={80}
                      x={-40}
                      y={-6}
                    />
                  </Group>
                );
              })}
            </Group>

            <ConveyorBelt
              y={LAYOUT.beltY}
              width={virtualWidth}
              dragBoundFunc={(pos) => pos}
              layout={LAYOUT}
            />

            <PotionRushEffectsLayer />
          </Layer>
        </Stage>
      </motion.div>

      <motion.div
        className="absolute inset-0 bg-red-500 pointer-events-none z-40"
        initial={{ opacity: 0 }}
        animate={controls}
        variants={{
          default: { opacity: 0 },
          damage: {
            opacity: [0, 0.3, 0],
            transition: { duration: 0.4 },
          },
        }}
      />

      {gameState === "GAME_OVER" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.94, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-sm rounded-[28px] border border-white/15 bg-slate-950/95 p-8 text-center text-white shadow-2xl"
          >
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-300 text-slate-950 shadow-lg shadow-amber-300/20">
              <Trophy className="size-8" aria-hidden="true" />
            </div>
            <h2 className="mt-6 text-3xl font-black tracking-tight">
              ได้ {score} คะแนน
            </h2>
            <button
              type="button"
              onClick={() => {
                if (manageFullscreen) enterFullscreen();
                startGame(vocabList, difficulty);
              }}
              className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 text-base font-black text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300 active:scale-[0.98]"
            >
              <RotateCcw className="size-5" aria-hidden="true" />
              เริ่มเล่นใหม่
            </button>
          </motion.div>
        </motion.div>
      )}
        {showControls && <PotionRushControlPanel variant="bottom" />}
      </div>
    </div>
  );
}

function PotionRushControlPanel({ variant }: { variant: "sidebar" | "bottom" }) {
  const items = [
    { icon: MousePointer2, text: "Drag ingredients into the matching cauldron" },
    { icon: Hand, text: "Use HOLD slots to save a word for later" },
    { icon: Trash2, text: "Drop wrong items into the trash" },
  ];

  return (
    <aside
      aria-label="Potion Rush controls"
      className={
        variant === "sidebar"
          ? "hidden w-[clamp(220px,18vw,300px)] shrink-0 flex-col justify-center gap-4 border-r border-white/10 bg-slate-950/95 p-5 text-white shadow-2xl lg:flex"
          : "absolute inset-x-2 bottom-2 z-20 flex justify-center lg:hidden"
      }
    >
      <div
        className={
          variant === "sidebar"
            ? "rounded-3xl border border-violet-400/25 bg-violet-500/10 p-4 backdrop-blur-md"
            : "w-full max-w-xl rounded-2xl border border-violet-400/30 bg-slate-950/90 px-3 py-2 shadow-2xl backdrop-blur-md"
        }
      >
        <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-violet-200">
          <Beaker className="size-4 text-violet-300" aria-hidden="true" />
          How to play
        </div>
        <div className={variant === "sidebar" ? "space-y-3" : "grid grid-cols-3 gap-2"}>
          {items.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className={
                variant === "sidebar"
                  ? "flex items-start gap-2.5 text-xs font-semibold leading-snug text-white/80"
                  : "flex items-center gap-1.5 text-[10px] font-bold leading-tight text-white/80"
              }
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-violet-300" aria-hidden="true" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
