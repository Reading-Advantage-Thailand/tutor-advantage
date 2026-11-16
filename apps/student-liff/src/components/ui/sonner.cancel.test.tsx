// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A touch the browser cancels (pointercancel: a long press that starts text
 * selection, a system gesture) never gets a pointerup. Sonner 2 clears its
 * "interacting" and swiping state only on pointerup, so without the app's
 * Toaster stepping in, the toast stays on screen. These tests run the REAL
 * sonner Toaster (sonner.touch.test.tsx mocks it) with fake timers.
 *
 * jsdom has no PointerEvent constructor and no setPointerCapture: the events
 * are MouseEvents carrying pointerId / pointerType / isPrimary (as in
 * sonner.touch.test.tsx), and PointerEvent is stubbed with the same shape so
 * the Toaster can build the pointerup it sends sonner.
 */
vi.mock("../providers/ThemeProvider", () => ({ useTheme: () => ({ theme: "light" }) }));
vi.mock("../../lib/thaiText", () => ({ thaiCopy: (text: string) => text }));

import { Toaster } from "./sonner";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type PointerInit = MouseEventInit & { pointerId?: number; pointerType?: string; isPrimary?: boolean };

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly isPrimary: boolean;
  constructor(type: string, init: PointerInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? "touch";
    this.isPrimary = init.isPrimary ?? true;
  }
}

let container: HTMLDivElement;
let root: Root;
let originalSetPointerCapture: unknown;

function pointer(type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel", target: Element, init: PointerInit = {}) {
  act(() => {
    target.dispatchEvent(new TestPointerEvent(type, { bubbles: true, cancelable: true, pointerType: "touch", pointerId: 7, ...init }));
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const toasts = () => Array.from(document.querySelectorAll<HTMLElement>("[data-sonner-toast]"));
const toastWithText = (text: string) => toasts().find((element) => element.textContent?.includes(text)) ?? null;
const titleOf = (text: string) => toastWithText(text)!.querySelector("[data-title]")!;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  originalSetPointerCapture = (Element.prototype as { setPointerCapture?: unknown }).setPointerCapture;
  (Element.prototype as { setPointerCapture?: unknown }).setPointerCapture = () => {};
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<Toaster position="top-center" />));
});

