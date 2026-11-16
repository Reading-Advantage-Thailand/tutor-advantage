import { describe, expect, it } from "vitest";
import { BOOK_PRICE_MAX_SATANG, DEFAULT_BOOK_PRICE_BAHT, buildOpenBookRequest, parseBookPriceBaht } from "./bookPrice";

describe("parseBookPriceBaht", () => {
  it.each([
    ["3,000", 300000],
    ["3000", 300000],
    ["1,500", 150000],
    ["1500.50", 150050],
    ["1500.5", 150050],
    [" ฿1,500 ", 150000],
    ["๑,๕๐๐", 150000],
    ["๑๕๐๐.๕๐", 150050],
    ["0.01", 1],
    ["10,000", 1000000],
    ["10000.00", 1000000],
    // An inner space is stripped, like the admin money field.
    ["3 000", 300000],
    // Leading zeros and a one-digit decimal are still plain prices.
    ["007", 700],
    ["3,000.5", 300050],
    ["0,500", 50000],
  ])("reads %j as %i satang", (input, satang) => {
    expect(parseBookPriceBaht(input)).toBe(satang);
  });

  it.each([
    "",
    "   ",
    "-1500",
    "+1500",
    "0",
    "0.00",
    "1500.505",
    "1,5",
    "12,34",
    "3,",
    "3,000.",
    "1.500,50",
    "1e3",
    "abc",
    "1500บาท",
    "10,000.01",
    // The old satang default typed by habit.
    "300000",
    "300,000",
    "１５００",
    "NaN",
    "Infinity",
    // Malformed grouping or decimals.
    "1,0000",
    "10,0000",
    ",300",
    "3,,000",
    ".50",
    "3000.",
    "3.000",
    // A zero-width space is not stripped like an ordinary space.
    "3\u200b000",
    // Only ASCII and Thai digits are read.
    "\u0663\u0660\u0660\u0660",
  ])("rejects %j", (input) => {
    expect(parseBookPriceBaht(input)).toBeNull();
  });

  it("starts at the server's default price and stops at its maximum", () => {
    expect(parseBookPriceBaht(DEFAULT_BOOK_PRICE_BAHT)).toBe(300000);
    expect(BOOK_PRICE_MAX_SATANG).toBe(1_000_000);
  });

  it("round-trips every satang amount from 1 to the maximum", () => {
    // Each amount as grouped baht ("1,500.05"), plain baht ("1500.05") and,
    // for whole baht, without decimals ("1,500" and "1500").
    for (let satang = 1; satang <= BOOK_PRICE_MAX_SATANG; satang += 1) {
      const baht = Math.floor(satang / 100);
      const plain = String(baht);
      const grouped = baht >= 1000 ? `${plain.slice(0, -3)},${plain.slice(-3)}` : plain;
      const decimals = `.${String(satang % 100).padStart(2, "0")}`;
      const texts = [grouped + decimals, plain + decimals];
      if (satang % 100 === 0) texts.push(grouped, plain);
      for (const text of texts) {
        const parsed = parseBookPriceBaht(text);
        if (parsed !== satang || !Number.isInteger(parsed)) {
          expect({ text, parsed }).toEqual({ text, parsed: satang });
        }
      }
    }
  }, 30_000);
});

describe("buildOpenBookRequest", () => {
  it("sends the parsed price as integer satang", () => {
    expect(buildOpenBookRequest("book-1", "1,500")).toEqual({ bookId: "book-1", packagePriceSatang: 150000 });
    expect(buildOpenBookRequest("book-1", DEFAULT_BOOK_PRICE_BAHT)).toEqual({ bookId: "book-1", packagePriceSatang: 300000 });
  });

  it.each(["", "0", "300000", "1e3", "abc"])("sends nothing for the price %j", (price) => {
    expect(buildOpenBookRequest("book-1", price)).toBeNull();
  });

  it("sends nothing without a book", () => {
    expect(buildOpenBookRequest("", "3,000")).toBeNull();
  });
});
