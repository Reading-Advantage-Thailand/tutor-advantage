"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  ArcadeGames,
  GameErrorBoundary,
  isGameLoaded,
  preloadGame,
  resolveGameId,
} from "./gameRegistry"
import {
  buildLessonSentences,
  buildLessonVocabulary,
  hasUsableSentences,
  hasUsableVocabulary,
  repeatThinSentences,
  type LessonArticle,
} from "@/lib/games/lessonContent"
import { toLessonGameResult, type ArcadeResult, type LessonGameResult } from "../../lib/games/lessonGameResult"
import { endRunningRoundsNow } from "@/lib/games/roundClock"
import { getGameById, type LiveLessonGameCategory } from "@/lib/liveLessonGames"

/** Time to read the result before the lesson screen takes over. The result is kept safe meanwhile. */
const RESULT_HOLD_MS = 2_600
const NO_CONTENT_HOLD_MS = 5_000
const NO_CONTENT_RESULT: LessonGameResult = { score: 0, correct: 0, total: 0, durationMs: 0 }
/** The longest a game may hold the screen for its own finish before the end screen. */
const MAX_OUTRO_MS = 4_000
/**
 * After the class round closes, how long to wait for a game that was already in
 * its own short end pause (its clock stopped, its result not sent yet) before
 * saying this phone had nothing to hand in. Games pause for at most about 1.5 s.
 */
const ROUND_CLOSE_SETTLE_MS = 2_000

type AdvantageArcadeRuntimeProps = {
  gameId: string
  category: LiveLessonGameCategory
  articleData?: LessonArticle | null
  autoStart?: boolean
  /** Allow a game child to start a fresh round after completion. */
  restartOnComplete?: boolean
  tutorialMode?: boolean
  /**
   * The class round is over for everyone (the tutor ended the game). A round
   * still running ends now, and its result is handed over without the pause.
   */
  roundClosed?: boolean
  /** The class round closed before this phone's round started, so there is nothing to hand in. */
  onRoundUnplayed?: () => void
  onComplete: (result: LessonGameResult) => void
}

// Each game is a separate chunk (see gameRegistry); names and props are unchanged.
const {
  AbyssalWellGame,
  CastleDefenseGame,
  DevourerSlimeGame,
  DungeonLiberatorGame,
  GriffinRidersEscapeGame,
  GriffinSkyJoustGame,
  GryphonPatrolGame,
  HauntedLibraryGame,
  LabyrinthGoblinKingGame,
  PotionRushGame,
  RealmCarverGame,
  RuneForgeChamberGame,
  ShadowGateDungeonGame,
  SpellweaversRunGame,
  StormCastleTowerGame,
  VillageGuardianGame,
  AlchemistsSynthesisGame,
  ArchersRevengeGame,
  DragonFlightGame,
  EnchantedLibraryGame,
  PaladinsTwinSoulGame,
  RuneMatchGame,
  WizardZombieGame,
} = ArcadeGames

