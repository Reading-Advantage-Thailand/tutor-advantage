import { describe, expect, it } from "vitest";
import {
  formatListTimestamp,
  formatRelativeDay,
  formatSatang,
  formatTHB,
  formatThaiDate,
  formatThaiMonthYear,
  formatThaiTime,
  toDate,
  toLocalDateKey,
} from "./format";

// Local-time constructors keep these tests independent of the machine's time zone.
const oct2 = new Date(2026, 9, 2, 14, 5);

describe("money", () => {
  it("formats baht with a symbol, word or code", () => {
    expect(formatTHB(1500)).toBe("฿1,500");
    expect(formatTHB(1500, { display: "word" })).toBe("1,500 บาท");
    expect(formatTHB(1500, { display: "code" })).toBe("THB 1,500");
  });

  it("shows satang only when present unless fraction digits are fixed", () => {
    expect(formatTHB(99.5)).toBe("฿99.50");
    expect(formatTHB(1234567.25)).toBe("฿1,234,567.25");
    expect(formatTHB(1500, { fractionDigits: 2 })).toBe("฿1,500.00");
    expect(formatTHB(99.5, { fractionDigits: 0 })).toBe("฿100");
  });

  it("handles negatives, zero and invalid input", () => {
    expect(formatTHB(-250)).toBe("-฿250");
    expect(formatTHB(0)).toBe("฿0");
    expect(formatTHB(-0.001)).toBe("฿0");
    expect(formatTHB(Number.NaN)).toBe("–");
    expect(formatTHB(Number.POSITIVE_INFINITY)).toBe("–");
  });

  it("converts satang (API minor units) to baht", () => {
    expect(formatSatang(150000)).toBe("฿1,500");
    expect(formatSatang(9950, { display: "word" })).toBe("99.50 บาท");
    expect(formatSatang(Number.NaN)).toBe("–");
  });
});

describe("dates", () => {
  it("formats Thai dates with the Buddhist-era year", () => {
    expect(formatThaiDate(oct2)).toBe("2 ต.ค. 2569");
    expect(formatThaiDate(oct2, "short")).toBe("2 ต.ค.");
    expect(formatThaiDate(oct2, "long")).toBe("2 ตุลาคม 2569");
    const full = formatThaiDate(oct2, "full");
    expect(full).toContain("ศุกร์");
    expect(full).toContain("2569");
  });

  it("accepts ISO strings and epoch ms, and returns empty for invalid input", () => {
    expect(formatThaiDate(oct2.toISOString())).toBe("2 ต.ค. 2569");
    expect(formatThaiDate(oct2.getTime())).toBe("2 ต.ค. 2569");
    expect(formatThaiDate("not a date")).toBe("");
    expect(formatThaiTime("")).toBe("");
    expect(toDate(undefined)).toBeNull();
  });

  it("formats 24-hour times with an optional น. suffix", () => {
    expect(formatThaiTime(oct2)).toBe("14:05");
    expect(formatThaiTime(new Date(2026, 9, 2, 0, 5))).toBe("00:05");
    expect(formatThaiTime(oct2, { suffix: true })).toBe("14:05 น.");
  });

  it("formats month and year for calendar headers", () => {
    expect(formatThaiMonthYear(oct2)).toBe("ตุลาคม 2569");
  });

  it("builds local YYYY-MM-DD keys", () => {
    expect(toLocalDateKey(oct2)).toBe("2026-10-02");
    expect(toLocalDateKey(new Date(2026, 0, 9, 23, 59))).toBe("2026-01-09");
    expect(toLocalDateKey("garbage")).toBe("");
  });
});

describe("relative days", () => {
  const now = new Date(2026, 9, 2, 9, 0);

  it("labels today, yesterday and tomorrow across midnight boundaries", () => {
    expect(formatRelativeDay(new Date(2026, 9, 2, 23, 59), now)).toBe("วันนี้");
    expect(formatRelativeDay(new Date(2026, 9, 1, 0, 1), now)).toBe("เมื่อวาน");
    expect(formatRelativeDay(new Date(2026, 9, 3, 0, 0), now)).toBe("พรุ่งนี้");
  });

  it("falls back to a date, adding the year only for other years", () => {
    expect(formatRelativeDay(new Date(2026, 8, 20), now)).toBe("20 ก.ย.");
    expect(formatRelativeDay(new Date(2025, 8, 20), now)).toBe("20 ก.ย. 2568");
  });

  it("formats compact list timestamps", () => {
    expect(formatListTimestamp(new Date(2026, 9, 2, 8, 30), now)).toBe("08:30");
    expect(formatListTimestamp(new Date(2026, 9, 1, 20, 0), now)).toBe("เมื่อวาน");
    expect(formatListTimestamp(new Date(2026, 8, 20), now)).toBe("20 ก.ย.");
  });
});
