/**
 * Sequential lesson unlock rule shared by /progress and the class detail
 * lesson list. It is a client-side rule (the learning service sends only a
 * per-lesson done flag): lessons are taken in book order, finished ones are
 * "done", the first unfinished one is "current" (open, "ยังไม่ได้เรียน") and
 * every later unfinished one is "locked" until the student finishes the
 * current lesson. Pure; no "@/…" imports so the root vitest config can load it.
 */

export type LessonLockState = "done" | "current" | "locked";

export interface SequentialLessonPlan {
  /** Index of the first lesson not done yet; -1 when every lesson is done (or none). */
  currentIndex: number;
  /** One state per input lesson, same order. */
  states: LessonLockState[];
}

export function getSequentialLessonPlan(lessons: ReadonlyArray<{ done: boolean }>): SequentialLessonPlan {
  const currentIndex = lessons.findIndex((lesson) => !lesson.done);
  const states = lessons.map<LessonLockState>((lesson, index) =>
    lesson.done ? "done" : index === currentIndex ? "current" : "locked",
  );
  return { currentIndex, states };
}

/** Whether a lesson in this state can be opened in the reader. */
export function isLessonOpenable(state: LessonLockState): boolean {
  return state !== "locked";
}
