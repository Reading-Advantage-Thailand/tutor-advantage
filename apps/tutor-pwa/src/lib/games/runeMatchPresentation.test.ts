import { describe, expect, it } from "vitest";
import {
  formatRuneLabel,
  getRuneLabelMetrics,
  getTimePresentation,
} from "./runeMatchPresentation";

describe("Rune Match presentation helpers", () => {
  it("wraps long unbroken English and Thai labels instead of hiding them", () => {
    expect(formatRuneLabel("discover")).toBe("disc\nover");
    expect(formatRuneLabel("การเดินทาง").replaceAll("\n", "")).toBe("การเดินทาง");
    expect(formatRuneLabel("forest")).toBe("forest");
  });

  it("uses a larger label for short words and keeps long labels inside the rune", () => {
    const shortLabel = getRuneLabelMetrics("cat", 72);
    const longLabel = getRuneLabelMetrics("การเดินทางผจญภัย", 72);

    expect(shortLabel.fontSize).toBeGreaterThan(longLabel.fontSize);
    expect(longLabel.fontSize).toBeGreaterThanOrEqual(12);
    expect(shortLabel.fontSize).toBeLessThanOrEqual(24);
  });

  it("respects the accessibility text multiplier within the safe cell limit", () => {
    const normal = getRuneLabelMetrics("forest", 64, 1);
    const enlarged = getRuneLabelMetrics("forest", 64, 1.25);

    expect(enlarged.fontSize).toBeGreaterThanOrEqual(normal.fontSize);
    expect(enlarged.fontSize).toBeLessThanOrEqual(Math.round(64 * 0.34));
  });

  it("makes the final fifth of the timer visually urgent", () => {
    expect(getTimePresentation(60_000, 60_000)).toMatchObject({
      seconds: 60,
      urgent: false,
      color: "#34d399",
    });
    expect(getTimePresentation(12_000, 60_000)).toMatchObject({
      seconds: 12,
      urgent: true,
      color: "#ef4444",
    });
  });
});
