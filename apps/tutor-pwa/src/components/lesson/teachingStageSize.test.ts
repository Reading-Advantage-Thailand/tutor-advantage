import { describe, expect, it } from "vitest";
import { stageScale } from "./teachingStageSize";

describe("stageScale", () => {
  it("leaves a laptop-sized stage alone", () => {
    expect(stageScale(912, 512)).toBe(1);
    expect(stageScale(1232, 640)).toBe(1);
  });

  it("grows on a 1080p projector, more once the dock is hidden", () => {
    expect(stageScale(1872, 948)).toBe(1.48);
    expect(stageScale(1872, 1060)).toBe(1.66);
  });

  it("never lets a tall narrow stage overflow its width", () => {
    expect(stageScale(788, 892)).toBe(1);
  });

  it("stops growing at a limit and survives an unmeasured stage", () => {
    expect(stageScale(3840, 2160)).toBe(2.2);
    expect(stageScale(0, 0)).toBe(1);
  });
});
