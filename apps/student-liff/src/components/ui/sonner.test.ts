import { describe, expect, it, vi } from "vitest";

/**
 * ./sonner puts the Thai line-break helper and the toast time on the named
 * toast functions once, when the module loads. "sonner" is mocked here, so the
 * functions it wraps are the spies in `raw`.
 *
 * thaiCopy is mocked as a visible marker, so a wrapped string is easy to tell
 * from a plain one.
 */
const raw = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  message: vi.fn(),
  loading: vi.fn(),
  promise: vi.fn(),
}));

vi.mock("sonner", () => ({ Toaster: () => null, toast: { ...raw } }));
vi.mock("../../lib/thaiText", () => ({ thaiCopy: (text: string) => `[th]${text}` }));

import { toast } from "sonner";
import "./sonner";

describe("toast wrapper", () => {
  it("shows success, info, warning and neutral toasts for 4 seconds", () => {
    toast.success("บันทึกแล้ว");
    toast.info("กำลังตรวจสอบ");
    toast.warning("ใกล้หมดเวลา");
    toast.message("ครูเรียกคุณ");

    expect(raw.success).toHaveBeenCalledWith("[th]บันทึกแล้ว", { duration: 4000 });
    expect(raw.info).toHaveBeenCalledWith("[th]กำลังตรวจสอบ", { duration: 4000 });
    expect(raw.warning).toHaveBeenCalledWith("[th]ใกล้หมดเวลา", { duration: 4000 });
    expect(raw.message).toHaveBeenCalledWith("[th]ครูเรียกคุณ", { duration: 4000 });
  });

  it("wraps a loading toast too", () => {
    // Sonner never times a loading toast (it stays until replaced or
    // dismissed), so the 4000 is inert there; the tone must still be wrapped.
    toast.loading("กำลังบันทึก");

    expect(raw.loading).toHaveBeenCalledWith("[th]กำลังบันทึก", { duration: 4000 });
  });

  it("shows errors for 6 seconds", () => {
    toast.error("บันทึกไม่สำเร็จ");

    expect(raw.error).toHaveBeenCalledWith("[th]บันทึกไม่สำเร็จ", { duration: 6000 });
  });

  it("lets a call set its own time, and keeps its other options", () => {
    toast.message("ครูเรียกคุณ", { id: "nudge", duration: 5000 });
    toast.error("หลุดการเชื่อมต่อ", { duration: Infinity });

    expect(raw.message).toHaveBeenCalledWith("[th]ครูเรียกคุณ", { id: "nudge", duration: 5000 });
    expect(raw.error).toHaveBeenCalledWith("[th]หลุดการเชื่อมต่อ", { duration: Infinity });
  });

  it("gives a same-id success its own 4 seconds after an error", () => {
    toast.error("บันทึกไม่สำเร็จ", { id: "save" });
    toast.success("บันทึกแล้ว", { id: "save" });

    expect(raw.error).toHaveBeenCalledWith("[th]บันทึกไม่สำเร็จ", { id: "save", duration: 6000 });
    expect(raw.success).toHaveBeenCalledWith("[th]บันทึกแล้ว", { id: "save", duration: 4000 });
  });

  it("still passes a text description through the Thai line-break helper", () => {
    toast.error("ชำระเงินไม่สำเร็จ", { description: "ลองอีกครั้ง" });
    toast.success("ส่งแล้ว", { description: "ทีมงานจะตอบกลับ", duration: 8000 });

    expect(raw.error).toHaveBeenCalledWith("[th]ชำระเงินไม่สำเร็จ", {
      duration: 6000,
      description: "[th]ลองอีกครั้ง",
    });
    expect(raw.success).toHaveBeenCalledWith("[th]ส่งแล้ว", {
      duration: 8000,
      description: "[th]ทีมงานจะตอบกลับ",
    });
  });

  it("passes a node title and a node description on unchanged", () => {
    const title = { node: "title" } as unknown as React.ReactNode;
    const description = { node: "description" } as unknown as React.ReactNode;
    toast.info(title, { description });

    expect(raw.info).toHaveBeenCalledTimes(1);
    const [sentTitle, sentData] = raw.info.mock.calls[0];
    expect(sentTitle).toBe(title);
    expect(sentData).toEqual({ duration: 4000, description });
    expect(sentData.description).toBe(description);
  });

  it("wraps toast.promise: Thai text, 4 seconds after success, 6 after an error", async () => {
    const work = Promise.resolve("ok");
    toast.promise(work, { loading: "กำลังบันทึก", success: "บันทึกแล้ว", error: "บันทึกไม่สำเร็จ", description: "ลองอีกครั้ง" });

    expect(raw.promise).toHaveBeenCalledTimes(1);
    const [sentPromise, sent] = raw.promise.mock.calls[0];
    expect(sentPromise).toBe(work);
    expect(sent.loading).toBe("[th]กำลังบันทึก");
    expect(sent.description).toBe("[th]ลองอีกครั้ง");
    await expect(sent.success("ok")).resolves.toEqual({ message: "[th]บันทึกแล้ว", duration: 4000 });
    await expect(sent.error(new Error("x"))).resolves.toEqual({ message: "[th]บันทึกไม่สำเร็จ", duration: 6000 });
  });

  it("keeps a toast.promise call's own states, time and missing states", async () => {
    const node = { node: "done" } as unknown as React.ReactNode;
    toast.promise(Promise.resolve(2), {
      duration: 9000,
      success: (count: number) => `บันทึก ${count} รายการ`,
      error: () => ({ message: "หมดเวลา", duration: Infinity }),
      description: (count: number) => `รวม ${count}`,
    });
    toast.promise(Promise.resolve(1), { success: () => node });

    const [, first] = raw.promise.mock.calls[0];
    expect(first.loading).toBeUndefined();
    await expect(first.success(2)).resolves.toEqual({ message: "[th]บันทึก 2 รายการ", duration: 9000 });
    await expect(first.error(new Error("x"))).resolves.toEqual({ message: "[th]หมดเวลา", duration: Infinity });
    await expect(first.description(2)).resolves.toBe("[th]รวม 2");

    const [, second] = raw.promise.mock.calls[1];
    expect(second.error).toBeUndefined();
    const settled = await second.success(1);
    expect(settled).toEqual({ message: node, duration: 4000 });
    expect(settled.message).toBe(node);
  });
});
