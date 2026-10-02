import { describe, expect, it } from "vitest";
import { badgeTone, computeTierProgress, hasPerformanceSignal } from "./performance-data";

describe("computeTierProgress", () => {
  it("measures progress from 0 to the first tier", () => {
    expect(computeTierProgress(5000, 20000)).toEqual({
      prevTier: 0,
      target: 20000,
      progress: 25,
      remaining: 15000,
      isMaxTier: false,
    });
  });

  it("measures progress between two tiers", () => {
    const p = computeTierProgress(60000, 100000);
    expect(p.prevTier).toBe(20000);
    expect(p.progress).toBe(50);
    expect(p.remaining).toBe(40000);
  });

  it("is 100% at the max tier", () => {
    const p = computeTierProgress(650000, 0);
    expect(p.isMaxTier).toBe(true);
    expect(p.progress).toBe(100);
    expect(p.target).toBe(500000);
  });

  it("defaults the target to the first tier when nothing is known", () => {
    expect(computeTierProgress(0, 0).target).toBe(20000);
  });
});

describe("hasPerformanceSignal", () => {
  it("is false without data", () => {
    expect(hasPerformanceSignal(null)).toBe(false);
    expect(hasPerformanceSignal({})).toBe(false);
  });
  it("is true for any activity, metric, badge or goal", () => {
    expect(hasPerformanceSignal({ metrics: { activity: { completedClasses: 1 } } })).toBe(true);
    expect(
      hasPerformanceSignal({ metrics: { engagement: { rating: { value: 4.5, source: "actual", sampleSize: 2 } } } }),
    ).toBe(true);
    expect(
      hasPerformanceSignal({
        badges: { nextGoal: { code: "x", label: "x", description: "", icon: "Star", progress: 10 } },
      }),
    ).toBe(true);
  });
});

describe("badgeTone", () => {
  it("maps API tailwind classes to tile tones", () => {
    expect(badgeTone("bg-amber-100 text-amber-600")).toBe("amber");
    expect(badgeTone("bg-emerald-500/10 text-emerald-600")).toBe("brand");
    expect(badgeTone("text-indigo-600 bg-indigo-50")).toBe("blue");
    expect(badgeTone("text-rose-500")).toBe("pink");
    expect(badgeTone("something-else")).toBe("neutral");
    expect(badgeTone(undefined)).toBe("amber");
  });
});
