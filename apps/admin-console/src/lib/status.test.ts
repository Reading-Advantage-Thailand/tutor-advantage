import { describe, expect, it } from "vitest";
import { statusLabel, statusMeta, statusOptions } from "./status";

describe("admin status map", () => {
  it("maps backend values to Thai labels and tones", () => {
    expect(statusMeta("settlementRun", "SUBMITTED")).toMatchObject({ label: "รออนุมัติ", tone: "warning" });
    expect(statusMeta("payoutTransfer", "TRANSFER_FAILED").tone).toBe("danger");
    expect(statusLabel("payment", "success")).toBe("ชำระแล้ว");
    expect(statusLabel("fraudFlag", "FROZEN")).toBe("ระงับไว้");
  });

  it("labels every class and discount code status the new admin lists show", () => {
    for (const status of ["OPEN", "FULL", "CLOSED"]) expect(statusLabel("classStatus", status), status).not.toMatch(/[A-Za-z]/);
    for (const status of ["ACTIVE", "USED_UP", "EXPIRED", "VOID"]) {
      expect(statusLabel("discountCode", status), status).not.toMatch(/[A-Za-z]/);
    }
  });

  it("labels a used single-use discount code ใช้แล้ว and keeps the other labels", () => {
    expect(statusMeta("discountCode", "USED_UP")).toEqual({ label: "ใช้แล้ว", tone: "info" });
    expect(statusLabel("discountCode", "ACTIVE")).toBe("ใช้งานได้");
    expect(statusLabel("discountCode", "EXPIRED")).toBe("หมดอายุ");
    expect(statusLabel("discountCode", "VOID")).toBe("ยกเลิกแล้ว");
    expect(statusOptions("discountCode", { all: "ทุกสถานะ" })).toContainEqual({ value: "USED_UP", label: "ใช้แล้ว" });
  });

  it("labels every support ticket status and category in Thai", () => {
    expect(statusLabel("ticket", "OPEN")).toBe("รอทีมงาน");
    expect(statusLabel("ticket", "IN_PROGRESS")).toBe("กำลังดำเนินการ");
    expect(statusLabel("ticket", "WAITING_ON_REQUESTER")).toBe("รอผู้แจ้ง");
    expect(statusLabel("ticket", "RESOLVED")).toBe("ปิดแล้ว");
    expect(statusLabel("ticketCategory", "REFUND")).toBe("คืนเงิน/ยกเลิก");
    expect(statusLabel("ticketCategory", "OTHER")).toBe("อื่นๆ");
    expect(statusOptions("ticketCategory").map((o) => o.value)).toEqual([
      "REFUND",
      "BOOK_DELIVERY",
      "BOOK_DAMAGED",
      "CLASS",
      "PAYOUT",
      "PRIVACY",
      "TECHNICAL",
      "OTHER",
    ]);
    for (const option of statusOptions("ticketCategory")) expect(option.label, option.value).not.toMatch(/[A-Za-z]/);
  });

  it("falls back to a neutral humanised label", () => {
    expect(statusMeta("coupon", "SOMETHING_NEW")).toEqual({ label: "Something new", tone: "neutral" });
    expect(statusLabel("coupon", null)).toBe("–");
  });

  it("builds filter options", () => {
    expect(statusOptions("adjustment", { all: "ทั้งหมด" })[0]).toEqual({ value: "", label: "ทั้งหมด" });
  });
});
