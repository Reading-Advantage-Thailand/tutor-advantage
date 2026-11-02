/** Book from GET /v1/books. */
export type BookOption = {
  bookId: string;
  bookCode?: string;
  title?: string;
};

export function isPrimaryBook(book: Pick<BookOption, "bookCode" | "title">, field: "bookCode" | "either" = "either") {
  const value = field === "bookCode" ? book.bookCode : book.bookCode || book.title;
  return String(value || "").startsWith("Primary ");
}

/** Book name for pickers: Primary titles drop their "(A1)" level suffix. */
export function bookDisplayLabel(book: { bookCode?: string | null; title?: string | null }): string {
  return String(book.bookCode || "").startsWith("Primary ")
    ? String(book.title || "").replace(/\s*\([A-C]\d\)$/i, "")
    : book.title || "";
}

/** Splits the catalogue into the two programmes (Reading / Primary Advantage). */
export function groupBooksByProgram<T extends BookOption>(books: T[], field: "bookCode" | "either" = "either") {
  return {
    reading: books.filter((book) => !isPrimaryBook(book, field)),
    primary: books.filter((book) => isPrimaryBook(book, field)),
  };
}
