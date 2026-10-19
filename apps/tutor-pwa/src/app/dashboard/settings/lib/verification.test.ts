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
  passportScanPatch,
  sanitizeDigitsAndDashes,
  isValidThaiId,
  stepCompletion,
  validateBankDraft,
  validateTaxInfoDraft,
  verificationSteps,
  type SettingsUser,
  type TaxInfoDraft,
} from "./verification";

const user: SettingsUser = {
  verificationStatus: "PENDING",
  settings: {
    address: "1 ถนนหลัก",
    taxName: "ครู ทดสอบ",
    nationalId: "1234567890121",
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
    expect(stepCompletion(user)).toEqual({ idCard: true, bankBook: true, address: true, taxInfo: true, workPermit: false });
    expect(stepCompletion({})).toEqual({ idCard: false, bankBook: false, address: false, taxInfo: false, workPermit: false });
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
  const thaiDraft: TaxInfoDraft = {
    idType: "THAI_ID",
    taxName: "ครู ทดสอบ",
    nationalId: "1234567890121",
    passportNumber: "",
    passportNationality: "",
    passportExpiresOn: "",
    teachingLocation: "",
    privacyNoticeAccepted: false,
    rightToWorkConfirmed: false,
  };
  const passportDraft: TaxInfoDraft = {
    ...thaiDraft,
    idType: "PASSPORT",
    taxName: "John Smith",
    nationalId: "",
    passportNumber: "AA1234567",
    passportNationality: "GB",
    passportExpiresOn: "2099-01-01",
    teachingLocation: "THAILAND",
    privacyNoticeAccepted: true,
    rightToWorkConfirmed: true,
  };

  it("requires a name and a Thai ID with a valid check digit", () => {
    expect(isValidThaiId("1-2345-67890-12-1")).toBe(true);
    expect(isValidThaiId("1234567890123")).toBe(false);
    expect(isTaxInfoValid("ครู", "1-2345-67890-12-1")).toBe(true);
    expect(isTaxInfoValid("ครู", "123")).toBe(false);
    expect(isTaxInfoValid(" ", "1234567890121")).toBe(false);
    expect(validateTaxInfoDraft({ ...thaiDraft, nationalId: "1234567890123" })).toBe("nationalIdInvalid");
    expect(isTaxInfoChanged(user, thaiDraft)).toBe(false);
    expect(isTaxInfoChanged(user, { ...thaiDraft, taxName: "ครู ใหม่" })).toBe(true);
    expect(isTaxInfoChanged(user, passportDraft)).toBe(true);
  });

  it("validates a passport draft field by field", () => {
    const now = new Date("2026-10-16T05:00:00Z");
    expect(validateTaxInfoDraft(passportDraft, now)).toBeNull();
    expect(validateTaxInfoDraft({ ...passportDraft, passportNumber: "A1" }, now)).toBe("passportNumberInvalid");
    expect(validateTaxInfoDraft({ ...passportDraft, passportNationality: "" }, now)).toBe("nationalityRequired");
    expect(validateTaxInfoDraft({ ...passportDraft, passportExpiresOn: "2026-10-16" }, now)).toBe("passportExpiryInvalid");
    expect(validateTaxInfoDraft({ ...passportDraft, teachingLocation: "" }, now)).toBe("teachingLocationRequired");
    expect(validateTaxInfoDraft({ ...passportDraft, privacyNoticeAccepted: false }, now)).toBe("privacyNoticeRequired");
    expect(validateTaxInfoDraft({ ...passportDraft, rightToWorkConfirmed: false }, now)).toBe("rightToWorkRequired");
  });

  it("lets a saved passport holder leave the number blank and keeps earlier consents", () => {
    const now = new Date("2026-10-16T05:00:00Z");
    const saved = { hasNumber: true, privacyAccepted: true, rightToWorkConfirmed: true };
    const edit = { ...passportDraft, passportNumber: "", privacyNoticeAccepted: false, rightToWorkConfirmed: false };
    expect(validateTaxInfoDraft(edit, now, saved)).toBeNull();
    expect(validateTaxInfoDraft(edit, now)).toBe("passportNumberInvalid");
    expect(validateTaxInfoDraft({ ...edit, passportNumber: "A1" }, now, saved)).toBe("passportNumberInvalid");
  });

  it("adds the work permit step only when the server says it is required", () => {
    expect(verificationSteps(user)).not.toContain("workPermit");
    expect(verificationSteps({ identity: { idType: "PASSPORT", workPermitRequired: true } })).toContain("workPermit");
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

describe("passportScanPatch", () => {
  const codes = ["GB", "US", "DE"];

  it("maps scanned values onto the passport form fields", () => {
    expect(
      passportScanPatch(
        {
          fields: { fullName: " JOHN  WILLIAM SMITH ", passportNumber: "5334 01372", nationality: "gb", expiresOn: "2032-09-30" },
          confirmed: ["passportNumber"],
        },
        codes,
      ),
    ).toEqual({
      patch: { taxName: "JOHN WILLIAM SMITH", passportNumber: "533401372", passportNationality: "GB", passportExpiresOn: "2032-09-30" },
      filled: ["fullName", "passportNumber", "nationality", "expiresOn"],
    });
  });

  it("skips values the form would not accept", () => {
    expect(
      passportScanPatch(
        { fields: { fullName: "  ", passportNumber: "12/45", nationality: "TH", expiresOn: "30/09/2032" }, confirmed: [] },
        codes,
      ),
    ).toEqual({ patch: {}, filled: [] });
  });

  it("still fills an expired date so the form can flag it", () => {
    expect(passportScanPatch({ fields: { expiresOn: "2020-01-01" }, confirmed: [] }, codes).patch).toEqual({
      passportExpiresOn: "2020-01-01",
    });
  });
});
