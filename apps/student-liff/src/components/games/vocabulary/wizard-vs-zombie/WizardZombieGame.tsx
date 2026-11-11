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
  Circle,
  Image as KonvaImage,
} from "react-konva";
import {
  Difficulty,
  GAME_HEIGHT,
  GAME_WIDTH,
  ROUND_DURATION_MS as GAME_DURATION_MS,
  SHOCKWAVE_RADIUS,
  WizardZombieRoundEnd,
  WizardZombieRoundReview,
  WizardZombieState,
  advanceWizardZombieTime,
  buildRoundReview,
  createWizardZombieState,
  uniqueWords,
} from "@/lib/games/wizardZombie";
import {
  ORB_LABEL_FONT,
  OrbLabel,
  chooseArena,
  computePlayRect,
  fitCamera,
  isPortraitViewport,
  layoutOrbLabel,
  worldToScreen,
} from "@/lib/games/wizardZombieLayout";
import type { VocabularyItem } from "@/store/useGameStore";
import { playGameSound, useSound } from "@/hooks/useSound";
import { useInterval } from "@/hooks/useInterval";
import { useDirectionalInput } from "@/hooks/useDirectionalInput";
import { useAccessibilitySettings } from "@/hooks/useAccessibilitySettings";
import { useAdaptiveDifficulty } from "@/hooks/useAdaptiveDifficulty";
import { registerDifficultyParams } from "@/lib/adaptive-difficulty/registerDifficultyParams";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { VirtualDPad } from "@/components/ui/VirtualDPad";
import { getCachedGameImage, loadGameImage } from "@/lib/games/gameAssetPreloader";
import { createRoundClock, splitFrameTime } from "@/lib/games/roundClock";
import { GameAssetLoadFailure } from "@/components/games/GameAssetLoadFailure";
import { GameStartScreen } from "@/components/games/game/GameStartScreen";
import { useGameFullscreen } from "@/hooks/useGameFullscreen";
import {
  Heart,
  Shield,
  Zap,
  Sword,
} from "lucide-react";
import { useScopedI18n } from "@/locales/client";
import { tx } from "@/lib/games/gameText";

export type WizardZombieGameResult = {
  accuracy: number;
  /** Words found on the first try: the only thing that earns points. */
  correctAnswers: number;
  /** Words in the round, so the tutor reads x out of the word count. */
  totalAttempts: number;
  difficulty: Difficulty;
  durationMs?: number;
  /** For the student's own result card. Never sent to the server. */
  review?: WizardZombieRoundReview;
};

/** What the canvas draws for a moment after something happens. All times in ms. */
type FloatingText = {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  ageMs: number;
};
type Poof = { id: number; x: number; y: number; ageMs: number };
type Effects = {
  floats: FloatingText[];
  poofs: Poof[];
  ringAgeMs: number | null;
  flashMs: number;
  shakeMs: number;
  shakeX: number;
  shakeY: number;
};

const NO_EFFECTS: Effects = { floats: [], poofs: [], ringAgeMs: null, flashMs: 0, shakeMs: 0, shakeX: 0, shakeY: 0 };
const FLOAT_LIFE_MS = 900;
const POOF_LIFE_MS = 420;
const RING_LIFE_MS = 420;
const FLASH_LIFE_MS = 280;
const SHAKE_LIFE_MS = 240;
const SHAKE_PX = 8;

function ageEffects(fx: Effects, ms: number): Effects {
  if (fx === NO_EFFECTS) return fx;
  const floats = fx.floats.map((f) => ({ ...f, ageMs: f.ageMs + ms })).filter((f) => f.ageMs < FLOAT_LIFE_MS);
  const poofs = fx.poofs.map((p) => ({ ...p, ageMs: p.ageMs + ms })).filter((p) => p.ageMs < POOF_LIFE_MS);
  const ringAgeMs = fx.ringAgeMs === null || fx.ringAgeMs + ms >= RING_LIFE_MS ? null : fx.ringAgeMs + ms;
  const flashMs = Math.max(0, fx.flashMs - ms);
  const shakeMs = Math.max(0, fx.shakeMs - ms);
  if (!floats.length && !poofs.length && ringAgeMs === null && flashMs === 0 && shakeMs === 0) return NO_EFFECTS;
  const reach = (shakeMs / SHAKE_LIFE_MS) * SHAKE_PX;
  return {
    floats,
    poofs,
    ringAgeMs,
    flashMs,
    shakeMs,
    shakeX: shakeMs ? (Math.random() - 0.5) * reach : 0,
    shakeY: shakeMs ? (Math.random() - 0.5) * reach : 0,
  };
}

type Toast = { text: string; detail?: string; tone: "right" | "retry" };

interface WizardZombieGameProps {
  vocabulary: VocabularyItem[];
  onComplete: (results: WizardZombieGameResult) => void;
  adaptive?: boolean;
  autoStart?: boolean;
  tutorialMode?: boolean;
}

