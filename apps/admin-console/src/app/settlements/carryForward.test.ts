import { describe, expect, it } from "vitest";
import { carryForwardDebt, carryForwardSummary, monthsBetween } from "./carryForward";

describe("carryForwardSummary", () => {
  it("counts lines that carry debt forward", () => {
    expect(
      carryForwardSummary([
        { carryForwardOutSatang: "250000" },
        { carryForwardOutSatang: "0" },
        { carryForwardOutSatang: "5000" },
        { carryForwardOutSatang: undefined },
      ]),
    ).toEqual({ count: 2, totalSatang: "255000" });
  });
});

describe("carryForwardDebt / monthsBetween", () => {
  it("recognises system debt rows, not write-offs or manual rows", () => {
    expect(carryForwardDebt({ reason: "carry-forward:origin=2026-02", amountSatang: -5000 })).toEqual({ origin: "2026-02" });
    expect(carryForwardDebt({ reason: "carry-forward-writeoff: left", amountSatang: 5000 })).toBeNull();
    expect(carryForwardDebt({ reason: "manual bonus", amountSatang: -5000 })).toBeNull();
  });

  it("counts months across years", () => {
    expect(monthsBetween("2025-11", "2026-05")).toBe(6);
    expect(monthsBetween("2026-05", "2026-05")).toBe(0);
  });
});
