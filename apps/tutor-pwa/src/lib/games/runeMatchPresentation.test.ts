import { describe, expect, it } from "vitest";
import { fitRuneLabel, getTimePresentation } from "./runeMatchPresentation";
import { estimateTextWidth } from "./textFit";

describe("Rune Match presentation helpers", () => {
  const words = ["forest", "shield", "dragon", "crystal", "ancient", "journey", "discover", "การเดินทาง", "คริสตัล", "โบราณ"];

  it("never splits a word across lines and keeps every letter", () => {
    for (const cell of [44, 56, 72, 89]) {
      for (const word of words) {
        const label = fitRuneLabel(word, cell, 1, estimateTextWidth);
        // Every letter is kept; Latin words stay on one line. Thai may only
        // break between dictionary words (Intl.Segmenter), never inside one.
        expect(label.text.replaceAll("\n", ""), `${word} @${cell}`).toBe(word);
        if (/^[a-z]+$/.test(word)) expect(label.text, `${word} @${cell}`).toBe(word);
      }
    }
  });

  it("shrinks long words so they fit inside the stone", () => {
    for (const cell of [56, 72]) {
      for (const word of words) {
        const label = fitRuneLabel(word, cell, 1, estimateTextWidth);
        const widest = Math.max(...label.text.split("\n").map((line) => estimateTextWidth(line, label.fontSize)));
        expect(widest, `${word} @${cell}`).toBeLessThanOrEqual(cell - 4 - 14);
      }
    }
  });

  it("wraps multi-word labels at spaces only", () => {
    const label = fitRuneLabel("look after", 56, 1, estimateTextWidth);
    expect(label.text.split("\n").every((line) => ["look", "after", "look after"].includes(line))).toBe(true);
  });

  it("uses a larger font for short words and respects the text-size setting", () => {
    expect(fitRuneLabel("cat", 72, 1, estimateTextWidth).fontSize).toBeGreaterThan(
      fitRuneLabel("discover", 72, 1, estimateTextWidth).fontSize,
    );
    expect(fitRuneLabel("cat", 72, 1.25, estimateTextWidth).fontSize).toBeGreaterThanOrEqual(
      fitRuneLabel("cat", 72, 1, estimateTextWidth).fontSize,
    );
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
