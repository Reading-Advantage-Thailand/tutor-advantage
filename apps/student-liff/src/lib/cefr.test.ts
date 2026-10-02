import { describe, expect, it } from "vitest";
import { CEFR_FILTER_LEVELS, cefrFilterChipId, cefrTone, formatLevelLabel, normalizeCefr } from "./cefr";

describe("normalizeCefr", () => {
  it("trims and upper-cases, null for empty or non-strings", () => {
    expect(normalizeCefr(" b1 ")).toBe("B1");
    expect(normalizeCefr("")).toBeNull();
    expect(normalizeCefr(null)).toBeNull();
    expect(normalizeCefr(undefined)).toBeNull();
    expect(normalizeCefr(3)).toBeNull();
  });
});

describe("cefrTone", () => {
  it("groups levels into colour families", () => {
    expect(cefrTone("A0")).toBe("brand");
    expect(cefrTone("A2")).toBe("brand");
    expect(cefrTone("B1")).toBe("blue");
    expect(cefrTone("b2")).toBe("blue");
    expect(cefrTone("C1")).toBe("purple");
  });

  it("never throws on null (Primary books have no CEFR)", () => {
    expect(cefrTone(null)).toBe("neutral");
    expect(cefrTone("Pre-A1")).toBe("neutral");
  });
});

describe("formatLevelLabel", () => {
  it("formats level and falls back to A1 / 1", () => {
    expect(formatLevelLabel("A0", 31)).toBe("A0 · Lv.31");
    expect(formatLevelLabel("", 0)).toBe("A1 · Lv.1");
    expect(formatLevelLabel(null, undefined, "ระดับ ")).toBe("A1 · ระดับ 1");
  });
});

describe("cefrFilterChipId", () => {
  it("keeps the legacy chip ids", () => {
    expect(cefrFilterChipId(null, "ทั้งหมด")).toBe("chip-filter-ทั้งหมด");
    expect(cefrFilterChipId("A1", "ทั้งหมด")).toBe("chip-filter-reading-a1");
  });

  it("offers A0 through C1", () => {
    expect(CEFR_FILTER_LEVELS).toEqual(["A0", "A1", "A2", "B1", "B2", "C1"]);
  });
});
