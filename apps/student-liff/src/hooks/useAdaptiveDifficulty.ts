import { useCallback, useRef, useState } from 'react';
import { usePerformanceMetrics } from './usePerformanceMetrics';
import { modifyParameters, type ParameterModifierResult } from '@/lib/adaptive-difficulty/parameter-modifier';
import { getDifficultyParams } from '@/lib/adaptive-difficulty/registerDifficultyParams';
import type { PerformanceScore } from '@/types/adaptive-difficulty';

interface UseAdaptiveDifficultyOptions {
  gameId: string;
  adaptive?: boolean;
}

export interface AdaptiveDifficultyState {
  isEnabled: boolean;
  currentParams: Map<string, number> | null;
  lastAdjustment: ParameterModifierResult | null;
  responseCount: number;
  performanceScore: PerformanceScore | null;
}

export interface UseAdaptiveDifficultyReturn {
  recordResponse: (correct: boolean, timeMs: number) => void;
  getCurrentParams: () => Map<string, number> | null;
  getParamValue: (name: string, defaultValue: number) => number;
  isEnabled: boolean;
  state: AdaptiveDifficultyState;
}

export function useAdaptiveDifficulty({
  gameId,
  adaptive = false,
}: UseAdaptiveDifficultyOptions): UseAdaptiveDifficultyReturn {
  const { recordResponse: recordPerf, getScore } = usePerformanceMetrics();
  const [lastAdjustment, setLastAdjustment] = useState<ParameterModifierResult | null>(null);
  const [responseCount, setResponseCount] = useState(0);
  const [performanceScore, setPerformanceScore] = useState<PerformanceScore | null>(null);
  const adjustmentInProgress = useRef(false);

  const recordResponse = useCallback(
    (correct: boolean, timeMs: number) => {
      if (!adaptive) {
        return;
      }

      // Record performance metrics
      recordPerf(correct, timeMs);
      const score = getScore();
      setPerformanceScore(score);
      setResponseCount((prev) => prev + 1);

      // Avoid concurrent adjustments
      if (adjustmentInProgress.current) {
        return;
      }

      adjustmentInProgress.current = true;
      try {
        // Run adjustment algorithm
        const result = modifyParameters(gameId, score);
        if (result) {
          setLastAdjustment(result);
        }
      } finally {
        adjustmentInProgress.current = false;
      }
    },
    [adaptive, gameId, recordPerf, getScore]
  );

  const getCurrentParams = useCallback((): Map<string, number> | null => {
    if (!adaptive) {
      return null;
    }

    const params = getDifficultyParams(gameId);
    if (!params) {
      return null;
    }

    // Build current parameter map from last adjustment or defaults
    const currentMap = new Map<string, number>();
    if (lastAdjustment) {
      for (const modified of lastAdjustment.modifiedParams) {
        currentMap.set(modified.name, modified.newValue);
      }
    } else {
      for (const [name, param] of params.params) {
        currentMap.set(name, param.current);
      }
    }

    return currentMap;
  }, [adaptive, gameId, lastAdjustment]);

  const getParamValue = useCallback(
    (name: string, defaultValue: number): number => {
      if (!adaptive) {
        return defaultValue;
      }

      const currentParams = getCurrentParams();
      if (currentParams?.has(name)) {
        return currentParams.get(name)!;
      }

      // Fallback to registered params
      const params = getDifficultyParams(gameId);
      if (params?.params.has(name)) {
        return params.params.get(name)!.current;
      }

      return defaultValue;
    },
    [adaptive, gameId, getCurrentParams]
  );

  const state: AdaptiveDifficultyState = {
    isEnabled: adaptive,
    currentParams: getCurrentParams(),
    lastAdjustment,
    responseCount,
    performanceScore,
  };

  return {
    recordResponse,
    getCurrentParams,
    getParamValue,
    isEnabled: adaptive,
    state,
  };
}
