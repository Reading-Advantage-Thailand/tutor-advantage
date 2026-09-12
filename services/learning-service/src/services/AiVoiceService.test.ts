import { describe, expect, it } from "vitest";
import { calculateUnlockedSeconds } from "./voiceEntitlement";

describe("AI voice entitlement", () => {
  it("unlocks five minutes plus a proportional share of the grace pool", () => {
    const expected = [0, 385, 771, 1_157, 1_542, 1_928, 2_314, 2_700, 3_085, 3_471, 3_857, 4_242, 4_628, 5_014, 5_400];
    expected.forEach((seconds, completedArticles) => {
      expect(calculateUnlockedSeconds(completedArticles, 14)).toBe(seconds);
    });
  });

  it("clamps invalid completion counts", () => {
    expect(calculateUnlockedSeconds(-1, 14)).toBe(0);
    expect(calculateUnlockedSeconds(99, 14)).toBe(5_400);
    expect(calculateUnlockedSeconds(1, 0)).toBe(0);
  });
});
