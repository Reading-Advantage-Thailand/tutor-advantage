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

  it.each(sizes)("cover fills the %o viewport without gaps and follows the player", (view) => {
    for (const focus of [{ x: 0, y: 0 }, { x: 400, y: 300 }, { x: 800, y: 600 }]) {
      const cam = computeCastleDefenseCamera(view, focus);
      const r = boardRect(view, cam);
      expect(r.left).toBeLessThanOrEqual(0.001);
      expect(r.top).toBeLessThanOrEqual(0.001);
      expect(r.right).toBeGreaterThanOrEqual(view.width - 0.001);
      expect(r.bottom).toBeGreaterThanOrEqual(view.height - 0.001);
    }
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