const MAX_ROUND_WORDS = 10;
const TOAST_MS = 1_100;
const CAST_HINT_MS = 1_500;
const WIZARD_ASSET_PATHS = {
  player: "/games/vocabulary/wizard-vs-zombie/player_3x3_pose_sheet.webp",
  zombie: "/games/vocabulary/wizard-vs-zombie/zombie_3x3_pose_sheet.webp",
  orb: "/games/vocabulary/wizard-vs-zombie/orb_3x3_pose_sheet.webp",
  floor: "/games/vocabulary/wizard-vs-zombie/tile-ruins.webp",
};

const buildRoundVocabulary = (items: VocabularyItem[]) =>
  uniqueWords(items)
    .map((item) => ({ item, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ item }) => item)
    .slice(0, MAX_ROUND_WORDS);

const getCachedWizardAssets = () => {
  const player = getCachedGameImage(WIZARD_ASSET_PATHS.player);
  const zombie = getCachedGameImage(WIZARD_ASSET_PATHS.zombie);
  const orb = getCachedGameImage(WIZARD_ASSET_PATHS.orb);
  const floor = getCachedGameImage(WIZARD_ASSET_PATHS.floor);
  return player && zombie && orb && floor ? { player, zombie, orb, floor } : null;
};

// Sprite Helper
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

/** The phone's home-bar height: CSS knows it, script has to measure it. */
function readSafeBottom(host: HTMLElement | null): number {
  if (!host) return 0;
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;width:0;height:env(safe-area-inset-bottom,0px)";
  host.appendChild(probe);
  const height = probe.getBoundingClientRect().height;
  host.removeChild(probe);
  return height;
}

const termFontClass = (term: string) => {
  if (term.length > 30) return "text-sm";
  if (term.length > 18) return "text-base";
  return "text-xl";
};

const NO_LABELS = new Map<string, OrbLabel>();

