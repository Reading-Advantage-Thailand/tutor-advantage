import { describe, expect, it } from "vitest";
import {
  AUTO_SELECTION,
  buildReadHref,
  buildVoicePracticeHref,
  getDisplayedSelection,
  getLessonPlan,
  getProgressPercent,
  getRemainingLessons,
  getWeekChart,
  hasProgressData,
  selectBook,
  selectClass,
  selectNextBook,
  type ProgressArticle,
  type ProgressData,
} from "./progressModel";

function article(no: number, done: boolean): ProgressArticle {
  return { id: `a${no}`, no, title: `Lesson ${no}`, minutes: done ? 10 : 0, done, assessmentSupported: true, assessmentDone: false };
}

function data(overrides: Partial<ProgressData> = {}): ProgressData {
  return {
    selectedClassId: "c1",
    selectedBookCycleId: "b1",
    nextAvailableBookCycleId: null,
    stats: {
      level: "Reading 1",
      cefr: "A1",
      seriesColor: "#06c755",
      totalArticles: 4,
      articlesRead: 1,
      weekStreak: 1,
      totalMinutes: 25,
      nextMilestone: { at: 5, reward: "⭐" },
    },
    weeklyActivity: [],
    articles: [],
    ...overrides,
  };
}

describe("getLessonPlan", () => {
  it("unlocks done lessons and the first not-done one only", () => {
    // Same shape as real data: lesson 3 done while 1 is still current.
    const plan = getLessonPlan([article(1, false), article(2, false), article(3, true), article(4, false)]);
    expect(plan.currentIndex).toBe(0);
    expect(plan.currentArticle?.id).toBe("a1");
    expect(plan.states).toEqual(["current", "locked", "done", "locked"]);
  });

  it("points 'continue' at the last lesson when the book is finished", () => {
    const plan = getLessonPlan([article(1, true), article(2, true)]);
    expect(plan.currentIndex).toBe(-1);
    expect(plan.currentArticle?.id).toBe("a2");
    expect(plan.states).toEqual(["done", "done"]);
  });

  it("handles an empty book", () => {
    expect(getLessonPlan([])).toEqual({ currentIndex: -1, currentArticle: undefined, states: [] });
  });
});

describe("hrefs", () => {
  it("builds the reader URL", () => {
    expect(buildReadHref("abc")).toBe("/student/read/abc");
  });

  it("keeps the Reedy voice-practice contract", () => {
    expect(buildVoicePracticeHref("cyc 1", "art/2")).toBe("/voice-practice?cycleId=cyc%201&articleId=art%2F2");
  });
});

describe("book summary", () => {
  it("computes percent and remaining", () => {
    expect(getProgressPercent({ articlesRead: 1, totalArticles: 13 })).toBe(8);
    expect(getProgressPercent({ articlesRead: 0, totalArticles: 0 })).toBe(0);
    expect(getRemainingLessons({ articlesRead: 5, totalArticles: 3 })).toBe(0);
    expect(getRemainingLessons({ articlesRead: 1, totalArticles: 13 })).toBe(12);
  });

  it("detects whether there is a book", () => {
    expect(hasProgressData(data())).toBe(true);
    expect(hasProgressData(data({ stats: { ...data().stats, totalArticles: 0 }, articles: [] }))).toBe(false);
    expect(hasProgressData(data({ stats: { ...data().stats, totalArticles: 0 }, articles: [article(1, false)] }))).toBe(true);
  });
});

describe("getWeekChart", () => {
  it("scales bars to the busiest day with an 8% stub", () => {
    const { bars, totalMinutes } = getWeekChart([
      { day: "จ", minutes: 0, active: false },
      { day: "อ", minutes: 25, active: true },
      { day: "พ", minutes: 10, active: true },
    ]);
    expect(totalMinutes).toBe(35);
    expect(bars.map((bar) => bar.heightPct)).toEqual([8, 100, 40]);
  });

  it("does not divide by zero", () => {
    expect(getWeekChart([{ day: "จ", minutes: 0, active: false }]).bars[0].heightPct).toBe(8);
    expect(getWeekChart([]).totalMinutes).toBe(0);
  });
});

describe("selection", () => {
  it("starts with the server's default", () => {
    expect(AUTO_SELECTION).toEqual({ classId: null, cycleId: null });
  });

  it("switching class resets the book to the server default", () => {
    expect(selectClass(data(), "c2")).toEqual({ classId: "c2", cycleId: null });
    expect(selectClass(data(), "c1")).toBeNull();
  });

  it("switching book keeps the server-resolved class", () => {
    expect(selectBook(data(), AUTO_SELECTION, { id: "b2", hasAccess: true })).toEqual({ classId: "c1", cycleId: "b2" });
  });

  it("ignores locked or already-selected books", () => {
    expect(selectBook(data(), AUTO_SELECTION, { id: "b2", hasAccess: false })).toBeNull();
    expect(selectBook(data(), AUTO_SELECTION, { id: "b1", hasAccess: true })).toBeNull();
  });

  it("falls back to the requested class when the server did not echo one", () => {
    expect(selectBook(data({ selectedClassId: null }), { classId: "c9", cycleId: null }, { id: "b2", hasAccess: true })).toEqual({
      classId: "c9",
      cycleId: "b2",
    });
  });

  it("lets the student go back to the class on screen while a switch loads or after it failed", () => {
    // Previous data (c1/b1) is still shown while c2 was requested.
    const shown = getDisplayedSelection(data(), { classId: "c2", cycleId: null }, true);
    expect(selectClass(data(), "c2", shown.classId)).toBeNull();
    expect(selectClass(data(), "c1", shown.classId)).toEqual({ classId: "c1", cycleId: null });
  });

  it("lets the student go back to the book on screen while a book switch loads or after it failed", () => {
    const requested = { classId: "c1", cycleId: "b2" };
    const shown = getDisplayedSelection(data(), requested, true);
    expect(selectBook(data(), requested, { id: "b2", hasAccess: true }, shown.cycleId)).toBeNull();
    expect(selectBook(data(), requested, { id: "b1", hasAccess: true }, shown.cycleId)).toEqual({ classId: "c1", cycleId: "b1" });
    expect(selectBook(data(), requested, { id: "b3", hasAccess: false }, shown.cycleId)).toBeNull();
  });

  it("moves to the next book of the same class", () => {
    expect(selectNextBook(data({ nextAvailableBookCycleId: "b2" }), AUTO_SELECTION)).toEqual({ classId: "c1", cycleId: "b2" });
    expect(selectNextBook(data(), AUTO_SELECTION)).toBeNull();
  });

  it("highlights the server's choice, or the requested one while switching", () => {
    const current = data();
    expect(getDisplayedSelection(current, AUTO_SELECTION, false)).toEqual({ classId: "c1", cycleId: "b1" });
    expect(getDisplayedSelection(current, { classId: "c2", cycleId: null }, true)).toEqual({ classId: "c2", cycleId: null });
    expect(getDisplayedSelection(current, { classId: "c1", cycleId: "b2" }, true)).toEqual({ classId: "c1", cycleId: "b2" });
  });
});
