import { describe, expect, it } from "vitest";
import { GAME_HEIGHT, GAME_WIDTH, computeCastleDefenseCamera } from "./castleDefense";

const boardRect = (view: { width: number; height: number }, cam: { x: number; y: number; scale: number }) => ({
  left: cam.x,
  top: cam.y,
  right: cam.x + GAME_WIDTH * cam.scale,
  bottom: cam.y + GAME_HEIGHT * cam.scale,
  view,
});

describe("computeCastleDefenseCamera", () => {
  const sizes = [
    { width: 390, height: 844 },
    { width: 360, height: 640 },
    { width: 1002, height: 560 },
    { width: 1366, height: 768 },
    { width: 788, height: 591 },
  ];

  it.each(sizes)("cover keeps the board across the full width of the %o viewport", (view) => {
    for (const focus of [{ x: 0, y: 0 }, { x: 400, y: 300 }, { x: 800, y: 600 }]) {
      const r = boardRect(view, computeCastleDefenseCamera(view, focus));
      expect(r.left).toBeLessThanOrEqual(0.001);
      expect(r.right).toBeGreaterThanOrEqual(view.width - 0.001);
    }
  });

  it("cover shows more of the map on a phone than zooming by height did", () => {
    const cam = computeCastleDefenseCamera({ width: 390, height: 844 }, { x: 400, y: 300 }, { insetTop: 140, insetBottom: 130 });
    expect(cam.scale).toBeCloseTo(0.8, 5);
    expect(390 / cam.scale).toBeGreaterThan(480);
  });

  it.each([
    { width: 390, height: 844, insetTop: 140, insetBottom: 130 },
    { width: 360, height: 640, insetTop: 150, insetBottom: 130 },
    { width: 844, height: 390, insetTop: 110, insetBottom: 0 },
    { width: 1366, height: 768, insetTop: 140, insetBottom: 0 },
  ])("cover can bring every spot into the band between HUD and controls on %o", ({ insetTop, insetBottom, ...view }) => {
    for (const y of [0, 100, 300, 500, 600]) {
      const cam = computeCastleDefenseCamera(view, { x: 400, y }, { insetTop, insetBottom });
      const screenY = cam.y + y * cam.scale;
      expect(screenY).toBeGreaterThanOrEqual(insetTop - 0.001);
      expect(screenY).toBeLessThanOrEqual(view.height - insetBottom + 0.001);
    }
  });

  it("cover centres a short board in the band and a tall one on the player", () => {
    const short = computeCastleDefenseCamera({ width: 390, height: 844 }, { x: 400, y: 100 }, { insetTop: 140, insetBottom: 130 });
    const boardHeight = GAME_HEIGHT * short.scale;
    expect(short.y).toBeCloseTo(140 + (844 - 140 - 130 - boardHeight) / 2, 5);

    const tall = computeCastleDefenseCamera({ width: 844, height: 390 }, { x: 400, y: 300 }, { insetTop: 110 });
    expect(tall.y + 300 * tall.scale).toBeCloseTo((110 + 390) / 2, 5);
  });

  it.each(sizes)("contain keeps the whole board inside the %o viewport below the HUD inset", (view) => {
    const insetTop = 120;
    const insetBottom = 90;
    const cam = computeCastleDefenseCamera(view, { x: 0, y: 0 }, { fit: "contain", insetTop, insetBottom });
    const r = boardRect(view, cam);
    expect(r.left).toBeGreaterThanOrEqual(-0.001);
    expect(r.right).toBeLessThanOrEqual(view.width + 0.001);
    expect(r.top).toBeGreaterThanOrEqual(Math.min(insetTop, view.height * 0.4) - 0.001);
    expect(r.bottom).toBeLessThanOrEqual(view.height - Math.min(insetBottom, view.height * 0.25) + 0.001);
    // uniform scale keeps the 4:3 board aspect ratio
    expect((r.right - r.left) / (r.bottom - r.top)).toBeCloseTo(GAME_WIDTH / GAME_HEIGHT, 5);
  });

  it("returns an identity camera for an unmeasured container", () => {
    expect(computeCastleDefenseCamera({ width: 0, height: 0 }, { x: 10, y: 10 })).toEqual({ x: 0, y: 0, scale: 1 });
  });
});
