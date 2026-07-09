import { type DifficultyParam, type DifficultyParams } from '@/types/adaptive-difficulty';

// Module-level registry for difficulty parameters
const difficultyRegistry: Map<string, DifficultyParams> = new Map();

export function registerDifficultyParams(
  gameId: string,
  params: Record<string, Omit<DifficultyParam, 'name'>>
): DifficultyParams {
  const paramMap = new Map<string, DifficultyParam>();

  for (const [name, config] of Object.entries(params)) {
    paramMap.set(name, {
      name,
      ...config,
    });
  }

  const difficultyParams: DifficultyParams = {
    gameId,
    params: paramMap,
  };

  difficultyRegistry.set(gameId, difficultyParams);
  return difficultyParams;
}

export function getDifficultyParams(gameId: string): DifficultyParams | undefined {
  return difficultyRegistry.get(gameId);
}

export function hasDifficultyParams(gameId: string): boolean {
  return difficultyRegistry.has(gameId);
}

export function unregisterDifficultyParams(gameId: string): boolean {
  return difficultyRegistry.delete(gameId);
}

export function getAllRegisteredGames(): string[] {
  return Array.from(difficultyRegistry.keys());
}

export function resetDifficultyRegistry(): void {
  difficultyRegistry.clear();
}
