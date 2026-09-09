// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import type { LiveAssessmentState } from "@tutor-advantage/shared-config";
import LiveAssessmentControls from "./LiveAssessmentControls";

let container: HTMLDivElement; let root: Root;
const initial: LiveAssessmentState = { sessionId: "room", supported: true, mode: "PRE", status: "LOBBY", revision: 1, paused: false, postOpened: false, items: [], answers: {}, progress: [{ studentId: "s1", name: "Student", answered: 0, completed: false, previouslyCompleted: false }], completed: false };
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(state: LiveAssessmentState, devMode = false) {
  const onControl = vi.fn().mockResolvedValue(true);
  await act(async () => root.render(React.createElement(LiveAssessmentControls, { state, busy: false, error: "", onControl, devMode })));
  return onControl;
}
function button(text: string) { return [...container.querySelectorAll("button")].find(b => b.textContent?.includes(text))!; }
async function click(text: string) { await act(async () => button(text).click()); }

it("keeps the assessment card selection-only before the shared Lobby start", async () => {
  const control = await render(initial);
  expect(control).not.toHaveBeenCalled();
  expect(container.textContent).toContain("เริ่มพร้อมกันจากปุ่มด้านล่าง");
  expect([...container.querySelectorAll("button")].some(item => item.textContent?.includes("เริ่มแบบประเมิน"))).toBe(false);
});

it("shows incomplete progress and requires confirmation before teacher finish", async () => {
  const control = await render({ ...initial, status: "RUNNING", revision: 2, progress: [{ ...initial.progress[0], answered: 7, connected: false }] });
  expect(container.textContent).toContain("47%");
  expect(container.textContent).toContain("กดเพื่อดูรายละเอียดนักเรียนทั้งหมด");
  await click("ดูรายละเอียดนักเรียน");
  expect(document.body.textContent).toContain("7/15 ข้อ");
  expect(document.body.textContent).toContain("หลุดจากห้อง");
  expect(button("เรียนตาม Lesson").disabled).toBe(true);
  await click("จบแบบประเมินและสรุปผล");
  expect(control).not.toHaveBeenCalled();
  await click("ยืนยันจบ");
  expect(control).toHaveBeenCalledWith({ action: "finish", revision: 2 });
});

it("allows returning to Lesson after finish but prevents PRE once POST has started", async () => {
  const control = await render({ ...initial, status: "FINISHED", revision: 3, postOpened: true });
  expect(button("ประเมินก่อนเรียน").disabled).toBe(true);
  await click("เรียนตาม Lesson");
  expect(control).toHaveBeenCalledWith({ action: "select", mode: "LESSON", revision: 3 });
});

it("shows the reset action only for development and requires a second confirmation", async () => {
  const control = await render(initial, true);
  expect(container.textContent).toContain("[DEV] Reset คะแนน");
  await click("[DEV] Reset คะแนน");
  expect(control).not.toHaveBeenCalled();
  expect(container.textContent).toContain("ยืนยันรีเซ็ต");
  await click("ยืนยันรีเซ็ต");
  expect(control).toHaveBeenCalledWith({ action: "reset", revision: 1 });
  await render(initial);
  expect(container.textContent).not.toContain("[DEV] Reset คะแนน");
});
