import { describe, expect, it } from "vitest";
import { BOOK_CELEBRATED_KEY_PREFIX, claimBookCelebration } from "./bookCompleteCelebration";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe("claimBookCelebration", () => {
  it("celebrates a completed book only once", () => {
    const storage = memoryStorage();
    const seen = new Set<string>();
    expect(claimBookCelebration("cycle-1", true, storage, seen)).toBe(true);
    expect(storage.map.get(`${BOOK_CELEBRATED_KEY_PREFIX}cycle-1`)).toBe("1");
    expect(claimBookCelebration("cycle-1", true, storage, seen)).toBe(false);
    // A fresh session on the same device remembers it too.
    expect(claimBookCelebration("cycle-1", true, storage, new Set())).toBe(false);
    expect(claimBookCelebration("cycle-2", true, storage, seen)).toBe(true);
  });

  it("never celebrates unfinished books or unknown ids", () => {
    const storage = memoryStorage();
    expect(claimBookCelebration("cycle-1", false, storage, new Set())).toBe(false);
    expect(claimBookCelebration("cycle-1", undefined, storage, new Set())).toBe(false);
    expect(claimBookCelebration(null, true, storage, new Set())).toBe(false);
    expect(storage.map.size).toBe(0);
  });

  it("falls back to the in-memory guard when storage throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const seen = new Set<string>();
    expect(claimBookCelebration("cycle-1", true, broken, seen)).toBe(true);
    expect(claimBookCelebration("cycle-1", true, broken, seen)).toBe(false);
    expect(claimBookCelebration("cycle-1", true, null, seen)).toBe(false);
  });
});
