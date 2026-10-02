/**
 * Thai display formatting for the admin console (money, numbers, dates,
 * times, settlement periods). Ported from apps/tutor-pwa/src/lib/format.ts
 * plus admin helpers at the end (Bangkok period months, short ids).
 * Same output conventions as apps/student-liff/src/lib/format.ts:
 *
 * - Locale th-TH: dates use the Buddhist-era year ("2 ต.ค. 2569" = 2026 CE).
 *   Use these helpers instead of date-fns `format()` / toLocaleDateString so
 *   every screen shows the same BE year (classes/new used to show CE).
 * - Times are 24-hour ("14:30", or "14:30 น." with `suffix`).
 * - Time zone is fixed to Asia/Bangkok (UTC+7, no DST). Server components run
 *   in UTC on Cloud Run, so relying on the device/server zone would show
 *   different times in RSC and client components. Storage stays ISO/UTC.
 * - Invalid input never throws: dates return "" and numbers/money return "–".
 * - Formatters are cached Intl instances (cheap to call in lists).
 */

const LOCALE = "th-TH";
export const APP_TIME_ZONE = "Asia/Bangkok";
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

export type DateInput = Date | string | number;

/** Placeholder for missing/invalid numeric values. */
export const PLACEHOLDER = "–";

/**
 * Non-breaking space. Use it between a number and its unit ("10:00 น.",
 * "5 บท") so a line never wraps leaving the unit alone on the next line.
 */
export const NBSP = " ";

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

// ─── Numbers & money ────────────────────────────────────────────────────────

/** Grouped number, e.g. 12500 → "12,500". `fractionDigits` defaults to 0–2 as needed. */
export function formatNumber(value: number | null | undefined, fractionDigits?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return PLACEHOLDER;
  const options: Intl.NumberFormatOptions =
    fractionDigits === undefined
      ? { maximumFractionDigits: 2 }
      : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits };
  return numberFormat(options).format(value);
}

/** Compact number for stat tiles, e.g. 1250 → "1.3K", 2_400_000 → "2.4M". */
export function formatCompactNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return PLACEHOLDER;
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/**
 * Percentage. Pass a ratio (0.25 → "25%") by default, or `{ isRatio: false }`
 * for a value that is already a percentage (25 → "25%").
 */
