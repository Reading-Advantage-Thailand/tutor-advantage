import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Group, Rect, Text } from "react-konva";
import { potionRushAccuracy, usePotionRushStore, SentenceItem } from "@/store/usePotionRushStore";
import { useGameImages } from "@/lib/games/useGameImages";
import { AnimatePresence, motion } from "framer-motion";
import { Beaker, Hand, MousePointer2, RotateCcw, Trash2, Trophy } from "lucide-react";
import { GameAssetLoading } from "@/components/games/GameAssetLoadFailure";
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
import { DragHint, GameHint, OrderBanner, RoundTimer } from "./PotionRushOverlays";
import { tx } from "@/lib/games/gameText";
import { pickShortSentences } from "@/lib/games/sentenceRound";

const SHOP_IMAGES = {
  wall: "/games/sentence/potion-rush/shop-wall.webp",
  floor: "/games/sentence/potion-rush/shop-floor.webp",
  counter: "/games/sentence/potion-rush/shop-counter.webp",
};
// The shop art is scenery: a slow or failed image must not hold the round back.
const SHOP_IMAGE_WAIT_MS = 4_000;
// A longer order cannot be brewed in a 60 second round.
const MAX_ORDER_WORDS = 8;
const POT_Y = 380;
const BELT_CENTRE_Y = 720;
const HINT_Y = 462;
const SCORE_LINE_HEIGHT = 48;
const BANNER_MARGIN = 8;
// Read from the back of the room once the board is big enough.
const LARGE_BOARD_WIDTH = 768;
const LARGE_BOARD_FONT_SCALE = 1.35;
// Belt words are drawn in scene units, which a big screen already enlarges a little.
const BELT_WORD_PRESENTER_BOOST = 1.13;

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
  /** Stage scale on a projector: words, the order and the HUD are drawn bigger. */
  presenterScale?: number;
}