export function AdvantageArcadeRuntime({
  gameId,
  category,
  articleData,
  autoStart = true,
  restartOnComplete = true,
  tutorialMode = false,
  roundClosed = false,
  onRoundUnplayed,
  onComplete,
}: AdvantageArcadeRuntimeProps) {
  const startedAt = useRef(Date.now())
  const completedRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const resolvedGameId = resolveGameId(gameId, category)
  // Live lessons auto-start once; finishing a round must not start another one.
  const childAutoStart = autoStart
  const vocabulary = useMemo(() => buildLessonVocabulary(articleData), [articleData])
  const sentences = useMemo(() => repeatThinSentences(buildLessonSentences(articleData)), [articleData])
  const usesWords = (getGameById(resolvedGameId)?.category ?? category) === "vocabulary"
  // No word from outside the lesson may be played or scored, so say so and hand back 0.
  const hasContent = usesWords ? hasUsableVocabulary(vocabulary) : hasUsableSentences(sentences)
  const [roundResult, setRoundResult] = useState<LessonGameResult | null>(null)
  const [handedBack, setHandedBack] = useState(false)
  const [outroPlaying, setOutroPlaying] = useState(false)
  const outroMsRef = useRef(0)
  // The auto-start clicker must wait for the game's chunk; a preloaded game is ready on mount.
  const [readyGameId, setReadyGameId] = useState(() => (isGameLoaded(resolvedGameId) ? resolvedGameId : null))
  const gameReady = readyGameId === resolvedGameId

  useEffect(() => {
    if (gameReady) return
    let cancelled = false
    void preloadGame(resolvedGameId).then((loaded) => {
      if (!cancelled && loaded) setReadyGameId(resolvedGameId)
    })
    return () => {
      cancelled = true
    }
  }, [gameReady, resolvedGameId])

  useEffect(() => {
    if (!autoStart || !gameReady) return

    const startPatterns = [
      /start/i,
      /begin/i,
      /play/i,
      /ready/i,
      /battle/i,
      /defense/i,
      /survival/i,
      /flight/i,
      /tower/i,
      /brew/i,
      /storm/i,
      /enter/i,
      /run/i,
      /เริ่ม/,
    ]
    const blockedPatterns = [/again/i, /restart/i, /ranking/i, /leaderboard/i, /back/i, /home/i, /อีกครั้ง/, /อันดับ/]

    const clickStartButton = () => {
      const root = rootRef.current
      if (!root) return false

      // Start screens mark their start button; labels are Thai now, so the
      // text patterns below are only a fallback for custom start buttons.
      const marked = root.querySelector<HTMLButtonElement>("button[data-game-start]:not(:disabled)")
      if (marked) {
        marked.click()
        return true
      }

      const buttons = Array.from(root.querySelectorAll("button")) as HTMLButtonElement[]
      const startButton = buttons.find((button) => {
        if (button.disabled) return false
        const text = (button.textContent || button.getAttribute("aria-label") || "").trim()
        if (!text) return false
        if (blockedPatterns.some((pattern) => pattern.test(text))) return false
        return startPatterns.some((pattern) => pattern.test(text))
      })

      if (!startButton) return false
      startButton.click()
      return true
    }

    const timers = [120, 450, 900, 1400].map((delay) =>
      window.setTimeout(clickStartButton, delay),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [autoStart, gameReady, resolvedGameId])

  // Parents pass an inline onComplete; read it through a ref so handleComplete
  // stays referentially stable and never re-triggers a game's effects.
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])
  const onRoundUnplayedRef = useRef(onRoundUnplayed)
  useEffect(() => {
    onRoundUnplayedRef.current = onRoundUnplayed
  }, [onRoundUnplayed])

  // A result is handed over once, whichever comes first: the pause, the student
  // leaving, the class round closing, or this screen going away.
  const handedOverRef = useRef(false)
  const handOver = useCallback((result: LessonGameResult) => {
    if (handedOverRef.current) return
    handedOverRef.current = true
    setHandedBack(true)
    onCompleteRef.current(result)
  }, [])

  const roundClosedRef = useRef(roundClosed)

  const handleComplete = useCallback((result: ArcadeResult) => {
    if (completedRef.current) return
    completedRef.current = true
    outroMsRef.current = Math.min(Math.max(result.outroMs ?? 0, 0), MAX_OUTRO_MS)
    setOutroPlaying(outroMsRef.current > 0)
    const elapsedMs = Date.now() - startedAt.current
    const lessonResult = toLessonGameResult(result, elapsedMs)
    // A round cut short still reports its full length from some games.
    lessonResult.durationMs = Math.min(lessonResult.durationMs, Math.max(0, Math.round(elapsedMs)))
    setRoundResult(lessonResult)
    // The class round is already over, so hand it in now. This also covers a
    // game that reports while this screen is being taken down.
    if (roundClosedRef.current) handOver(lessonResult)
  }, [handOver])

  useEffect(() => {
    if (hasContent || completedRef.current) return
    completedRef.current = true
    setRoundResult(NO_CONTENT_RESULT)
  }, [hasContent])

  // Show the result for a moment before handing it over, because the lesson page
  // replaces this screen as soon as it has the result. A student who leaves
  // during the pause must not lose the score, so leaving hands it over at once.
  useEffect(() => {
    if (!roundResult) return
    const send = () => handOver(roundResult)
    const handOverIfHidden = () => {
      if (document.visibilityState === "hidden") send()
    }
    const outroMs = outroMsRef.current
    const outroTimer = window.setTimeout(() => setOutroPlaying(false), outroMs)
    const timer = window.setTimeout(send, (hasContent ? RESULT_HOLD_MS : NO_CONTENT_HOLD_MS) + outroMs)
    document.addEventListener("visibilitychange", handOverIfHidden)
    window.addEventListener("pagehide", send)
    // The round can run out with the page already in the background, where timers may never fire.
    handOverIfHidden()
    return () => {
      window.clearTimeout(outroTimer)
      window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", handOverIfHidden)
      window.removeEventListener("pagehide", send)
      send()
    }
  }, [roundResult, hasContent, handOver])

  // The tutor ended the round for the class. Finish this phone's round now so the
  // points earned so far count, and hand them in without the usual pause.
  useEffect(() => {
    roundClosedRef.current = roundClosed
    if (!roundClosed) return
    if (roundResult) {
      handOver(roundResult)
      return
    }
    // The game already reported; its result reaches state on the next render.
    if (completedRef.current) return
    if (endRunningRoundsNow() > 0) return
    // No clock was running. Either the round never started here, or the game is
    // in its own end pause and reports in a moment.
    const timer = window.setTimeout(() => {
      if (!completedRef.current) onRoundUnplayedRef.current?.()
    }, ROUND_CLOSE_SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [roundClosed, roundResult, handOver])

  const commonClass = "h-dvh min-h-0 w-full overflow-hidden bg-background"

  if (!hasContent) {
    return (
      <div role="status" data-testid="arcade-no-content" className={`${commonClass} flex items-center justify-center bg-slate-950 px-6 text-center text-white`}>
        <div className="max-w-sm">
          <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-amber-400/15 text-3xl">📖</div>
          <p className="mt-4 text-lg font-black">{usesWords ? "บทเรียนนี้ยังไม่มีคำศัพท์สำหรับเกมนี้" : "บทเรียนนี้ยังไม่มีประโยคสำหรับเกมนี้"}</p>
          <p className="mt-1 text-sm font-semibold text-white/60">รอบนี้ได้ 0 คะแนน รอคุณครูไปขั้นต่อไปนะ</p>
        </div>
      </div>
    )
  }

  if (roundResult && !outroPlaying) {
    return (
      <div role="status" data-testid="arcade-round-end" className={`${commonClass} flex items-center justify-center bg-slate-950 px-6 text-center text-white`}>
        <div>
          <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-emerald-400/15 text-3xl">✓</div>
          <p className="mt-4 text-lg font-black">{roundResult.review?.heading ?? "จบเกมแล้ว!"}</p>
          <p className="mt-3 text-6xl font-black tabular-nums text-emerald-300">{roundResult.score}</p>
          <p className="text-sm font-bold text-white/70">คะแนน</p>
          <p className="mt-3 text-lg font-black tabular-nums">ตอบถูก {roundResult.correct} จาก {roundResult.total}</p>
          <p className="mt-4 text-sm font-semibold text-white/60">{handedBack ? "ส่งผลคะแนนแล้ว รอคะแนนของทุกคน..." : "กำลังส่งคะแนน..."}</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={rootRef} className={commonClass}>
      <GameErrorBoundary>
        {resolvedGameId === "dragon-flight" && (
          <DragonFlightGame vocabulary={vocabulary} autoStart={childAutoStart} tutorialMode={tutorialMode} onComplete={handleComplete} />
        )}
        {resolvedGameId === "wizard-vs-zombie" && (
          <WizardZombieGame vocabulary={vocabulary} autoStart={childAutoStart} tutorialMode={tutorialMode} onComplete={handleComplete} />
        )}
        {resolvedGameId === "enchanted-library" && (
          <EnchantedLibraryGame
            vocabulary={vocabulary}
            difficulty="normal"
            onDifficultyChange={() => undefined}
            rankings={{ easy: [], normal: [], hard: [], extreme: [] }}
            autoStart={childAutoStart}
            restartOnComplete={restartOnComplete}
            tutorialMode={tutorialMode}
            onComplete={handleComplete}
          />
        )}
        {resolvedGameId === "rune-match" && (
          <RuneMatchGame
            vocabulary={vocabulary}
            tutorialMode={tutorialMode}
            restartOnComplete={restartOnComplete}
            onComplete={handleComplete}
          />
        )}
        {resolvedGameId === "alchemists-synthesis" && (
          <AlchemistsSynthesisGame vocabulary={vocabulary} onComplete={handleComplete} />
        )}
        {resolvedGameId === "archers-revenge" && (
          <ArchersRevengeGame vocabulary={vocabulary} onComplete={handleComplete} />
        )}
        {resolvedGameId === "paladins-twin-soul" && (
          <PaladinsTwinSoulGame vocabulary={vocabulary} onComplete={handleComplete} />
        )}
        {resolvedGameId === "castle-defense" && (
          <CastleDefenseGame
            vocabulary={sentences}
            autoStart={childAutoStart}
            restartOnComplete={restartOnComplete}
            tutorialMode={tutorialMode}
            onComplete={handleComplete}
          />
        )}
        {resolvedGameId === "potion-rush" && (
          <PotionRushGame
            vocabList={sentences}
            difficulty="normal"
            autoStart={childAutoStart}
            restartOnComplete={restartOnComplete}
            tutorialMode={tutorialMode}
            onComplete={handleComplete}
          />
        )}
        {resolvedGameId === "dungeon-liberator" && (
          <DungeonLiberatorGame vocabulary={sentences} onComplete={handleComplete} />
        )}
        {resolvedGameId === "spellweavers-run" && (
          <SpellweaversRunGame vocabulary={sentences} onComplete={handleComplete} />
        )}
        {resolvedGameId === "shadow-gate-dungeon" && (
          <ShadowGateDungeonGame vocabulary={sentences} onComplete={handleComplete} />
        )}
        {resolvedGameId === "rune-forge-chamber" && (
          <RuneForgeChamberGame vocabulary={sentences} onComplete={handleComplete} />
        )}
        {resolvedGameId === "village-guardian" && (
          <VillageGuardianGame vocabulary={sentences} onComplete={handleComplete} />
        )}
        {resolvedGameId === "labyrinth-goblin-king" && (
          <LabyrinthGoblinKingGame sentences={sentences} onComplete={handleComplete} />
        )}
        {resolvedGameId === "abyssal-well" && (
          <AbyssalWellGame sentences={sentences} onComplete={handleComplete} />
        )}
        {resolvedGameId === "storm-castle-tower" && (
          <StormCastleTowerGame vocabulary={sentences} onComplete={handleComplete} />
        )}
        {resolvedGameId === "griffin-sky-joust" && (
          <GriffinSkyJoustGame vocabulary={sentences} onComplete={handleComplete} />
        )}
        {resolvedGameId === "realm-carver" && (
          <RealmCarverGame sentences={sentences} onComplete={handleComplete} />
        )}
        {resolvedGameId === "griffin-riders-escape" && (
          <GriffinRidersEscapeGame vocabulary={sentences} onComplete={handleComplete} />
        )}
        {resolvedGameId === "devourer-slime" && (
          <DevourerSlimeGame sentences={sentences} difficulty="medium" onComplete={handleComplete} />
        )}
        {resolvedGameId === "haunted-library" && (
          <HauntedLibraryGame sentences={sentences} onComplete={handleComplete} />
        )}
        {resolvedGameId === "gryphon-patrol" && (
          <GryphonPatrolGame vocabList={sentences} difficulty="normal" onComplete={handleComplete} />
        )}
      </GameErrorBoundary>
    </div>
  )
}
