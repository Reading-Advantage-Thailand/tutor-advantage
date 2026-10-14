import { describe, expect, it } from "vitest";
import { LESSON_PHASE, TOTAL_LESSON_PHASES } from "../../lib/lessonPhases";
import { formatPhaseStep, getPhaseMeta, getPhaseProgress } from "./phaseMeta";

describe("getPhaseMeta", () => {
  it("has a Thai name for every lesson phase", () => {
    for (let phase = 1; phase <= TOTAL_LESSON_PHASES; phase += 1) {
      const meta = getPhaseMeta(phase);
      expect(meta.label, `phase ${phase}`).not.toMatch(/missing|Phase/);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.emoji.length).toBeGreaterThan(0);
    }
  });

  it("names the phases the old reader map got wrong", () => {
    expect(getPhaseMeta(LESSON_PHASE.VOCABULARY_PRACTICE).label).toBe("ฝึกคำศัพท์");
    expect(getPhaseMeta(LESSON_PHASE.VOCABULARY_GAME).label).toBe("เกมคำศัพท์");
    expect(getPhaseMeta(LESSON_PHASE.GUIDED_WRITING).label).toBe("เขียนแบบมีโครง");
  });

  it("keeps the look-at-screen labels and tips", () => {
    expect(getPhaseMeta(LESSON_PHASE.LAUNCH)).toMatchObject({ label: "แนะนำบทเรียน", emoji: "📖", tip: "คุณครูกำลังแนะนำบทเรียนวันนี้" });
    expect(getPhaseMeta(LESSON_PHASE.KEY_SENTENCES)).toMatchObject({ label: "ประโยคสำคัญ", emoji: "⭐" });
    expect(getPhaseMeta(LESSON_PHASE.COMPREHENSION).tip).toBeNull();
  });

  it("falls back to a step label for unknown phases", () => {
    expect(getPhaseMeta(42)).toMatchObject({ label: "ขั้นที่ 42", tone: "neutral", tip: null });
  });
});

describe("formatPhaseStep / getPhaseProgress", () => {
  it("shows the step out of the whole lesson", () => {
    expect(formatPhaseStep(7)).toBe("ขั้นที่ 7/18");
    expect(formatPhaseStep(0)).toBe("ขั้นที่ 0");
  });

  it("maps the phase to a clamped percentage", () => {
    expect(getPhaseProgress(0)).toBe(0);
    expect(getPhaseProgress(9)).toBe(50);
    expect(getPhaseProgress(18)).toBe(100);
    expect(getPhaseProgress(99)).toBe(100);
    expect(getPhaseProgress(Number.NaN)).toBe(0);
  });
});