export default function PotionRushGame({
  vocabList,
  difficulty,
  onComplete,
  autoStart = false,
  tutorialMode = false,
  manageFullscreen = true,
  presenterScale = 1,
}: PotionRushGameProps) {
  const t = useScopedI18n("pages.student.gamesPage.potionRush");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  // A state setter is a stable ref callback, and it re-runs the observer below.
  const [containerNode, containerRef] = useState<HTMLDivElement | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const roundSentences = useMemo(() => pickShortSentences(vocabList, MAX_ORDER_WORDS), [vocabList]);
  const { containerRef: fsContainerRef, enterFullscreen, exitFullscreen } = useGameFullscreen();
  useAccessibilitySettings(); // Verify hook is integrated

  const { images, settled: shopImagesSettled } = useGameImages(SHOP_IMAGES);
  const [waitedForImages, setWaitedForImages] = useState(false);
  const assetsLoaded = shopImagesSettled || waitedForImages;
  const showControls = autoStart || tutorialMode;
  // Below lg the strip sits under the board. The tutorial overlay already walks
  // through each step and its spotlight targets the full-height board, so the
  // strip only shows there in teacher/play mode.
  const showBottomControls = showControls && !tutorialMode;


  useEffect(() => {
    const timer = setTimeout(() => setWaitedForImages(true), SHOP_IMAGE_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  const startGame = usePotionRushStore((state) => state.startGame);
  const tick = usePotionRushStore((state) => state.tick);
  const gameState = usePotionRushStore((state) => state.gameState);
  const reset = usePotionRushStore((state) => state.reset);
  const score = usePotionRushStore((state) => state.score);
  const completedSentences = usePotionRushStore(
    (state) => state.completedSentences,
  );

  const completionReported = useRef(false);

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
    const finished = usePotionRushStore.getState();
    onComplete({
      xp: finished.totalXpEarned,
      accuracy: potionRushAccuracy(finished),
      difficulty,
      score: finished.score,
      correctAnswers: finished.completedSentences,
      totalAttempts: Math.min(10, vocabList.length || 10),
      durationMs: Math.round(finished.gameTime * 1000),
    });
  }, [gameState, manageFullscreen, difficulty, vocabList.length, onComplete, exitFullscreen]);

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

  const scoreLineHeight = SCORE_LINE_HEIGHT * presenterScale;
  const beltLabelScale = Math.max(1, presenterScale * BELT_WORD_PRESENTER_BOOST);
  const orderFontScale = Math.max(dimensions.width >= LARGE_BOARD_WIDTH ? LARGE_BOARD_FONT_SCALE : 1, presenterScale * 1.25);

  const LAYOUT = {
    wallH: 420,
    floorH: 424,
    counterY: 300,
    customerY: 301,
    cauldronY: 400,
    beltY: BELT_CENTRE_Y,
    trashX: virtualWidth / 2,
    trashY: 620,
  };

  const toScreen = (x: number, y: number) => ({ x: stageX + x * scale, y: stageY + y * scale });
  const potCentres = [0, 1, 2].map((slot) => toScreen((virtualWidth * (slot + 0.5)) / 3, POT_Y)) as [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ];
  const bannerLeft = stageX + BANNER_MARGIN;
  const slotCentres = potCentres.map((pot) => pot.x - bannerLeft) as [number, number, number];

  // The placeholder below is swapped for the real frame, so watch whichever is
  // mounted. Otherwise entering fullscreen leaves a stale size and clips the belt.
  useEffect(() => {
    const el = containerNode;
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
  }, [containerNode]);

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
    if ((autoStart || tutorialMode) && assetsLoaded && !hasStarted && roundSentences.length > 0) {
      setHasStarted(true);
      if (manageFullscreen) enterFullscreen();
      startGame(roundSentences, difficulty);
    }
  }, [autoStart, tutorialMode, manageFullscreen, assetsLoaded, hasStarted, roundSentences, difficulty, enterFullscreen, startGame]);

  const setFullscreenContainerRef = (node: HTMLDivElement | null) => {
    (fsContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  if (dimensions.width === 0) {
    return (
      <div
        ref={setFullscreenContainerRef}
        className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-950 lg:flex-row"
      >
        {showControls && <PotionRushControlPanel variant="sidebar" presenterScale={presenterScale} />}
        <div ref={containerRef} className="min-h-0 min-w-0 flex-1 bg-slate-950" />
        {showBottomControls && <PotionRushControlPanel variant="bottom" />}
      </div>
    );
  }

  return (
    <div
      ref={setFullscreenContainerRef}
      // Below lg the how-to-play strip sits under the board (not over it), so
      // the stage measures the remaining height and the conveyor labels stay clear.
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-950 font-sans touch-none select-none lg:flex-row"
    >
      <PotionRushSoundController />
      {showControls && <PotionRushControlPanel variant="sidebar" presenterScale={presenterScale} />}

      <div
        ref={containerRef}
        className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-slate-950"
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
              startGame(roundSentences, difficulty);
            }}
          />
        )}
      </AnimatePresence>

      {hasStarted && (
        <div
          className="absolute inset-x-0 top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 text-white pointer-events-none"
          style={{ height: scoreLineHeight }}
        >
          <div />
          <div style={{ zoom: presenterScale }} className="justify-self-center text-lg sm:text-2xl font-bold tabular-nums text-amber-400 drop-shadow-lg bg-black/40 border border-amber-500/35 px-3 py-0.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
            ⏱️ <RoundTimer />
          </div>
          <div style={{ zoom: presenterScale }} className="justify-self-end text-right text-base sm:text-xl font-bold text-white drop-shadow-lg bg-black/40 px-2 sm:px-4 py-0.5 rounded-full">
            {t("hud.served")} {completedSentences}
          </div>
        </div>
      )}

      {!hasStarted && (autoStart || tutorialMode) && <GameAssetLoading />}

      {hasStarted && gameState !== "GAME_OVER" && (
        <>
          <OrderBanner
            top={scoreLineHeight}
            left={bannerLeft}
            right={Math.max(0, stageX) + BANNER_MARGIN}
            slotCentres={slotCentres}
            promptEnabled={false}
            fontScale={orderFontScale}
          />
          <GameHint top={toScreen(0, HINT_Y).y} />
          {!tutorialMode && <DragHint from={toScreen(virtualWidth / 2, BELT_CENTRE_Y)} potCentres={potCentres} />}
        </>
      )}

      <div className="relative">
        <Stage
          width={dimensions.width}
          height={dimensions.height}
          scaleX={scale}
          scaleY={scale}
          x={stageX}
          y={stageY}
        >
          {/* Three layers, so the moving words do not redraw the shop every frame. */}
          <Layer listening={false}>
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
          </Layer>

          <Layer>
            <CustomerQueue y={LAYOUT.customerY} width={virtualWidth} />

            {images.counter && (
              <KonvaImage
                image={images.counter}
                y={LAYOUT.counterY}
                width={virtualWidth}
                height={160}
                listening={false}
              />
            )}

            <CauldronStation
              y={LAYOUT.cauldronY}
              width={virtualWidth}
            />

            {/* Word Holding Area (3 slots) */}
            <Group y={510} listening={false}>
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
                      text={tx("HOLD")}
                      fontSize={Math.min(16, 11 * beltLabelScale)}
                      fontStyle="bold"
                      fill="rgba(255, 255, 255, 0.8)"
                      align="center"
                      width={80}
                      x={-40}
                      y={-6}
                    />
                  </Group>
                );
              })}
            </Group>

          </Layer>

          <Layer>
            <TrashPortal x={LAYOUT.trashX} y={LAYOUT.trashY} />

            <ConveyorBelt
              y={LAYOUT.beltY}
              width={virtualWidth}
              layout={LAYOUT}
              labelScale={beltLabelScale}
            />

            <PotionRushEffectsLayer />
          </Layer>
        </Stage>
      </div>

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
                startGame(roundSentences, difficulty);
              }}
              className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 text-base font-black text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300 active:scale-[0.98]"
            >
              <RotateCcw className="size-5" aria-hidden="true" />
              เริ่มเล่นใหม่
            </button>
          </motion.div>
        </motion.div>
      )}
      </div>
      {showBottomControls && <PotionRushControlPanel variant="bottom" />}
    </div>
  );
}

