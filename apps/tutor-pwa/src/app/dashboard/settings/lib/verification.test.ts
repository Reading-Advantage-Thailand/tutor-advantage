import { describe, expect, it } from "vitest";
import {
  bankBrandLabel,
  canSubmitAddress,
  digitsOnly,
  getFieldStatus,
  getRejectionComment,
  isPdfFile,
  isPdfUrl,
  isTaxInfoChanged,
  isTaxInfoValid,
  sanitizeDigitsAndDashes,
  stepCompletion,
  validateBankDraft,
  type SettingsUser,
} from "./verification";

const user: SettingsUser = {
  verificationStatus: "PENDING",
  settings: {
    address: "1 ถนนหลัก",
    taxName: "ครู ทดสอบ",
    nationalId: "1234567890123",
    verification: {
      idCard: { status: "VERIFIED" },
      bankBook: { status: "REJECTED", comment: "ภาพไม่ชัด" },
      address: { status: "PENDING", comment: "ignored" },
    },
  },
};

const file = (name = "a.png", type = "image/png") => new File(["x"], name, { type });

describe("field status", () => {
  it("defaults to UNVERIFIED", () => {
    expect(getFieldStatus(user, "taxInfo")).toBe("UNVERIFIED");
    expect(getFieldStatus(null, "idCard")).toBe("UNVERIFIED");
    expect(getFieldStatus(user, "bankBook")).toBe("REJECTED");
  });
  it("returns a comment only for rejected fields", () => {
    expect(getRejectionComment(user, "bankBook")).toBe("ภาพไม่ชัด");
    expect(getRejectionComment(user, "address")).toBe("");
  });
  it("computes step completion like the old progress bar", () => {
    expect(stepCompletion(user)).toEqual({ idCard: true, bankBook: true, address: true, taxInfo: true });
    expect(stepCompletion({})).toEqual({ idCard: false, bankBook: false, address: false, taxInfo: false });
  });
});

describe("validation", () => {
  it("validates the bank step in the original order", () => {
    expect(validateBankDraft({ file: null, accountNumber: "123", brand: "kbank" })).toBe("selectBankBookFile");
    expect(validateBankDraft({ file: file(), accountNumber: "--", brand: "kbank" })).toBe("bankAccountRequired");
    expect(validateBankDraft({ file: file(), accountNumber: "123-4", brand: "" })).toBe("bankBrandRequired");
    expect(validateBankDraft({ file: file(), accountNumber: "123-4", brand: "scb" })).toBeNull();
  });
  it("requires a changed, non-empty address", () => {
    expect(canSubmitAddress("  ", "")).toBe(false);
    expect(canSubmitAddress("1 ถนนหลัก", "1 ถนนหลัก")).toBe(false);
    expect(canSubmitAddress("2 ถนนรอง", "1 ถนนหลัก")).toBe(true);
  });
  it("requires a name and 13 digits for tax info", () => {
    expect(isTaxInfoValid("ครู", "1-2345-67890-12-3")).toBe(true);
    expect(isTaxInfoValid("ครู", "123")).toBe(false);
    expect(isTaxInfoValid(" ", "1234567890123")).toBe(false);
    expect(isTaxInfoChanged(user, "ครู ทดสอบ", "1234567890123")).toBe(false);
    expect(isTaxInfoChanged(user, "ครู ใหม่", "1234567890123")).toBe(true);
  });
  it("filters digits", () => {
    expect(digitsOnly("12-3a")).toBe("123");
    expect(sanitizeDigitsAndDashes("12-3a ")).toBe("12-3");
  });
});

describe("misc", () => {
  it("labels banks", () => {
    expect(bankBrandLabel("kbank")).toBe("กสิกรไทย (KBank)");
    expect(bankBrandLabel("other")).toBe("other");
    expect(bankBrandLabel(undefined)).toBe("");
  });
  it("detects PDFs", () => {
    expect(isPdfFile(file("doc.PDF", ""))).toBe(true);
    expect(isPdfFile(file())).toBe(false);
    expect(isPdfUrl("https://x/y/id.pdf?sig=1")).toBe(true);
    expect(isPdfUrl("blob:abc")).toBe(false);
  });
});
