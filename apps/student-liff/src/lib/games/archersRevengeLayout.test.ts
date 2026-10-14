import { describe, expect, it } from "vitest";
import { createArchersRevengeState } from "./archersRevenge";
import { ARCHERS_REVENGE_CONFIG } from "./archersRevengeConfig";
import { estimateTextWidth, fitText } from "./textFit";

// Mirrors ArchersRevengeGame: 22px orb, one-line label 16px tall starting 24px
// below the orb centre, as wide as the column gap minus 4px.
const ORB_RADIUS = 22;
const LABEL_TOP = 24;
const LABEL_HEIGHT = 16;

const words = ["forest", "ancient", "journey", "crystal", "dragon", "shield", "การเดินทาง", "คริสตัล", "โบราณ", "มังกร"];
const vocabulary = Array.from({ length: 30 }, (_, i) => ({ id: `w${i}`, term: words[i % words.length], translation: words[(i + 3) % words.length] }));

describe("Archer's Revenge enemy labels", () => {
  const { enemySpacing } = ARCHERS_REVENGE_CONFIG.layout;
  const labelWidth = enemySpacing.x - 4;

  it("spaces rows so a label never reaches the next row's orb", () => {
    expect(LABEL_TOP + LABEL_HEIGHT).toBeLessThanOrEqual(enemySpacing.y - ORB_RADIUS);
  });

  it("keeps every label inside its column gap (no overlap with neighbours)", () => {
    const state = createArchersRevengeState(vocabulary, { difficulty: "extreme", rng: () => 0.42 });
    const boxes = state.enemies.map((enemy) => {
      const label = fitText(enemy.translation, {
        width: labelWidth,
        height: LABEL_HEIGHT,
        maxFontSize: 15,
        minFontSize: 8,
        lineHeight: 1,
        measure: estimateTextWidth,
      });
      const text = label.lines.join(" ");
      expect(text.replaceAll(" ", "")).toBe(enemy.translation.replaceAll(" ", ""));
      const width = estimateTextWidth(text, label.fontSize);
      expect(width).toBeLessThanOrEqual(labelWidth + 0.5);
      return { left: enemy.x - width / 2, right: enemy.x + width / 2, top: enemy.y + LABEL_TOP, bottom: enemy.y + LABEL_TOP + LABEL_HEIGHT };
    });
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        expect(overlap).toBe(false);
      }
    }
  });
});
