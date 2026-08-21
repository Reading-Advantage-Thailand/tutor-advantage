"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { AbyssalWellGame } from "@/components/games/sentence/abyssal-well/AbyssalWellGame"
import { CastleDefenseGame } from "@/components/games/sentence/castle-defense/CastleDefenseGame"
import { DevourerSlimeGame } from "@/components/games/sentence/devourer-slime/DevourerSlimeGame"
import { DungeonLiberatorGame } from "@/components/games/sentence/dungeon-liberator/DungeonLiberatorGame"
import { GriffinRidersEscapeGame } from "@/components/games/sentence/griffin-riders-escape/GriffinRidersEscapeGame"
import { GriffinSkyJoustGame } from "@/components/games/sentence/griffin-sky-joust/GriffinSkyJoustGame"
import GryphonPatrolGame from "@/components/games/sentence/gryphon-patrol/GryphonPatrolGame"
import { HauntedLibraryGame } from "@/components/games/sentence/haunted-library/HauntedLibraryGame"
import { LabyrinthGoblinKingGame } from "@/components/games/sentence/labyrinth-goblin-king/LabyrinthGoblinKingGame"
import PotionRushGame from "@/components/games/sentence/potion-rush/PotionRushGame"
import { RealmCarverGame } from "@/components/games/sentence/realm-carver/RealmCarverGame"
import { RuneForgeChamberGame } from "@/components/games/sentence/rune-forge-chamber/RuneForgeChamberGame"
import { ShadowGateDungeonGame } from "@/components/games/sentence/shadow-gate-dungeon/ShadowGateDungeonGame"
import { SpellweaversRunGame } from "@/components/games/sentence/spellweavers-run/SpellweaversRunGame"
import { StormCastleTowerGame } from "@/components/games/sentence/storm-castle-tower/StormCastleTowerGame"
import { VillageGuardianGame } from "@/components/games/sentence/village-guardian/VillageGuardianGame"
import { AlchemistsSynthesisGame } from "@/components/games/vocabulary/alchemists-synthesis/AlchemistsSynthesisGame"
import { ArchersRevengeGame } from "@/components/games/vocabulary/archers-revenge/ArchersRevengeGame"
import { DragonFlightGame } from "@/components/games/vocabulary/dragon-flight/DragonFlightGame"
import { EnchantedLibraryGame } from "@/components/games/vocabulary/enchanted-library/EnchantedLibraryGame"
import { PaladinsTwinSoulGame } from "@/components/games/vocabulary/paladins-twin-soul/PaladinsTwinSoulGame"
import { RuneMatchGame } from "@/components/games/vocabulary/rune-match/RuneMatchGame"
import { WizardZombieGame } from "@/components/games/vocabulary/wizard-vs-zombie/WizardZombieGame"
import type { LiveLessonGameCategory } from "@/lib/liveLessonGames"
import type { VocabularyItem } from "@/store/useGameStore"

type LessonWord = {
  id?: string
  vocabulary?: string
  word?: string
  text?: string
  translation?: string
  definition?: { th?: string; en?: string }
}

type LessonSentence = string | {
  id?: string
  sentences?: string
  sentence?: string
  text?: string
  translation?: string
  meaning?: string
}

type ArticleData = {
  words?: LessonWord[]
  sentences?: LessonSentence[]
}

type ArcadeResult = {
  score?: number
  xp?: number
  accuracy?: number
  correctAnswers?: number
  totalAttempts?: number
  correctWords?: number
  total?: number
  durationMs?: number
}

type AdvantageArcadeRuntimeProps = {
  gameId: string
  category: LiveLessonGameCategory
  articleData?: ArticleData | null
  autoStart?: boolean
  /** Allow a game child to start a fresh round after completion. */
  restartOnComplete?: boolean
  tutorialMode?: boolean
  onComplete: (result: {
    score: number
    correct: number
    total: number
    durationMs: number
  }) => void
}

