import { VocabularyItem } from '@/store/useGameStore'

export type ActionPower = 'basic' | 'power'

export interface WordPerformance {
  correct: number
  attempts: number
}

export interface BattleAction extends VocabularyItem {
  id: string
  power: ActionPower
  difficulty: number
}

interface SelectionOptions {
  count?: number
  rng?: () => number
}

interface Candidate {
  term: string
  translation: string
  difficulty: number
  weight: number
  power: ActionPower
}

const POWER_THRESHOLD = 0.5
const MIN_WEIGHT = 0.25

export function selectBattleActions(
  vocabulary: VocabularyItem[],
  performance: Record<string, WordPerformance> = {},
  options: SelectionOptions = {}
): BattleAction[] {
  if (vocabulary.length === 0) return []

  const candidates: Candidate[] = vocabulary.map((word) => {
    const stats = performance[word.term]
    const attempts = stats?.attempts ?? 0
    const correct = stats?.correct ?? 0
    const accuracy = attempts > 0 ? correct / attempts : 0
    const difficulty = Math.min(1, Math.max(0, 1 - accuracy))
    const power: ActionPower = difficulty >= POWER_THRESHOLD ? 'power' : 'basic'
    const weight = MIN_WEIGHT + difficulty

    return {
      term: word.term,
      translation: word.translation,
      difficulty,
      weight,
      power,
    }
  })

  const count = Math.min(options.count ?? 3, candidates.length)
  const rng = options.rng ?? Math.random
  const remaining = [...candidates].sort((a, b) => b.weight - a.weight)
  const selections: Candidate[] = []

  for (let index = 0; index < count; index += 1) {
    const totalWeight = remaining.reduce((sum, candidate) => sum + candidate.weight, 0)
    const target = rng() * totalWeight
    let running = 0
    let selectedIndex = remaining.length - 1

    for (let pickIndex = 0; pickIndex < remaining.length; pickIndex += 1) {
      running += remaining[pickIndex].weight
      if (target <= running) {
        selectedIndex = pickIndex
        break
      }
    }

    selections.push(remaining[selectedIndex])
    remaining.splice(selectedIndex, 1)
  }

  return selections.map((selection, index) => ({
    id: `${selection.term}-${index}`,
    term: selection.term,
    translation: selection.translation,
    power: selection.power,
    difficulty: selection.difficulty,
  }))
}
