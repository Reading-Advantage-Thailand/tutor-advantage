/**
 * Thai display formatting (money, dates, times) with cached Intl instances.
 *
 * - Locale is th-TH, so dates use the Buddhist-era year (2569 = 2026 CE), the
 *   same as the existing toLocaleDateString("th-TH") calls in the pages.
 * - Times are 24-hour ("14:30"), which Thai students read naturally.
 * - Everything uses the device time zone (like the code it replaces).
 * - Invalid input never throws: dates return "" and money returns "–".
 *
 * Card-number/expiry input masks live in src/lib/paymentFlow.ts
 * (formatCardNumber, formatCardExpiry).
 */

const LOCALE = "th-TH";

export type DateInput = Date | string | number;

const numberFormatCache = new Map<string, Intl.NumberFormat>();
const dateFormatCache = new Map<string, Intl.DateTimeFormat>();

function numberFormat(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const cacheKey = JSON.stringify(options);
  let formatter = numberFormatCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, options);
    numberFormatCache.set(cacheKey, formatter);
  }
  return formatter;
}

function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const cacheKey = JSON.stringify(options);
  let formatter = dateFormatCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(LOCALE, options);
    dateFormatCache.set(cacheKey, formatter);
  }
  return formatter;
}

/** Parse a Date | ISO string | epoch ms into a valid Date, or null. */
export function toDate(input: DateInput | null | undefined): Date | null {
  if (input === null || input === undefined || input === "") return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ─── Money ──────────────────────────────────────────────────────────────────

export interface MoneyFormatOptions {
  /**
   * - "symbol" (default): "฿1,500"
   * - "word": "1,500 บาท" (friendliest for younger students)
   * - "code": "THB 1,500" (matches the current payment screens)
   */
  display?: "symbol" | "word" | "code";
  /** Fraction digits. "auto" (default) shows 2 decimals only when there are satang. */
  fractionDigits?: 0 | 2 | "auto";
}

const MONEY_PLACEHOLDER = "–";

/** Format an amount in baht, e.g. formatTHB(1500) → "฿1,500", formatTHB(99.5) → "฿99.50". */
export function formatTHB(amountBaht: number, options: MoneyFormatOptions = {}): string {
  if (typeof amountBaht !== "number" || !Number.isFinite(amountBaht)) return MONEY_PLACEHOLDER;
  const { display = "symbol", fractionDigits = "auto" } = options;

  const absolute = Math.abs(amountBaht);
  const digits =
    fractionDigits === "auto"
      ? Math.round(absolute * 100) % 100 === 0
        ? 0
        : 2
      : fractionDigits;
  const number = numberFormat({
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(absolute);
  // No "-฿0" when a tiny negative rounds to zero.
  const sign = amountBaht < 0 && Math.round(absolute * 10 ** digits) !== 0 ? "-" : "";

  if (display === "word") return `${sign}${number} บาท`;
  if (display === "code") return `${sign}THB ${number}`;
  return `${sign}฿${number}`;
}

/** Format an amount in satang (minor units, as the payment APIs return), e.g. 150000 → "฿1,500". */
export function formatSatang(amountSatang: number, options: MoneyFormatOptions = {}): string {
  if (typeof amountSatang !== "number" || !Number.isFinite(amountSatang)) return MONEY_PLACEHOLDER;
  return formatTHB(amountSatang / 100, options);
}

// ─── Dates & times ──────────────────────────────────────────────────────────

export type ThaiDateStyle = "short" | "medium" | "long" | "full";

const DATE_STYLE_OPTIONS: Record<ThaiDateStyle, Intl.DateTimeFormatOptions> = {
  /** "2 ต.ค." */
  short: { day: "numeric", month: "short" },
  /** "2 ต.ค. 2569" */
  medium: { day: "numeric", month: "short", year: "numeric" },
  /** "2 ตุลาคม 2569" */
  long: { day: "numeric", month: "long", year: "numeric" },
  /** "วันศุกร์ที่ 2 ตุลาคม 2569" */
  full: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
};

/** Thai date, e.g. "2 ต.ค. 2569" (medium, default). Returns "" for invalid input. */
export function formatThaiDate(input: DateInput, style: ThaiDateStyle = "medium"): string {
  const date = toDate(input);
  return date ? dateFormat(DATE_STYLE_OPTIONS[style]).format(date) : "";
}

/** 24-hour time, e.g. "14:30" or "14:30 น." with `{ suffix: true }`. Returns "" for invalid input. */
export function formatThaiTime(input: DateInput, options: { suffix?: boolean } = {}): string {
  const date = toDate(input);
  if (!date) return "";
  const time = dateFormat({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  return options.suffix ? `${time} น.` : time;
}

/** Month and Buddhist-era year, e.g. "ตุลาคม 2569" (calendar headers). */
export function formatThaiMonthYear(input: DateInput): string {
  const date = toDate(input);
  return date ? dateFormat({ month: "long", year: "numeric" }).format(date) : "";
}

/**
 * Local calendar-day key "YYYY-MM-DD" (Gregorian, device time zone).
 * Use for grouping and comparing days, never for display.
 */
export function toLocalDateKey(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayOffset(date: Date, now: Date): number {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOf(date) - startOf(now)) / 86_400_000);
}

/** Labels used by formatRelativeDay. */
export const RELATIVE_DAY_LABELS = {
  today: "วันนี้",
  yesterday: "เมื่อวาน",
  tomorrow: "พรุ่งนี้",
} as const;

/**
 * "วันนี้" / "เมื่อวาน" / "พรุ่งนี้", otherwise a date: "2 ต.ค." in the current
 * year, "2 ต.ค. 2568" for other years. Good for list section headers.
 */
export function formatRelativeDay(input: DateInput, now: Date = new Date()): string {
  const date = toDate(input);
  if (!date) return "";
  const offset = dayOffset(date, now);
  if (offset === 0) return RELATIVE_DAY_LABELS.today;
  if (offset === -1) return RELATIVE_DAY_LABELS.yesterday;
  if (offset === 1) return RELATIVE_DAY_LABELS.tomorrow;
  return formatThaiDate(date, date.getFullYear() === now.getFullYear() ? "short" : "medium");
}

/**
 * Compact timestamp for list rows (chat list, notifications): "14:30" today,
 * "เมื่อวาน" yesterday, otherwise "2 ต.ค." / "2 ต.ค. 2568".
 */
export function formatListTimestamp(input: DateInput, now: Date = new Date()): string {
  const date = toDate(input);
  if (!date) return "";
  const offset = dayOffset(date, now);
  if (offset === 0) return formatThaiTime(date);
  if (offset === -1) return RELATIVE_DAY_LABELS.yesterday;
  return formatThaiDate(date, date.getFullYear() === now.getFullYear() ? "short" : "medium");
}
