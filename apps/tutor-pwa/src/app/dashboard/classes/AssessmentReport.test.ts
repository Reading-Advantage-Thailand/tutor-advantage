import { describe, expect, it } from "vitest";
import { summarizeAssessment } from "./assessment-report-summary";

describe("assessment report summary", () => {
  it("summarizes completed attempts and only counts paired students for comparison", () => {
    const summary = summarizeAssessment({
      postOpenedAt: "2026-09-09T00:00:00.000Z",
      students: [
        {
          userId: "student-1",
          displayName: "One",
          attempts: [
            { attemptId: "pre-1", stage: "PRE", submittedAt: "2026-09-01", total: 9, scores: { vocabulary: 3, reading: 2, listening: 4 }, teacherComment: null },
            { attemptId: "post-1", stage: "POST", submittedAt: "2026-09-09", total: 12, scores: { vocabulary: 4, reading: 4, listening: 4 }, teacherComment: null },
          ],
        },
        {
          userId: "student-2",
          displayName: "Two",
          attempts: [
            { attemptId: "pre-2", stage: "PRE", submittedAt: "2026-09-02", total: 11, scores: { vocabulary: 5, reading: 3, listening: 3 }, teacherComment: null },
          ],
        },
      ],
    });

    expect(summary).toMatchObject({
      totalStudents: 2,
      preCompleted: 2,
      postCompleted: 1,
      paired: 1,
      preAverage: 10,
      postAverage: 12,
    });
    expect(summary.skillAverages).toEqual([
      { key: "vocabulary", label: "คำศัพท์", pre: 4, post: 4 },
      { key: "reading", label: "การอ่าน", pre: 2.5, post: 4 },
      { key: "listening", label: "การฟัง", pre: 3.5, post: 4 },
    ]);
  });
});
