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
  Text,
  Image as KonvaImage,
  Group,
} from "react-konva";
import { MousePointer2, Shield, Trophy } from "lucide-react";
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
import { getCachedGameImage, loadGameImage } from "@/lib/games/gameAssetPreloader";

import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  GAME_TICK_MS,
  ANIMATION_FRAME_MS,
  buildTowerAtSlot,
  collectWords,
  createCastleDefenseState,
  advanceCastleDefenseTime,
  isSentenceComplete,
  CastleDefenseState,
  WORD_RADIUS,
  inRange,
  calculateCastleDefenseXP,
  updateProjectiles,
  updateTowers,
  type SentenceItem,
  type Enemy,
  type TowerSlot,
  type Word,
} from "@/lib/games/castleDefense";
import { BackgroundLayer } from "./BackgroundLayer";

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
  onComplete?: (results: {
    xp: number;
    score?: number;
    accuracy: number;
    correctAnswers?: number;
    totalAttempts?: number;
    difficulty: string;
    durationMs?: number;
  }) => void;
  autoStart?: boolean;
  tutorialMode?: boolean;
  onTutorialStepChange?: (step: number) => void;
};

const GAME_DURATION_MS = 60_000;
const MAX_ROUND_SENTENCES = 10;
const CASTLE_ASSET_PATHS = {
  player: "/games/sentence/castle-defense/player_3x3_pose_sheet.png",
  soldier: "/games/sentence/castle-defense/goblin_3x3_pose_sheet.png",
  tank: "/games/sentence/castle-defense/orc_3x3_pose_sheet.png",
  boss: "/games/sentence/castle-defense/troll_3x3_pose_sheet.png",
  towerBase: "/games/sentence/castle-defense/tower-base.png",
  towerBuilt: "/games/sentence/castle-defense/tower-built.png",
  base: "/games/sentence/castle-defense/player-castle.png",
};

const buildRoundSentences = (items: SentenceItem[]) =>
  [...items].sort(() => Math.random() - 0.5).slice(0, MAX_ROUND_SENTENCES);

