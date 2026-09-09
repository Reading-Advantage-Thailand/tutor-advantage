// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import type { LiveAssessmentState } from "@tutor-advantage/shared-config";
import LiveAssessmentStudent from "./LiveAssessmentStudent";
let container: HTMLDivElement; let root: Root;
const items = Array.from({ length: 15 }, (_, i) => ({ id: `q${i}`, skill: "vocabulary" as const, prompt: `Question ${i}`, options: ["One", "Two", "Three", "Four"] }));
const initial: LiveAssessmentState = { sessionId: "room", supported: true, mode: "PRE", status: "RUNNING", revision: 2, paused: false, postOpened: false, items, answers: {}, progress: [], completed: false };
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(state: LiveAssessmentState, onAnswer = vi.fn().mockResolvedValue(true)) { await act(async () => root.render(React.createElement(LiveAssessmentStudent, { state, busy: false, error: "", onAnswer }))); }
async function click(text: string) { await act(async () => [...container.querySelectorAll("button")].find(b => b.textContent?.includes(text))!.click()); }
describe("self-paced test inside the teacher's room", () => {
  it("waits in the lobby without a student start button", async () => {
    await render({ ...initial, status: "LOBBY", items: [] });
    expect(container.textContent).toContain("รอครูเริ่ม"); expect(container.querySelectorAll("button")).toHaveLength(0);
  });
  it("resumes at the first unsaved question from server answers", async () => {
    await render({ ...initial, answers: { q0: 1, q1: 2 } });
    expect(container.textContent).toContain("ข้อ 3/15");
  });
  it("does not advance until the answer is saved, and retries safely", async () => {
    const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await render(initial, save);
    expect([...container.querySelectorAll("button")].find(b => b.textContent?.includes("ถัดไป"))!.disabled).toBe(true);
    await act(async () => (container.querySelector("input") as HTMLInputElement).click());
    await click("ถัดไป"); expect(container.textContent).toContain("ข้อ 1/15");
    await click("ถัดไป"); expect(container.textContent).toContain("ข้อ 2/15");
    expect(save).toHaveBeenLastCalledWith("q0", 0);
  });
  it("waits for the teacher after all answers and never self-grades", async () => {
    await render({ ...initial, answers: Object.fromEntries(items.map(i => [i.id, 0])) });
    expect(container.textContent).toContain("รอครูจบ"); expect(container.querySelectorAll("button")).toHaveLength(0);
  });
  it("stops accepting answers on teacher finish without inventing incomplete scores", async () => {
    await render({ ...initial, status: "FINISHED", items: [], answers: { q0: 1 } });
    expect(container.textContent).toContain("ยังไม่สร้างคะแนน"); expect(container.querySelectorAll("input")).toHaveLength(0);
  });
});
