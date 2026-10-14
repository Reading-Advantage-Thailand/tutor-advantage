"use client"

/**
 * Code-split registry for the live-lesson arcade games.
 *
 * Every game (plus konva / framer-motion, which only games use) is its own
 * async chunk, so /interactive/play no longer downloads all 23 games up front.
 * Call preloadGame(id) as soon as the game is known (voting / countdown): the
 * runtime and the game then mount synchronously, like the old static imports.
 */

import {
  Component,
  createElement,
  useState,
  type ComponentProps,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from "react"
import dynamic from "next/dynamic"
import type { AdvantageArcadeRuntime as ArcadeRuntimeComponent } from "@/components/lesson/AdvantageArcadeRuntime"
import { t } from "@/lib/i18n"
import type { LiveLessonGameCategory } from "@/lib/liveLessonGames"

// ─── Loading / error UI ──────────────────────────────────────────────────────

/** Friendly full-screen placeholder shown while a game's code downloads. */
export function GameLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-dvh min-h-0 w-full flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-white"
    >
      <div className="relative flex size-20 items-center justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border-4 border-white/15 border-t-emerald-400 motion-safe:animate-spin"
        />
        <span aria-hidden="true" className="text-4xl motion-safe:animate-bounce">🎮</span>
      </div>
      <p className="text-lg font-black">{t("interactivePlay.gamePreparing")}</p>
      <p className="text-sm font-semibold text-white/60">{t("interactivePlay.gameLoadingHint")}</p>
    </div>
  )
}

function GameLoadError() {
  return (
    <div
      role="alert"
      className="flex h-dvh min-h-0 w-full flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-white"
    >
      <div aria-hidden="true" className="flex size-16 items-center justify-center rounded-3xl bg-amber-400/15 text-3xl">😵</div>
      <p className="mt-1 text-lg font-black">{t("interactivePlay.gameLoadFailedTitle")}</p>
      <p className="max-w-xs text-sm font-semibold text-white/70">{t("interactivePlay.gameLoadFailedDescription")}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-3 min-h-11 rounded-2xl bg-emerald-500 px-6 text-base font-black text-white active:scale-95"
      >
        {t("interactivePlay.gameLoadRetry")}
      </button>
    </div>
  )
}

/**
 * Catches a game chunk that failed to download (flaky mobile data) or a game
 * that crashed, and offers a reload instead of a blank lesson screen.
 * A reload is required: the bundler caches a failed chunk for the page lifetime.
 */
export class GameErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[arcade] game failed", error, info.componentStack)
  }

  render() {
    return this.state.failed ? <GameLoadError /> : this.props.children
  }
}

// ─── Loaders ─────────────────────────────────────────────────────────────────

