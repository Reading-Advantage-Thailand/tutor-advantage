import { useState, useCallback } from 'react';
import {
  type ResponseRecord,
  type PerformanceMetrics,
  type PerformanceScore,
  DEFAULT_WINDOW_SIZE,
  WEIGHTS,
} from '@/types/adaptive-difficulty';

interface UsePerformanceMetricsOptions {
  windowSize?: number;
}

interface UsePerformanceMetricsReturn {
  recordResponse: (correct: boolean, timeMs: number) => void;
  getScore: () => PerformanceScore;
  getMetrics: () => PerformanceMetrics;
  reset: () => void;
}

function normalizeSpeed(averageTimeMs: number): number {
  // Normalize speed: faster = higher score
  // 0-1s: 100, 1-3s: 80-100, 3-5s: 60-80, 5-10s: 40-60, >10s: 0-40
  if (averageTimeMs <= 1000) return 100;
  if (averageTimeMs <= 3000) return 80 + ((3000 - averageTimeMs) / 2000) * 20;
  if (averageTimeMs <= 5000) return 60 + ((5000 - averageTimeMs) / 2000) * 20;
  if (averageTimeMs <= 10000) return 40 + ((10000 - averageTimeMs) / 5000) * 20;
  return Math.max(0, 40 - ((averageTimeMs - 10000) / 10000) * 40);
}

function normalizeStreak(currentStreak: number): number {
  // Normalize streak: 0=0, 1=20, 2=40, 3=60, 4=80, 5+=100
  if (currentStreak <= 0) return 0;
  if (currentStreak >= 5) return 100;
  return currentStreak * 20;
}

export function usePerformanceMetrics(
  options: UsePerformanceMetricsOptions = {}
): UsePerformanceMetricsReturn {
  const windowSize = options.windowSize ?? DEFAULT_WINDOW_SIZE;
  const [records, setRecords] = useState<ResponseRecord[]>([]);

  const recordResponse = useCallback(
    (correct: boolean, timeMs: number) => {
      const record: ResponseRecord = {
        timestamp: Date.now(),
        correct,
        timeMs,
      };

      setRecords((prev) => {
        const newRecords = [...prev, record];
        // Maintain rolling window
        if (newRecords.length > windowSize) {
          return newRecords.slice(newRecords.length - windowSize);
        }
        return newRecords;
      });
    },
    [windowSize]
  );

  const calculateMetrics = useCallback((): PerformanceMetrics => {
    if (records.length === 0) {
      return {
        accuracy: 0,
        averageSpeed: 0,
        currentStreak: 0,
        bestStreak: 0,
        totalResponses: 0,
        windowSize,
      };
    }

    const correctCount = records.filter((r) => r.correct).length;
    const accuracy = (correctCount / records.length) * 100;

    const totalTime = records.reduce((sum, r) => sum + r.timeMs, 0);
    const averageSpeed = totalTime / records.length;

    // Calculate streaks
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    for (const record of records) {
      if (record.correct) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    // Current streak is from the end
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].correct) {
        currentStreak++;
      } else {
        break;
      }
    }

    return {
      accuracy,
      averageSpeed,
      currentStreak,
      bestStreak,
      totalResponses: records.length,
      windowSize,
    };
  }, [records, windowSize]);

  const getScore = useCallback((): PerformanceScore => {
    const metrics = calculateMetrics();

    if (metrics.totalResponses === 0) {
      return {
        score: 0,
        accuracy: 0,
        speed: 0,
        streak: 0,
      };
    }

    const accuracyScore = metrics.accuracy;
    const speedScore = normalizeSpeed(metrics.averageSpeed);
    const streakScore = normalizeStreak(metrics.currentStreak);

    const compositeScore =
      accuracyScore * WEIGHTS.accuracy +
      speedScore * WEIGHTS.speed +
      streakScore * WEIGHTS.streak;

    return {
      score: Math.round(compositeScore),
      accuracy: Math.round(accuracyScore),
      speed: Math.round(speedScore),
      streak: Math.round(streakScore),
    };
  }, [calculateMetrics]);

  const getMetrics = useCallback((): PerformanceMetrics => {
    return calculateMetrics();
  }, [calculateMetrics]);

  const reset = useCallback(() => {
    setRecords([]);
  }, []);

  return {
    recordResponse,
    getScore,
    getMetrics,
    reset,
  };
}
