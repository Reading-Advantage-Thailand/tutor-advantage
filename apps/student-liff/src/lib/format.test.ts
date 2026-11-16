import { describe, expect, it } from "vitest";
import {
  APP_TIME_ZONE,
  formatListTimestamp,
  formatRelativeDay,
  formatSatang,
  formatTHB,
  formatThaiDate,
  formatThaiMonthYear,
  formatThaiTime,
  keepTimesTogether,
  localDayToBangkokNoon,
  noOrphan,
  toDate,
  toDateKey,
  toLocalDateKey,
} from "./format";

// A moment given as Bangkok wall-clock time (UTC+7): the formatters show Thai
// time, so these tests read the same in any machine time zone.
const bkk = (year: number, month: number, day: number, hour = 0, minute = 0) =>
  new Date(Date.UTC(year, month, day, hour - 7, minute));
const oct2 = bkk(2026, 9, 2, 14, 5);

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
    expect(formatThaiTime(bkk(2026, 9, 2, 0, 5))).toBe("00:05");
    expect(formatThaiTime(oct2, { suffix: true })).toBe("14:05\u00A0น.");
  });

  it("shows Thai time (Asia/Bangkok) whatever the device zone is", () => {
    expect(APP_TIME_ZONE).toBe("Asia/Bangkok");
    // 17:05 UTC on 1 Oct is 00:05 on 2 Oct in Bangkok.
    expect(formatThaiTime("2026-10-01T17:05:00Z")).toBe("00:05");
    expect(formatThaiDate("2026-10-01T17:05:00Z", "long")).toBe("2 ตุลาคม 2569");
    // A class start date is stored as UTC midnight = 07:00 in Bangkok, the same day.
    expect(formatThaiDate("2026-11-06T00:00:00.000Z")).toBe("6 พ.ย. 2569");
  });

  it("formats month and year for calendar headers", () => {
    expect(formatThaiMonthYear(oct2)).toBe("ตุลาคม 2569");
    expect(formatThaiMonthYear("2026-10-31T17:00:00Z")).toBe("พฤศจิกายน 2569");
  });

  it("builds Bangkok YYYY-MM-DD keys", () => {
    expect(toDateKey(oct2)).toBe("2026-10-02");
    expect(toDateKey("2026-01-09T16:59:59Z")).toBe("2026-01-09");
    expect(toDateKey("2026-01-09T17:30:00Z")).toBe("2026-01-10");
    expect(toDateKey("garbage")).toBe("");
    expect(toDateKey(null)).toBe("");
  });

  it("builds local YYYY-MM-DD keys", () => {
    // Device-local constructors on purpose: this key follows the machine's zone.
    expect(toLocalDateKey(new Date(2026, 9, 2, 14, 5))).toBe("2026-10-02");
    expect(toLocalDateKey(new Date(2026, 0, 9, 23, 59))).toBe("2026-01-09");
    expect(toLocalDateKey("garbage")).toBe("");
  });
});

describe("device-local calendar days", () => {
  it("moves a local day to Bangkok noon of the same calendar day", () => {
    expect(localDayToBangkokNoon(new Date(2026, 10, 1)).toISOString()).toBe("2026-11-01T05:00:00.000Z");
    expect(localDayToBangkokNoon(new Date(2026, 10, 1, 23, 59)).toISOString()).toBe("2026-11-01T05:00:00.000Z");
    expect(formatThaiMonthYear(localDayToBangkokNoon(new Date(2026, 10, 1)))).toBe("พฤศจิกายน 2569");
    expect(formatThaiDate(localDayToBangkokNoon(new Date(2026, 10, 6)), "long")).toBe("6 พฤศจิกายน 2569");
  });

  it("keeps the calendar day for 400 days in a row, in any machine zone", () => {
    // The schedule calendar's day labels and month header depend on this.
    const wrong: string[] = [];
    for (let i = 0; i < 400; i++) {
      const local = new Date(2026, 0, 1 + i);
      const key = toLocalDateKey(local);
      const noon = localDayToBangkokNoon(local);
      const shownDay = formatThaiDate(noon, "short").split(" ")[0];
      if (toDateKey(noon) !== key || shownDay !== String(local.getDate())) wrong.push(key);
    }
    expect(wrong).toEqual([]);
  });

  it("keeps the calendar day and month on devices east and west of Bangkok", () => {
    // The loop above only bites east of UTC+7, and CI runs in UTC. Switching
    // the zone at run time makes these guards bite on any machine.
    const saved = process.env.TZ;
    try {
      for (const zone of ["Asia/Tokyo", "Pacific/Auckland", "America/Los_Angeles"]) {
        process.env.TZ = zone;
        expect(formatThaiMonthYear(localDayToBangkokNoon(new Date(2026, 10, 1))), zone).toBe("พฤศจิกายน 2569");
        expect(formatThaiDate(localDayToBangkokNoon(new Date(2026, 10, 6)), "long"), zone).toBe("6 พฤศจิกายน 2569");
        const wrong: string[] = [];
        for (let i = 0; i < 400; i++) {
          const local = new Date(2026, 0, 1 + i);
          const noon = localDayToBangkokNoon(local);
          if (formatThaiDate(noon, "short").split(" ")[0] !== String(local.getDate())) wrong.push(toLocalDateKey(local));
        }
        expect(wrong, zone).toEqual([]);
      }
    } finally {
      if (saved === undefined) delete process.env.TZ;
      else process.env.TZ = saved;
    }
  });

  it("gives an invalid date back as invalid, which the formatters show as empty", () => {
    expect(formatThaiDate(localDayToBangkokNoon(new Date("garbage")))).toBe("");
  });
});

