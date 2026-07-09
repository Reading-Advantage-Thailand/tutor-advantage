export interface SessionHint {
  gameId: string;
  params: Record<string, number>;
  timestamp: number;
}

const STORAGE_KEY = 'adaptive-difficulty-hints';

function getStorageData(): Record<string, SessionHint> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {};
    }
    const parsed = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function setStorageData(data: Record<string, SessionHint>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function isValidHint(hint: unknown): hint is SessionHint {
  if (typeof hint !== 'object' || hint === null) {
    return false;
  }
  
  const h = hint as Record<string, unknown>;
  
  if (typeof h.gameId !== 'string') {
    return false;
  }
  
  if (typeof h.params !== 'object' || h.params === null) {
    return false;
  }
  
  if (typeof h.timestamp !== 'number') {
    return false;
  }
  
  return true;
}

export function saveSessionHint(hint: SessionHint): void {
  const data = getStorageData();
  data[hint.gameId] = hint;
  setStorageData(data);
}

export function loadSessionHint(gameId: string): SessionHint | null {
  const data = getStorageData();
  const hint = data[gameId];
  
  if (!hint || !isValidHint(hint)) {
    return null;
  }
  
  return hint;
}

export function clearSessionHint(gameId: string): void {
  const data = getStorageData();
  delete data[gameId];
  setStorageData(data);
}

export function hasSessionHint(gameId: string): boolean {
  return loadSessionHint(gameId) !== null;
}

export function getAllSessionHints(): Record<string, SessionHint> {
  const data = getStorageData();
  const validHints: Record<string, SessionHint> = {};
  
  for (const [gameId, hint] of Object.entries(data)) {
    if (isValidHint(hint)) {
      validHints[gameId] = hint;
    }
  }
  
  return validHints;
}

export function clearAllSessionHints(): void {
  localStorage.removeItem(STORAGE_KEY);
}
