// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../lib/api", () => ({ fetchWithAuth: api }));
import AssessmentPanel, { compareScores, pickInitialArticleId } from "./AssessmentPanel";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  sessionStorage.clear();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(summary: unknown) {
  api.mockResolvedValueOnce(summary);
  await act(async () => root.render(React.createElement(AssessmentPanel, { cycleId: "cycle" })));
}
describe("student assessment experience", () => {
  it("does not show the pilot on unsupported books", async () => {
    await render({ supported: false }); expect(container.textContent).toBe("");
  });
  it("shows no fabricated growth when only a post score exists", async () => {
    await render({ supported: true, postOpenedAt: "2026-09-07", attempts: [{ stage: "POST", submittedAt: "2026-09-07", total: 10, scores: { vocabulary: 4, reading: 3, listening: 3 }, teacherComment: "ฝึกฟังต่อ" }] });
    expect(container.textContent).toContain("ไม่มีผลก่อนเรียน");
    expect(container.textContent).toContain("ฝึกฟังต่อ");
    expect(container.textContent).not.toContain("ตอบถูกเพิ่มขึ้น");
  });
  it("shows a neutral message for decreased scores", async () => {
    await render({ supported: true, postOpenedAt: "2026-09-07", attempts: [{ stage: "PRE", submittedAt: "date", total: 10 }, { stage: "POST", submittedAt: "date", total: 7 }] });
    expect(container.textContent).toContain("ผลครั้งนี้ต่ำกว่าครั้งก่อน");
  });
  it("is read-only even before the pre assessment", async () => {
    await render({ supported: true, postOpenedAt: null, attempts: [] });
    expect(container.textContent).toContain("ครูเป็นผู้เริ่ม");
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(api).toHaveBeenCalledTimes(1);
  });
});

describe("assessment helpers", () => {
  it("starts on the article of the latest submitted attempt", () => {
    expect(
      pickInitialArticleId({
        supported: true,
        articles: [{ articleId: "a1", title: "A" }, { articleId: "a2", title: "B" }],
        attempts: [
          { attemptId: "1", articleId: "a1", stage: "PRE", submittedAt: "2026-09-01", total: 5, scores: null, teacherComment: null },
          { attemptId: "2", articleId: "a2", stage: "PRE", submittedAt: "2026-09-05", total: 6, scores: null, teacherComment: null },
          { attemptId: "3", articleId: "a1", stage: "POST", submittedAt: null, total: null, scores: null, teacherComment: null },
        ],
      }),
    ).toBe("a2");
    expect(pickInitialArticleId({ supported: true, articles: [{ articleId: "a1", title: "A" }], attempts: [] })).toBe("a1");
    expect(pickInitialArticleId({ supported: true, attempts: [] })).toBe("");
  });

  it("compares scores like before (null-safe, never invents growth)", () => {
    expect(compareScores(10, 12)).toEqual({ kind: "improved", gained: 2 });
    expect(compareScores(10, 10)).toEqual({ kind: "same" });
    expect(compareScores(10, 7)).toEqual({ kind: "lower" });
  });
});

describe("retry", () => {
  it("re-applies the article selection after a failed first load", async () => {
    api.mockRejectedValueOnce(new Error("API Error 500"));
    await act(async () => root.render(React.createElement(AssessmentPanel, { cycleId: "cycle" })));
    const retry = container.querySelector("button");
    expect(retry).not.toBeNull();
    expect(container.textContent).not.toContain("API Error 500");

    api.mockResolvedValueOnce({
      supported: true,
      articles: [{ articleId: "a1", title: "Lesson A" }, { articleId: "a2", title: "Lesson B" }],
      attempts: [
        { attemptId: "1", articleId: "a1", stage: "PRE", submittedAt: "2026-09-01", total: 3 },
        { attemptId: "2", articleId: "a2", stage: "PRE", submittedAt: "2026-09-05", total: 9 },
        { attemptId: "3", articleId: "a2", stage: "POST", submittedAt: "2026-09-06", total: 12 },
      ],
    });
    await act(async () => retry!.click());
    expect(api).toHaveBeenCalledTimes(2);
    // Only lesson B's attempts count: 9 → 12, not lesson A's 3.
    expect(container.textContent).toContain("9/15");
    expect(container.textContent).toContain("12/15");
    expect(container.textContent).not.toContain("3/15");
    expect(container.textContent).toContain("ตอบถูกเพิ่มขึ้น 3 ข้อ");
  });
});
