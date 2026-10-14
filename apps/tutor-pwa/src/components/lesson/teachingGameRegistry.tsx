"use client";

/**
 * Code-split registry for the tutor's teaching games (teacher demo / tutorial
 * stages in the live lesson and the rehearsal).
 *
 * Each teaching game (and the konva / framer-motion / zustand code that only
 * games use) is its own async chunk, so /lesson/[id]/interactive and
 * /prepare/lesson no longer download all seven games up front. Call
 * preloadTeachingGame(id) as soon as the game is known (vote leader, locked
 * vote); once loaded, the game mounts synchronously, like a static import.
 * Mirrors apps/student-liff/src/components/lesson/gameRegistry.tsx.
 */

import {
  Component,
  createElement,
  useState,
  type ComponentProps,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { Gamepad2, RotateCcw } from "lucide-react";
import { Spinner } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import type { CastleDefenseTeachingGame as CastleDefenseComponent } from "./CastleDefenseTeachingGame";
import type { DragonFlightTeachingGame as DragonFlightComponent } from "./DragonFlightTeachingGame";
import type { EnchantedLibraryTeachingGame as EnchantedLibraryComponent } from "./EnchantedLibraryTeachingGame";
import type { FlashcardTeachingGame as FlashcardComponent } from "./FlashcardTeachingGame";
import type { PotionRushTeachingGame as PotionRushComponent } from "./PotionRushTeachingGame";
import type { RuneMatchTeachingGame as RuneMatchComponent } from "./RuneMatchTeachingGame";
import type { WizardZombieTeachingGame as WizardZombieComponent } from "./WizardZombieTeachingGame";

// ─── Loading / error UI ──────────────────────────────────────────────────────

/** Placeholder with the game stage's footprint while its code downloads. */
export function TeachingGameLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[min(60dvh,520px)] w-full flex-col items-center justify-center gap-3 rounded-xl border border-hairline bg-surface-muted px-6 text-center"
    >
      <Spinner className="text-brand-fg [&_svg]:size-7" />
      <p className="text-base font-semibold text-fg">{t("lesson.live.gameLoading")}</p>
      <p className="text-sm text-fg-muted">{t("lesson.live.gameLoadingHint")}</p>
    </div>
  );
}

function TeachingGameLoadError() {
  return (
    <div
      role="alert"
      className="flex min-h-[min(60dvh,520px)] w-full flex-col items-center justify-center gap-3 rounded-xl border border-danger-border bg-danger-bg px-6 text-center"
    >
      <Gamepad2 aria-hidden="true" className="size-8 text-danger-fg" />
      <p className="text-base font-semibold text-fg">{t("lesson.live.gameLoadFailedTitle")}</p>
      <p className="max-w-sm text-sm text-fg-muted">{t("lesson.live.gameLoadFailedDescription")}</p>
      <Button variant="outline" onClick={() => window.location.reload()}>
        <RotateCcw aria-hidden="true" />
        {t("lesson.live.gameLoadRetry")}
      </Button>
    </div>
  );
}

/**
 * Catches a game chunk that failed to download or a game that crashed, and
 * offers a reload (the bundler caches a failed chunk for the page lifetime)
 * instead of taking the whole presenter down.
 */
export class TeachingGameErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[teaching-game] failed", error, info.componentStack);
  }

  render() {
    return this.state.failed ? <TeachingGameLoadError /> : this.props.children;
  }
}

// ─── Loaders ─────────────────────────────────────────────────────────────────

const TEACHING_GAME_LOADERS = {
  "dragon-flight": () => import("./DragonFlightTeachingGame").then((m) => m.DragonFlightTeachingGame),
  "wizard-vs-zombie": () => import("./WizardZombieTeachingGame").then((m) => m.WizardZombieTeachingGame),
  "enchanted-library": () => import("./EnchantedLibraryTeachingGame").then((m) => m.EnchantedLibraryTeachingGame),
  "rune-match": () => import("./RuneMatchTeachingGame").then((m) => m.RuneMatchTeachingGame),
  "castle-defense": () => import("./CastleDefenseTeachingGame").then((m) => m.CastleDefenseTeachingGame),
  "potion-rush": () => import("./PotionRushTeachingGame").then((m) => m.PotionRushTeachingGame),
  // Phase 2 flashcards (no game engine, but keeps the phase code out of the first load).
  flashcard: () => import("./FlashcardTeachingGame").then((m) => m.FlashcardTeachingGame),
} as const;

export type TeachingGameId = keyof typeof TEACHING_GAME_LOADERS;

/** Live-lesson game ids that have a dedicated tutor teaching game. */
export const TEACHING_GAME_IDS = Object.keys(TEACHING_GAME_LOADERS).filter((id) => id !== "flashcard") as Exclude<
  TeachingGameId,
  "flashcard"
>[];

export function isTeachingGameId(id: string | null | undefined): id is TeachingGameId {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(TEACHING_GAME_LOADERS, id);
}

// ─── Preloading ──────────────────────────────────────────────────────────────

const loadedGames = new Map<TeachingGameId, ComponentType<never>>();
const pendingLoads = new Map<TeachingGameId, Promise<boolean>>();