const getCachedCastleAssets = (): GameAssets | null => {
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

type TutorialPointer = {
  x: number;
  y: number;
  label: string;
};

export function CastleDefenseGame({
  vocabulary,
  onComplete,
  autoStart = false,
  tutorialMode = false,
  onTutorialStepChange,
}: Props) {
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
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [hasStarted, setHasStarted] = useState(false);
  const [buildEffects, setBuildEffects] = useState<
    { id: string; x: number; y: number; createdAt: number }[]
  >([]);

  const [playerFrame, setPlayerFrame] = useState(0);
  const [enemyFrame, setEnemyFrame] = useState(0);
  const [tutorialPointer, setTutorialPointer] = useState<TutorialPointer | null>(null);
  const [tutorialDirection, setTutorialDirection] = useState({ dx: 0, walking: false });
  const [tutorialCycle, setTutorialCycle] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const previousTowerIds = useRef<string[]>([]);
  const lastFrameRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const animTimerRef = useRef<number>(0);
  const buildEffectsRef = useRef(buildEffects);
  const gameStateRef = useRef(gameState);
  const onCompleteRef = useRef(onComplete);
  const onTutorialStepChangeRef = useRef(onTutorialStepChange);
  const completedRef = useRef(false);
  const tutorialSceneRef = useRef<{ words: Word[]; slot: TowerSlot } | null>(null);
  const tutorialStartedRef = useRef(false);
  // Keep input in a ref so the game loop doesn't restart on every D-pad move
  const inputRef = useRef({ dx: 0, dy: 0, cast: false });
  const { enterFullscreen, exitFullscreen } = useGameFullscreen();
  const { getEffectiveTextSize } = useAccessibilitySettings();

  const { input, setVirtualInput, triggerCast, consumeCast } = useDirectionalInput();

  // Sync input into a ref so the game loop reads it without depending on it
  useEffect(() => {
    inputRef.current = { dx: input.dx, dy: input.dy, cast: !!input.cast };
  });

  // Keep buildEffects ref in sync
  useEffect(() => {
    buildEffectsRef.current = buildEffects;
  }, [buildEffects]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onTutorialStepChangeRef.current = onTutorialStepChange;
  }, [onTutorialStepChange]);

  useEffect(() => {
    if (tutorialMode) return;
    tutorialSceneRef.current = null;
    tutorialStartedRef.current = false;
    setTutorialPointer(null);
    setTutorialDirection({ dx: 0, walking: false });
    setTutorialCycle(0);
  }, [tutorialMode]);

  const handleBackToMenu = useCallback(() => {
    setHasStarted(false);
    setGameState(null);
    completedRef.current = false;
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
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
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

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

  // The regular game loop owns the camera during play. Tutorial mode is
  // intentionally paused, so keep the same responsive camera calculation in
  // a small separate effect while the scripted player moves around the map.
  useEffect(() => {
    if (!tutorialMode || !gameState || dimensions.width <= 0 || dimensions.height <= 0) return;

    const scaleX = dimensions.width / GAME_WIDTH;
    const scaleY = dimensions.height / GAME_HEIGHT;
    const scale = Math.max(scaleX, scaleY, 0.8);
    let x = dimensions.width / 2 - gameState.player.x * scale;
    let y = dimensions.height / 2 - gameState.player.y * scale;
    const minX = dimensions.width - GAME_WIDTH * scale;
    const minY = dimensions.height - GAME_HEIGHT * scale;

    x = minX > 0 ? (dimensions.width - GAME_WIDTH * scale) / 2 : Math.max(minX, Math.min(0, x));
    y = minY > 0 ? (dimensions.height - GAME_HEIGHT * scale) / 2 : Math.max(minY, Math.min(0, y));
    setCamera({ x, y, scale });
  }, [dimensions.height, dimensions.width, gameState, tutorialMode]);

  const startGame = useCallback(() => {
    completedRef.current = false;
    tutorialSceneRef.current = null;
    tutorialStartedRef.current = false;
    setTutorialPointer(null);
    setTutorialDirection({ dx: 0, walking: false });
    setTutorialCycle(0);
    setGameState(createCastleDefenseState(gameVocabulary, {
      difficulty,
      maxSentences: Math.min(MAX_ROUND_SENTENCES, gameVocabulary.length || 1),
      durationMs: GAME_DURATION_MS,
    }));
    setHasStarted(true);
    enterFullscreen();
  }, [gameVocabulary, difficulty, enterFullscreen]);

  useEffect(() => {
    if (!autoStart || hasStarted || gameVocabulary.length === 0) return;
    startGame();
  }, [autoStart, gameVocabulary.length, hasStarted, startGame]);

  // Tutorial mode uses a frozen, deterministic action script. It moves the
  // player to each real word orb, collects it through the same game logic, and
  // then builds a real tower. The normal RAF loop stays off while this runs so
  // the timer and enemies cannot interfere with the walkthrough.
  useEffect(() => {
    if (!tutorialMode || !hasStarted || !gameState || tutorialSceneRef.current) return;

    const words = gameState.words.filter((word) => !word.isCollected);
    const slot = gameState.towerSlots.find(
      (candidate) => !gameState.towers.some((tower) => tower.id === `tower-${candidate.id}`),
    );
    if (words.length === 0 || !slot) return;

    tutorialSceneRef.current = { words: [...words], slot };
  }, [gameState, hasStarted, tutorialMode]);

  useEffect(() => {
    if (
      !tutorialMode ||
      !hasStarted ||
      gameState?.status !== "playing" ||
      !tutorialSceneRef.current ||
      tutorialStartedRef.current
    ) {
      return;
    }

    const { words, slot } = tutorialSceneRef.current;
    tutorialStartedRef.current = true;
    let cancelled = false;

    const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    const setStep = (step: number) => onTutorialStepChangeRef.current?.(step);
    const movePointer = (pointer: TutorialPointer) => setTutorialPointer(pointer);
    let walkingFrame = 0;

    const walkTutorialPlayerTo = (target: { x: number; y: number }) => new Promise<void>((resolve) => {
      const current = gameStateRef.current?.player;
      if (!current) {
        resolve();
        return;
      }

      const start = { x: current.x, y: current.y };
      const distance = Math.hypot(target.x - start.x, target.y - start.y);
      const duration = Math.min(920, Math.max(420, distance * 1.55));
      const startedAt = performance.now();
      const direction = Math.sign(target.x - start.x);
      setTutorialDirection({ dx: direction, walking: true });

      const animate = (timestamp: number) => {
        if (cancelled) {
          resolve();
          return;
        }

        const progress = Math.min(1, (timestamp - startedAt) / duration);
        const easedProgress = 1 - (1 - progress) ** 2;
        setGameState((previous) => previous
          ? {
              ...previous,
              player: {
                ...previous.player,
                x: start.x + (target.x - start.x) * easedProgress,
                y: start.y + (target.y - start.y) * easedProgress,
              },
            }
          : previous);
        setPlayerFrame(Math.floor(timestamp / ANIMATION_FRAME_MS) % 3);

        if (progress < 1) {
          walkingFrame = window.requestAnimationFrame(animate);
        } else {
          setTutorialDirection({ dx: 0, walking: false });
          resolve();
        }
      };

      walkingFrame = window.requestAnimationFrame(animate);
    });

    const moveTutorialEnemyTo = (enemyId: string, target: { x: number; y: number }) => new Promise<void>((resolve) => {
      const current = gameStateRef.current?.enemies.find((enemy) => enemy.id === enemyId);
      if (!current) {
        resolve();
        return;
      }

      const start = { x: current.x, y: current.y };
      const distance = Math.hypot(target.x - start.x, target.y - start.y);
      const duration = Math.min(850, Math.max(420, distance * 1.4));
      const startedAt = performance.now();

      const animate = (timestamp: number) => {
        if (cancelled) {
          resolve();
          return;
        }

        const progress = Math.min(1, (timestamp - startedAt) / duration);
        const easedProgress = 1 - (1 - progress) ** 2;
        setGameState((previous) => previous
          ? {
              ...previous,
              enemies: previous.enemies.map((enemy) => enemy.id === enemyId
                ? {
                    ...enemy,
                    x: start.x + (target.x - start.x) * easedProgress,
                    y: start.y + (target.y - start.y) * easedProgress,
                  }
                : enemy),
            }
          : previous);
        setEnemyFrame(Math.floor(timestamp / ANIMATION_FRAME_MS) % 3);

        if (progress < 1) {
          walkingFrame = window.requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      walkingFrame = window.requestAnimationFrame(animate);
    });

    const demonstrateTowerAttack = () => new Promise<void>((resolve) => {
      let previousTimestamp = performance.now();
      let defeated = false;

      setGameState((previous) => {
        if (!previous) return previous;
        const towerUpdate = updateTowers(
          previous.towers,
          previous.enemies,
          previous.projectiles,
          previous.gameTime + 1000,
        );
        return {
          ...previous,
          towers: towerUpdate.towers,
          projectiles: towerUpdate.projectiles,
        };
      });

      const animate = (timestamp: number) => {
        if (cancelled) {
          resolve();
          return;
        }

        const delta = Math.min(50, Math.max(16, timestamp - previousTimestamp));
        previousTimestamp = timestamp;
        setGameState((previous) => {
          if (!previous) return previous;
          const projectileUpdate = updateProjectiles(previous.projectiles, previous.enemies, delta);
          if (projectileUpdate.hits.includes("tutorial-enemy")) defeated = true;
          return {
            ...previous,
            projectiles: projectileUpdate.projectiles,
            enemies: projectileUpdate.enemies,
          };
        });
        setEnemyFrame(Math.floor(timestamp / ANIMATION_FRAME_MS) % 3);

        if (defeated) {
          resolve();
        } else {
          walkingFrame = window.requestAnimationFrame(animate);
        }
      };

      walkingFrame = window.requestAnimationFrame(animate);
    });

    const collectTutorialWord = (wordId: string) => {
      setGameState((previous) => {
        if (!previous) return previous;
        const target = previous.words.find((word) => word.id === wordId);
        if (!target) return previous;

        const collection = collectWords(
          { ...previous.player, x: target.x, y: target.y },
          previous.words,
          previous.sentenceWords,
          previous.collectedWordIndices,
        );
        const sentenceCompleted = isSentenceComplete(
          collection.collectedWordIndices,
          previous.sentenceWords.length,
        );
        const completedSentences =
          sentenceCompleted && !previous.sentenceCompleted
            ? previous.completedSentences + 1
            : previous.completedSentences;

        return {
          ...previous,
          player: collection.player,
          words: collection.words,
          collectedWordIndices: collection.collectedWordIndices,
          sentenceCompleted,
          completedSentences,
          score: Math.min(10, completedSentences),
          correctWordCollections:
            previous.correctWordCollections + (collection.collectedWord && !collection.invalidCollection ? 1 : 0),
          incorrectWordCollections:
            previous.incorrectWordCollections + (collection.collectedWord && collection.invalidCollection ? 1 : 0),
        };
      });
    };

    const buildTutorialTower = () => {
      setGameState((previous) => {
        if (!previous) return previous;
        const positionedState = {
          ...previous,
          player: { ...previous.player, x: slot.x, y: slot.y },
          sentenceCompleted: true,
        };
        return buildTowerAtSlot(positionedState, slot.id, gameVocabulary);
      });
    };

    const run = async () => {
      setStep(0);
      movePointer({ x: GAME_WIDTH / 2, y: 112, label: "อ่านคำแปลก่อน" });
      await wait(1500);
      if (cancelled) return;

      setStep(1);
      for (const word of words) {
        movePointer({ x: word.x, y: word.y, label: `เก็บ “${word.term}”` });
        await walkTutorialPlayerTo(word);
        if (cancelled) return;
        collectTutorialWord(word.id);
        await wait(260);
        if (cancelled) return;
      }

      setStep(2);
      movePointer({ x: slot.x, y: slot.y, label: "สร้างป้อมตรงจุดนี้" });
      await walkTutorialPlayerTo(slot);
      if (cancelled) return;
      buildTutorialTower();
      await wait(500);
      if (cancelled) return;

      setStep(3);
      movePointer({ x: 725, y: 75, label: "ป้อมพร้อมป้องกันปราสาท" });
      await walkTutorialPlayerTo({ x: 725, y: 75 });
      if (cancelled) return;

      const enemyFromLeft = slot.x < GAME_WIDTH / 2;
      const enemyStartX = enemyFromLeft
        ? Math.min(GAME_WIDTH - 40, slot.x + 230)
        : Math.max(40, slot.x - 230);
      const enemyTargetX = enemyFromLeft ? slot.x + 105 : slot.x - 105;
      const tutorialEnemy: Enemy = {
        id: "tutorial-enemy",
        x: enemyStartX,
        y: slot.y,
        radius: 12,
        type: "soldier",
        hp: 10,
        maxHp: 10,
        speed: 0.8,
        waypointIndex: 0,
      };

      setGameState((previous) => previous
        ? { ...previous, enemies: [tutorialEnemy], projectiles: [] }
        : previous);
      movePointer({ x: enemyStartX, y: slot.y, label: "ศัตรูกำลังเข้ามา" });
      await wait(400);
      if (cancelled) return;

      await moveTutorialEnemyTo(tutorialEnemy.id, { x: enemyTargetX, y: slot.y });
      if (cancelled) return;
      movePointer({ x: enemyTargetX, y: slot.y, label: "ศัตรูเข้าระยะป้อมแล้ว" });
      await wait(350);
      if (cancelled) return;

      movePointer({ x: enemyTargetX, y: slot.y, label: "ป้อมล็อกเป้าและยิงอัตโนมัติ" });
      await demonstrateTowerAttack();
      if (cancelled) return;
      movePointer({ x: enemyTargetX, y: slot.y, label: "ศัตรูถูกกำจัด ✓" });
      await wait(900);
      if (cancelled) return;

      // Keep the teaching scene looping so the teacher can leave it running
      // while explaining. Reset the real game state before the next pass.
      setStep(0);
      setTutorialPointer(null);
      setTutorialDirection({ dx: 0, walking: false });
      tutorialSceneRef.current = null;
      tutorialStartedRef.current = false;
      setGameState(createCastleDefenseState(gameVocabulary, {
        difficulty,
        maxSentences: Math.min(MAX_ROUND_SENTENCES, gameVocabulary.length || 1),
        durationMs: GAME_DURATION_MS,
      }));
      setTutorialCycle((cycle) => cycle + 1);
    };

    void run();
    return () => {
      cancelled = true;
      if (walkingFrame) window.cancelAnimationFrame(walkingFrame);
    };
  }, [gameState?.status, gameVocabulary, hasStarted, tutorialCycle, tutorialMode]);

  // Game loop with requestAnimationFrame
  useEffect(() => {
    if (tutorialMode || !gameState || gameState.status !== "playing" || !assets || !hasStarted) {
      return;
    }

    const loop = (timestamp: number) => {
      const delta = lastFrameRef.current ? timestamp - lastFrameRef.current : GAME_TICK_MS;
      lastFrameRef.current = timestamp;
      const clampedDelta = Math.min(delta, 50);

      setGameState((prevState) => {
        if (!prevState || prevState.status !== "playing") return prevState;

        const currentInput = inputRef.current;
        const nextState = advanceCastleDefenseTime(
          prevState,
          clampedDelta,
          { dx: currentInput.dx, dy: currentInput.dy, drop: currentInput.cast },
          gameVocabulary,
        );

        // Update camera
        if (dimensions.width > 0 && dimensions.height > 0) {
          const scaleX = dimensions.width / GAME_WIDTH;
          const scaleY = dimensions.height / GAME_HEIGHT;
          const scale = Math.max(scaleX, scaleY, 0.8);

          let camX = dimensions.width / 2 - nextState.player.x * scale;
          let camY = dimensions.height / 2 - nextState.player.y * scale;

          const minX = dimensions.width - GAME_WIDTH * scale;
          const minY = dimensions.height - GAME_HEIGHT * scale;

          if (minX > 0) camX = (dimensions.width - GAME_WIDTH * scale) / 2;
          else camX = Math.max(minX, Math.min(0, camX));

          if (minY > 0) camY = (dimensions.height - GAME_HEIGHT * scale) / 2;
          else camY = Math.max(minY, Math.min(0, camY));

          setCamera({ x: camX, y: camY, scale });
        }

        // Animation frames
        animTimerRef.current += clampedDelta;
        if (animTimerRef.current >= ANIMATION_FRAME_MS) {
          animTimerRef.current = 0;
          setPlayerFrame((f) => (f + 1) % 3);
          setEnemyFrame((f) => (f + 1) % 3);
        }

        // Build effects cleanup
        setBuildEffects((prev) =>
          prev.filter((effect) => Date.now() - effect.createdAt < 600),
        );

        // Handle game end
        if (
          (nextState.status === "gameover" || nextState.status === "victory") &&
          onCompleteRef.current &&
          !completedRef.current
        ) {
          completedRef.current = true;
          const totalAttempts =
            nextState.correctWordCollections +
            nextState.incorrectWordCollections;
          const accuracy =
            totalAttempts > 0
              ? nextState.correctWordCollections / totalAttempts
              : 0;
          onCompleteRef.current({
            xp: calculateCastleDefenseXP(nextState),
            score: nextState.score,
            accuracy,
            correctAnswers: nextState.completedSentences,
            totalAttempts: nextState.maxSentences,
            difficulty: nextState.difficulty,
            durationMs: Math.min(GAME_DURATION_MS, Math.max(0, nextState.gameTime)),
          });
          if (autoStart || tutorialMode) {
            completedRef.current = false;
            return createCastleDefenseState(gameVocabulary, {
              difficulty,
              maxSentences: Math.min(MAX_ROUND_SENTENCES, gameVocabulary.length || 1),
              durationMs: GAME_DURATION_MS,
            });
          }
          exitFullscreen();
        }

        if (inputRef.current.cast) {
          consumeCast();
        }

        return nextState;
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.status, assets, hasStarted, gameVocabulary, dimensions.width, dimensions.height, consumeCast, exitFullscreen, tutorialMode]);

  const grids = useMemo(() => {
    if (!assets) return null;
    return {
      player: buildSpriteGrid(assets.player.width, assets.player.height),
      soldier: buildSpriteGrid(assets.soldier.width, assets.soldier.height),
      tank: buildSpriteGrid(assets.tank.width, assets.tank.height),
      boss: buildSpriteGrid(assets.boss.width, assets.boss.height),
    };
  }, [assets]);

  const activeBuildSlot = useMemo(() => {
    if (!gameState || !gameState.sentenceCompleted) return null;
    return gameState.towerSlots.find((slot) => {
      const hasTower = gameState.towers.some(
        (tower) => tower.id === `tower-${slot.id}`,
      );
      if (hasTower) return false;
      return inRange(
        gameState.player.x,
        gameState.player.y,
        slot.x,
        slot.y,
        50,
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.sentenceCompleted, gameState?.towerSlots, gameState?.towers, gameState?.player.x, gameState?.player.y]);

  if (!assets) {
    if (autoStart) {
      return <div className="h-dvh w-screen bg-slate-950" />;
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
      return <div className="h-dvh w-screen bg-slate-950" />;
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
              title="Leaderboard"
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

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden bg-slate-900 touch-none select-none h-dvh w-screen rounded-none"
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
                      radius={TILE_SIZE * 0.6}
                      stroke={
                        activeBuildSlot?.id === slot.id
                          ? "#22c55e"
                          : "rgba(250, 204, 21, 0.9)"
                      }
                      strokeWidth={activeBuildSlot?.id === slot.id ? 4 : 2}
                      dash={activeBuildSlot?.id === slot.id ? [6, 4] : [4, 6]}
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
                    y={enemy.y - size / 2 - 10}
                    width={30}
                    height={4}
                    fill="#333"
                    cornerRadius={2}
                  />
                  <Rect
                    x={enemy.x - 15}
                    y={enemy.y - size / 2 - 10}
                    width={30 * (enemy.hp / enemy.maxHp)}
                    height={4}
                    fill={enemy.hp > enemy.maxHp * 0.5 ? "#22c55e" : "#ef4444"}
                    cornerRadius={2}
                  />
                </Group>
              );
            })}

            {gameState.words
              .filter((w) => !w.isCollected)
              .map((word) => (
                <Group key={word.term + word.x} x={word.x} y={word.y}>
                  <Circle
                    radius={WORD_RADIUS}
                    fill="white"
                    stroke="#111"
                    strokeWidth={2}
                  />
                  <Text
                    text={word.translation}
                    fontSize={getEffectiveTextSize(Math.max(12, Math.min(18, Math.floor((word.radius * 1.45) / Math.max(word.translation.length, 1)) * 2)))}
                    fontStyle="bold"
                    fill="black"
                    offsetX={word.radius}
                    offsetY={word.radius}
                    width={word.radius * 2}
                    height={word.radius * 2}
                    align="center"
                    verticalAlign="middle"
                    wrap="none"
                    ellipsis
                  />
                </Group>
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
                  tutorialDirection.walking || input.dx !== 0 || input.dy !== 0 ? 1 : 0,
                )}
                scaleX={tutorialDirection.walking ? (tutorialDirection.dx < 0 ? -1 : 1) : input.dx < 0 ? -1 : 1}
              />
            )}
          </Layer>
        </Stage>
      )}

      {gameState && (
        <div className="absolute top-[max(0.5rem,env(safe-area-inset-top))] inset-x-0 z-20 pointer-events-none flex flex-col items-center gap-1.5 px-3">

          {/* Top status bar: Score | Timer | Castle HP */}
          <div className="flex w-full items-center justify-between gap-2">
            {/* Score */}
            <div className="flex flex-col items-center bg-slate-950/80 border border-white/10 px-2.5 py-1 rounded-xl shadow-lg backdrop-blur min-w-[52px]">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">{t("hud.score")}</span>
              <span className="text-sm font-black text-white leading-tight">{gameState.score}</span>
            </div>

            {/* Center: Timer + Sentences */}
            <div className="flex items-center gap-1.5">
              <div className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] font-black text-white shadow-lg backdrop-blur">
                ⏱ {Math.max(0, Math.ceil((gameState.durationMs - gameState.gameTime) / 1000))}s
              </div>
              <div className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] font-black text-white shadow-lg backdrop-blur">
                {gameState.completedSentences}/{gameState.maxSentences}
              </div>
            </div>

            {/* Castle HP */}
            <div className="flex flex-col items-center bg-slate-950/80 border border-white/10 px-2.5 py-1 rounded-xl shadow-lg backdrop-blur min-w-[52px]">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">{t("hud.castleHp")}</span>
              <span className="text-sm font-black text-rose-400 leading-tight">{gameState.base.hp}</span>
              <div className="w-10 h-1 bg-slate-700 rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full bg-rose-500 transition-all duration-300"
                  style={{ width: `${((gameState.base.hp || 0) / (gameState.base.maxHp || 100)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Wave info */}
          <div className="bg-slate-950/70 border border-white/10 px-3 py-0.5 rounded-full shadow-lg text-white text-[10px] font-bold uppercase tracking-widest">
            {t("hud.wave", {
              current: gameState.wave,
              killed: gameState.enemiesKilledThisWave,
              total: gameState.totalEnemiesThisWave,
            })}
          </div>

          {/* Thai sentence prompt */}
          {gameState.currentSentenceThai && (
            <div className="bg-blue-900/90 border border-blue-400/40 px-3 py-1.5 rounded-2xl shadow-xl backdrop-blur-md w-full">
              <div className="text-white text-sm font-black text-center leading-snug" style={{ fontSize: getEffectiveTextSize(15) }}>
                {gameState.currentSentenceThai}
              </div>
            </div>
          )}

          {/* Progress (blank slots) */}
          <div className="bg-slate-950/70 border border-white/10 px-3 py-1 rounded-xl shadow-lg backdrop-blur-md text-center w-full">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-0.5">
              {t("hud.progress")}
            </span>
            <div className="text-xs font-semibold text-white">
              {gameState.sentenceWords.map((word, idx) => (
                <span
                  key={`${word}-${idx}`}
                  className={
                    gameState.collectedWordIndices.includes(idx)
                      ? "text-emerald-300"
                      : "text-slate-400"
                  }
                >
                  {gameState.collectedWordIndices.includes(idx) ? word : "___"}{" "}
                </span>
              ))}
            </div>
          </div>

          {/* Sentence complete badge */}
          {gameState.sentenceCompleted && (
            <div className="bg-emerald-600/90 border border-emerald-300/60 px-3 py-0.5 rounded-full shadow-lg text-white text-[10px] font-black uppercase tracking-widest">
              {t("messages.sentenceComplete")}
            </div>
          )}
        </div>
      )}

      {tutorialMode && tutorialPointer && dimensions.width > 0 && dimensions.height > 0 && (
        <div
          className="pointer-events-none absolute inset-0 z-[25] overflow-hidden bg-slate-950/25"
          aria-hidden="true"
        >
          <div
            className="absolute flex flex-col items-center gap-1 transition-[left,top] duration-1000 ease-in-out"
            style={{
              left: camera.x + tutorialPointer.x * camera.scale,
              top: camera.y + tutorialPointer.y * camera.scale,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="relative flex size-20 items-center justify-center rounded-full border-2 border-violet-300 bg-violet-400/10 shadow-[0_0_0_10px_rgba(167,139,250,0.16),0_0_40px_rgba(167,139,250,0.8)] animate-pulse">
              <div className="flex size-11 items-center justify-center rounded-full bg-slate-950/90 text-violet-200 shadow-xl">
                <MousePointer2 size={25} fill="currentColor" />
              </div>
            </div>
            <span className="whitespace-nowrap rounded-full border border-violet-200/60 bg-slate-950/95 px-3 py-1 text-xs font-black text-white shadow-2xl">
              {tutorialPointer.label}
            </span>
          </div>
        </div>
      )}

      {tutorialMode && (
        <div className="pointer-events-none absolute right-3 top-[max(0.5rem,env(safe-area-inset-top))] z-30 rounded-full border border-violet-300/50 bg-slate-950/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-violet-200 shadow-xl backdrop-blur-md">
          ⏸ หยุดเวลา · สาธิตอัตโนมัติ
        </div>
      )}

      {/* Score and Castle HP are now rendered in the top HUD bar above */}

      {activeBuildSlot && (
        <div className="absolute bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-emerald-600/90 border border-emerald-300/60 px-4 md:px-5 py-1.5 md:py-2 rounded-full shadow-lg text-white font-black uppercase tracking-widest text-[10px] md:text-xs" style={{ fontSize: getEffectiveTextSize(16) }}>
            {t("hud.buildTower")}
          </div>
        </div>
      )}

      {gameState?.waveMessage && (
        <div className="absolute top-[30%] md:top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-amber-500/90 border border-amber-200/60 px-5 md:px-6 py-1.5 md:py-2 rounded-full shadow-xl text-white font-black uppercase tracking-widest text-[10px] md:text-xs" style={{ fontSize: getEffectiveTextSize(16) }}>
            {gameState.waveMessage}
          </div>
        </div>
      )}

      {!tutorialMode && (
        <>
          <div
            className="absolute bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-1/2 z-30 -translate-x-1/2 scale-90 pointer-events-auto md:scale-100"
            data-testid="virtual-dpad"
          >
            <VirtualDPad onInput={setVirtualInput} />
          </div>

          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              triggerCast();
            }}
            className="absolute bottom-[calc(env(safe-area-inset-bottom)+2.25rem)] right-5 z-30 flex size-16 items-center justify-center rounded-full border-2 border-emerald-300/60 bg-emerald-500 text-xs font-black text-white shadow-2xl shadow-emerald-950/40 active:scale-95 md:bottom-8 md:right-8 md:size-20 md:text-sm"
          >
            {t("controls.build")}
          </button>
        </>
      )}
    </div>
  );
}
