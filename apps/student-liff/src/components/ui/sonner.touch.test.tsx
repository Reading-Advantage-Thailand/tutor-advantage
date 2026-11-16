// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sonner pauses its toast timers while the pointer is over the toaster and
 * resumes on mouseleave. A touch leaves the toaster "hovered" (compatibility
 * mouse events, no mouseleave), so the app's Toaster sends the toaster a
 * mouseout after a touch or pen contact ends. Sonner is mocked as a bare
 * toaster list, so the test sees exactly which mouseout events reach it.
 */
vi.mock("sonner", () => ({
  Toaster: () => (
    <ol data-sonner-toaster="">
      <li data-testid="toast">
        <span data-testid="toast-title">บันทึกแล้ว</span>
      </li>
    </ol>
  ),
  toast: {},
}));
vi.mock("../providers/ThemeProvider", () => ({ useTheme: () => ({ theme: "light" }) }));
vi.mock("../../lib/thaiText", () => ({ thaiCopy: (text: string) => text }));

import { Toaster } from "./sonner";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let outside: HTMLButtonElement;
let leaves: MouseEvent[];

function pointer(type: "pointerup" | "pointercancel", target: Element, pointerType: string) {
  // jsdom has no PointerEvent constructor; the hook reads only type, target and pointerType.
  const event = new MouseEvent(type, { bubbles: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  target.dispatchEvent(event);
}

function toaster() {
  return container.querySelector("[data-sonner-toaster]") as HTMLElement;
}

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  outside = document.createElement("button");
  document.body.append(container, outside);
  root = createRoot(container);
  act(() => root.render(<Toaster />));
  leaves = [];
  toaster().addEventListener("mouseout", (event) => leaves.push(event));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  outside.remove();
  vi.useRealTimers();
});

describe("Toaster after a touch", () => {
  it("sends the toaster a mouseleave shortly after a finger lifts off a toast", () => {
    pointer("pointerup", container.querySelector("[data-testid=toast-title]")!, "touch");
    expect(leaves).toHaveLength(0);

    vi.advanceTimersByTime(80);

    expect(leaves).toHaveLength(1);
    expect(leaves[0].bubbles).toBe(true);
    expect(leaves[0].relatedTarget).toBe(document.body);
  });

  it("does the same for a cancelled touch and a pen", () => {
    pointer("pointercancel", toaster(), "touch");
    pointer("pointerup", toaster(), "pen");
    vi.advanceTimersByTime(80);

    expect(leaves).toHaveLength(2);
  });

  it("releases again after the click a tap ends with", () => {
    pointer("pointerup", toaster(), "touch");
    vi.advanceTimersByTime(80);
    container.querySelector<HTMLElement>("[data-testid=toast]")!.click();
    vi.advanceTimersByTime(80);

    expect(leaves).toHaveLength(2);
  });

  it("leaves a mouse alone, so desktop hover still pauses the toast", () => {
    pointer("pointerup", toaster(), "mouse");
    toaster().click();
    vi.advanceTimersByTime(1000);

    expect(leaves).toHaveLength(0);
  });

  it("ignores touches outside the toaster", () => {
    pointer("pointerup", outside, "touch");
    outside.click();
    vi.advanceTimersByTime(1000);

    expect(leaves).toHaveLength(0);
  });

  it("stops listening when the toaster unmounts", () => {
    const list = toaster();
    pointer("pointerup", list, "touch");
    act(() => root.unmount());
    vi.advanceTimersByTime(1000);
    pointer("pointerup", list, "touch");
    vi.advanceTimersByTime(1000);

    expect(leaves).toHaveLength(0);
    root = createRoot(container);
  });
});