function PotionRushControlPanel({ variant, presenterScale = 1 }: { variant: "sidebar" | "bottom"; presenterScale?: number }) {
  const t = useScopedI18n("pages.student.gamesPage.potionRush");
  const items = [
    { icon: MousePointer2, text: t("howToPlay.drag") },
    { icon: Hand, text: t("howToPlay.hold") },
    { icon: Trash2, text: t("howToPlay.trash") },
  ];

  return (
    <aside
      aria-label={t("howToPlay.title")}
      className={
        variant === "sidebar"
          ? "hidden w-[clamp(220px,18vw,300px)] shrink-0 flex-col justify-center gap-4 border-r border-white/10 bg-slate-950/95 p-5 text-white shadow-2xl lg:flex"
          : "relative z-20 flex shrink-0 justify-center border-t border-white/10 bg-slate-950 px-2 py-1.5 lg:hidden"
      }
    >
      <div
        className={
          variant === "sidebar"
            ? "rounded-3xl border border-violet-400/25 bg-violet-500/10 p-4 backdrop-blur-md"
            : "w-full max-w-2xl rounded-2xl border border-violet-400/30 bg-violet-500/10 px-3 py-2"
        }
        style={variant === "sidebar" ? { zoom: Math.min(presenterScale, 1.25) } : undefined}
      >
        <div
          className={`flex items-center gap-2 text-xs font-black text-violet-200 ${
            variant === "sidebar" ? "mb-3" : "mb-1.5"
          }`}
        >
          <Beaker className="size-4 text-violet-300" aria-hidden="true" />
          {t("howToPlay.title")}
        </div>
        <div className={variant === "sidebar" ? "space-y-3" : "grid grid-cols-3 gap-2"}>
          {items.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className={
                variant === "sidebar"
                  ? "flex items-start gap-2.5 text-xs font-semibold leading-snug text-white/80"
                  : "flex items-center gap-1.5 text-[11px] font-bold leading-tight text-white/85"
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
