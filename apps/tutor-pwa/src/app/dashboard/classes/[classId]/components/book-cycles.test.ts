import { describe, expect, it } from "vitest";
import { initialCycleId, openingCycleProgress, type BookCycle } from "./book-cycles";

function cycle(id: string, status: string, progress: BookCycle["progress"]): BookCycle {
  return { id, bookId: `book-${id}`, sequence: 1, title: `Book ${id}`, status, packagePriceSatang: 0, progress };
}

describe("openingCycleProgress", () => {
  it("uses the cycle the lesson picker opens on", () => {
    const cycles = [
      cycle("a", "closed", { completedArticles: 14, totalArticles: 14, percent: 100 }),
      cycle("b", "open", { completedArticles: 2, totalArticles: 12, percent: 17 }),
    ];
    expect(initialCycleId(cycles)).toBe("b");
    expect(openingCycleProgress(cycles, 14)?.progress.totalArticles).toBe(12);
  });

  it("keeps the cycle's own total when the book's article count is larger", () => {
    const cycles = [cycle("a", "open", { completedArticles: 13, totalArticles: 13, percent: 100 })];
    expect(openingCycleProgress(cycles, 14)?.progress.totalArticles).toBe(13);
  });

  it("returns null for a demo class whose one cycle counts more lessons than it lists", () => {
    const cycles = [cycle("a", "open", { completedArticles: 0, totalArticles: 14, percent: 0 })];
    expect(openingCycleProgress(cycles, 1)).toBeNull();
  });

  it("returns null without progress or a total", () => {
    expect(openingCycleProgress([], 14)).toBeNull();
    expect(openingCycleProgress([cycle("a", "open", null)], 14)).toBeNull();
    expect(openingCycleProgress([cycle("a", "open", { completedArticles: 0, totalArticles: 0, percent: 0 })], 14)).toBeNull();
  });
});