export function WizardZombieGame({
  vocabulary,
  onComplete,
  adaptive = false,
  autoStart = false,
  tutorialMode = false,
}: WizardZombieGameProps) {
  const t = useScopedI18n("pages.student.gamesPage");
  useSound(); // unlocks audio on the first tap
  const { input, setVirtualInput, consumeCast } = useDirectionalInput();
  const { getEffectiveTouchTarget, getEffectiveTextSize } =
    useAccessibilitySettings();
  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen();
  const gameVocabulary = useMemo(() => buildRoundVocabulary(vocabulary), [vocabulary]);

  const [gamePhase, setGamePhase] = useState<"start" | "playing" | "ended">(
    autoStart ? "playing" : "start",
  );
  const selectedDifficulty: Difficulty = "medium";

  // The game loop owns the live state in this ref. React state only follows it
  // for drawing: a loop that read back React state could run a stale copy again.
  const gameStateRef = useRef<WizardZombieState | null>(null);
  const [gameState, setGameState] = useState<WizardZombieState | null>(null);
  const commitState = useCallback((state: WizardZombieState | null) => {
    gameStateRef.current = state;
    setGameState(state);
  }, []);
  const completedRef = useRef(false);
  // The round's real deadline. It outlives the loop effect, so restarting the
  // effect can never give a child extra time.
  const roundEndsAtRef = useRef<number | null>(null);
  const [tutorialStep, setTutorialStep] = useState(0);
  const tutorialPreparedRef = useRef(false);
  const tutorialCastRef = useRef(false);

  // Register adaptive difficulty params for wizard-vs-zombie
  useMemo(() => {
    const difficultyModifiers = {
      easy: { speed: 0.8, spawnRate: 1.2 },
      medium: { speed: 1.0, spawnRate: 1.0 },
      hard: { speed: 1.2, spawnRate: 0.8 },
    };
    const modifiers = difficultyModifiers[selectedDifficulty] || difficultyModifiers.medium;
    registerDifficultyParams('wizard-vs-zombie', {
      zombieSpeed: { current: modifiers.speed, min: 0.5, max: 2.0, default: 1.0, step: 0.1 },
      spawnRate: { current: modifiers.spawnRate, min: 0.4, max: 1.5, default: 1.0, step: 0.1 },
    });
  }, [selectedDifficulty]);

  const { recordResponse: recordAdaptiveResponse } = useAdaptiveDifficulty({
    gameId: 'wizard-vs-zombie',
    adaptive,
  });
  const recordAdaptiveRef = useRef(recordAdaptiveResponse);
  recordAdaptiveRef.current = recordAdaptiveResponse;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const dpadSize = getEffectiveTouchTarget(136);
  const castButtonSize = getEffectiveTouchTarget(82);
  const textScale = getEffectiveTextSize(16); // base font size in pixels

  const [assets, setAssets] = useState<{
    player: HTMLImageElement;
    zombie: HTMLImageElement;
    orb: HTMLImageElement;
    floor: HTMLImageElement;
  } | null>(() => getCachedWizardAssets());
  const [assetLoadFailed, setAssetLoadFailed] = useState(false);
  const [assetLoadAttempt, setAssetLoadAttempt] = useState(0);

  const dimensions = useGameDimensions(containerRef);
  const [safeBottom, setSafeBottom] = useState(0);
  const controls = useMemo(() => ({ stick: dpadSize, safeBottom }), [dpadSize, safeBottom]);
  const playRect = useMemo(() => computePlayRect(dimensions, controls), [dimensions, controls]);
  const arena = gameState?.arena;
  const camera = useMemo(
    () => (arena && dimensions.width > 0 ? fitCamera(arena, playRect) : { x: 0, y: 0, scale: 1 }),
    [arena, dimensions.width, playRect],
  );
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const isPortrait = isPortraitViewport(dimensions);
  const playRectRef = useRef(playRect);
  playRectRef.current = playRect;

  const [animFrame, setAnimFrame] = useState(0);
  const [timeLeftS, setTimeLeftS] = useState(Math.ceil(GAME_DURATION_MS / 1000));

  const [effects, setEffects] = useState<Effects>(NO_EFFECTS);
  const effectsRef = useRef(effects);
  const nextEffectId = useRef(1);
  const [toast, setToast] = useState<Toast | null>(null);
  const [castHint, setCastHint] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const castHintTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => {
    window.clearTimeout(toastTimer.current);
    window.clearTimeout(castHintTimer.current);
  }, []);

  const inputRef = useRef(input);
  useEffect(() => { inputRef.current = input; }, [input]);

  // One tap is one cast: the loop takes this flag exactly once.
  const castQueuedRef = useRef(false);
  useEffect(() => {
    if (!input.cast) return;
    castQueuedRef.current = true;
    consumeCast();
  }, [input.cast, consumeCast]);

  // Asset Loading
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [player, zombie, orb, floor] = await Promise.all([
          loadGameImage(WIZARD_ASSET_PATHS.player),
          loadGameImage(WIZARD_ASSET_PATHS.zombie),
          loadGameImage(WIZARD_ASSET_PATHS.orb),
          loadGameImage(WIZARD_ASSET_PATHS.floor),
        ]);
        if (mounted) setAssets({ player, zombie, orb, floor });
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
    onCompleteRef.current({
      accuracy: 0,
      correctAnswers: 0,
      totalAttempts: Math.max(gameVocabulary.length, 1),
      difficulty: selectedDifficulty,
      durationMs: 0,
    });
  }, [gameVocabulary.length, selectedDifficulty]);

  const startGame = useCallback(() => {
    if (gameVocabulary.length === 0) return;
    completedRef.current = false;
    roundEndsAtRef.current = null;
    commitState(null);
    effectsRef.current = NO_EFFECTS;
    setEffects(NO_EFFECTS);
    setGamePhase("playing");
  }, [commitState, gameVocabulary.length]);

  const finishRound = useCallback((reason: WizardZombieRoundEnd, durationMs: number) => {
    const state = gameStateRef.current;
    if (completedRef.current || !state) return;
    completedRef.current = true;
    setGamePhase("ended");
    const totalWords = Math.max(gameVocabulary.length, 1);
    const correctWords = Math.min(state.correctAnswers, totalWords);
    onCompleteRef.current({
      accuracy: correctWords / totalWords,
      correctAnswers: correctWords,
      totalAttempts: totalWords,
      difficulty: selectedDifficulty,
      durationMs: Math.min(durationMs, GAME_DURATION_MS),
      review: buildRoundReview(state, gameVocabulary, reason),
    });
  }, [gameVocabulary, selectedDifficulty]);

  // A round starts once the images are in and the game screen has its real size,
  // so the arena fits the phone and a slow download costs no play time.
  useEffect(() => {
    if (gamePhase !== "playing" || !assets || gameStateRef.current || gameVocabulary.length === 0) return;
    const host = containerRef.current;
    const box = host?.getBoundingClientRect();
    const measuredSafeBottom = readSafeBottom(host);
    setSafeBottom(measuredSafeBottom);
    const roundArena = box && box.width > 0 && box.height > 0
      ? chooseArena(box, { stick: dpadSize, safeBottom: measuredSafeBottom })
      : { width: GAME_WIDTH, height: GAME_HEIGHT };
    commitState(createWizardZombieState(gameVocabulary, { difficulty: selectedDifficulty, arena: roundArena }));
  }, [assets, commitState, containerRef, dpadSize, gamePhase, gameVocabulary, selectedDifficulty]);

  // The tutorial's fixed walk: the wizard on the left, the right orb straight ahead.
  const prepareTutorialRound = useCallback((state: WizardZombieState): WizardZombieState => {
    const orbAt = { x: state.arena.width * 0.75, y: state.arena.height * 0.5 };
    return {
      ...state,
      player: { ...state.player, x: state.arena.width * 0.25, y: state.arena.height * 0.5 },
      orbs: state.orbs
        .map((orb) => orb.isCorrect ? { ...orb, ...orbAt } : orb)
        .filter((orb) => orb.isCorrect || Math.hypot(orb.x - orbAt.x, orb.y - orbAt.y) > 130),
    };
  }, []);

  const hasRound = gameState !== null;

  useEffect(() => {
    if (!tutorialMode || gamePhase !== "playing" || !hasRound || tutorialPreparedRef.current) return;
    tutorialPreparedRef.current = true;
    setTutorialStep(0);
    const current = gameStateRef.current;
    if (current) commitState(prepareTutorialRound(current));
  }, [commitState, gamePhase, hasRound, prepareTutorialRound, tutorialMode]);

  useEffect(() => {
    if (!tutorialMode || gamePhase !== "playing") return;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const state = gameStateRef.current;
      if (!state) return;
      if (elapsed < 1400) {
        setTutorialStep(0);
        return;
      }
      if (elapsed < 2800) {
        setTutorialStep(1);
        return;
      }
      const correctOrb = state.orbs.find((orb) => orb.isCorrect);
      if (!correctOrb || state.correctAnswers > 0) {
        if (state.correctAnswers > 0 && !tutorialCastRef.current) {
          tutorialCastRef.current = true;
          castQueuedRef.current = true;
        }
        setVirtualInput({ dx: 0, dy: 0 });
        setTutorialStep(3);
        return;
      }
      setTutorialStep(2);
      setVirtualInput({
        dx: Math.abs(correctOrb.x - state.player.x) < 12 ? 0 : correctOrb.x > state.player.x ? 1 : -1,
        dy: Math.abs(correctOrb.y - state.player.y) < 12 ? 0 : correctOrb.y > state.player.y ? 1 : -1,
      });
    }, 80);
    return () => {
      window.clearInterval(interval);
      setVirtualInput({ dx: 0, dy: 0 });
    };
  }, [gamePhase, setVirtualInput, tutorialMode]);

  useEffect(() => {
    if (gamePhase === "playing") {
      enterFullscreen();
    } else {
      exitFullscreen();
    }
  }, [gamePhase, enterFullscreen, exitFullscreen]);

  // Animation Loop (sprite frames)
  useInterval(() => {
    if (gamePhase === "playing") setAnimFrame((f) => (f + 1) % 3);
  }, 150);

  const showToast = useCallback((next: Toast) => {
    setToast(next);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  /** Sound, words and flashes for whatever just changed in the game. */
  const reactToChange = useCallback((before: WizardZombieState, after: WizardZombieState) => {
    let fx = effectsRef.current;
    const addFloat = (text: string, color: string) => {
      const screen = worldToScreen(cameraRef.current, after.player);
      // Above the wizard, but never hidden behind the HUD.
      const y = Math.max(playRectRef.current.y + 30, screen.y - 44 * cameraRef.current.scale);
      fx = {
        ...fx,
        floats: [...fx.floats, { id: nextEffectId.current++, x: screen.x, y, text, color, ageMs: 0 }],
      };
    };

    if (after.player.hp < before.player.hp) {
      playGameSound("angry-grunt");
      addFloat(`-${before.player.hp - after.player.hp}`, "#fca5a5");
      fx = { ...fx, flashMs: FLASH_LIFE_MS, shakeMs: SHAKE_LIFE_MS };
    }

    if (after.player.shockwaveCharges < before.player.shockwaveCharges) {
      playGameSound("missile-hit");
      fx = { ...fx, ringAgeMs: 0 };
    }

    if (after.totalAttempts > before.totalAttempts && after.lastPick) {
      const pick = after.lastPick;
      recordAdaptiveRef.current(pick.isCorrect, 1000);
      if (pick.isCorrect) {
        if (pick.isFirstTry) {
          playGameSound("success");
          addFloat("+1", "#fde047");
          showToast({ text: "ถูกต้อง!", detail: `${pick.term} = ${pick.meaning}`, tone: "right" });
        } else {
          playGameSound("clinking");
          showToast({ text: "ถูกแล้ว แต่ไม่ได้คะแนน", detail: `${pick.term} = ${pick.meaning}`, tone: "retry" });
        }
        const left = new Set(after.zombies.map((zombie) => zombie.id));
        const gone = before.zombies.filter((zombie) => !left.has(zombie.id));
        if (gone.length) {
          fx = {
            ...fx,
            poofs: [...fx.poofs, ...gone.map((zombie) => ({ id: nextEffectId.current++, x: zombie.x, y: zombie.y, ageMs: 0 }))],
          };
        }
      } else {
        playGameSound("error");
      }
    }

    if (fx !== effectsRef.current) {
      effectsRef.current = fx;
      setEffects(fx);
    }
  }, [showToast]);

  // Game Loop with requestAnimationFrame
  useEffect(() => {
    if (gamePhase !== "playing" || !hasRound) return;

    roundEndsAtRef.current ??= performance.now() + GAME_DURATION_MS;
    const endsAt = roundEndsAtRef.current;
    const clock = tutorialMode
      ? null
      : createRoundClock({
          durationMs: Math.max(0, endsAt - performance.now()),
          onExpire: () => finishRound("time", GAME_DURATION_MS),
        });
    clock?.start();

    let rafId = 0;
    let lastFrameAt = 0;

    const loop = (timestamp: number) => {
      const frameMs = lastFrameAt ? timestamp - lastFrameAt : 0;
      lastFrameAt = timestamp;

      const frame = clock?.tick(timestamp);
      if (completedRef.current) return;
      if (frame) setTimeLeftS(Math.ceil(frame.remainingMs / 1000));
      const stepsMs = frame ? frame.stepsMs : splitFrameTime(frameMs);

      const before = gameStateRef.current;
      if (!before) return;

      let next = before;
      let cast = castQueuedRef.current;
      for (const stepMs of stepsMs) {
        if (next.status !== "playing") break;
        next = advanceWizardZombieTime(next, stepMs, { ...inputRef.current, cast }, gameVocabulary);
        cast = false;
      }
      castQueuedRef.current = cast;

      if (next !== before) {
        reactToChange(before, next);
        commitState(next);
      }

      const aged = ageEffects(effectsRef.current, Math.min(frameMs, 100));
      if (aged !== effectsRef.current) {
        effectsRef.current = aged;
        setEffects(aged);
      }

      if (next.status === "gameover") {
        if (clock) {
          finishRound("all-words", GAME_DURATION_MS - (endsAt - performance.now()));
          return;
        }
        // A tutorial has no round to end: it starts over and hands back nothing.
        tutorialCastRef.current = false;
        commitState(prepareTutorialRound(createWizardZombieState(gameVocabulary, { arena: next.arena })));
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      clock?.stop();
    };
  }, [commitState, finishRound, gamePhase, gameVocabulary, hasRound, prepareTutorialRound, reactToChange, tutorialMode]);

  const pressCast = useCallback((event: React.SyntheticEvent) => {
    event.preventDefault();
    const state = gameStateRef.current;
    if (!state) return;
    if (state.player.shockwaveCharges > 0) {
      castQueuedRef.current = true;
      return;
    }
    setCastHint(true);
    window.clearTimeout(castHintTimer.current);
    castHintTimer.current = window.setTimeout(() => setCastHint(false), CAST_HINT_MS);
  }, []);

  // Memoize sprite grids
  const grids = useMemo(() => {
    if (!assets) return null;
    return {
      player: buildSpriteGrid(assets.player.width, assets.player.height),
      zombie: buildSpriteGrid(assets.zombie.width, assets.zombie.height),
      orb: buildSpriteGrid(assets.orb.width, assets.orb.height),
    };
  }, [assets]);

  // Orbs only change with a new word, so the text is fitted once per word.
  const orbs = gameState?.orbs;
  const orbLabels = useMemo(() => {
    if (!orbs || !arena) return NO_LABELS;
    return new Map(orbs.map((orb) => [orb.id, layoutOrbLabel(orb, arena, camera.scale)]));
  }, [arena, camera.scale, orbs]);

  if (!assets) {
    return (
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-2xl bg-slate-950 flex items-center justify-center border border-white/10"
        style={{ height: "min(75svh, 100%)" }}
      >
        {assetLoadFailed ? (
          <GameAssetLoadFailure
            onRetry={() => {
              setAssetLoadFailed(false);
              setAssetLoadAttempt((attempt) => attempt + 1);
            }}
            onGiveUp={autoStart && !tutorialMode ? giveUpLoading : undefined}
          />
        ) : (
          <div className="text-white animate-pulse font-mono tracking-widest uppercase text-sm sm:text-base">
            {tx("Initializing Grimoire...")}
          </div>
        )}
      </div>
    );
  }

  if (gamePhase === "start") {
    return (
      <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10 touch-none">
        <GameStartScreen
          gameTitle={tx("Wizard vs Zombie")}
          gameSubtitle={tx("Arcane Defense")}
          vocabulary={gameVocabulary}
          instructions={[
            { step: 1, text: "อ่านคำที่ต้องหา แล้วเดินไปเก็บลูกแก้วที่ตรงความหมาย", icon: Shield },
            { step: 2, text: "ถูกตั้งแต่ครั้งแรกเท่านั้นจึงได้คะแนน", icon: Zap },
            { step: 3, text: "ตอบผิดจะเฉลย แล้วคำนั้นจะถูกถามอีกครั้ง", icon: Shield },
            { step: 4, text: "ตอบถูกได้ ⚡ แตะร่ายเวทเพื่อผลักซอมบี้", icon: Zap },
          ]}
          proTip="โดนล้อมเมื่อไหร่ แตะร่ายเวทเปิดทางหนี!"
          controls={[
            { label: tx("Move"), keys: tx("Arrows / WASD"), color: "bg-blue-500" },
            { label: tx("Cast"), keys: tx("Space / Enter"), color: "bg-yellow-500" },
          ]}
          startButtonText={t("common.startSurvival")}
          icon={Sword}
          onStart={startGame}
        />
      </div>
    );
  }

  const charges = gameState?.player.shockwaveCharges ?? 0;
  const maxCharges = gameState?.player.maxShockwaveCharges ?? 0;
  const hpPercent = gameState ? Math.max(0, (gameState.player.hp / gameState.player.maxHp) * 100) : 0;
  const sideColumn = dpadSize + 12;
  const fieldCentre = { x: playRect.x + playRect.width / 2, y: playRect.y + playRect.height / 2 };

  const hpChip = gameState && (
    <div
      role="img"
      aria-label={`${tx("HP")} ${Math.ceil(gameState.player.hp)}`}
      className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-2.5 py-1.5"
    >
      <Heart className="size-4 shrink-0 fill-rose-400 text-rose-400" />
      <div className="h-2.5 w-14 overflow-hidden rounded-full bg-white/20">
        <div className="h-full rounded-full bg-rose-400 transition-[width] duration-150" style={{ width: `${hpPercent}%` }} />
      </div>
      <span className="text-xs font-black tabular-nums text-white">{Math.ceil(gameState.player.hp)}</span>
    </div>
  );
  const timerChip = (
    <div className="rounded-full border border-white/15 bg-black/70 px-3 py-1 text-center text-lg leading-tight font-black tabular-nums text-cyan-300">
      {timeLeftS} วิ
    </div>
  );
  const correctChip = gameState && (
    <div data-testid="wz-correct" className="rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-center text-sm font-black tabular-nums text-amber-200">
      ถูก {gameState.correctAnswers}/{gameVocabulary.length}
    </div>
  );
  const findBox = gameState && (
    <div
      data-testid="wz-find"
      className={`flex flex-col items-center justify-center rounded-2xl border border-white/20 bg-black/75 px-3 py-1 text-center ${isPortrait ? "h-[56px]" : "min-h-[56px]"} ${tutorialMode && tutorialStep === 0 ? "ring-4 ring-amber-300/80" : ""}`}
    >
      <span className="text-[11px] leading-tight font-bold text-white/65">{tx("Find:")}</span>
      <span className={`line-clamp-2 leading-tight font-black break-words text-yellow-300 ${termFontClass(gameState.targetWord)}`}>
        {gameState.targetWord}
      </span>
    </div>
  );

  return (
    <div
      ref={containerRef}
      style={{ minHeight: "400px", height: "100%" }}
      className="relative w-full overflow-hidden rounded-none bg-slate-950 shadow-2xl ring-1 ring-white/10 touch-none sm:rounded-3xl"
    >
      {gameState && grids && (
        <>
          {/* HUD */}
          {isPortrait ? (
            <>
              <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-center justify-between gap-2">
                {hpChip}
                {timerChip}
                {correctChip}
              </div>
              <div className="pointer-events-none absolute inset-x-2 top-[50px] z-10">{findBox}</div>
            </>
          ) : (
            <>
              <div className="pointer-events-none absolute top-2 left-2 z-10 flex flex-col items-start gap-1.5" style={{ width: sideColumn }}>
                {hpChip}
                {timerChip}
              </div>
              <div className="pointer-events-none absolute top-2 right-2 z-10 flex flex-col items-stretch gap-1.5" style={{ width: sideColumn }}>
                {correctChip}
                {findBox}
              </div>
            </>
          )}

          {/* Virtual Controls */}
          <div
            className={`absolute z-20 rounded-2xl ${isPortrait ? "left-1/2 -translate-x-1/2" : "left-2"} ${tutorialMode && tutorialStep === 1 ? "ring-4 ring-amber-300/80" : ""}`}
            style={{ bottom: "calc(12px + env(safe-area-inset-bottom))" }}
          >
            <div style={{ transform: `scale(${dpadSize / 128})`, transformOrigin: isPortrait ? "bottom center" : "bottom left" }}>
              <VirtualDPad onInput={setVirtualInput} />
            </div>
          </div>
          <div
            className={`absolute z-20 ${dimensions.width < 340 ? "right-1" : "right-3"}`}
            style={{ bottom: "calc(16px + env(safe-area-inset-bottom))" }}
          >
            {castHint && (
              <div role="status" className="pointer-events-none absolute right-0 bottom-full mb-2 rounded-xl bg-black/85 px-3 py-1.5 text-sm font-bold whitespace-nowrap text-amber-200">
                ตอบถูกเพื่อชาร์จ
              </div>
            )}
            <button
              type="button"
              data-testid="wz-cast"
              onPointerDown={pressCast}
              // A screen reader or a keyboard sends a click with no pointer press.
              onClick={(event) => {
                if (event.detail === 0) pressCast(event);
              }}
              onContextMenu={(event) => event.preventDefault()}
              aria-disabled={charges === 0}
              style={{
                width: castButtonSize,
                height: castButtonSize,
                fontSize: `${Math.max(13, textScale * 0.875)}px`,
              }}
              className={`flex touch-none flex-col items-center justify-center rounded-full border-2 leading-tight font-black transition-transform select-none active:scale-95 ${
                charges > 0
                  ? "border-blue-300 bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)]"
                  : "border-slate-500 bg-slate-800 text-slate-200"
              }`}
            >
              <span className="flex items-center gap-0.5 tabular-nums">
                <Zap className={`size-4 ${charges > 0 ? "fill-yellow-300 text-yellow-300" : ""}`} />
                {charges}/{maxCharges}
              </span>
              {tx("Cast")}
            </button>
          </div>

          {/* Canvas */}
          {dimensions.width > 0 && (
            <Stage
              width={dimensions.width}
              height={dimensions.height}
              listening={false}
              data-testid="stage"
            >
              {/* The floor changes only while the screen shakes, so it is not redrawn every frame. */}
              <Layer x={effects.shakeX} y={effects.shakeY} listening={false}>
                <Rect
                  x={-16}
                  y={-16}
                  width={dimensions.width + 32}
                  height={dimensions.height + 32}
                  fillPatternImage={assets.floor}
                  fillPatternRepeat="repeat"
                  fillPatternScaleX={0.5 * camera.scale}
                  fillPatternScaleY={0.5 * camera.scale}
                />
                {/* HUD and controls sit on darkened floor; the arena stays bright. */}
                <Rect x={-16} y={-16} width={dimensions.width + 32} height={camera.y + 16} fill="#020617" opacity={0.62} />
                <Rect
                  x={-16}
                  y={camera.y + gameState.arena.height * camera.scale}
                  width={dimensions.width + 32}
                  height={dimensions.height - camera.y - gameState.arena.height * camera.scale + 16}
                  fill="#020617"
                  opacity={0.62}
                />
                <Rect x={-16} y={camera.y} width={camera.x + 16} height={gameState.arena.height * camera.scale} fill="#020617" opacity={0.62} />
                <Rect
                  x={camera.x + gameState.arena.width * camera.scale}
                  y={camera.y}
                  width={dimensions.width - camera.x - gameState.arena.width * camera.scale + 16}
                  height={gameState.arena.height * camera.scale}
                  fill="#020617"
                  opacity={0.62}
                />
                <Rect
                  x={camera.x}
                  y={camera.y}
                  width={gameState.arena.width * camera.scale}
                  height={gameState.arena.height * camera.scale}
                  stroke="#e2e8f0"
                  strokeWidth={2}
                  opacity={0.35}
                  cornerRadius={6}
                />
              </Layer>
              <Layer listening={false}>
                <Group
                  x={camera.x + effects.shakeX}
                  y={camera.y + effects.shakeY}
                  scaleX={camera.scale}
                  scaleY={camera.scale}
                >
                  {/* Player */}
                  <KonvaImage
                    image={assets.player}
                    name="player"
                    x={gameState.player.x}
                    y={gameState.player.y}
                    width={64}
                    height={64}
                    offsetX={32}
                    offsetY={32}
                    opacity={
                      gameState.player.caughtMs > 0
                        ? 0.35
                        : gameState.player.invulnerabilityTime > 0 && Math.floor(gameState.gameTime / 90) % 2 === 0
                          ? 0.45
                          : 1
                    }
                    crop={getSpriteCrop(
                      grids.player.fw,
                      grids.player.fh,
                      animFrame,
                      input.dx === 0 && input.dy === 0 ? 0 : 1,
                    )}
                  />

                  {/* Shockwave */}
                  {effects.ringAgeMs !== null && (
                    <Circle
                      x={gameState.player.x}
                      y={gameState.player.y}
                      radius={SHOCKWAVE_RADIUS * (effects.ringAgeMs / RING_LIFE_MS)}
                      stroke="#67e8f9"
                      strokeWidth={10 * (1 - effects.ringAgeMs / RING_LIFE_MS) + 2}
                      opacity={1 - effects.ringAgeMs / RING_LIFE_MS}
                    />
                  )}

                  {/* Zombies - Offset animation */}
                  {gameState.zombies.map((zombie, i) => (
                    <KonvaImage
                      key={zombie.id}
                      image={assets.zombie}
                      name="zombie"
                      x={zombie.x}
                      y={zombie.y}
                      width={48}
                      height={48}
                      offsetX={24}
                      offsetY={24}
                      crop={getSpriteCrop(
                        grids.zombie.fw,
                        grids.zombie.fh,
                        (animFrame + i) % 3,
                        0,
                      )}
                    />
                  ))}

                  {/* Zombies blasted away by a right answer */}
                  {effects.poofs.map((poof) => (
                    <Circle
                      key={poof.id}
                      x={poof.x}
                      y={poof.y}
                      radius={14 + 26 * (poof.ageMs / POOF_LIFE_MS)}
                      stroke="#fde047"
                      strokeWidth={4}
                      opacity={1 - poof.ageMs / POOF_LIFE_MS}
                    />
                  ))}

                  {/* Orbs */}
                  {gameState.orbs.map((orb, i) => {
                    const label = orbLabels.get(orb.id);
                    return (
                      <Group key={orb.id} x={orb.x} y={orb.y}>
                        {tutorialMode && tutorialStep === 2 && orb.isCorrect && (
                          <Circle radius={40} stroke="#fcd34d" strokeWidth={6} />
                        )}
                        <KonvaImage
                          image={assets.orb}
                          name="orb"
                          width={orb.radius * 2}
                          height={orb.radius * 2}
                          offsetX={orb.radius}
                          offsetY={orb.radius}
                          crop={getSpriteCrop(
                            grids.orb.fw,
                            grids.orb.fh,
                            (animFrame + i) % 3,
                            0,
                          )}
                        />
                        {label && (
                          // Drawn in screen pixels, so the text keeps its size on any phone.
                          <Group scaleX={1 / camera.scale} scaleY={1 / camera.scale} x={0} y={0}>
                            <Rect
                              x={label.offsetX}
                              y={label.offsetY}
                              width={label.width}
                              height={label.height}
                              fill="#020617"
                              opacity={0.82}
                              cornerRadius={8}
                            />
                            <Text
                              x={label.offsetX}
                              y={label.offsetY + 4}
                              width={label.width}
                              text={label.text}
                              wrap="none"
                              align="center"
                              fontFamily={ORB_LABEL_FONT}
                              fontStyle="bold"
                              fontSize={label.fontSize}
                              lineHeight={label.lineHeight}
                              fill="white"
                            />
                          </Group>
                        )}
                      </Group>
                    );
                  })}
                </Group>

                {/* Numbers that rise from the wizard, in screen pixels */}
                {effects.floats.map((float) => (
                  <Text
                    key={float.id}
                    x={float.x - 40}
                    y={float.y - (float.ageMs / FLOAT_LIFE_MS) * 36}
                    width={80}
                    align="center"
                    text={float.text}
                    fontFamily="Arial"
                    fontStyle="bold"
                    fontSize={26}
                    fill={float.color}
                    stroke="#020617"
                    strokeWidth={5}
                    fillAfterStrokeEnabled
                    opacity={Math.min(1, 2 - (float.ageMs / FLOAT_LIFE_MS) * 2)}
                  />
                ))}

                {effects.flashMs > 0 && (
                  <Rect
                    x={0}
                    y={0}
                    width={dimensions.width}
                    height={dimensions.height}
                    fill="#ef4444"
                    opacity={(effects.flashMs / FLASH_LIFE_MS) * 0.4}
                  />
                )}
              </Layer>
            </Stage>
          )}

          {/* Wrong pick: time stops and the right meaning is on screen */}
          {gameState.reveal && (
            <div
              role="status"
              data-testid="wz-reveal"
              className="pointer-events-none absolute z-30 w-[min(340px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-rose-300/70 bg-slate-950/95 px-4 py-3 text-center shadow-2xl"
              style={{ left: fieldCentre.x, top: fieldCentre.y }}
            >
              <p className="text-sm font-black text-rose-300">ยังไม่ใช่</p>
              <p className="mt-1 text-xl leading-tight font-black break-words text-white">{gameState.reveal.term}</p>
              <p className="mt-1 text-lg leading-snug font-bold text-amber-200">{gameState.reveal.meaning}</p>
            </div>
          )}

          {/* Caught: the wizard is back in a moment and the word stays */}
          {gameState.player.caughtMs > 0 && (
            <div
              role="status"
              data-testid="wz-caught"
              className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-rose-300/70 bg-slate-950/95 px-5 py-3 text-center shadow-2xl"
              style={{ left: fieldCentre.x, top: fieldCentre.y }}
            >
              <p className="text-lg font-black whitespace-nowrap text-rose-300">ซอมบี้จับได้!</p>
              <p className="text-sm font-bold whitespace-nowrap text-white/80">รอสักครู่ พ่อมดกำลังกลับมา</p>
            </div>
          )}

          {/* Right pick */}
          {toast && !gameState.reveal && (
            <div
              role="status"
              data-testid="wz-toast"
              className={`pointer-events-none absolute z-30 w-[min(340px,calc(100%-24px))] -translate-x-1/2 rounded-2xl border px-3 py-1.5 text-center shadow-lg ${
                toast.tone === "right" ? "border-emerald-300/70 bg-emerald-950/95" : "border-sky-300/70 bg-slate-950/95"
              }`}
              style={{ left: fieldCentre.x, top: playRect.y + 4 }}
            >
              <p className={`text-sm font-black ${toast.tone === "right" ? "text-emerald-300" : "text-sky-300"}`}>{toast.text}</p>
              {toast.detail && <p className="truncate text-xs font-bold text-white/85">{toast.detail}</p>}
            </div>
          )}

          {tutorialMode && (
            <div
              className="pointer-events-none absolute left-1/2 z-30 w-[min(520px,calc(100%-32px))] -translate-x-1/2 rounded-3xl border border-amber-300/35 bg-slate-950/90 p-4 text-white shadow-2xl backdrop-blur"
              style={{ top: playRect.y + 8 }}
            >
              <p className="text-xs font-black uppercase tracking-widest text-amber-300">{tx("Tutorial ·")} {tutorialStep + 1} / 4</p>
              <p className="mt-1 text-lg font-black">{["ดูคำศัพท์เป้าหมาย", "ใช้จอยเดิน", "เดินเก็บลูกแก้วที่ตรงคำศัพท์", "ได้คะแนนและชาร์จร่ายเวทแล้ว"][tutorialStep]}</p>
              <p className="mt-1 text-sm font-semibold text-white/65">{["ดูคำในกล่องหาคำแปลก่อนเลือก", "พาพ่อมดเดินไปหาลูกแก้ว", "เลือกความหมายที่ตรงกับคำศัพท์", "แตะร่ายเวทเมื่อถูกซอมบี้ล้อม"][tutorialStep]}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