const GAME_LOADERS = {
  "abyssal-well": () => import("@/components/games/sentence/abyssal-well/AbyssalWellGame").then((m) => m.AbyssalWellGame),
  "castle-defense": () => import("@/components/games/sentence/castle-defense/CastleDefenseGame").then((m) => m.CastleDefenseGame),
  "devourer-slime": () => import("@/components/games/sentence/devourer-slime/DevourerSlimeGame").then((m) => m.DevourerSlimeGame),
  "dungeon-liberator": () => import("@/components/games/sentence/dungeon-liberator/DungeonLiberatorGame").then((m) => m.DungeonLiberatorGame),
  "griffin-riders-escape": () => import("@/components/games/sentence/griffin-riders-escape/GriffinRidersEscapeGame").then((m) => m.GriffinRidersEscapeGame),
  "griffin-sky-joust": () => import("@/components/games/sentence/griffin-sky-joust/GriffinSkyJoustGame").then((m) => m.GriffinSkyJoustGame),
  // Default export: next/dynamic resolves `module.default` itself.
  "gryphon-patrol": () => import("@/components/games/sentence/gryphon-patrol/GryphonPatrolGame"),
  "haunted-library": () => import("@/components/games/sentence/haunted-library/HauntedLibraryGame").then((m) => m.HauntedLibraryGame),
  "labyrinth-goblin-king": () => import("@/components/games/sentence/labyrinth-goblin-king/LabyrinthGoblinKingGame").then((m) => m.LabyrinthGoblinKingGame),
  // Default export: next/dynamic resolves `module.default` itself.
  "potion-rush": () => import("@/components/games/sentence/potion-rush/PotionRushGame"),
  "realm-carver": () => import("@/components/games/sentence/realm-carver/RealmCarverGame").then((m) => m.RealmCarverGame),
  "rune-forge-chamber": () => import("@/components/games/sentence/rune-forge-chamber/RuneForgeChamberGame").then((m) => m.RuneForgeChamberGame),
  "shadow-gate-dungeon": () => import("@/components/games/sentence/shadow-gate-dungeon/ShadowGateDungeonGame").then((m) => m.ShadowGateDungeonGame),
  "spellweavers-run": () => import("@/components/games/sentence/spellweavers-run/SpellweaversRunGame").then((m) => m.SpellweaversRunGame),
  "storm-castle-tower": () => import("@/components/games/sentence/storm-castle-tower/StormCastleTowerGame").then((m) => m.StormCastleTowerGame),
  "village-guardian": () => import("@/components/games/sentence/village-guardian/VillageGuardianGame").then((m) => m.VillageGuardianGame),
  "alchemists-synthesis": () => import("@/components/games/vocabulary/alchemists-synthesis/AlchemistsSynthesisGame").then((m) => m.AlchemistsSynthesisGame),
  "archers-revenge": () => import("@/components/games/vocabulary/archers-revenge/ArchersRevengeGame").then((m) => m.ArchersRevengeGame),
  "dragon-flight": () => import("@/components/games/vocabulary/dragon-flight/DragonFlightGame").then((m) => m.DragonFlightGame),
  "enchanted-library": () => import("@/components/games/vocabulary/enchanted-library/EnchantedLibraryGame").then((m) => m.EnchantedLibraryGame),
  "paladins-twin-soul": () => import("@/components/games/vocabulary/paladins-twin-soul/PaladinsTwinSoulGame").then((m) => m.PaladinsTwinSoulGame),
  "rune-match": () => import("@/components/games/vocabulary/rune-match/RuneMatchGame").then((m) => m.RuneMatchGame),
  "wizard-vs-zombie": () => import("@/components/games/vocabulary/wizard-vs-zombie/WizardZombieGame").then((m) => m.WizardZombieGame),
} as const

/** Canonical ids of the games the arcade runtime can render. */
export type ArcadeGameId = keyof typeof GAME_LOADERS

export const ARCADE_GAME_IDS = Object.keys(GAME_LOADERS) as ArcadeGameId[]

export function isArcadeGameId(id: string): id is ArcadeGameId {
  return Object.prototype.hasOwnProperty.call(GAME_LOADERS, id)
}

/** Legacy / activity ids that map onto an arcade game. */
const GAME_ID_ALIASES: Record<string, ArcadeGameId> = {
  "vocabulary-matching": "rune-match",
  "vocabulary-flashcard": "dragon-flight",
  "vocabulary-cloze": "enchanted-library",
  "dragon-rider": "dragon-flight",
  "sentence-order-word": "dungeon-liberator",
  "sentence-order-sentence": "haunted-library",
  "sentence-cloze": "potion-rush",
  "sentence-matching": "castle-defense",
  "sentence-flashcard": "spellweavers-run",
}

/** Map an alias to its game id (unknown ids pass through unchanged). */
export const resolveGameId = (gameId: string, category: LiveLessonGameCategory) =>
  GAME_ID_ALIASES[gameId] ?? gameId ?? (category === "vocabulary" ? "rune-match" : "dungeon-liberator")

// ─── Preloading ──────────────────────────────────────────────────────────────

type LoadedModule = ComponentType<never> | { default: ComponentType<never> }

const loadedGames = new Map<ArcadeGameId, ComponentType<never>>()
const pendingLoads = new Map<ArcadeGameId, Promise<boolean>>()

