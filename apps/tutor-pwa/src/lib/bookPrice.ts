/**
 * The package price a tutor types when opening the next book: baht in the
 * field, integer satang on the wire (POST book-cycles, packagePriceSatang).
 * Pure, no imports, unit-tested in bookPrice.test.ts.
 *
 * The limits mirror learning-service classController.ts: MAX_PACKAGE_PRICE_SATANG
 * (1,000,000 satang = 10,000 baht), any integer from 1 satang up, and the
 * server's default of 300000 satang (3,000 baht) when no price is sent.
 */

/** Highest price the server accepts, in satang (10,000 baht). */
export const BOOK_PRICE_MAX_SATANG = 1_000_000;

/** What the field starts with: the server's default price, in baht. */
export const DEFAULT_BOOK_PRICE_BAHT = "3,000";

const THAI_DIGIT = /[๐-๙]/g;
/** Grouped ("1,500") or plain ("1500") whole baht, then at most two decimals. */
const BAHT_PATTERN = /^(\d{1,3}(,\d{3})+|\d{1,7})(\.\d{1,2})?$/;

/**
 * Baht text → integer satang, or null when the text is not a price the server
 * accepts. Thai digits are read as digits; spaces and the baht sign are
 * ignored. Stricter than a plain Number(): "1,5", "3,", "1e3", "-1500" and
 * anything above 10,000 baht or not above 0 are rejected.
 */
export function parseBookPriceBaht(input: string): number | null {
  const ascii = input.replace(THAI_DIGIT, (digit) => String(digit.charCodeAt(0) - 0x0e50));
  const cleaned = ascii.replace(/[\s฿]/g, "");
  if (!BAHT_PATTERN.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.replace(/,/g, "").split(".");
  const satang = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return satang >= 1 && satang <= BOOK_PRICE_MAX_SATANG ? satang : null;
}

/**
 * The body of the open-book request (book id + integer satang), or null when
 * no book is chosen or the price text does not parse; null means nothing is sent.
 */
export function buildOpenBookRequest(
  bookId: string,
  priceBaht: string,
): { bookId: string; packagePriceSatang: number } | null {
  const packagePriceSatang = parseBookPriceBaht(priceBaht);
  if (!bookId || packagePriceSatang === null) return null;
  return { bookId, packagePriceSatang };
}
