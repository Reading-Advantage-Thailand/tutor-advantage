import { describe, expect, it } from "vitest";
import { getAiScoreTone, getScoreStars } from "./aiScore";

describe("getAiScoreTone / getScoreStars", () => {
  it("keeps the old thresholds", () => {
    expect(getAiScoreTone(5)).toBe("success");
    expect(getAiScoreTone(4)).toBe("success");
    expect(getAiScoreTone(3.5)).toBe("warning");
    expect(getAiScoreTone(2)).toBe("warning");
    expect(getAiScoreTone(1)).toBe("danger");
    expect(getAiScoreTone(0)).toBe("danger");
  });

  it("draws rounded stars and never a negative count", () => {
    expect(getScoreStars(3)).toBe("⭐⭐⭐");
    expect(getScoreStars(2.6)).toBe("⭐⭐⭐");
    expect(getScoreStars(0)).toBe("");
    expect(getScoreStars(-2)).toBe("");
  });
});