function toComponent(loaded: LoadedModule): ComponentType<never> {
  return typeof loaded === "object" && loaded !== null && "default" in loaded ? loaded.default : loaded
}

/** True when the game's code is already downloaded, so it can mount without a loader. */
export function isGameLoaded(gameId: string | null | undefined): boolean {
  if (!gameId) return false
  const id = GAME_ID_ALIASES[gameId] ?? gameId
  return isArcadeGameId(id) && loadedGames.has(id)
}

type ArcadeRuntimeProps = ComponentProps<typeof ArcadeRuntimeComponent>

const loadArcadeRuntime = () =>
  import("@/components/lesson/AdvantageArcadeRuntime").then((m) => m.AdvantageArcadeRuntime)

let loadedRuntime: ComponentType<ArcadeRuntimeProps> | undefined
let runtimeLoad: Promise<boolean> | null = null

/** Start downloading the arcade runtime (small) so the game phase opens without a loader. */
export function preloadArcadeRuntime(): Promise<boolean> {
  if (loadedRuntime) return Promise.resolve(true)
  if (!runtimeLoad) {
    runtimeLoad = loadArcadeRuntime().then(
      (runtime) => {
        loadedRuntime = runtime
        return true
      },
      () => {
        runtimeLoad = null
        return false
      },
    )
  }
  return runtimeLoad
}

/**
 * Start downloading a game's code (and the arcade runtime) in the background.
 * Accepts aliases. Safe to call repeatedly; resolves true once the game is
 * ready, false for unknown ids or a failed download. Never rejects.
 */
export function preloadGame(gameId: string | null | undefined): Promise<boolean> {
  if (!gameId) return Promise.resolve(false)
  const id = GAME_ID_ALIASES[gameId] ?? gameId
  if (!isArcadeGameId(id)) return Promise.resolve(false)
  void preloadArcadeRuntime()
  if (loadedGames.has(id)) return Promise.resolve(true)

  let pending = pendingLoads.get(id)
  if (!pending) {
    pending = (GAME_LOADERS[id]() as Promise<LoadedModule>).then(
      (loaded) => {
        loadedGames.set(id, toComponent(loaded))
        return true
      },
      () => {
        pendingLoads.delete(id)
        return false
      },
    )
    pendingLoads.set(id, pending)
  }
  return pending
}

// ─── Components ──────────────────────────────────────────────────────────────

/**
 * Wrap a next/dynamic component so that, once preloaded, it renders
 * synchronously (no loader flash, same timing as a static import). The choice
 * is made once per mount, so a game never remounts mid-play.
 */
function renderWhenLoaded<P extends object>(
  name: string,
  getLoaded: () => ComponentType<P> | undefined,
  Dynamic: ComponentType<P>,
): ComponentType<P> {
  function Preloadable(props: P) {
    const [Loaded] = useState(getLoaded)
    return createElement(Loaded ?? Dynamic, props)
  }
  Preloadable.displayName = name
  return Preloadable
}

function arcadeGame<P extends object>(id: ArcadeGameId, Dynamic: ComponentType<P>): ComponentType<P> {
  return renderWhenLoaded(`ArcadeGame(${id})`, () => loadedGames.get(id) as ComponentType<P> | undefined, Dynamic)
}

const PreloadableArcadeRuntime = renderWhenLoaded<ArcadeRuntimeProps>(
  "PreloadableArcadeRuntime",
  () => loadedRuntime,
  dynamic(loadArcadeRuntime, { ssr: false, loading: GameLoading }),
)

/**
 * Code-split AdvantageArcadeRuntime (next/dynamic, ssr: false) with the same
 * props, for the play page. After preloadGame()/preloadArcadeRuntime() it
 * mounts synchronously; a failed download shows a friendly reload screen.
 */
export function LazyArcadeRuntime(props: ArcadeRuntimeProps) {
  return (
    <GameErrorBoundary>
      <PreloadableArcadeRuntime {...props} />
    </GameErrorBoundary>
  )
}

/**
 * Lazily loaded game components, with the same names and props as the
 * original static imports. Render inside <GameErrorBoundary>.
 */
