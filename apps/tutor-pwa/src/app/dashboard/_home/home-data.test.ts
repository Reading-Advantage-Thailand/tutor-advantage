import { describe, expect, it } from "vitest";
import {
  classStatusTone,
  computeRateGoal,
  DEFAULT_RATE_TARGET_THB,
  setupNoticeLine,
  signInSetupRedirect,
  type ClassNeedingSetup,
} from "./home-data";

describe("computeRateGoal", () => {
  it("falls back to the default target with no finance data", () => {
    expect(computeRateGoal(null)).toEqual({
      rate: 0,
      grossVolume: 0,
      target: DEFAULT_RATE_TARGET_THB,
      progress: 0,
      remaining: DEFAULT_RATE_TARGET_THB,
      state: "progress",
    });
  });

  it("computes progress and remaining towards the next tier", () => {
    const goal = computeRateGoal({ currentRate: 0.43, grossVolumeTHB: 5000, nextTierTargetTHB: 10000 });
    expect(goal.rate).toBe(0.43);
    expect(goal.progress).toBe(50);
    expect(goal.remaining).toBe(5000);
    expect(goal.state).toBe("progress");
  });

  it("caps progress at 100 and marks the goal as reached", () => {
    const goal = computeRateGoal({ currentRate: 0.5, grossVolumeTHB: 30000, nextTierTargetTHB: 20000 });
    expect(goal.progress).toBe(100);
    expect(goal.remaining).toBe(0);
    expect(goal.state).toBe("reached");
  });

  it("treats a zero target as the max rate", () => {
    const goal = computeRateGoal({ currentRate: 0.6, grossVolumeTHB: 600000, nextTierTargetTHB: 0 });
    expect(goal.state).toBe("max");
    expect(goal.progress).toBe(100);
  });

  it("uses the default target when the API omits it", () => {
    const goal = computeRateGoal({ currentRate: 0.4, grossVolumeTHB: 2000 });
    expect(goal.target).toBe(DEFAULT_RATE_TARGET_THB);
    expect(goal.progress).toBe(10);
  });
});

describe("classStatusTone", () => {
  it("maps known statuses", () => {
    expect(classStatusTone("open")).toEqual({ key: "open", tone: "success" });
    expect(classStatusTone("FULL")).toEqual({ key: "full", tone: "warning" });
  });
  it("falls back to closed", () => {
    expect(classStatusTone("cancelled").key).toBe("closed");
    expect(classStatusTone(undefined).tone).toBe("neutral");
  });
});

describe("classes needing setup", () => {
  const classes: ClassNeedingSetup[] = [
    { classId: "class-1", title: "English", bookTitle: "Primary Origins 2", activeStudents: 3, setupRequiredAt: "2026-11-02T09:00:00.000Z" },
    { classId: "class-2", title: "Reading", bookTitle: null, activeStudents: 0, setupRequiredAt: "2026-11-01T09:00:00.000Z" },
  ];

  it("sends a tutor who just signed in to the first class waiting for setup", () => {
    expect(signInSetupRedirect("1", classes)).toBe("/dashboard/classes/class-1/setup");
  });

  it("stays on Home without the sign-in flag or without classes to set up", () => {
    expect(signInSetupRedirect(undefined, classes)).toBeNull();
    expect(signInSetupRedirect(["1"], classes)).toBeNull();
    expect(signInSetupRedirect("1", [])).toBeNull();
    expect(signInSetupRedirect("1", undefined)).toBeNull();
  });

  it("describes each class in the notice", () => {
    expect(setupNoticeLine(classes[0])).toBe(
      '"English" · นักเรียนชำระเงินแล้ว 3 คน — ตั้งชื่อคลาส ตารางเรียน และลิงก์ห้องเรียน',
    );
  });
});