export function formatPercent(
  value: number | null | undefined,
  { isRatio = true, fractionDigits = 0 }: { isRatio?: boolean; fractionDigits?: number } = {},
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return PLACEHOLDER;
  const ratio = isRatio ? value : value / 100;
  return numberFormat({
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(ratio);
}

export interface MoneyFormatOptions {
  /**
   * - "symbol" (default): "฿1,500"
   * - "word": "1,500 บาท"
   * - "code": "THB 1,500"
   */
  display?: "symbol" | "word" | "code";
  /** Fraction digits. "auto" (default) shows 2 decimals only when there are satang. */
  fractionDigits?: 0 | 2 | "auto";
  /** Prefix positive amounts with "+" (earnings deltas). Default false. */
  signed?: boolean;
}

/** Format an amount in baht, e.g. formatTHB(1500) → "฿1,500", formatTHB(99.5) → "฿99.50". */
export function formatTHB(amountBaht: number | null | undefined, options: MoneyFormatOptions = {}): string {
  if (typeof amountBaht !== "number" || !Number.isFinite(amountBaht)) return PLACEHOLDER;
  const { display = "symbol", fractionDigits = "auto", signed = false } = options;

  const absolute = Math.abs(amountBaht);
  const digits =
    fractionDigits === "auto" ? (Math.round(absolute * 100) % 100 === 0 ? 0 : 2) : fractionDigits;
  const number = numberFormat({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(absolute);
  const roundsToZero = Math.round(absolute * 10 ** digits) === 0;
  // No "-฿0" when a tiny negative rounds to zero.
  const sign = amountBaht < 0 && !roundsToZero ? "-" : signed && amountBaht > 0 && !roundsToZero ? "+" : "";

  if (display === "word") return `${sign}${number}${NBSP}บาท`;
  if (display === "code") return `${sign}THB${NBSP}${number}`;
  return `${sign}฿${number}`;
}

/** Format an amount in satang (minor units), e.g. 150000 → "฿1,500". */
export function formatSatang(amountSatang: number | null | undefined, options: MoneyFormatOptions = {}): string {
  if (typeof amountSatang !== "number" || !Number.isFinite(amountSatang)) return PLACEHOLDER;
  return formatTHB(amountSatang / 100, options);
}

// ─── Dates & times ──────────────────────────────────────────────────────────

export type ThaiDateStyle = "short" | "medium" | "long" | "full" | "weekdayShort";

const DATE_STYLE_OPTIONS: Record<ThaiDateStyle, Intl.DateTimeFormatOptions> = {
  /** "2 ต.ค." */
  short: { day: "numeric", month: "short" },
  /** "2 ต.ค. 2569" */
  medium: { day: "numeric", month: "short", year: "numeric" },
  /** "2 ตุลาคม 2569" */
  long: { day: "numeric", month: "long", year: "numeric" },
  /** "วันศุกร์ที่ 2 ตุลาคม 2569" */
  full: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  /** "ศ. 2 ต.ค." */
  weekdayShort: { weekday: "short", day: "numeric", month: "short" },
};

/** Thai date, e.g. "2 ต.ค. 2569" (medium, default). Returns "" for invalid input. */
export function formatThaiDate(input: DateInput | null | undefined, style: ThaiDateStyle = "medium"): string {
  const date = toDate(input);
  return date ? dateFormat(DATE_STYLE_OPTIONS[style]).format(date) : "";
}

/** 24-hour time, e.g. "14:30" or "14:30 น." with `{ suffix: true }`. Returns "" for invalid input. */
export function formatThaiTime(input: DateInput | null | undefined, options: { suffix?: boolean } = {}): string {
  const date = toDate(input);
  if (!date) return "";
  const time = dateFormat({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  return options.suffix ? `${time}${NBSP}น.` : time;
}

/** Date + time, e.g. "2 ต.ค. 2569 14:30 น." (style applies to the date part). */
export function formatThaiDateTime(input: DateInput | null | undefined, style: ThaiDateStyle = "medium"): string {
  const date = toDate(input);
  if (!date) return "";
  return `${formatThaiDate(date, style)} ${formatThaiTime(date, { suffix: true })}`;
}

/** Time range on one line, e.g. "18:00–19:30 น.". */
export function formatTimeRange(start: DateInput | null | undefined, end: DateInput | null | undefined): string {
  const from = formatThaiTime(start);
  const to = formatThaiTime(end);
  if (!from) return "";
  if (!to) return `${from}${NBSP}น.`;
  return `${from}–${to}${NBSP}น.`;
}

/** Month and Buddhist-era year, e.g. "ตุลาคม 2569" (calendar headers). */
export function formatThaiMonthYear(input: DateInput | null | undefined): string {
  const date = toDate(input);
  return date ? dateFormat({ month: "long", year: "numeric" }).format(date) : "";
}

/** Gregorian year → Buddhist-era year (2026 → 2569). */
export function toBuddhistYear(gregorianYear: number): number {
  return gregorianYear + 543;
}

/** Calendar parts of a date in Bangkok time (month is 0-based like Date). */
function bangkokParts(date: Date): { year: number; month: number; day: number } {
  const shifted = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}

/**
 * Bangkok calendar-day key "YYYY-MM-DD" (Gregorian). Use for grouping and
 * comparing days (schedule, chat separators), never for display.
 */
export function toDateKey(input: DateInput | null | undefined): string {
  const date = toDate(input);
  if (!date) return "";
  const { year, month, day } = bangkokParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dayNumber(date: Date): number {
  const { year, month, day } = bangkokParts(date);
  return Date.UTC(year, month, day) / DAY_MS;
}

/** Whole calendar days from `now` to `input` in Bangkok time (0 = today, 1 = tomorrow). */
export function dayOffset(input: DateInput, now: Date = new Date()): number {
  const date = toDate(input);
  if (!date) return Number.NaN;
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
export function formatRelativeDay(input: DateInput | null | undefined, now: Date = new Date()): string {
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
export function formatListTimestamp(input: DateInput | null | undefined, now: Date = new Date()): string {
  const date = toDate(input);
  if (!date) return "";
  const offset = dayOffset(date, now);
  if (offset === 0) return formatThaiTime(date);
  if (offset === -1) return RELATIVE_DAY_LABELS.yesterday;
  return formatThaiDate(date, bangkokParts(date).year === bangkokParts(now).year ? "short" : "medium");
}

/**
 * Glues a short last word (≤ `maxTail` characters) to the word before it with
 * a non-breaking space, so titles never end with a one-character orphan line.
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
 * Keeps times in free text (e.g. "จันทร์ 18:00 - 19:30 น.") on one line: the
 * spaces around a dash between two times and before "น." become non-breaking.
 */
export function keepTimesTogether(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/(\d{1,2}[:.]\d{2})\s*([-–])\s*(?=\d{1,2}[:.]\d{2})/g, `$1${NBSP}$2${NBSP}`)
    .replace(/(\d)\s+(น\.)/g, `$1${NBSP}$2`);
}

// ─── Admin helpers ──────────────────────────────────────────────────────────

/** "YYYY-MM" period key of a date in Bangkok time (settlement periods). */
export function toPeriodMonth(input: DateInput | null | undefined): string {
  const date = toDate(input);
  if (!date) return "";
  const { year, month } = bangkokParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Current Bangkok month as "YYYY-MM". */
export function currentBangkokMonth(now: Date = new Date()): string {
  return toPeriodMonth(now);
}

/**
 * Previous Bangkok month as "YYYY-MM" (default settlement period). Safe on the
 * 1st between 00:00–07:00 ICT and on the 29th–31st (fixes the setMonth(-1) +
 * toISOString bug, F-5).
 */
export function previousBangkokMonth(now: Date = new Date()): string {
  return shiftPeriodMonth(currentBangkokMonth(now), -1);
}

/** Add `delta` months to a "YYYY-MM" key. Returns "" for invalid input. */
export function shiftPeriodMonth(period: string, delta: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period ?? "");
  if (!match) return "";
  const index = Number(match[1]) * 12 + (Number(match[2]) - 1) + delta;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** "2026-08" → "สิงหาคม 2569" (or "ส.ค. 2569" with `short`). Returns the input when it is not a period. */
export function formatPeriodMonth(period: string | null | undefined, { short = false }: { short?: boolean } = {}): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period ?? "");
  if (!match) return period ?? "";
  // Mid-month noon UTC: the same calendar month in every time zone.
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 15, 12));
  return dateFormat({ month: short ? "short" : "long", year: "numeric" }).format(date);
}

/**
 * Short display form of an id: "5eed0000…0101". Use with a copy button
 * (IdCell); never show a full UUID as primary text.
 */
export function shortId(id: string | null | undefined, head = 8, tail = 4): string {
  if (!id) return PLACEHOLDER;
  return id.length > head + tail + 1 ? `${id.slice(0, head)}…${id.slice(-tail)}` : id;
}

/** Satang (minor units, number | bigint-as-string) → baht display. Accepts the API's string amounts. */
export function formatMinor(value: number | string | null | undefined, options: MoneyFormatOptions = {}): string {
  const n = typeof value === "string" ? Number(value) : value;
  return formatSatang(typeof n === "number" && Number.isFinite(n) ? n : null, options);
}
