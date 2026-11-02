import { describe, expect, it } from "vitest";
import { bookDisplayLabel, groupBooksByProgram } from "./book-options";

describe("book options", () => {
  it("drops the level suffix from Primary titles only", () => {
    expect(bookDisplayLabel({ bookCode: "Primary Origins 2", title: "Primary Origins 2 (A1)" })).toBe("Primary Origins 2");
    expect(bookDisplayLabel({ bookCode: "Reading 3.1", title: "Reading 3.1 (A2)" })).toBe("Reading 3.1 (A2)");
    expect(bookDisplayLabel({ bookCode: null, title: null })).toBe("");
  });

  it("groups the catalogue by programme", () => {
    const books = [
      { bookId: "1", bookCode: "Reading 3.1", title: "Reading 3.1" },
      { bookId: "2", bookCode: "Primary Origins 2", title: "Primary Origins 2 (A1)" },
    ];
    const grouped = groupBooksByProgram(books, "bookCode");
    expect(grouped.reading.map((book) => book.bookId)).toEqual(["1"]);
    expect(grouped.primary.map((book) => book.bookId)).toEqual(["2"]);
  });
});