/** True when the game's code is already downloaded, so it mounts without a loader. */
export function isTeachingGameLoaded(gameId: string | null | undefined): boolean {
  return isTeachingGameId(gameId) && loadedGames.has(gameId);
}

/**
 * Start downloading a teaching game in the background. Safe to call
 * repeatedly; resolves true once ready, false for unknown ids or a failed
 * download (a later call retries). Never rejects.
 */
export function preloadTeachingGame(gameId: string | null | undefined): Promise<boolean> {
  if (!isTeachingGameId(gameId)) return Promise.resolve(false);
  if (loadedGames.has(gameId)) return Promise.resolve(true);
  let pending = pendingLoads.get(gameId);
  if (!pending) {
    pending = (TEACHING_GAME_LOADERS[gameId]() as Promise<ComponentType<never>>).then(
      (component) => {
        loadedGames.set(gameId, component);
        return true;
      },
      () => {
        pendingLoads.delete(gameId);
        return false;
      },
    );
    pendingLoads.set(gameId, pending);
  }
  return pending;
}

// ─── Components ──────────────────────────────────────────────────────────────

/**
 * Wrap a next/dynamic component so that, once preloaded, it renders
 * synchronously (no loader flash). The choice is made once per mount, so a
 * game never remounts mid-demo.
 */
function teachingGame<P extends object>(id: TeachingGameId): ComponentType<P> {
  const Dynamic = dynamic(TEACHING_GAME_LOADERS[id] as () => Promise<ComponentType<P>>, {
    ssr: false,
    loading: TeachingGameLoading,
  });
  function Preloadable(props: P) {
    const [Loaded] = useState(() => loadedGames.get(id) as ComponentType<P> | undefined);
    return (
      <TeachingGameErrorBoundary>{createElement((Loaded ?? Dynamic) as ComponentType<P>, props)}</TeachingGameErrorBoundary>
    );
  }
  Preloadable.displayName = `TeachingGame(${id})`;
  return Preloadable;
}

export const LazyDragonFlightTeachingGame = teachingGame<ComponentProps<typeof DragonFlightComponent>>("dragon-flight");
export const LazyWizardZombieTeachingGame = teachingGame<ComponentProps<typeof WizardZombieComponent>>("wizard-vs-zombie");
export const LazyEnchantedLibraryTeachingGame =
  teachingGame<ComponentProps<typeof EnchantedLibraryComponent>>("enchanted-library");
export const LazyRuneMatchTeachingGame = teachingGame<ComponentProps<typeof RuneMatchComponent>>("rune-match");
export const LazyCastleDefenseTeachingGame = teachingGame<ComponentProps<typeof CastleDefenseComponent>>("castle-defense");
export const LazyPotionRushTeachingGame = teachingGame<ComponentProps<typeof PotionRushComponent>>("potion-rush");
export const LazyFlashcardTeachingGame = teachingGame<ComponentProps<typeof FlashcardComponent>>("flashcard");

type WordItem = { term: string; translation: string };

export interface TeachingGameStageProps {
  gameId: string;
  mode: "teacher" | "tutorial";
  /** Vocabulary games use word/meaning pairs, sentence games use sentences. */
  vocabulary: WordItem[];
  sentences: WordItem[];
  fullscreen?: boolean;
  potionRushTeacherDemoCompleted?: boolean;
  onPotionRushTeacherDemoComplete?: () => void;
}

/** Renders the teaching game for `gameId`, or null when there is none. */
export function TeachingGameStage({
  gameId,
  mode,
  vocabulary,
  sentences,
  fullscreen = false,
  potionRushTeacherDemoCompleted,
  onPotionRushTeacherDemoComplete,
}: TeachingGameStageProps) {
  switch (gameId) {
    case "dragon-flight":
      return <LazyDragonFlightTeachingGame vocabulary={vocabulary} mode={mode} fullscreen={fullscreen} />;
    case "wizard-vs-zombie":
      return <LazyWizardZombieTeachingGame vocabulary={vocabulary} mode={mode} fullscreen={fullscreen} />;
    case "enchanted-library":
      return <LazyEnchantedLibraryTeachingGame vocabulary={vocabulary} mode={mode} fullscreen={fullscreen} />;
    case "rune-match":
      return <LazyRuneMatchTeachingGame vocabulary={vocabulary} mode={mode} fullscreen={fullscreen} />;
    case "castle-defense":
      return <LazyCastleDefenseTeachingGame vocabulary={sentences} mode={mode} fullscreen={fullscreen} />;
    case "potion-rush":
      return mode === "teacher" ? (
        <LazyPotionRushTeachingGame
          vocabulary={sentences}
          mode="teacher"
          fullscreen={fullscreen}
          teacherDemoCompleted={potionRushTeacherDemoCompleted}
          onTeacherDemoComplete={onPotionRushTeacherDemoComplete}
        />
      ) : (
        <LazyPotionRushTeachingGame vocabulary={sentences} mode="tutorial" fullscreen={fullscreen} />
      );
    default:
      return null;
  }
}
