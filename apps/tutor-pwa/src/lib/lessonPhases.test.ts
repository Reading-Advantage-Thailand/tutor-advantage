import { describe, expect, it } from "vitest";
import { t } from "./i18n";
import { LESSON_PHASE, PHASE_GROUPS, PHASE_NAMES, TOTAL_LESSON_PHASES } from "./lessonPhases";

/**
 * Copy that states how many steps the lesson plan has: the hub, the demo,
 * the live lobby, the login page and the performance tips. Other step counts
 * in the app (e.g. verification steps) are not the lesson plan and are not checked.
 */
const LESSON_STEP_COUNT_KEYS = [
  "lesson.teachDescription",
  "lesson.interactive.steps14",
  "lesson.interactive.demoEmptyMessage",
  "lesson.live.stepsCount",
  "app.loginBenefitLessons",
  "dashboardPerformance.tips.classMaster2",
] as const;

describe("lesson step count in the copy", () => {
  it("names the same number of steps as the live lesson has", () => {
    for (const key of LESSON_STEP_COUNT_KEYS) {
      const counts = Array.from(t(key).matchAll(/(\d+)\s*ขั้นตอน/g), (match) => Number(match[1]));
      expect([key, counts]).toEqual([key, [TOTAL_LESSON_PHASES]]);
    }
  });

  it("keeps the hub strings on 18 steps in 4 periods", () => {
    expect(TOTAL_LESSON_PHASES).toBe(18);
    expect(t("lesson.teachDescription")).toContain(`${TOTAL_LESSON_PHASES} ขั้นตอน (4 คาบ)`);
    expect(t("lesson.interactive.steps14")).toBe(`${TOTAL_LESSON_PHASES} ขั้นตอน · 4 คาบ`);
    expect(t("lesson.interactive.demoEmptyMessage")).toContain(`${TOTAL_LESSON_PHASES} ขั้นตอน`);
  });

  it("puts every step in exactly one group: 4 periods and the final ranking step", () => {
    const grouped = PHASE_GROUPS.flatMap((group) => group.phases);
    expect([...grouped].sort((a, b) => a - b)).toEqual(Array.from({ length: TOTAL_LESSON_PHASES }, (_, i) => i + 1));
    expect(PHASE_GROUPS).toHaveLength(5);
    expect(PHASE_GROUPS[4].phases).toEqual([LESSON_PHASE.WRAP_UP]);
  });
});

describe("PHASE_NAMES", () => {
  it("has a Thai name for every step, with no English-only name", () => {
    for (let phase = 1; phase <= TOTAL_LESSON_PHASES; phase += 1) {
      expect(PHASE_NAMES[phase], `phase ${phase}`).toMatch(/[฀-๿]/);
    }
  });

  it("calls step 16 สรุปการเรียนรู้ like the student app", () => {
    expect(PHASE_NAMES[LESSON_PHASE.REFLECTION]).toBe("สรุปการเรียนรู้");
  });
});
