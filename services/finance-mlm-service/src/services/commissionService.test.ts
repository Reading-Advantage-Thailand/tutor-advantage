import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculateCommissionInfo,
  calculateCommissionRate,
  calculatePayoutMinor,
  formatIctPeriodMonth,
  getIctMonthWindow,
} from "./commissionService";

describe("commissionService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates an ICT month window using UTC boundaries", () => {
    const window = getIctMonthWindow("2026-05");

    expect(window.start.toISOString()).toBe("2026-04-30T17:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-05-31T16:59:59.999Z");
  });

  it("rejects invalid period months", () => {
    expect(() => getIctMonthWindow("2026-13")).toThrow("INVALID_PERIOD_MONTH");
    expect(() => getIctMonthWindow("not-a-month")).toThrow("INVALID_PERIOD_MONTH");
  });

  it("formats dates by Bangkok local month", () => {
    expect(formatIctPeriodMonth(new Date("2026-04-30T18:00:00.000Z"))).toBe("2026-05");
  });

  it("calculates tiered commission rates and next targets", () => {
    vi.stubEnv("COMMISSION_BASE_RATE", "0.5");

    expect(calculateCommissionRate(0)).toBe(0);
    expect(calculateCommissionRate(10_000)).toBeCloseTo(0.45);
    expect(calculateCommissionRate(20_000)).toBeCloseTo(0.5);
    expect(calculateCommissionInfo(50_000)).toMatchObject({
      nextTarget: 70_000,
    });
    expect(calculateCommissionInfo(500_000)).toMatchObject({
      nextTarget: 0,
    });
  });

  it("calculates payout in minor units without floating point drift", () => {
    expect(calculatePayoutMinor(100_00n, 0.5)).toBe(50_00n);
    expect(calculatePayoutMinor(99n, 0)).toBe(0n);
    expect(calculatePayoutMinor(0n, 0.5)).toBe(0n);
  });
});
