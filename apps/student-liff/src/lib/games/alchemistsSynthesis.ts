import type { VocabularyItem } from "@/store/useGameStore";

export type Point = {
  x: number;
  y: number;
};

export type AlchemistsSynthesisState = {
  status: "idle" | "playing" | "gameover" | "victory";
  score: number;
  correctAnswers: number;
  totalAttempts: number;
  gameTime: number;
  currentWord: VocabularyItem | null;
  options: VocabularyItem[];
  difficulty: "easy" | "normal" | "hard";
  round: number;
  maxRounds: number;
};

export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 844;

export function createAlchemistsSynthesisState(
  vocabulary: VocabularyItem[],
  difficulty: "easy" | "normal" | "hard" = "normal"
): AlchemistsSynthesisState {
  const maxRounds =
    difficulty === "easy" ? 5 : difficulty === "normal" ? 7 : 10;
  const shuffled = [...vocabulary].sort(() => Math.random() - 0.5);
  const currentWord = shuffled[0] || null;
  const options = generateOptions(currentWord, shuffled);

  return {
    status: "idle",
    score: 0,
    correctAnswers: 0,
    totalAttempts: 0,
    gameTime: 0,
    currentWord,
    options,
    difficulty,
    round: 1,
    maxRounds,
  };
}

export function generateOptions(
  currentWord: VocabularyItem | null,
  vocabulary: VocabularyItem[]
): VocabularyItem[] {
  if (!currentWord) return [];

  const wrongOptions = vocabulary
    .filter((v) => v.term !== currentWord.term)
    .slice(0, 3);

  return [currentWord, ...wrongOptions].sort(() => Math.random() - 0.5);
}

export function advanceAlchemistsSynthesisTime(
  state: AlchemistsSynthesisState,
  deltaMs: number
): AlchemistsSynthesisState {
  if (state.status !== "playing") return state;

  const newGameTime = state.gameTime + deltaMs;

  if (newGameTime >= 60000) {
    return {
      ...state,
      status: "gameover",
      gameTime: newGameTime,
    };
  }

  return {
    ...state,
    gameTime: newGameTime,
  };
}

export function handleAnswer(
  state: AlchemistsSynthesisState,
  selectedWord: VocabularyItem,
  vocabulary: VocabularyItem[]
): AlchemistsSynthesisState {
  if (state.status !== "playing" || !state.currentWord) return state;

  const isCorrect = selectedWord.term === state.currentWord.term;
  const newCorrectAnswers = isCorrect
    ? state.correctAnswers + 1
    : state.correctAnswers;
  const newTotalAttempts = state.totalAttempts + 1;
  const newScore = isCorrect ? state.score + 10 : state.score;
  const newRound = state.round + 1;

  if (newRound > state.maxRounds) {
    return {
      ...state,
      status: newCorrectAnswers >= state.maxRounds / 2 ? "victory" : "gameover",
      score: newScore,
      correctAnswers: newCorrectAnswers,
      totalAttempts: newTotalAttempts,
      round: newRound,
    };
  }

  const shuffled = [...vocabulary].sort(() => Math.random() - 0.5);
  const newCurrentWord = shuffled[0] || null;
  const newOptions = generateOptions(newCurrentWord, shuffled);

  return {
    ...state,
    score: newScore,
    correctAnswers: newCorrectAnswers,
    totalAttempts: newTotalAttempts,
    round: newRound,
    currentWord: newCurrentWord,
    options: newOptions,
  };
}

export type AlchemistsSynthesisResult = {
  xp: number;
  accuracy: number;
  score: number;
  correctAnswers: number;
  totalAttempts: number;
  gameTime: number;
  difficulty: string;
};

export function getAlchemistsSynthesisResults(
  state: AlchemistsSynthesisState
): AlchemistsSynthesisResult {
  const accuracy =
    state.totalAttempts > 0 ? state.correctAnswers / state.totalAttempts : 0;

  return {
    xp: Math.floor(state.correctAnswers * accuracy),
    accuracy,
    score: state.score,
    correctAnswers: state.correctAnswers,
    totalAttempts: state.totalAttempts,
    gameTime: state.gameTime,
    difficulty: state.difficulty,
  };
}
