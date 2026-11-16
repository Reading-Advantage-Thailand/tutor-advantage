import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The store keeps module-level state and only arms its timer in a browser
 * (`typeof window`), so every test loads a fresh copy under a stub `window`.
 * No DOM is needed.
 */
async function loadStore() {
  vi.resetModules();
  return import("./toastStore");
}

describe("toast store: how long a toast stays", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(["plain", "success", "info", "warning"] as const)("keeps a %s toast for 4 s by default", async (kind) => {
    const { toast, getToastsSnapshot } = await loadStore();
    if (kind === "plain") toast("บันทึกแล้ว");
    else toast[kind]("บันทึกแล้ว");
    expect(getToastsSnapshot()).toMatchObject([{ message: "บันทึกแล้ว", duration: 4000 }]);
    vi.advanceTimersByTime(3999);
    expect(getToastsSnapshot()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getToastsSnapshot()).toHaveLength(0);
  });

  it("keeps an error for 6 s by default, then removes it", async () => {
    const { toast, getToastsSnapshot } = await loadStore();
    toast.error("บันทึกไม่สำเร็จ", { description: "เซิร์ฟเวอร์ไม่ตอบสนอง" });
    expect(getToastsSnapshot()).toMatchObject([{ tone: "error", duration: 6000 }]);
    vi.advanceTimersByTime(4000);
    expect(getToastsSnapshot()).toHaveLength(1);
    vi.advanceTimersByTime(1999);
    expect(getToastsSnapshot()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getToastsSnapshot()).toHaveLength(0);
  });

  it("lets a caller's own duration win, for an error too", async () => {
    const { toast, getToastsSnapshot } = await loadStore();
    toast.success("คัดลอกแล้ว", { duration: 1500 });
    toast.error("ส่งออกไม่สำเร็จ", { duration: 9000 });
    expect(getToastsSnapshot().map((item) => item.duration)).toEqual([1500, 9000]);
    vi.advanceTimersByTime(1500);
    expect(getToastsSnapshot().map((item) => item.tone)).toEqual(["error"]);
    vi.advanceTimersByTime(7499);
    expect(getToastsSnapshot()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getToastsSnapshot()).toHaveLength(0);
  });

  it("stays until dismissed only when a caller asks for duration 0", async () => {
    const { toast, getToastsSnapshot } = await loadStore();
    const id = toast.error("ต้องตรวจสอบ", { duration: 0 });
    vi.advanceTimersByTime(60_000);
    expect(getToastsSnapshot()).toHaveLength(1);
    toast.dismiss(id);
    expect(getToastsSnapshot()).toHaveLength(0);
  });
});