export const ArcadeGames = {
  AbyssalWellGame: arcadeGame("abyssal-well", dynamic(GAME_LOADERS["abyssal-well"], { ssr: false, loading: GameLoading })),
  CastleDefenseGame: arcadeGame("castle-defense", dynamic(GAME_LOADERS["castle-defense"], { ssr: false, loading: GameLoading })),
  DevourerSlimeGame: arcadeGame("devourer-slime", dynamic(GAME_LOADERS["devourer-slime"], { ssr: false, loading: GameLoading })),
  DungeonLiberatorGame: arcadeGame("dungeon-liberator", dynamic(GAME_LOADERS["dungeon-liberator"], { ssr: false, loading: GameLoading })),
  GriffinRidersEscapeGame: arcadeGame("griffin-riders-escape", dynamic(GAME_LOADERS["griffin-riders-escape"], { ssr: false, loading: GameLoading })),
  GriffinSkyJoustGame: arcadeGame("griffin-sky-joust", dynamic(GAME_LOADERS["griffin-sky-joust"], { ssr: false, loading: GameLoading })),
  GryphonPatrolGame: arcadeGame("gryphon-patrol", dynamic(GAME_LOADERS["gryphon-patrol"], { ssr: false, loading: GameLoading })),
  HauntedLibraryGame: arcadeGame("haunted-library", dynamic(GAME_LOADERS["haunted-library"], { ssr: false, loading: GameLoading })),
  LabyrinthGoblinKingGame: arcadeGame("labyrinth-goblin-king", dynamic(GAME_LOADERS["labyrinth-goblin-king"], { ssr: false, loading: GameLoading })),
  PotionRushGame: arcadeGame("potion-rush", dynamic(GAME_LOADERS["potion-rush"], { ssr: false, loading: GameLoading })),
  RealmCarverGame: arcadeGame("realm-carver", dynamic(GAME_LOADERS["realm-carver"], { ssr: false, loading: GameLoading })),
  RuneForgeChamberGame: arcadeGame("rune-forge-chamber", dynamic(GAME_LOADERS["rune-forge-chamber"], { ssr: false, loading: GameLoading })),
  ShadowGateDungeonGame: arcadeGame("shadow-gate-dungeon", dynamic(GAME_LOADERS["shadow-gate-dungeon"], { ssr: false, loading: GameLoading })),
  SpellweaversRunGame: arcadeGame("spellweavers-run", dynamic(GAME_LOADERS["spellweavers-run"], { ssr: false, loading: GameLoading })),
  StormCastleTowerGame: arcadeGame("storm-castle-tower", dynamic(GAME_LOADERS["storm-castle-tower"], { ssr: false, loading: GameLoading })),
  VillageGuardianGame: arcadeGame("village-guardian", dynamic(GAME_LOADERS["village-guardian"], { ssr: false, loading: GameLoading })),
  AlchemistsSynthesisGame: arcadeGame("alchemists-synthesis", dynamic(GAME_LOADERS["alchemists-synthesis"], { ssr: false, loading: GameLoading })),
  ArchersRevengeGame: arcadeGame("archers-revenge", dynamic(GAME_LOADERS["archers-revenge"], { ssr: false, loading: GameLoading })),
  DragonFlightGame: arcadeGame("dragon-flight", dynamic(GAME_LOADERS["dragon-flight"], { ssr: false, loading: GameLoading })),
  EnchantedLibraryGame: arcadeGame("enchanted-library", dynamic(GAME_LOADERS["enchanted-library"], { ssr: false, loading: GameLoading })),
  PaladinsTwinSoulGame: arcadeGame("paladins-twin-soul", dynamic(GAME_LOADERS["paladins-twin-soul"], { ssr: false, loading: GameLoading })),
  RuneMatchGame: arcadeGame("rune-match", dynamic(GAME_LOADERS["rune-match"], { ssr: false, loading: GameLoading })),
  WizardZombieGame: arcadeGame("wizard-vs-zombie", dynamic(GAME_LOADERS["wizard-vs-zombie"], { ssr: false, loading: GameLoading })),
}
