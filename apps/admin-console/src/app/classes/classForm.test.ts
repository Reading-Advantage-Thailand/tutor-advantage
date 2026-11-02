import { describe, expect, it } from "vitest";
import {
  EMPTY_CLASS_FORM,
  bookLabel,
  discountCodeCreateHref,
  groupBooksByProgram,
  validateCreateClassForm,
} from "./classForm";

const messages = {
  emailInvalid: "email",
  displayNameInvalid: "name",
  titleInvalid: "title",
  bookRequired: "book",
  priceInvalid: "price",
  capacityInvalid: "capacity",
};
const valid = {
  ...EMPTY_CLASS_FORM,
  tutorEmail: "  Kasamphon63@Gmail.com ",
  tutorDisplayName: " T.นกเอี้ยง ",
  title: " English ",
  bookId: "5eed0000-0000-4000-8000-0000000b0001",
};

describe("validateCreateClassForm", () => {
  it("builds the body with the defaults (3,000 THB, 30 seats) and a lower-cased email", () => {
    expect(validateCreateClassForm(valid, messages)).toEqual({
      errors: {},
      body: {
        tutorEmail: "kasamphon63@gmail.com",
        tutorDisplayName: "T.นกเอี้ยง",
        title: "English",
        bookId: "5eed0000-0000-4000-8000-0000000b0001",
        capacity: 30,
        packagePriceSatang: 300_000,
      },
    });
  });

  it("parses the price in baht exactly", () => {
    expect(validateCreateClassForm({ ...valid, price: "2,500.50" }, messages).body?.packagePriceSatang).toBe(250_050);
    expect(validateCreateClassForm({ ...valid, price: "10,000" }, messages).body?.packagePriceSatang).toBe(1_000_000);
  });

  it("rejects what the API would reject", () => {
    const result = validateCreateClassForm(
      { tutorEmail: "not-an-email", tutorDisplayName: "  ", title: "x".repeat(121), bookId: "", price: "0", capacity: "1.5" },
      messages,
    );
    expect(result.body).toBeNull();
    expect(result.errors).toEqual({
      tutorEmail: "email",
      tutorDisplayName: "name",
      title: "title",
      bookId: "book",
      price: "price",
      capacity: "capacity",
    });
  });

  it("enforces the price and seat limits", () => {
    expect(validateCreateClassForm({ ...valid, price: "10,000.01" }, messages).errors.price).toBe("price");
    expect(validateCreateClassForm({ ...valid, price: "abc" }, messages).errors.price).toBe("price");
    for (const capacity of ["0", "101", "", "-1"]) {
      expect(validateCreateClassForm({ ...valid, capacity }, messages).errors.capacity, capacity).toBe("capacity");
    }
    expect(validateCreateClassForm({ ...valid, capacity: "100" }, messages).body?.capacity).toBe(100);
    expect(validateCreateClassForm({ ...valid, tutorDisplayName: "ก".repeat(101) }, messages).errors.tutorDisplayName).toBe("name");
  });
});

describe("book labels", () => {
  it("shows the code, plus the title when it differs, without the CEFR suffix", () => {
    expect(bookLabel({ bookId: "b1", bookCode: "Primary Origins 2", title: "Primary Origins 2 (A1)" })).toBe("Primary Origins 2");
    expect(bookLabel({ bookId: "b2", bookCode: "RA-3", title: "Reading Advantage 3" })).toBe("RA-3 · Reading Advantage 3");
    expect(bookLabel({ bookId: "b3", bookCode: null, title: null })).toBe("b3");
  });

  it("groups books by programme", () => {
    const books = [
      { bookId: "a", bookCode: "Primary Origins 2" },
      { bookId: "b", bookCode: "Reading Advantage 1" },
    ];
    expect(groupBooksByProgram(books)).toEqual({ reading: [books[1]], primary: [books[0]] });
  });
});

describe("discountCodeCreateHref", () => {
  it("opens the discount code sheet with the class preselected", () => {
    expect(discountCodeCreateHref("5eed0000-0000-4000-8000-00000000c1a5")).toBe(
      "/discount-codes?create=1&classId=5eed0000-0000-4000-8000-00000000c1a5",
    );
  });
});
