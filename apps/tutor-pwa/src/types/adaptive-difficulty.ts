export interface ResponseRecord {
  timestamp: number;
  correct: boolean;
  timeMs: number;
}

export interface PerformanceMetrics {
  accuracy: number; // 0-100
  averageSpeed: number; // ms
  currentStreak: number;
  bestStreak: number;
  totalResponses: number;
  windowSize: number;
}

export interface DifficultyParam {
  name: string;
  min: number;
  max: number;
  current: number;
  default: number;
  step: number;
}

export interface DifficultyParams {
  gameId: string;
  params: Map<string, DifficultyParam>;
}

export interface PerformanceScore {
  score: number; // 0-100 composite
  accuracy: number; // 0-100
  speed: number; // 0-100
  streak: number; // 0-100
}

export const DEFAULT_WINDOW_SIZE = 20;

export const WEIGHTS = {
  accuracy: 0.5,
  speed: 0.3,
  streak: 0.2,
} as const;
