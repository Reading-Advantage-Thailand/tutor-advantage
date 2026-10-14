import { describe, expect, it } from "vitest";
import {
  classesResourceKey,
  classesResourcePrefix,
  getClassStatusBadge,
  isClassFilterActive,
  resolveSearchQuery,
  SEARCH_DEBOUNCE_MS,
  searchDebounceDelay,
} from "./classesList";

describe("classes cache keys", () => {
  it("keys every (cefr, q) pair under the student's prefix", () => {
    expect(classesResourcePrefix("u1")).toBe("u1:classes:");
    expect(classesResourceKey("u1", "", null)).toBe("u1:classes:*:");
    expect(classesResourceKey("u1", "ครู เอ ", "A1")).toBe("u1:classes:A1:ครู เอ ");
    expect(classesResourceKey("u1", "x", null).startsWith(classesResourcePrefix("u1"))).toBe(true);
  });
});

describe("resolveSearchQuery", () => {
  it("applies an emptied search box at once and otherwise waits for the debounce", () => {
    expect(resolveSearchQuery("", "old text")).toBe("");
    expect(resolveSearchQuery("rea", "re")).toBe("re");
    expect(resolveSearchQuery("read", "read")).toBe("read");
  });
});

describe("searchDebounceDelay", () => {
  it("debounces typing but settles an emptied box at once", () => {
    expect(searchDebounceDelay("")).toBe(0);
    expect(searchDebounceDelay("a")).toBe(SEARCH_DEBOUNCE_MS);
    expect(SEARCH_DEBOUNCE_MS).toBe(400);
  });
});

describe("isClassFilterActive", () => {
  it("is true for a query or a level", () => {
    expect(isClassFilterActive("", null)).toBe(false);
    expect(isClassFilterActive("a", null)).toBe(true);
    expect(isClassFilterActive("", "A0")).toBe(true);
  });
});

describe("getClassStatusBadge", () => {
  it("only badges full and closed classes", () => {
    expect(getClassStatusBadge("open")).toBeNull();
    expect(getClassStatusBadge("full")).toBe("full");
    expect(getClassStatusBadge("closed")).toBe("closed");
    expect(getClassStatusBadge("weird")).toBeNull();
  });
});
