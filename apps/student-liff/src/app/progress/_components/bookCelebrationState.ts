/**
 * "Book complete" confetti should play once per book, not on every visit or
 * data refresh. Seen books are remembered per device (localStorage) and, as a
 * fallback when storage is blocked, for the rest of the session in memory.
 */

export const BOOK_CELEBRATED_KEY_PREFIX = "ta:celebrated:book:";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const celebratedThisSession = new Set<string>();

function safeStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Returns true (and records it) the first time a completed book is seen;
 * false for incomplete books, unknown ids and books already celebrated.
 */
export function claimBookCelebration(
  bookCycleId: string | null | undefined,
  isComplete: boolean | undefined,
  storage: StorageLike | null = safeStorage(),
  seen: Set<string> = celebratedThisSession,
): boolean {
  if (!isComplete || !bookCycleId) return false;
  if (seen.has(bookCycleId)) return false;
  seen.add(bookCycleId);
  const key = BOOK_CELEBRATED_KEY_PREFIX + bookCycleId;
  try {
    if (storage?.getItem(key)) return false;
    storage?.setItem(key, "1");
  } catch {
    // Storage blocked (private mode / webview): the in-memory guard still prevents repeats.
  }
  return true;
}
