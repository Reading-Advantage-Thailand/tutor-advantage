import { describe, expect, it } from "vitest";
import {
  adjustmentLines,
  canOfferTawi50,
  commissionPercent,
  formatPeriodMonth,
  historyGross,
  historyNetTotal,
  isPendingTransfer,
  projectWithholding,
  rateProgressPercent,
  type EarningsHistoryItem,
} from "./earnings";

const row = (over: Partial<EarningsHistoryItem> = {}): EarningsHistoryItem => ({
  date: "2026-09",
  direct: 1000,
  network: 200,
  clawback: -50,
  status: "approved",
  ...over,
});

describe("projectWithholding", () => {
  it("mirrors the backend satang rounding", () => {
    expect(projectWithholding(2125)).toEqual({ gross: 2125, wht: 63.75, net: 2061.25 });
    // 0.17 * 3 = 0.51 satang-rounded: (17*3+50)/100 = 1.01 → 1 satang
    expect(projectWithholding(0.17)).toEqual({ gross: 0.17, wht: 0.01, net: 0.16 });
  });
  it("never withholds on zero or negative gross", () => {
    expect(projectWithholding(0).wht).toBe(0);
    expect(projectWithholding(-100)).toEqual({ gross: -100, wht: 0, net: -100 });
  });
});

describe("rate helpers", () => {
  it("rounds commission percent to 2 decimals", () => {
    expect(commissionPercent(0.425)).toBe(42.5);
    expect(commissionPercent(0.12345)).toBe(12.35);
  });
  it("caps progress and treats no target as max tier", () => {
    expect(rateProgressPercent({ rate: 0.4, volume: 5000, nextTarget: 10000 })).toBe(50);
    expect(rateProgressPercent({ rate: 0.4, volume: 20000, nextTarget: 10000 })).toBe(100);
    expect(rateProgressPercent({ rate: 0.5, volume: 1, nextTarget: 0 })).toBe(100);
  });
});

describe("history rows", () => {
  it("prefers netPayout and falls back to the legacy gross sum", () => {
    expect(historyNetTotal(row({ netPayout: 999 }))).toBe(999);
    expect(historyNetTotal(row({ badgeBonus: 100 }))).toBe(1150);
  });
  it("includes badge bonus in gross", () => {
    expect(historyGross(row({ badgeBonus: 100 }))).toBe(1250);
  });
  it("lists explicit adjustments, else the clawback", () => {
    expect(adjustmentLines(row(), "หักคืน")).toEqual([{ amount: -50, reason: "หักคืน" }]);
    expect(adjustmentLines(row({ clawback: 0 }), "หักคืน")).toEqual([]);
    expect(
      adjustmentLines(row({ adjustments: [{ amount: 20, reason: "" }, { amount: -5, reason: "คืนเงิน" }] }), "หักคืน"),
    ).toEqual([
      { amount: 20, reason: "หักคืน" },
      { amount: -5, reason: "คืนเงิน" },
    ]);
  });
  it("offers 50 ทวิ only for approved rows with WHT and a document", () => {
    const doc = {
      payoutDocumentId: "x",
      documentNumber: "D1",
      documentType: "WHT",
      status: "ISSUED",
      issuedAt: "2026-09-30",
    };
    expect(canOfferTawi50(row({ payoutDocument: doc, withholdingTax: 10 }))).toBe(true);
    expect(canOfferTawi50(row({ payoutDocument: doc, withholdingTax: 0 }))).toBe(false);
    expect(canOfferTawi50(row({ payoutDocument: doc, withholdingTax: 10, status: "pending" }))).toBe(false);
    expect(canOfferTawi50(row({ withholdingTax: 10 }))).toBe(false);
  });
});

describe("misc", () => {
  it("knows which transfer statuses are still moving", () => {
    expect(isPendingTransfer("SENT")).toBe(true);
    expect(isPendingTransfer("PAID")).toBe(false);
    expect(isPendingTransfer(undefined)).toBe(false);
  });
  it("formats YYYY-MM periods in Thai Buddhist era", () => {
    expect(formatPeriodMonth("2026-10")).toBe("ตุลาคม 2569");
    expect(formatPeriodMonth("2026-01")).toBe("มกราคม 2569");
    expect(formatPeriodMonth("1 ต.ค. 69")).toBe("1 ต.ค. 69");
    expect(formatPeriodMonth("")).toBe("");
  });
});