afterEach(() => {
  act(() => toast.dismiss());
  advance(1000);
  act(() => root.unmount());
  container.remove();
  (Element.prototype as { setPointerCapture?: unknown }).setPointerCapture = originalSetPointerCapture;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Toaster after a cancelled touch (real sonner)", () => {
  it("lets a toast leave on its own time after the browser cancels the touch", () => {
    const onDismiss = vi.fn();
    const onAutoClose = vi.fn();
    act(() => {
      toast.success("บันทึกแล้ว", { onDismiss, onAutoClose });
    });
    advance(0);
    const toaster = document.querySelector("[data-sonner-toaster]")!;
    const leaves: Event[] = [];
    toaster.addEventListener("mouseout", (event) => leaves.push(event));
    expect(toastWithText("บันทึกแล้ว")).not.toBeNull();

    advance(1000);
    pointer("pointerdown", titleOf("บันทึกแล้ว"), { clientX: 100, clientY: 40 });
    advance(1000);
    pointer("pointercancel", titleOf("บันทึกแล้ว"));
    expect(toastWithText("บันทึกแล้ว")!.getAttribute("data-swiping")).toBe("false");

    // One release for the cancel: the replayed pointerup is not handled again.
    advance(80);
    expect(leaves).toHaveLength(1);

    // 4 s on screen + the 1 s the finger was down: still there just before, gone just after.
    advance(2800); // t = 4880
    expect(toastWithText("บันทึกแล้ว")).not.toBeNull();
    expect(toastWithText("บันทึกแล้ว")!.getAttribute("data-removed")).toBe("false");
    advance(400); // t = 5280 (auto close at 5000, unmount 200 ms later)
    expect(toastWithText("บันทึกแล้ว")).toBeNull();
    expect(onAutoClose).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("does not turn a cancel after the finger moved past the swipe threshold into a dismissal", () => {
    const onDismiss = vi.fn();
    act(() => {
      toast.error("บันทึกไม่สำเร็จ", { onDismiss });
    });
    advance(1000);
    const title = titleOf("บันทึกไม่สำเร็จ");
    pointer("pointerdown", title, { clientX: 100, clientY: 100 });
    pointer("pointermove", title, { clientX: 100, clientY: 96 });
    advance(100);
    pointer("pointermove", title, { clientX: 100, clientY: 40 });
    expect(toastWithText("บันทึกไม่สำเร็จ")!.style.getPropertyValue("--swipe-amount-y")).toBe("-60px");
    pointer("pointercancel", title);

    advance(400);
    const element = toastWithText("บันทึกไม่สำเร็จ")!;
    expect(element).not.toBeNull();
    expect(element.getAttribute("data-removed")).toBe("false");
    expect(element.getAttribute("data-swipe-out")).toBe("false");
    expect(element.getAttribute("data-swiping")).toBe("false");
    expect(element.style.getPropertyValue("--swipe-amount-y")).toBe("0px");
    expect(onDismiss).not.toHaveBeenCalled();

    // 6 s + the 0.1 s the finger was down: auto close at 6100.
    advance(4500); // t = 6000
    expect(toastWithText("บันทึกไม่สำเร็จ")).not.toBeNull();
    advance(400); // t = 6400
    expect(toastWithText("บันทึกไม่สำเร็จ")).toBeNull();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("frees every toast on screen when the touch on one of them is cancelled", () => {
    act(() => {
      toast.success("ส่งการบ้านแล้ว");
      toast.error("โหลดไม่สำเร็จ");
    });
    advance(0);
    expect(toasts()).toHaveLength(2);

    advance(1000);
    pointer("pointerdown", titleOf("โหลดไม่สำเร็จ"), { clientX: 100, clientY: 40 });
    advance(1000);
    pointer("pointercancel", titleOf("โหลดไม่สำเร็จ"));

    advance(2800); // t = 4800
    expect(toasts()).toHaveLength(2);
    advance(500); // t = 5300: the success (4 s + 1 s paused) is gone
    expect(toastWithText("ส่งการบ้านแล้ว")).toBeNull();
    expect(toastWithText("โหลดไม่สำเร็จ")).not.toBeNull();
    advance(1500); // t = 6800
    expect(toastWithText("โหลดไม่สำเร็จ")).not.toBeNull();
    advance(500); // t = 7300: the error (6 s + 1 s paused) is gone
    expect(toasts()).toHaveLength(0);
  });

  it("keeps a real swipe to dismiss and a tap as they were", () => {
    const onDismiss = vi.fn();
    act(() => {
      toast.success("คัดลอกแล้ว", { onDismiss });
    });
    advance(1000);
    const title = titleOf("คัดลอกแล้ว");
    pointer("pointerdown", title, { clientX: 100, clientY: 100 });
    pointer("pointermove", title, { clientX: 100, clientY: 96 });
    advance(100);
    pointer("pointermove", title, { clientX: 100, clientY: 40 });
    pointer("pointerup", title);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(toastWithText("คัดลอกแล้ว")!.getAttribute("data-swipe-out")).toBe("true");
    advance(300);
    expect(toastWithText("คัดลอกแล้ว")).toBeNull();

    act(() => {
      toast.success("บันทึกแล้ว");
    });
    advance(1000);
    pointer("pointerdown", titleOf("บันทึกแล้ว"), { clientX: 100, clientY: 40 });
    pointer("pointerup", titleOf("บันทึกแล้ว"));
    advance(2800); // 3.8 s after it appeared
    expect(toastWithText("บันทึกแล้ว")).not.toBeNull();
    advance(500);
    expect(toastWithText("บันทึกแล้ว")).toBeNull();
  });
});
