/**
 * Thai display formatting (money, dates, times) with cached Intl instances.
 *
 * - Locale is th-TH, so dates use the Buddhist-era year (2569 = 2026 CE), the
 *   same as the existing toLocaleDateString("th-TH") calls in the pages.
 * - Times are 24-hour ("14:30"), which Thai students read naturally.
 * - The time zone is fixed to Asia/Bangkok (UTC+7, no DST), like the tutor and
 *   admin apps: a server timestamp reads the same on every device. A
 *   device-local calendar day (a schedule grid cell, a "yyyy-MM-dd" day built
 *   with new Date(y, m, d)) must go through localDayToBangkokNoon() before it
 *   is formatted, or a device east of UTC+7 shows the day before.
 * - Invalid input never throws: dates return "" and money returns "–".
 *
 * Card-number/expiry input masks live in src/lib/paymentFlow.ts
 * (formatCardNumber, formatCardExpiry).
 */

const LOCALE = "th-TH";
export const APP_TIME_ZONE = "Asia/Bangkok";
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

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
    formatter = new Intl.DateTimeFormat(LOCALE, { timeZone: APP_TIME_ZONE, ...options });
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

/**
 * Non-breaking space. Use it between a number and its unit ("10:00 น.",
 * "5 บท") so a line never wraps leaving the unit alone on the next line.
 */
export const NBSP = "\u00A0";

/** Word joiner (U+2060): invisible, zero width, forbids a line break on both sides. */
export const WORD_JOINER = "\u2060";

/**
 * Glues a short last word (≤ `maxTail` characters, e.g. the "1" in
 * "คลาส Reading Advantage 1") to the word before it with a non-breaking space,
 * so titles never end with a one-character orphan line. Other text is unchanged.
 */
export function noOrphan(text: string | null | undefined, maxTail = 3): string {
  if (!text) return "";
  const trimmed = text.trimEnd();
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace <= 0) return text;
  const tail = trimmed.slice(lastSpace + 1);
  if (tail.length === 0 || tail.length > maxTail) return text;
  return `${trimmed.slice(0, lastSpace)}${NBSP}${tail}`;
}

/**
 * Keeps times in free text (e.g. a server schedule "จันทร์ 18:00 - 19:30 น.")
 * on one line: the spaces around a dash between two times and before "น."
 * become non-breaking. Other spaces are left alone so the text still wraps.
 * A word joiner follows the dash: line breaking still allows a break between
 * a hyphen or an en dash and a no-break space after it (UAX #14 LB12a), so
 * without it "18:00 -" / "19:30 น." could split on a narrow phone.
 */
export function keepTimesTogether(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/(\d{1,2}[:.]\d{2})\s*([-–])\s*(?=\d{1,2}[:.]\d{2})/g, `$1${NBSP}$2${WORD_JOINER}${NBSP}`)
    .replace(/(\d)\s+(น\.)/g, `$1${NBSP}$2`);
}

/** 24-hour time, e.g. "14:30" or "14:30 น." (non-breaking space) with `{ suffix: true }`. Returns "" for invalid input. */
export function formatThaiTime(input: DateInput, options: { suffix?: boolean } = {}): string {
  const date = toDate(input);
  if (!date) return "";
  const time = dateFormat({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  return options.suffix ? `${time}${NBSP}น.` : time;
}

/** Month and Buddhist-era year, e.g. "ตุลาคม 2569" (calendar headers). */
export function formatThaiMonthYear(input: DateInput): string {
  const date = toDate(input);
  return date ? dateFormat({ month: "long", year: "numeric" }).format(date) : "";
}

/** Calendar parts of a date in Bangkok time (month is 0-based like Date). */
function bangkokParts(date: Date): { year: number; month: number; day: number } {
  const shifted = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}

/**
 * Bangkok calendar-day key "YYYY-MM-DD" (Gregorian) of a server timestamp.
 * Use for grouping and comparing days (chat and ticket separators, history
 * groups), never for display. Returns "" for invalid input.
 */
export function toDateKey(input: DateInput | null | undefined): string {
  const date = toDate(input);
  if (!date) return "";
  const { year, month, day } = bangkokParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * A device-local calendar day (new Date(y, m, d), a schedule grid cell) → noon
 * of the same calendar day in Bangkok, ready for the formatters above. They
 * read the Bangkok day, and a device-local midnight is still the day before in
 * Bangkok on a device east of UTC+7.
 */
export function localDayToBangkokNoon(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 5));
}

/**
 * Local calendar-day key "YYYY-MM-DD" (Gregorian, device time zone).
 * Only for the schedule calendar grid, whose cells and "today" are device-local
 * days; never for display. A server timestamp is grouped with toDateKey()
 * (Bangkok day) instead: do not compare the two kinds of key with each other.
 */
export function toLocalDateKey(input: DateInput): string {
  const date = toDate(input);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Days since the epoch of the Bangkok calendar day a moment falls on. */
function dayNumber(date: Date): number {
  return Math.floor((date.getTime() + BANGKOK_OFFSET_MS) / DAY_MS);
}

/** Whole Bangkok calendar days from `now` to `date` (0 = today, 1 = tomorrow). */
function dayOffset(date: Date, now: Date): number {
  return dayNumber(date) - dayNumber(now);
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
  return formatThaiDate(date, bangkokParts(date).year === bangkokParts(now).year ? "short" : "medium");
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
  return formatThaiDate(date, bangkokParts(date).year === bangkokParts(now).year ? "short" : "medium");
}
