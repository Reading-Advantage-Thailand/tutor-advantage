import { describe, expect, it } from "vitest";
import {
  cellPosition,
  clampLabelCenter,
  computeRuneMatchLayout,
  fitRuneLabel,
  getTimePresentation,
  RUNE_LABEL_MIN_FONT,
} from "./runeMatchPresentation";
import { estimateTextWidth } from "./textFit";
import { RUNE_MATCH_CONFIG } from "./runeMatchConfig";

describe("Rune Match presentation helpers", () => {
  const words = ["forest", "shield", "dragon", "crystal", "ancient", "journey", "discover", "การเดินทาง", "คริสตัล", "โบราณ"];
  const hardWords = ["imperceptible", "anachronism", "constituent", "Whispering Woods", "ผู้ที่ยึดถือปฏิบัติมากกว่าอุดมคติ", "อยู่ในสถานการณ์ที่ยากลำบาก"];
  // Tiles real phones get: 360x640 phone up to a tablet.
  const realCells = [79, 84, 91, 130];

  it("keeps every letter, and a short word stays on one line on a real tile", () => {
    for (const cell of [72, 89]) {
      for (const word of words) {
        const label = fitRuneLabel(word, cell, 1, estimateTextWidth);
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
        expect(widest, `${word} @${cell}`).toBeLessThanOrEqual(cell - 4 - 8);
      }
    }
  });

  it("never draws a word under the floor on a real tile, cutting it if it must", () => {
    for (const cell of realCells) {
      for (const word of hardWords) {
        const label = fitRuneLabel(word, cell, 1, estimateTextWidth);
        expect(label.fontSize, `${word} @${cell}`).toBeGreaterThanOrEqual(RUNE_LABEL_MIN_FONT);
      }
    }
  });

  it("cuts a too-long English word with a hyphen and loses no letter", () => {
    const label = fitRuneLabel("imperceptible", 60, 1, estimateTextWidth);
    const lines = label.text.split("\n");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.slice(0, -1).every((line) => line.endsWith("-"))).toBe(true);
    expect(label.text.replaceAll("-\n", "")).toBe("imperceptible");
  });

  it("does not start a Thai line on a mark that belongs to the letter before it", () => {
    const label = fitRuneLabel("ประสิทธิภาพ", 48, 1, estimateTextWidth);
    expect(label.text.replaceAll("\n", "")).toBe("ประสิทธิภาพ");
    expect(label.text).toContain("\n");
    for (const line of label.text.split("\n")) {
      expect(line).not.toMatch(/^[ะัาำิ-ฺๅ็-๎]/);
    }
  });

  it("keeps the floor for a whole phrase on one tile and ends it with an ellipsis", () => {
    const phrase = "ความยั่งยืนทางสิ่งแวดล้อมและการจัดการทรัพยากรธรรมชาติอย่างมีประสิทธิภาพ";
    for (const cell of realCells.slice(0, 2)) {
      const label = fitRuneLabel(phrase, cell, 1, estimateTextWidth);
      const lines = label.text.split("\n");
      expect(label.fontSize, `@${cell}`).toBe(RUNE_LABEL_MIN_FONT);
      expect(label.text.endsWith("…"), `@${cell}`).toBe(true);
      expect(lines.length * label.fontSize * label.lineHeight, `@${cell}`).toBeLessThanOrEqual((cell - 4) * 0.8 - 4);
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

describe("Rune Match layout", () => {
  const { rows, columns } = RUNE_MATCH_CONFIG.grid;
  const screens: [number, number, number][] = [
    // width, height, smallest tile
    [390, 844, 90],
    [360, 780, 84],
    [360, 640, 76],
    [375, 667, 80],
    [844, 390, 85],
    [800, 360, 80],
    [740, 360, 78],
    [640, 360, 72],
    [768, 1024, 100],
    [1280, 800, 120],
  ];

  it("gives big tiles on every screen and puts nothing off screen", () => {
    for (const [width, height, smallest] of screens) {
      const layout = computeRuneMatchLayout(width, height);
      const name = `${width}x${height}`;
      expect(layout.cellSize, name).toBeGreaterThanOrEqual(smallest);
      expect(layout.gridX, name).toBeGreaterThanOrEqual(0);
      expect(layout.gridX + layout.gridWidth, name).toBeLessThanOrEqual(width);
      expect(layout.gridY + layout.gridHeight, name).toBeLessThanOrEqual(height);
      expect(layout.skills.y + layout.skills.height, name).toBeLessThanOrEqual(height);
      expect(layout.skills.x + layout.skills.width, name).toBeLessThanOrEqual(width);
      expect(layout.strip.y + layout.strip.height, name).toBeLessThanOrEqual(height);
    }
  });

  it("never lets the board overlap the panel, the message or the buttons in portrait", () => {
    for (const [width, height] of screens.filter(([w, h]) => w < h)) {
      const layout = computeRuneMatchLayout(width, height);
      const name = `${width}x${height}`;
      expect(layout.isMobile, name).toBe(true);
      expect(layout.panel.y + layout.panel.height, name).toBeLessThanOrEqual(layout.strip.y);
      expect(layout.strip.y + layout.strip.height, name).toBeLessThanOrEqual(layout.gridY);
      expect(layout.gridY + layout.gridHeight, name).toBeLessThanOrEqual(layout.skills.y);
    }
  });

  it("keeps the board beside the sidebar and the skills inside it in landscape", () => {
    for (const [width, height] of screens.filter(([w, h]) => w > h)) {
      const layout = computeRuneMatchLayout(width, height);
      const name = `${width}x${height}`;
      expect(layout.isMobile, name).toBe(false);
      expect(layout.gridX, name).toBeGreaterThanOrEqual(layout.sidebarWidth);
      expect(layout.skills.x + layout.skills.width, name).toBeLessThanOrEqual(layout.sidebarWidth);
      expect(layout.strip.y + layout.strip.height, name).toBeLessThanOrEqual(layout.skills.y);
    }
  });

  it("draws the board on its side in landscape without moving any neighbour", () => {
    const portrait = computeRuneMatchLayout(390, 844);
    const landscape = computeRuneMatchLayout(844, 390);
    expect(portrait.transposed).toBe(false);
    expect(landscape.transposed).toBe(true);
    expect(landscape.gridWidth / landscape.cellSize).toBeCloseTo(rows);
    expect(landscape.gridHeight / landscape.cellSize).toBeCloseTo(columns);

    const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    for (const layout of [portrait, landscape]) {
      expect(distance(cellPosition(layout, 2, 1), cellPosition(layout, 3, 1))).toBeCloseTo(layout.cellSize);
      expect(distance(cellPosition(layout, 2, 1), cellPosition(layout, 2, 2))).toBeCloseTo(layout.cellSize);
    }
    const lastCell = cellPosition(landscape, rows - 1, columns - 1);
    expect(lastCell.x + landscape.cellSize).toBeCloseTo(landscape.gridX + landscape.gridWidth);
    expect(lastCell.y + landscape.cellSize).toBeCloseTo(landscape.gridY + landscape.gridHeight);
  });

  it("makes room for the tutorial card and the demo banner", () => {
    const bottomOf = (options: { tutorialMode?: boolean; hasStatusBanner?: boolean }) => {
      const { skills } = computeRuneMatchLayout(390, 844, options);
      return skills.y + skills.height;
    };
    expect(bottomOf({ tutorialMode: true })).toBeLessThanOrEqual(844 - 120);
    expect(bottomOf({ hasStatusBanner: true })).toBeLessThanOrEqual(844 - 72);
  });

  it("keeps a floating label on screen beside either edge", () => {
    expect(clampLabelCenter(380, 170, 390)).toBe(390 - 85 - 4);
    expect(clampLabelCenter(5, 170, 390)).toBe(85 + 4);
    expect(clampLabelCenter(200, 170, 390)).toBe(200);
  });
});
