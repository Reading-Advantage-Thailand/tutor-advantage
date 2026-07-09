export interface Participant {
  studentId: string;
  name: string;
  pictureUrl?: string;
  score: number;
  [key: string]: any;
}

export interface VocabularyWord {
  vocabulary?: string;
  word?: string;
  text?: string;
  translation?: string;
  meaning?: string;
  [key: string]: any;
}

export interface Sentence {
  text: string;
  translation?: string;
  [key: string]: any;
}

export interface Question {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  [key: string]: any;
}

export interface ArticleData {
  id: string;
  title: string;
  imageUrl?: string;
  summary?: string;
  cefrLevel?: string;
  isCompleted?: boolean;
  content: {
    words: VocabularyWord[];
    sentences: Sentence[];
    comprehensionQuestions: Question[];
    [key: string]: any;
  };
  [key: string]: any;
}

export interface LessonPair {
  pairNumber: number;
  members: { studentId: string; name: string; pictureUrl?: string }[];
}

export type GameCategory = "vocabulary" | "sentence";
export type GamePhaseStatus = "voting" | "countdown" | "playing" | "results";

export interface GamePhaseResult {
  studentId: string;
  name: string;
  gameId: string;
  score: number;
  correct?: number;
  total?: number;
  durationMs?: number;
  submittedAt: number;
}

export interface GamePhaseState {
  phase: number;
  category: GameCategory;
  status: GamePhaseStatus;
  votes: Record<string, string>;
  selectedGameId?: string;
  countdownEndsAt?: number;
  results: Record<string, GamePhaseResult>;
}

export interface TutorSessionData {
  sessionId: string;
  currentPhase: number;
  articleData?: ArticleData;
  phaseSelectedIndices?: Record<number, number>;
  pairs?: LessonPair[] | null;
  gameState?: GamePhaseState | null;
  [key: string]: any;
}

export interface AnswerData {
  studentId: string;
  name: string;
  [key: string]: any;
}
