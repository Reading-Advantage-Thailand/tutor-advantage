import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Group, Rect, Text } from "react-konva";
import { potionRushAccuracy, usePotionRushStore, SentenceItem } from "@/store/usePotionRushStore";
import { useGameImages } from "@/lib/games/useGameImages";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Beaker } from "lucide-react";
import { GameAssetLoading } from "@/components/games/GameAssetLoadFailure";
import { GameEndScreen } from "@/components/games/game/GameEndScreen";
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
import { createRoundClock, type RoundClock } from "@/lib/games/roundClock";
import { MAX_GAME_POINTS, pickShortSentences } from "@/lib/games/sentenceRound";

const SHOP_IMAGES = {
  wall: "/games/sentence/potion-rush/shop-wall.webp",
  floor: "/games/sentence/potion-rush/shop-floor.webp",
  counter: "/games/sentence/potion-rush/shop-counter.webp",
};
// The shop art is scenery: a slow or failed image must not hold the round back.
const SHOP_IMAGE_WAIT_MS = 4_000;
// A longer order cannot be brewed in a 60 second round.
const MAX_ORDER_WORDS = 8;
const ROUND_MS = 60_000;
const VIRTUAL_WIDTH = 390;
// The belt ends here. The floor below it would only make everything smaller on a short phone.
const VIRTUAL_HEIGHT = 800;
const POT_Y = 380;
const BELT_CENTRE_Y = 720;
const HINT_Y = 462;
const SCORE_LINE_HEIGHT = 44;
const BANNER_MARGIN = 8;
// On a short phone the order would otherwise cover the customers.
const SHORT_PHONE_SCALE = 0.85;
const SHORT_PHONE_FONT_SCALE = 0.9;
const BACK_IN_GAME_HINT = "กลับมาแล้ว เล่นต่อเลย";
const ROTATE_NOTICE = "หมุนจอเป็นแนวตั้งเพื่อเล่น";
const HOLD_SLOT_XS = [0, 1, 2].map((slot) => (VIRTUAL_WIDTH * (slot + 0.5)) / 3);

const LAYOUT = {
  wallH: 420,
  floorH: 424,
  counterY: 300,
  customerY: 301,
  cauldronY: 400,
  beltY: BELT_CENTRE_Y,
  trashX: VIRTUAL_WIDTH / 2,
  trashY: 620,
};

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
  restartOnComplete?: boolean;
  tutorialMode?: boolean;
}

