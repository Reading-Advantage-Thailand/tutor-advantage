/**
 * Pure builders for handing out a batch of single-use discount codes: the
 * "copy all" text (one numbered line per code) and a CSV the admin fills in
 * with the student each code was sent to. Labels and the per-code message
 * come from the caller, so this module stays free of i18n.
 * Relative imports only so vitest (whose "@" alias points elsewhere) can test it.
 */
import { toDateKey } from "../../lib/format";

/** Excel needs the BOM to open UTF-8 (Thai) CSV correctly. Escaped: an invisible literal is easy to lose. */
export const CSV_BOM = "\uFEFF";
export const CSV_MIME = "text/csv;charset=utf-8";

export interface CodesCsvHeaders {
  index: string;
  code: string;
  sentTo: string;
  message: string;
}

export interface CodesCsvRow {
  code: string;
  /** Message to send the student with this code. */
  message: string;
}

/** "1. DC-ABCD-EFGH" per line, in the order given. */
export function buildCodesText(codes: readonly string[]): string {
  return codes.map((code, index) => `${index + 1}. ${code}`).join("\n");
}

/**
 * One CSV cell (RFC 4180): quoted when it holds a comma, a quote or a line
 * break. Text that a spreadsheet would run as a formula (= + - @ or a leading
 * tab/CR) gets a leading apostrophe.
 */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * UTF-8 CSV (with BOM, CRLF rows): ลำดับ, โค้ด, ส่งให้ (left blank for the
 * admin), message. Rows keep the order given (the API's batch order).
 */
export function buildCodesCsv(rows: readonly CodesCsvRow[], headers: CodesCsvHeaders): string {
  const lines = [
    [headers.index, headers.code, headers.sentTo, headers.message],
    ...rows.map((row, index) => [index + 1, row.code, "", row.message]),
  ];
  return `${CSV_BOM}${lines.map((cells) => cells.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

/** "discount-codes-2026-11-02.csv" (Bangkok date). */
export function codesCsvFilename(now: Date = new Date()): string {
  return `discount-codes-${toDateKey(now)}.csv`;
}
