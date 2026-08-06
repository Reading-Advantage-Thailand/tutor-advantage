import { AdjustmentEngine } from './adjustment-engine';
import { getDifficultyParams } from './registerDifficultyParams';
import type { PerformanceScore } from '@/types/adaptive-difficulty';

export interface ModifiedParam {
  name: string;
  oldValue: number;
  newValue: number;
  delta: number;
  direction: 'increase' | 'decrease' | 'hold';
}

export interface ParameterModifierResult {
  gameId: string;
  modifiedParams: ModifiedParam[];
  overallDirection: 'increase' | 'decrease' | 'hold';
  performanceScore: number;
  emaScore: number;
}

// Module-level map to persist AdjustmentEngine state per game
const engineRegistry: Map<string, AdjustmentEngine> = new Map();

export function getEngineForGame(gameId: string): AdjustmentEngine {
  let engine = engineRegistry.get(gameId);
  if (!engine) {
    engine = new AdjustmentEngine();
    engineRegistry.set(gameId, engine);
  }
  return engine;
}

export function resetEngineRegistry(): void {
  engineRegistry.clear();
}

export function modifyParameters(
  gameId: string,
  performanceScore: PerformanceScore
): ParameterModifierResult | null {
  const params = getDifficultyParams(gameId);
  if (!params) {
    return null;
  }

  const engine = getEngineForGame(gameId);
  const modifiedParams: ModifiedParam[] = [];
  let increaseCount = 0;
  let decreaseCount = 0;

  for (const [name, param] of params.params) {
    const result = engine.adjustParameter(
      param.current,
      param.min,
      param.max,
      performanceScore
    );

    modifiedParams.push({
      name,
      oldValue: param.current,
      newValue: result.adjustedValue,
      delta: result.delta,
      direction: result.direction,
    });

    if (result.direction === 'increase') increaseCount++;
    if (result.direction === 'decrease') decreaseCount++;
  }

  // Determine overall direction
  let overallDirection: 'increase' | 'decrease' | 'hold';
  if (increaseCount > decreaseCount) {
    overallDirection = 'increase';
  } else if (decreaseCount > increaseCount) {
    overallDirection = 'decrease';
  } else {
    overallDirection = 'hold';
  }

  return {
    gameId,
    modifiedParams,
    overallDirection,
    performanceScore: performanceScore.score,
    emaScore: engine.getEmaScore(),
  };
}