export default function PotionRushGame({
  vocabList,
  difficulty,
  onComplete,
  autoStart = false,
  restartOnComplete = true,
  tutorialMode = false,
}: PotionRushGameProps) {
  const t = useScopedI18n("pages.student.gamesPage.potionRush");
  const router = useRouter();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const roundSentences = useMemo(() => pickShortSentences(vocabList, MAX_ORDER_WORDS), [vocabList]);
  const { containerRef: fsContainerRef, enterFullscreen, exitFullscreen } = useGameFullscreen();
  useAccessibilitySettings(); // Verify hook is integrated

  const { images, settled: shopImagesSettled } = useGameImages(SHOP_IMAGES);
  const [waitedForImages, setWaitedForImages] = useState(false);
  const assetsLoaded = shopImagesSettled || waitedForImages;


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
  const totalXpEarned = usePotionRushStore((state) => state.totalXpEarned);

  useEffect(() => {
    if (gameState === "GAME_OVER") {
      if (restartOnComplete && (autoStart || tutorialMode)) {
        startGame(roundSentences, difficulty);
        return;
      }
      exitFullscreen();
      const finished = usePotionRushStore.getState();
      onComplete({
        xp: finished.totalXpEarned,
        accuracy: potionRushAccuracy(finished),
        difficulty: difficulty,
        score: finished.score,
        correctAnswers: finished.score,
        totalAttempts: MAX_GAME_POINTS,
        durationMs: Math.round(finished.gameTime * 1000),
      });
    }
  }, [gameState, autoStart, restartOnComplete, tutorialMode, difficulty, roundSentences, onComplete, exitFullscreen, startGame]);

  // Mobile-first portrait reference. The scene sits at the bottom, under the
  // thumbs, and any spare height at the top goes to the score line and the order.
  const scale = Math.min(dimensions.width / VIRTUAL_WIDTH, dimensions.height / VIRTUAL_HEIGHT);
  const sceneWidth = VIRTUAL_WIDTH * scale;
  const stageX = (dimensions.width - sceneWidth) / 2;
  const stageY = dimensions.height - VIRTUAL_HEIGHT * scale;
  const needsPortrait = dimensions.width > dimensions.height && dimensions.height < 500;

  const toScreen = (x: number, y: number) => ({ x: stageX + x * scale, y: stageY + y * scale });
  const potCentres = [0, 1, 2].map((slot) => toScreen(HOLD_SLOT_XS[slot], POT_Y)) as [
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
  const setFrameNode = useCallback((node: HTMLDivElement | null) => {
    setContainerNode(node);
    (fsContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [fsContainerRef]);

  // The round runs on real time, so a slow or hidden phone ends with everyone else.
  // A tutorial has no round to end, so it keeps counting frames.
  const clockRef = useRef<RoundClock | null>(null);

  useEffect(() => {
    if (gameState !== "PLAYING" || tutorialMode) return;
    const clock = createRoundClock({
      durationMs: ROUND_MS,
      onExpire: () => {
        const store = usePotionRushStore.getState();
        if (store.gameState === "PLAYING") store.endGame(ROUND_MS / 1000);
      },
    });
    clock.start();
    clockRef.current = clock;
    return () => {
      clock.stop();
      clockRef.current = null;
    };
  }, [gameState, tutorialMode]);

  // Say so when the player comes back: the clock kept running while they were away.
  useEffect(() => {
    if (gameState !== "PLAYING" || tutorialMode) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") usePotionRushStore.getState().showHint(BACK_IN_GAME_HINT);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [gameState, tutorialMode]);

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
      const clock = clockRef.current;
      if (clock) {
        const frame = clock.tick(timestamp);
        for (const stepMs of frame.stepsMs) tick(stepMs / 1000, VIRTUAL_WIDTH);
        usePotionRushStore.getState().syncGameTime((ROUND_MS - frame.remainingMs) / 1000);
      } else {
        const delta = lastFrameRef.current ? timestamp - lastFrameRef.current : 16.67;
        lastFrameRef.current = timestamp;
        tick(Math.min(delta, 50) / 1000, VIRTUAL_WIDTH);
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, dimensions.width, dimensions.height]);

  useEffect(() => {
    return () => reset();
  }, [reset]);

  useEffect(() => {
    if ((autoStart || tutorialMode) && assetsLoaded && !hasStarted && roundSentences.length > 0) {
      setHasStarted(true);
      enterFullscreen();
      startGame(roundSentences, difficulty);
    }
  }, [autoStart, tutorialMode, assetsLoaded, hasStarted, roundSentences, difficulty, enterFullscreen, startGame]);

  if (dimensions.width === 0)
    return <div ref={setContainerNode} className="h-full min-h-0 w-full bg-slate-950" />;

  return (
    <div ref={setFrameNode} className="h-full min-h-0 w-full relative font-sans overflow-hidden bg-slate-950 rounded-none touch-none select-none">
      <PotionRushSoundController />

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
          className="absolute top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-2 py-1.5 text-white pointer-events-none"
          style={{ left: stageX, width: sceneWidth, height: SCORE_LINE_HEIGHT }}
        >
          <div className="justify-self-start rounded-full bg-black/55 px-2.5 py-1 text-sm font-black text-amber-300 drop-shadow-lg">
            {t("hud.score")} {score}/{MAX_GAME_POINTS}
          </div>
          <div className="flex items-center gap-1 rounded-full border border-amber-500/35 bg-black/55 px-2.5 py-0.5 text-lg font-black tabular-nums text-amber-300 drop-shadow-lg">
            ⏱️ <RoundTimer />
          </div>
          <div className="justify-self-end rounded-full bg-black/55 px-2.5 py-1 text-sm font-black text-white drop-shadow-lg">
            {t("hud.served")} {completedSentences}
          </div>
        </div>
      )}

      {!hasStarted && (autoStart || tutorialMode) && <GameAssetLoading />}

      {hasStarted && gameState === "PLAYING" && (
        <>
          <OrderBanner
            top={SCORE_LINE_HEIGHT}
            left={bannerLeft}
            right={stageX + BANNER_MARGIN}
            slotCentres={slotCentres}
            promptEnabled={!tutorialMode}
            fontScale={scale < SHORT_PHONE_SCALE ? SHORT_PHONE_FONT_SCALE : 1}
          />
          <GameHint top={toScreen(0, HINT_Y).y} />
          {!tutorialMode && <DragHint from={toScreen(VIRTUAL_WIDTH / 2, BELT_CENTRE_Y)} potCentres={potCentres} />}
        </>
      )}

      {needsPortrait && (
        <div role="status" className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/95 text-white">
          <span className="text-5xl" aria-hidden="true">📱</span>
          <p className="mt-3 text-lg font-black">{ROTATE_NOTICE}</p>
        </div>
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
                width={VIRTUAL_WIDTH}
                height={LAYOUT.wallH}
              />
            )}

            {images.floor && (
              <KonvaImage
                image={images.floor}
                y={LAYOUT.wallH}
                width={VIRTUAL_WIDTH}
                height={LAYOUT.floorH}
              />
            )}
          </Layer>

          <Layer>
            <CustomerQueue y={LAYOUT.customerY} width={VIRTUAL_WIDTH} />

            {images.counter && (
              <KonvaImage
                image={images.counter}
                y={LAYOUT.counterY}
                width={VIRTUAL_WIDTH}
                height={160}
                listening={false}
              />
            )}

            <CauldronStation
              y={LAYOUT.cauldronY}
              width={VIRTUAL_WIDTH}
            />

            {/* Word Holding Area (3 slots) */}
            <Group y={510} listening={false}>
              {HOLD_SLOT_XS.map((slotX, i) => {
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
                      fontSize={11}
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
              width={VIRTUAL_WIDTH}
              layout={LAYOUT}
            />

            <PotionRushEffectsLayer />
          </Layer>
        </Stage>
      </div>

      {gameState === "GAME_OVER" && (
        <GameEndScreen
          status="victory"
          title={t("messages.victory")}
          subtitle={t("messages.victoryDesc")}
          score={score}
          xp={totalXpEarned}
          accuracy={potionRushAccuracy(usePotionRushStore.getState())}
          customStats={[
            {
              label: t("messages.customersServed"),
              value: completedSentences,
            },
          ]}
          restartButtonText={t("messages.openAgain")}
          onRestart={() => {
            enterFullscreen();
            startGame(roundSentences, difficulty);
          }}
          onExit={() => router.push("/")}
        />
      )}
    </div>
  );
}