describe("relative days", () => {
  const now = bkk(2026, 9, 2, 9, 0);

  it("labels today, yesterday and tomorrow across Bangkok midnight", () => {
    expect(formatRelativeDay(bkk(2026, 9, 2, 23, 59), now)).toBe("วันนี้");
    expect(formatRelativeDay(bkk(2026, 9, 1, 0, 1), now)).toBe("เมื่อวาน");
    expect(formatRelativeDay(bkk(2026, 9, 3, 0, 0), now)).toBe("พรุ่งนี้");
  });

  it("falls back to a date, adding the year only for other years", () => {
    expect(formatRelativeDay(bkk(2026, 8, 20), now)).toBe("20 ก.ย.");
    expect(formatRelativeDay(bkk(2025, 8, 20), now)).toBe("20 ก.ย. 2568");
  });

  it("compares the year in Bangkok time", () => {
    // 31 Dec 2025 17:30 UTC is already 1 Jan 2026 in Bangkok: this year, so no year is shown.
    expect(formatRelativeDay("2025-12-31T17:30:00Z", bkk(2026, 0, 5))).toBe("1 ม.ค.");
    expect(formatListTimestamp("2025-12-31T17:30:00Z", bkk(2026, 0, 5))).toBe("1 ม.ค.");
    // An hour earlier it is still 31 Dec 2025 in Bangkok: last year.
    expect(formatRelativeDay("2025-12-31T16:30:00Z", bkk(2026, 0, 5))).toBe("31 ธ.ค. 2568");
  });

  it("formats compact list timestamps", () => {
    expect(formatListTimestamp(bkk(2026, 9, 2, 8, 30), now)).toBe("08:30");
    expect(formatListTimestamp(bkk(2026, 9, 1, 20, 0), now)).toBe("เมื่อวาน");
    expect(formatListTimestamp(bkk(2026, 8, 20), now)).toBe("20 ก.ย.");
  });
});

describe("noOrphan", () => {
  it("glues a short last word to the previous one", () => {
    expect(noOrphan("คลาส Reading Advantage 1")).toBe("คลาส Reading Advantage\u00A01");
    expect(noOrphan("Book A1")).toBe("Book\u00A0A1");
  });

  it("leaves long last words, single words and empty text unchanged", () => {
    expect(noOrphan("คลาส Reading Advantage")).toBe("คลาส Reading Advantage");
    expect(noOrphan("Reading")).toBe("Reading");
    expect(noOrphan("")).toBe("");
  });
});

describe("keepTimesTogether", () => {
  it("glues time ranges and the น. unit with non-breaking spaces", () => {
    expect(keepTimesTogether("ทุกวันจันทร์ และ พฤหัสบดี 18:00 - 19:30")).toBe(
      "ทุกวันจันทร์ และ พฤหัสบดี 18:00\u00A0-\u2060\u00A019:30",
    );
    expect(keepTimesTogether("เวลา 10:00 น.")).toBe("เวลา 10:00\u00A0น.");
    expect(keepTimesTogether("9.00-10.30 น.")).toBe("9.00\u00A0-\u2060\u00A010.30\u00A0น.");
    // An en dash gets the same joiner.
    expect(keepTimesTogether("18:00 – 19:30 น.")).toBe("18:00\u00A0–\u2060\u00A019:30\u00A0น.");
  });

  it("returns empty text for nullish input and leaves other text alone", () => {
    expect(keepTimesTogether(undefined)).toBe("");
    expect(keepTimesTogether("ตามนัดหมาย")).toBe("ตามนัดหมาย");
  });
});
