import { describe, expect, it } from "vitest";
import { statusLabel, statusMeta, statusOptions } from "./status";

describe("admin status map", () => {
  it("maps backend values to Thai labels and tones", () => {
    expect(statusMeta("settlementRun", "SUBMITTED")).toMatchObject({ label: "รออนุมัติ", tone: "warning" });
    expect(statusMeta("payoutTransfer", "TRANSFER_FAILED").tone).toBe("danger");
    expect(statusLabel("payment", "success")).toBe("ชำระแล้ว");
    expect(statusLabel("fraudFlag", "FROZEN")).toBe("ระงับไว้");
  });

  it("falls back to a neutral humanised label", () => {
    expect(statusMeta("coupon", "SOMETHING_NEW")).toEqual({ label: "Something new", tone: "neutral" });
    expect(statusLabel("coupon", null)).toBe("–");
  });

  it("builds filter options", () => {
    expect(statusOptions("adjustment", { all: "ทั้งหมด" })[0]).toEqual({ value: "", label: "ทั้งหมด" });
  });
});
