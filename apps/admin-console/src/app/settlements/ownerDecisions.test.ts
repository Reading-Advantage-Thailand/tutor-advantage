import { describe, expect, it } from "vitest";
import { isCrossPeriodRefundClawback, uncollectedClawback } from "./ownerDecisions";

describe("uncollectedClawback", () => {
  it("sums the negative totals that are paid as 0", () => {
    expect(
      uncollectedClawback([
        { grossPayoutSatang: "-250000" },
        { grossPayoutSatang: "120000" },
        { grossPayoutSatang: "-5000" },
        { grossPayoutSatang: "oops" },
      ]),
    ).toEqual({ count: 2, totalSatang: "255000" });
    expect(uncollectedClawback([])).toEqual({ count: 0, totalSatang: "0" });
  });
});

describe("isCrossPeriodRefundClawback", () => {
  it("flags refund clawbacks that take commission and volume", () => {
    expect(isCrossPeriodRefundClawback({ reason: "refund:pi-1", amountSatang: -5000, volumeSatang: -250000 })).toBe(true);
    expect(isCrossPeriodRefundClawback({ reason: "chargeback:pi-1", amountSatang: -5000, volumeSatang: -250000 })).toBe(true);
  });

  it("ignores same-period (volume-only) and manual adjustments", () => {
    expect(isCrossPeriodRefundClawback({ reason: "refund:pi-1", amountSatang: 0, volumeSatang: -250000 })).toBe(false);
    expect(isCrossPeriodRefundClawback({ reason: "manual bonus", amountSatang: 5000, volumeSatang: null })).toBe(false);
  });
});
