import { describe, expect, it } from "vitest";

import { estimateTextWidth } from "./textFit";
import { createWizardZombieState, orbCell } from "./wizardZombie";
import {
  chooseArena,
  computePlayRect,
  fitCamera,
  isPortraitViewport,
  layoutOrbLabel,
  PORTRAIT_TOP_BAND,
  worldToScreen,
} from "./wizardZombieLayout";

const STICK = 136;
const NEW_LINE = String.fromCharCode(10);
const SCREENS = {
  phone: { width: 390, height: 844 },
  smallPhone: { width: 360, height: 640 },
  lineWebView: { width: 390, height: 680 },
  landscape: { width: 844, height: 390 },
  smallLandscape: { width: 667, height: 375 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
};
const words = Array.from({ length: 10 }, (_, i) => ({ id: `w${i}`, term: `word${i}`, translation: `ความหมาย${i}` }));

describe("Wizard vs Zombie layout", () => {
  for (const [name, screen] of Object.entries(SCREENS)) {
    describe(name, () => {
      const controls = { stick: STICK };
      const rect = computePlayRect(screen, controls);
      const arena = chooseArena(screen, controls);
      const camera = fitCamera(arena, rect);

      it("the whole arena is on screen, clear of the HUD and the controls", () => {
        const topLeft = worldToScreen(camera, { x: 0, y: 0 });
        const bottomRight = worldToScreen(camera, { x: arena.width, y: arena.height });
        expect(topLeft.x).toBeGreaterThanOrEqual(rect.x - 0.01);
        expect(topLeft.y).toBeGreaterThanOrEqual(rect.y - 0.01);
        expect(bottomRight.x).toBeLessThanOrEqual(rect.x + rect.width + 0.01);
        expect(bottomRight.y).toBeLessThanOrEqual(rect.y + rect.height + 0.01);
        if (isPortraitViewport(screen)) {
          expect(rect.y).toBe(PORTRAIT_TOP_BAND);
          // The stick's top edge.
          expect(bottomRight.y).toBeLessThanOrEqual(screen.height - STICK - 12);
        } else {
          expect(topLeft.x).toBeGreaterThanOrEqual(STICK);
          expect(bottomRight.x).toBeLessThanOrEqual(screen.width - STICK);
        }
      });

      it("the wizard stays big enough to see", () => {
        expect(64 * camera.scale).toBeGreaterThanOrEqual(36);
      });

      it("every orb and its label stay on screen in their own part of the arena", () => {
        for (let round = 0; round < 40; round++) {
          const state = createWizardZombieState(words, { arena });
          for (const orb of state.orbs) {
            const label = layoutOrbLabel(orb, arena, camera.scale, estimateTextWidth);
            const centre = worldToScreen(camera, orb);
            const cell = orbCell(arena, orb);
            const cellLeft = worldToScreen(camera, { x: cell.x, y: cell.y });
            const cellRight = worldToScreen(camera, { x: cell.x + cell.width, y: cell.y + cell.height });
            expect(centre.x + label.offsetX).toBeGreaterThanOrEqual(cellLeft.x - 0.5);
            expect(centre.x + label.offsetX + label.width).toBeLessThanOrEqual(cellRight.x + 0.5);
            expect(centre.y + label.offsetY).toBeGreaterThanOrEqual(cellLeft.y - 0.5);
            expect(centre.y + label.offsetY + label.height).toBeLessThanOrEqual(cellRight.y + 0.5);
          }
        }
      });
    });
  }

  it("keeps about the same floor area on every phone, so a walk takes about as long", () => {
    const area = (screen: { width: number; height: number }) => {
      const arena = chooseArena(screen, { stick: STICK });
      return arena.width * arena.height;
    };
    for (const screen of [SCREENS.phone, SCREENS.smallPhone, SCREENS.lineWebView, SCREENS.landscape, SCREENS.smallLandscape]) {
      expect(area(screen)).toBeGreaterThan(200_000);
      expect(area(screen)).toBeLessThan(320_000);
    }
  });

  it("the home bar takes room from the arena", () => {
    const without = computePlayRect(SCREENS.phone, { stick: STICK });
    const withBar = computePlayRect(SCREENS.phone, { stick: STICK, safeBottom: 34 });
    expect(withBar.height).toBe(without.height - 34);
  });

  it("a phone turned mid-round still fits the same arena", () => {
    const arena = chooseArena(SCREENS.phone, { stick: STICK });
    const rect = computePlayRect(SCREENS.landscape, { stick: STICK });
    const camera = fitCamera(arena, rect);
    expect(arena.width * camera.scale).toBeLessThanOrEqual(rect.width + 0.01);
    expect(arena.height * camera.scale).toBeLessThanOrEqual(rect.height + 0.01);
  });
});

describe("orb labels", () => {
  const arena = chooseArena(SCREENS.phone, { stick: STICK });
  const scale = fitCamera(arena, computePlayRect(SCREENS.phone, { stick: STICK })).scale;
  const orb = (translation: string, x = arena.width * 0.25, y = arena.height * 0.25) => ({ x, y, radius: 25, translation });

  it("a short meaning is one big line under the orb", () => {
    const label = layoutOrbLabel(orb("ป่า"), arena, scale, estimateTextWidth);
    expect(label.text).toBe("ป่า");
    expect(label.fontSize).toBe(16);
    expect(label.offsetY).toBeGreaterThan(0);
  });

  it("wraps Thai between words, not inside them", () => {
    const text = "ซึ่งไม่สามารถรับรู้ได้และอยู่ในสถานการณ์ที่ยากลำบากมากสำหรับทุกคน";
    const label = layoutOrbLabel(orb(text), arena, scale, estimateTextWidth);
    expect(label.text.split(NEW_LINE).length).toBeGreaterThan(1);
    expect(label.text.replaceAll(NEW_LINE, "")).toBe(text);
    const segmenter = new Intl.Segmenter("th", { granularity: "word" });
    const wordEnds = new Set<number>();
    let at = 0;
    for (const { segment } of segmenter.segment(text)) {
      at += segment.length;
      wordEnds.add(at);
    }
    let walked = 0;
    for (const line of label.text.split(NEW_LINE)) {
      walked += line.length;
      expect(wordEnds.has(walked)).toBe(true);
    }
  });

  it("a very long definition keeps a readable size and stays in its part of the arena", () => {
    const long = "ลัทธิการเมืองที่ปกครองเยอรมนีช่วงสงครามโลกครั้งที่สองโดยมีผู้นำเผด็จการและนโยบายเหยียดเชื้อชาติอย่างรุนแรงจนเกิดเหตุการณ์ฆ่าล้างเผ่าพันธุ์";
    const label = layoutOrbLabel(orb(long), arena, scale, estimateTextWidth);
    expect(label.fontSize).toBeGreaterThanOrEqual(11);
    expect(label.height).toBeLessThanOrEqual((arena.height / 2) * scale);
  });

  it("flips above the orb when there is no room below", () => {
    const low = orb("ความหมายที่ยาวพอสมควรจนต้องตัดเป็นหลายบรรทัดแน่นอนเลย", arena.width * 0.25, arena.height * 0.5 - 30);
    const label = layoutOrbLabel(low, arena, scale, estimateTextWidth);
    expect(label.offsetY).toBeLessThan(0);
  });

  it("is pushed back inside the arena near the edge", () => {
    const edge = orb("ความหมายที่ยาวพอสมควร", 30);
    const label = layoutOrbLabel(edge, arena, scale, estimateTextWidth);
    expect((edge.x * scale) + label.offsetX).toBeGreaterThanOrEqual(0);
  });
});
