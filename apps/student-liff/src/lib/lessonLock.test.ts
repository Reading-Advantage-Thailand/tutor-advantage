import { describe, expect, it } from "vitest";
import { getSequentialLessonPlan, isLessonOpenable } from "./lessonLock";

const lessons = (...done: boolean[]) => done.map((d) => ({ done: d }));

describe("getSequentialLessonPlan", () => {
  it("returns no states for an empty book", () => {
    expect(getSequentialLessonPlan([])).toEqual({ currentIndex: -1, states: [] });
  });

  it("opens the first lesson of a fresh book and locks the rest", () => {
    expect(getSequentialLessonPlan(lessons(false, false, false))).toEqual({
      currentIndex: 0,
      states: ["current", "locked", "locked"],
    });
  });

  it("marks finished lessons done, the first unfinished current, later ones locked", () => {
    const plan = getSequentialLessonPlan(lessons(true, true, false, false));
    expect(plan.currentIndex).toBe(2);
    expect(plan.states).toEqual(["done", "done", "current", "locked"]);
  });

  it("keeps a lesson finished out of order done (never re-locks completed work)", () => {
    expect(getSequentialLessonPlan(lessons(true, false, true, false)).states).toEqual([
      "done",
      "current",
      "done",
      "locked",
    ]);
  });

  it("has no current lesson when the whole book is done", () => {
    expect(getSequentialLessonPlan(lessons(true, true))).toEqual({ currentIndex: -1, states: ["done", "done"] });
  });
});

describe("isLessonOpenable", () => {
  it("only locked lessons are not openable", () => {
    expect(isLessonOpenable("done")).toBe(true);
    expect(isLessonOpenable("current")).toBe(true);
    expect(isLessonOpenable("locked")).toBe(false);
  });
});
