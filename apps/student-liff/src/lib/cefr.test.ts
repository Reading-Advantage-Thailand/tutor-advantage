import { describe, expect, it } from "vitest";
import {
  CEFR_FILTER_LEVELS,
  cefrFilterChipId,
  cefrTone,
  formatLevelLabel,
  getLevelTone,
  levelToneClass,
  normalizeCefr,
} from "./cefr";

describe("normalizeCefr", () => {
  it("trims and upper-cases, null for empty or non-strings", () => {
    expect(normalizeCefr(" b1 ")).toBe("B1");
    expect(normalizeCefr("")).toBeNull();
    expect(normalizeCefr(null)).toBeNull();
    expect(normalizeCefr(undefined)).toBeNull();
    expect(normalizeCefr(3)).toBeNull();
  });
});

describe("getLevelTone", () => {
  it("gives every catalog level its own colour", () => {
    expect(getLevelTone("A0")).toBe("teal");
    expect(getLevelTone("A1")).toBe("brand");
    expect(getLevelTone("A2")).toBe("orange");
    expect(getLevelTone("B1")).toBe("blue");
    expect(getLevelTone("B2")).toBe("purple");
    expect(getLevelTone("C1")).toBe("pink");
    const tones = CEFR_FILTER_LEVELS.map((level) => getLevelTone(level));
    expect(new Set(tones).size).toBe(CEFR_FILTER_LEVELS.length);
    expect(tones).not.toContain("neutral");
  });

  it("normalises case and whitespace", () => {
    expect(getLevelTone(" b2 ")).toBe("purple");
    expect(getLevelTone("a0")).toBe("teal");
  });

  it("falls back by family for unlisted levels", () => {
    expect(getLevelTone("C2")).toBe("pink");
    expect(getLevelTone("B3")).toBe("blue");
    expect(getLevelTone("A3")).toBe("brand");
  });

  it("never throws on null / unknown (Primary books have no CEFR)", () => {
    expect(getLevelTone(null)).toBe("neutral");
    expect(getLevelTone(undefined)).toBe("neutral");
    expect(getLevelTone(42)).toBe("neutral");
    expect(getLevelTone("")).toBe("neutral");
    expect(getLevelTone("Pre-A1")).toBe("neutral");
    expect(getLevelTone("Beginner")).toBe("neutral");
  });

  it("keeps cefrTone as an alias", () => {
    expect(cefrTone).toBe(getLevelTone);
  });
});

describe("levelToneClass", () => {
  it("has soft / solid / text classes for every tone", () => {
    for (const level of [...CEFR_FILTER_LEVELS, null]) {
      const tone = getLevelTone(level);
      const classes = levelToneClass[tone];
      expect(classes.soft).toMatch(/^bg-/);
      expect(classes.solid).toMatch(/^bg-/);
      expect(classes.text).toMatch(/^text-/);
    }
    expect(levelToneClass.orange.solid).toBe("bg-icon-orange");
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