const resolveGameId = (gameId: string, category: LiveLessonGameCategory) => {
  const aliases: Record<string, string> = {
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

  return aliases[gameId] ?? gameId ?? (category === "vocabulary" ? "rune-match" : "dungeon-liberator")
}

const wordText = (word: LessonWord, index: number) =>
  word.vocabulary || word.word || word.text || `Word ${index + 1}`

const wordTranslation = (word: LessonWord, fallback: string) =>
  word.definition?.th || word.translation || word.definition?.en || fallback

const sentenceText = (sentence: LessonSentence, index: number) => {
  if (typeof sentence === "string") return sentence
  return sentence.sentences || sentence.sentence || sentence.text || `Sentence ${index + 1}`
}

const sentenceTranslation = (sentence: LessonSentence, fallback: string) => {
  if (typeof sentence === "string") return fallback
  return sentence.translation || sentence.meaning || fallback
}

function buildVocabulary(articleData?: ArticleData | null): VocabularyItem[] {
  const words = articleData?.words ?? []
  const vocabulary = words
    .map((word, index) => {
      const term = wordText(word, index)
      return {
        id: word.id ?? `word-${index}`,
        term,
        translation: wordTranslation(word, term),
      }
    })
    .filter((word) => word.term && word.translation)

  return vocabulary.length
    ? vocabulary
    : [
        { id: "fallback-1", term: "analyze", translation: "study carefully" },
        { id: "fallback-2", term: "predict", translation: "say what may happen" },
        { id: "fallback-3", term: "compare", translation: "find similarities" },
      ]
}

function buildSentences(articleData?: ArticleData | null): VocabularyItem[] {
  const sentences = articleData?.sentences ?? []
  const sentenceItems = sentences
    .map((sentence, index) => {
      const term = sentenceText(sentence, index)
      return {
        id: typeof sentence === "string" ? `sentence-${index}` : sentence.id ?? `sentence-${index}`,
        term,
        translation: sentenceTranslation(sentence, term),
      }
    })
    .filter((sentence) => sentence.term)

  return sentenceItems.length
    ? sentenceItems
    : [
        { id: "fallback-sentence-1", term: "Students read the article carefully", translation: "Students read the article carefully" },
        { id: "fallback-sentence-2", term: "The teacher asks a follow up question", translation: "The teacher asks a follow up question" },
      ]
}

export function AdvantageArcadeRuntime({
  gameId,
  category,
  articleData,
  autoStart = true,
  restartOnComplete = true,
  tutorialMode = false,
  onComplete,
}: AdvantageArcadeRuntimeProps) {
  const startedAt = useRef(Date.now())
  const completedRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const resolvedGameId = resolveGameId(gameId, category)
  const childAutoStart = autoStart
  const vocabulary = useMemo(() => buildVocabulary(articleData), [articleData])
  const sentences = useMemo(() => buildSentences(articleData), [articleData])
  const [hasCompleted, setHasCompleted] = useState(false)

  useEffect(() => {
    if (!autoStart) return

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
    ]
    const blockedPatterns = [/again/i, /restart/i, /ranking/i, /leaderboard/i, /back/i, /home/i]

    const clickStartButton = () => {
      const root = rootRef.current
      if (!root) return false

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
  }, [autoStart, resolvedGameId])

  const handleComplete = (result: ArcadeResult) => {
    if (completedRef.current) return
    completedRef.current = true
    setHasCompleted(true)

    const total = Math.max(result.totalAttempts ?? result.total ?? 1, 1)
    const accuracy = typeof result.accuracy === "number" ? result.accuracy : undefined
    const correct = Math.round(
      result.correctAnswers ?? result.correctWords ?? (accuracy !== undefined ? accuracy * total : total)
    )
    const rawScore = result.score ?? result.xp ?? correct * 10

    onComplete({
      score: Math.max(0, Math.round(rawScore)),
      correct: Math.max(0, correct),
      total,
      durationMs: Math.max(0, Math.round(result.durationMs ?? Date.now() - startedAt.current)),
    })
  }

  const commonClass = "h-dvh min-h-0 w-full overflow-hidden bg-background"

  if (hasCompleted) {
    return (
      <div className={`${commonClass} flex items-center justify-center bg-slate-950 text-center text-white`}>
        <div>
          <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-emerald-400/15 text-3xl">✓</div>
          <p className="mt-4 text-lg font-black">ส่งผลคะแนนแล้ว</p>
          <p className="mt-1 text-sm font-semibold text-white/60">กำลังรอระบบอัปเดตคะแนนของทุกคน...</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={rootRef} className={commonClass}>
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
        <RuneMatchGame vocabulary={vocabulary} tutorialMode={tutorialMode} onComplete={handleComplete} />
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
    </div>
  )
}
