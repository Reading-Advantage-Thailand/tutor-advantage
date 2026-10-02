import { describe, expect, it } from "vitest";
import {
  NBSP,
  dayOffset,
  formatCompactNumber,
  formatListTimestamp,
  formatNumber,
  formatPercent,
  formatRelativeDay,
  formatSatang,
  formatTHB,
  formatThaiDate,
  formatThaiDateTime,
  formatThaiMonthYear,
  formatThaiTime,
  formatTimeRange,
  keepTimesTogether,
  noOrphan,
  toBuddhistYear,
  toDateKey,
} from "./format";

/** A Bangkok wall-clock time (UTC+7) as a Date, independent of the test machine's zone. */
function bkk(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month, day, hour - 7, minute));
}

describe("money & numbers", () => {
  it("formats baht with symbol, word and code styles", () => {
    expect(formatTHB(1500)).toBe("฿1,500");
    expect(formatTHB(99.5)).toBe("฿99.50");
    expect(formatTHB(1500, { display: "word" })).toBe(`1,500${NBSP}บาท`);
    expect(formatTHB(1500, { display: "code" })).toBe(`THB${NBSP}1,500`);
    expect(formatTHB(-20)).toBe("-฿20");
    expect(formatTHB(-0.001)).toBe("฿0");
    expect(formatTHB(250, { signed: true })).toBe("+฿250");
    expect(formatTHB(Number.NaN)).toBe("–");
    expect(formatTHB(null)).toBe("–");
  });

  it("formats satang, numbers, percents and compact numbers", () => {
    expect(formatSatang(150000)).toBe("฿1,500");
    expect(formatNumber(12500)).toBe("12,500");
    expect(formatNumber(3.14159, 1)).toBe("3.1");
    expect(formatNumber(undefined)).toBe("–");
    expect(formatPercent(0.25)).toBe("25%");
    expect(formatPercent(12.5, { isRatio: false, fractionDigits: 1 })).toBe("12.5%");
    expect(formatCompactNumber(1250)).toBe("1.3K");
  });
});

describe("dates & times (Asia/Bangkok, Buddhist era)", () => {
  const oct2 = bkk(2026, 9, 2, 14, 5);

  it("uses BE years and Thai month names", () => {
    expect(formatThaiDate(oct2, "short")).toBe("2 ต.ค.");
    expect(formatThaiDate(oct2)).toBe("2 ต.ค. 2569");
    expect(formatThaiDate(oct2, "long")).toBe("2 ตุลาคม 2569");
    expect(formatThaiDate(oct2, "full")).toBe("วันศุกร์ที่ 2 ตุลาคม 2569");
    expect(formatThaiMonthYear(oct2)).toBe("ตุลาคม 2569");
    expect(toBuddhistYear(2026)).toBe(2569);
  });

  it("formats 24-hour Bangkok times regardless of input zone", () => {
    expect(formatThaiTime(oct2)).toBe("14:05");
    expect(formatThaiTime("2026-10-01T17:05:00Z")).toBe("00:05");
    expect(formatThaiTime(oct2, { suffix: true })).toBe(`14:05${NBSP}น.`);
    expect(formatThaiDateTime(oct2)).toBe(`2 ต.ค. 2569 14:05${NBSP}น.`);
    expect(formatTimeRange(bkk(2026, 9, 2, 18), bkk(2026, 9, 2, 19, 30))).toBe(`18:00–19:30${NBSP}น.`);
  });

  it("never throws on invalid input", () => {
    expect(formatThaiDate("not a date")).toBe("");
    expect(formatThaiTime(undefined)).toBe("");
    expect(toDateKey("")).toBe("");
  });

  it("builds Bangkok day keys and offsets", () => {
    expect(toDateKey(bkk(2026, 0, 9, 23, 59))).toBe("2026-01-09");
    expect(toDateKey("2026-01-09T17:30:00Z")).toBe("2026-01-10");
    expect(dayOffset(bkk(2026, 9, 3, 0, 0), bkk(2026, 9, 2, 23, 59))).toBe(1);
  });

  it("formats relative days and list timestamps", () => {
    const now = bkk(2026, 9, 2, 9, 0);
    expect(formatRelativeDay(bkk(2026, 9, 2, 23, 59), now)).toBe("วันนี้");
    expect(formatRelativeDay(bkk(2026, 9, 1, 0, 1), now)).toBe("เมื่อวาน");
    expect(formatRelativeDay(bkk(2026, 9, 3), now)).toBe("พรุ่งนี้");
    expect(formatRelativeDay(bkk(2026, 8, 20), now)).toBe("20 ก.ย.");
    expect(formatRelativeDay(bkk(2025, 8, 20), now)).toBe("20 ก.ย. 2568");
    expect(formatListTimestamp(bkk(2026, 9, 2, 8, 30), now)).toBe("08:30");
    expect(formatListTimestamp(bkk(2026, 9, 1, 20), now)).toBe("เมื่อวาน");
  });
});

describe("text helpers", () => {
  it("prevents orphans and keeps times together", () => {
    expect(noOrphan("คลาส Reading Advantage 1")).toBe(`คลาส Reading Advantage${NBSP}1`);
    expect(noOrphan("Reading Advantage")).toBe("Reading Advantage");
    expect(keepTimesTogether("จันทร์ 18:00 - 19:30 น.")).toBe(`จันทร์ 18:00${NBSP}-${NBSP}19:30${NBSP}น.`);
  });
});

import { currentBangkokMonth, formatMinor, formatPeriodMonth, previousBangkokMonth, shiftPeriodMonth, shortId } from "./format";

describe("admin period helpers (Bangkok)", () => {
  it("uses the Bangkok month on the 1st before 07:00 ICT (F-5)", () => {
    // 2026-10-01 02:00 ICT = 2026-09-30 19:00 UTC
    const now = new Date("2026-09-30T19:00:00Z");
    expect(currentBangkokMonth(now)).toBe("2026-10");
    expect(previousBangkokMonth(now)).toBe("2026-09");
  });

  it("does not overflow on the 31st", () => {
    expect(previousBangkokMonth(new Date("2026-10-31T05:00:00Z"))).toBe("2026-09");
    expect(previousBangkokMonth(new Date("2026-01-15T05:00:00Z"))).toBe("2025-12");
    expect(shiftPeriodMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftPeriodMonth("bad", 1)).toBe("");
  });

  it("formats periods, ids and minor units", () => {
    expect(formatPeriodMonth("2026-08")).toBe("สิงหาคม 2569");
    expect(formatPeriodMonth("2026-08", { short: true })).toBe("ส.ค. 2569");
    expect(shortId("5eed0000-0000-4000-8000-000000000101")).toBe("5eed0000…0101");
    expect(formatMinor("150050")).toBe("฿1,500.50");
    expect(formatMinor(null)).toBe("–");
  });
});
