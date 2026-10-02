import { describe, expect, it } from "vitest";
import { KEYBOARD_THRESHOLD_PX, readViewportVars } from "./useVisualViewport";

describe("readViewportVars", () => {
  it("returns the visible height and offset (iOS keyboard up)", () => {
    expect(readViewportVars({ height: 420.4, offsetTop: 310.6, scale: 1 }, 812)).toEqual({
      height: 420,
      top: 311,
      keyboard: true,
    });
  });

  it("reports no keyboard when the viewport is (nearly) full height", () => {
    expect(readViewportVars({ height: 812, offsetTop: 0 }, 812)).toEqual({ height: 812, top: 0, keyboard: false });
    expect(readViewportVars({ height: 812 - KEYBOARD_THRESHOLD_PX, offsetTop: 0 }, 812)?.keyboard).toBe(false);
  });

  it("clamps negative offsets (iOS rubber-band)", () => {
    expect(readViewportVars({ height: 700, offsetTop: -12 }, 700)?.top).toBe(0);
  });

  it("leaves the layout alone while pinch-zoomed or without a viewport", () => {
    expect(readViewportVars({ height: 300, offsetTop: 40, scale: 2 }, 812)).toBeNull();
    expect(readViewportVars(undefined, 812)).toBeNull();
    expect(readViewportVars({ height: 0, offsetTop: 0 }, 812)).toBeNull();
  });
});
