import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage } from "react-konva";
import { usePotionRushStore, SentenceItem } from "@/store/usePotionRushStore";
import { withBasePath } from "@/lib/games/basePath";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { useRouter } from "next/navigation";
import { Beaker } from "lucide-react";
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

export interface PotionRushGameResult {
  xp: number;
  accuracy: number;
  difficulty: "easy" | "normal" | "hard" | "extreme";
  score: number;
}

interface PotionRushGameProps {
  vocabList: SentenceItem[];
  difficulty: "easy" | "normal" | "hard" | "extreme";
  onComplete: (results: PotionRushGameResult) => void;
}

export default function PotionRushGame({
  vocabList,
  difficulty,
  onComplete,
}: PotionRushGameProps) {
  const t = useScopedI18n("pages.student.gamesPage.potionRush");
  const router = useRouter();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const { containerRef: fsContainerRef, enterFullscreen, exitFullscreen } = useGameFullscreen();
  useAccessibilitySettings(); // Verify hook is integrated

  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});

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

  const controls = useAnimation();
  const prevReputation = useRef(reputation);

  useEffect(() => {
    if (reputation < prevReputation.current) {
      controls.start("damage");
    }
    prevReputation.current = reputation;
  }, [reputation, controls]);

  useEffect(() => {
    if (gameState === "GAME_OVER") {
      exitFullscreen();
      onComplete({
        xp: totalXpEarned,
        accuracy: Math.max(0, Math.min(reputation, 100)) / 100,
        difficulty: difficulty,
        score: score,
      });
    }
  }, [gameState, totalXpEarned, reputation, difficulty, score, onComplete, exitFullscreen]);

  // Mobile-first portrait reference: 390x844
  const VIRTUAL_WIDTH = 390;
  const VIRTUAL_HEIGHT = 844;

  const scaleX = dimensions.width / VIRTUAL_WIDTH;
  const scaleY = dimensions.height / VIRTUAL_HEIGHT;
  const scale = Math.min(scaleX, scaleY);

  const stageX = (dimensions.width - VIRTUAL_WIDTH * scale) / 2;
  const stageY = (dimensions.height - VIRTUAL_HEIGHT * scale) / 2;

  const LAYOUT = {
    wallH: 320,
    floorH: 320,
    counterY: 200,
    customerY: 201,
    cauldronY: 300,
    beltY: 560,
    trashX: 195,
    trashY: 440,
    isPortrait: true,
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
      tick(clampedDelta / 1000, VIRTUAL_WIDTH);
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

  if (dimensions.width === 0)
    return <div ref={containerRef} className="w-full h-full" />;

  return (
    <div ref={(node) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      (fsContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }} className="w-full h-full relative font-sans">
      <PotionRushSoundController />

      <AnimatePresence>
        {!hasStarted && (
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
        <div className="absolute top-0 left-0 w-full p-2 sm:p-4 text-white z-10 pointer-events-none flex justify-between items-start">
          <div>
            <div className="text-base sm:text-xl font-bold text-amber-400 drop-shadow-lg">
              {t("hud.score")}: {score}
            </div>
            <div className="text-xs sm:text-sm text-slate-300 drop-shadow-md">
              {t("hud.reputation")}: {Math.max(0, Math.round(reputation))}%
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-white drop-shadow-lg bg-black/30 px-2 sm:px-4 py-1 rounded-full">
            {t("hud.served")}: {completedSentences}
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

            <CustomerQueue y={LAYOUT.customerY} width={VIRTUAL_WIDTH} />

            {images.counter && (
              <KonvaImage
                image={images.counter}
                y={LAYOUT.counterY}
                width={VIRTUAL_WIDTH}
                height={160}
              />
            )}

            <CauldronStation
              y={LAYOUT.cauldronY}
              width={VIRTUAL_WIDTH}
              layout={LAYOUT}
            />

            <TrashPortal x={LAYOUT.trashX} y={LAYOUT.trashY} />

            <ConveyorBelt
              y={LAYOUT.beltY}
              width={VIRTUAL_WIDTH}
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
        <GameEndScreen
          status={reputation <= 0 ? "defeat" : "victory"}
          title={reputation <= 0 ? t("messages.defeat") : t("messages.victory")}
          subtitle={
            reputation <= 0
              ? t("messages.defeatDesc")
              : t("messages.victoryDesc")
          }
          score={score}
          xp={totalXpEarned}
          accuracy={Math.max(0, Math.min(reputation, 100)) / 100}
          customStats={[
            {
              label: t("messages.customersServed"),
              value: completedSentences,
            },
          ]}
          restartButtonText={t("messages.openAgain")}
          onRestart={() => {
            enterFullscreen();
            startGame(vocabList, difficulty);
          }}
          onExit={() => router.push("/")}
        />
      )}
    </div>
  );
}
