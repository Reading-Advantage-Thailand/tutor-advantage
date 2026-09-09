// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../lib/api", () => ({ fetchWithAuth: api }));
import AssessmentPanel from "./AssessmentPanel";

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
